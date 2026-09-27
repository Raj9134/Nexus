import { act, render, renderHook, waitFor as waitForHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CallProvider, useCall } from "@/context/CallContext";

/**
 * The signalling contract with server.js.
 *
 * server.js validates every signalling payload with readText, which rejects
 * anything that is not a string. The previous implementation sent
 * RTCSessionDescription and RTCIceCandidate objects, so the server answered
 * "Invalid WebRTC offer" and "Invalid ICE candidate" and no call could ever
 * connect. These tests assert the exact shapes, because a regression here
 * breaks calling silently: the UI renders, the request succeeds, and no audio
 * ever flows.
 */

const CALL_ID = "call-1";
const PEER_ID = "peer-1";

const emitted: Array<{ event: string; payload: Record<string, unknown> }> = [];
const handlers = new Map<string, (payload: unknown) => void | Promise<void>>();

vi.mock("@/services/socket", () => ({
  getSocket: () => ({ on: vi.fn(), off: vi.fn() }),
  joinChannel: vi.fn(),
  leaveChannel: vi.fn(),
  disconnectSocket: vi.fn(),
  emitCallEvent: (event: string, payload: Record<string, unknown>) => {
    emitted.push({ event, payload });
  },
  onSocketEvent: (event: string, handler: (payload: unknown) => void) => {
    handlers.set(event, handler);

    return () => handlers.delete(event);
  },
}));

const signIn = () => {
  window.localStorage.setItem("nexus.accessToken", "test-token");
  window.localStorage.setItem("nexus.refreshToken", "test-refresh");
};

class FakeTrack {
  enabled = true;
  stop() {}
}

class FakeStream {
  getAudioTracks() {
    return [new FakeTrack()];
  }

  getTracks() {
    return this.getAudioTracks();
  }
}

const SDP = "v=0\r\no=- 1 1 IN IP4 127.0.0.1\r\ns=-\r\n";

// Explicit parameter types: vi.fn() infers a zero-argument signature from the
// implementation, and the peer double forwards real arguments to these.
let createOffer = vi.fn(async (): Promise<{ type: string; sdp: string }> => ({
  type: "offer",
  sdp: SDP,
}));
let createAnswer = vi.fn(async (): Promise<{ type: string; sdp: string }> => ({
  type: "answer",
  sdp: SDP,
}));
let addIceCandidate = vi.fn(async (_candidate: unknown): Promise<void> => undefined);
let setRemoteDescription = vi.fn(async (_description: unknown): Promise<void> => undefined);

const makePeer = () => ({
  ontrack: null,
  onicecandidate: null,
  onconnectionstatechange: null,
  signalingState: "have-local-offer",
  connectionState: "new",
  addTrack: vi.fn(),
  createOffer: () => createOffer(),
  createAnswer: () => createAnswer(),
  setLocalDescription: vi.fn(async () => undefined),
  setRemoteDescription: (description: unknown) => setRemoteDescription(description),
  addIceCandidate: (candidate: unknown) => addIceCandidate(candidate),
  close: vi.fn(),
});

let peer: ReturnType<typeof makePeer>;

const CALL_RECORD = {
  id: CALL_ID,
  caller: { id: PEER_ID, name: "Priya", email: "priya@x.dev" },
  receiver: { id: "me", name: "Me", email: "me@x.dev" },
  status: "calling" as const,
  startedAt: null,
  endedAt: null,
  duration: 0,
  createdAt: null,
};

const mockApi = (overrides: Record<string, () => unknown> = {}) => {
  /*
    Route on the verb, because POST /api/calls creates and PUT
    /api/calls/:id/accept transitions, and both carry the same base path.
  */
  const routes: Record<string, () => unknown> = {
    ...overrides,
  };

  const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as Response;

  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      const path = url.replace(/^https?:\/\/[^/]+/, "");

      if (method === "POST" && path === "/api/calls") {
        return ok(routes["POST /api/calls"]?.() ?? { call: CALL_RECORD });
      }

      if (method === "PUT") {
        const override = routes[`PUT ${path}`];

        return ok(override?.() ?? { call: CALL_RECORD });
      }

      if (method === "GET") {
        const override = routes[`GET ${path}`];

        // GET /api/calls/:id is how an incoming call learns who is ringing.
        return ok(override?.() ?? { call: CALL_RECORD });
      }

      return ok({});
    }),
  );
};

const wrapper = ({ children }: { children: ReactNode }) => <CallProvider>{children}</CallProvider>;

const renderCall = () => renderHook(() => useCall(), { wrapper });

const fire = async (event: string, payload: unknown) => {
  const handler = handlers.get(event);

  if (!handler) {
    throw new Error(`no handler registered for ${event}`);
  }

  await act(async () => {
    await handler(payload);
  });
};

beforeEach(() => {
  emitted.length = 0;
  handlers.clear();
  signIn();

  peer = makePeer();
  createOffer = vi.fn(async () => ({ type: "offer", sdp: SDP }));
  createAnswer = vi.fn(async () => ({ type: "answer", sdp: SDP }));
  addIceCandidate = vi.fn(async () => undefined);
  setRemoteDescription = vi.fn(async () => undefined);

  vi.stubGlobal(
    "RTCPeerConnection",
    vi.fn(() => peer),
  );
  vi.stubGlobal("RTCSessionDescription", class {});
  vi.stubGlobal("RTCIceCandidate", class {});
  vi.stubGlobal("navigator", {
    ...window.navigator,
    mediaDevices: { getUserMedia: vi.fn(async () => new FakeStream()) },
  });

  mockApi();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("outbound signalling payloads", () => {
  it("sends only a callId when placing a call", async () => {
    const { result } = renderCall();

    await act(async () => {
      await result.current.startCall(PEER_ID, "Priya");
    });

    const callUser = emitted.find((entry) => entry.event === "callUser");

    expect(callUser).toBeDefined();
    expect(callUser?.payload).toEqual({ callId: expect.any(String) });

    // Identity comes from the authenticated socket, and the server resolves the
    // peer from the Call record, so identity fields in the payload are noise.
    expect(callUser?.payload).not.toHaveProperty("caller");
    expect(callUser?.payload).not.toHaveProperty("receiver");
  });

  it("sends the SDP as a string, not an RTCSessionDescription", async () => {
    const { result } = renderCall();

    await act(async () => {
      await result.current.startCall(PEER_ID, "Priya");
    });

    // The receiver accepts, so the caller starts negotiating.
    await fire("callAccepted", { callId: CALL_ID, receiver: PEER_ID });

    const offer = emitted.find((entry) => entry.event === "webrtcOffer");

    expect(offer).toBeDefined();
    expect(typeof offer?.payload["offer"]).toBe("string");
    expect(offer?.payload["offer"]).toBe(SDP);

    // The exact failure the server rejects with "Invalid WebRTC offer".
    expect(offer?.payload["offer"]).not.toBeInstanceOf(Object);
  });

  it("sends an ICE candidate as a string, not an RTCIceCandidate", async () => {
    const { result } = renderCall();

    await act(async () => {
      await result.current.startCall(PEER_ID, "Priya");
    });

    await fire("callAccepted", { callId: CALL_ID, receiver: PEER_ID });

    await act(async () => {
      (
        peer.onicecandidate as ((event: { candidate: { candidate: string } | null }) => void) | null
      )?.({
        candidate: { candidate: "candidate:1 1 udp" },
      });
    });

    const candidate = emitted.find((entry) => entry.event === "iceCandidate");

    expect(candidate).toBeDefined();
    expect(typeof candidate?.payload["candidate"]).toBe("string");
    expect(candidate?.payload["candidate"]).toBe("candidate:1 1 udp");
  });

  it("answers an offer with a string SDP", async () => {
    const { result } = renderCall();

    // We are the receiver: load the call, then take the incoming offer.
    await fire("incomingCall", { callId: CALL_ID, caller: "me", receiver: PEER_ID });

    await act(async () => {
      await result.current.acceptCall();
    });

    await fire("webrtcOffer", { callId: CALL_ID, caller: PEER_ID, receiver: "me", offer: SDP });

    const answer = emitted.find((entry) => entry.event === "webrtcAnswer");

    expect(answer).toBeDefined();
    expect(typeof answer?.payload["answer"]).toBe("string");
    expect(answer?.payload["answer"]).toBe(SDP);

    // And the offer we received is applied as a description, not as a string.
    expect(setRemoteDescription).toHaveBeenCalledWith({ type: "offer", sdp: SDP });
  });

  it("applies a received answer by sdp", async () => {
    const { result } = renderCall();

    await act(async () => {
      await result.current.startCall(PEER_ID, "Priya");
    });

    await fire("callAccepted", { callId: CALL_ID, receiver: PEER_ID });
    await fire("webrtcAnswer", { callId: CALL_ID, receiver: PEER_ID, answer: SDP });

    expect(setRemoteDescription).toHaveBeenCalledWith({ type: "answer", sdp: SDP });

    await waitForHook(() => expect(result.current.phase).toBe("active"));
  });

  it("applies a received candidate", async () => {
    const { result } = renderCall();

    await act(async () => {
      await result.current.startCall(PEER_ID, "Priya");
    });

    await fire("callAccepted", { callId: CALL_ID, receiver: PEER_ID });
    await fire("iceCandidate", { callId: CALL_ID, candidate: "candidate:2 1 udp" });

    expect(addIceCandidate).toHaveBeenCalledWith({ candidate: "candidate:2 1 udp" });
  });
});

describe("call state", () => {
  it("goes idle to calling when a call is placed", async () => {
    const { result } = renderCall();

    expect(result.current.phase).toBe("idle");

    await act(async () => {
      await result.current.startCall(PEER_ID, "Priya");
    });

    expect(result.current.phase).toBe("calling");
    expect(result.current.peerName).toBe("Priya");
  });

  it("surfaces an incoming call with the caller's name", async () => {
    const { result } = renderCall();

    await fire("incomingCall", { callId: CALL_ID, caller: "me", receiver: PEER_ID });

    expect(result.current.phase).toBe("incoming");
    await waitForHook(() => expect(result.current.peerName).toBe("Priya"));
  });

  it("returns to idle when the peer rejects", async () => {
    const { result } = renderCall();

    await act(async () => {
      await result.current.startCall(PEER_ID, "Priya");
    });

    await fire("callRejected", { callId: CALL_ID, receiver: PEER_ID });

    expect(result.current.phase).toBe("idle");
  });

  it("returns to idle when the peer hangs up", async () => {
    const { result } = renderCall();

    await act(async () => {
      await result.current.startCall(PEER_ID, "Priya");
    });

    await fire("callEnded", { callId: CALL_ID });

    expect(result.current.phase).toBe("idle");
  });

  it("reports a server error instead of pretending to be calling", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 500,
        json: async () => ({ message: "Server error" }),
      })) as never,
    );

    const { result } = renderCall();

    await act(async () => {
      await result.current.startCall(PEER_ID, "Priya");
    });

    // A failed start must not leave the UI waiting forever.
    expect(result.current.phase).toBe("idle");
    expect(result.current.error).toBeTruthy();
  });
});
