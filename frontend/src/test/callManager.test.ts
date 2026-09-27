import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  closeCall,
  createPeerConnection,
  getMicrophone,
  getPeerConnection,
  isMicrophoneMuted,
  toggleMicrophone,
} from "@/services/callManager";
import { rtcConfiguration } from "@/services/webrtc";

/**
 * WebRTC plumbing.
 *
 * The bug this pins down is the reason calling could never have worked. The
 * old implementation sent RTCSessionDescription and RTCIceCandidate objects
 * over the socket, but server.js validates the signalling payloads with
 * readText, which rejects anything that is not a string. Every offer came back
 * as "Invalid WebRTC offer" and every candidate as "Invalid ICE candidate", so
 * no call could ever connect. The payload shape is asserted in call-context
 * tests; this file covers the local side.
 */

class FakeTrack {
  enabled = true;
  stopped = false;

  stop() {
    this.stopped = true;
  }
}

class FakeStream {
  tracks = [new FakeTrack()];

  getAudioTracks() {
    return this.tracks;
  }

  /** closeCall stops every track, not only the audio ones. */
  getTracks() {
    return this.tracks;
  }
}

/** Records what was sent so the string-vs-object contract can be asserted. */
class FakePeer {
  sent: Array<Record<string, unknown>> = [];
  added: Array<Record<string, unknown>> = [];
  localDescription: unknown = null;
  remoteDescription: unknown = null;
  signalingState = "stable";
  connectionState = "new";

  ontrack: ((event: { streams: unknown[] }) => void) | null = null;
  onicecandidate: ((event: { candidate: { candidate: string } | null }) => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;

  addTrack() {
    return this;
  }

  async createOffer() {
    return { type: "offer", sdp: "v=0-o=-fake" };
  }

  async createAnswer() {
    return { type: "answer", sdp: "v=0-o=-fake" };
  }

  async setLocalDescription(description: unknown) {
    this.localDescription = description;
  }

  async setRemoteDescription(description: unknown) {
    this.remoteDescription = description;
  }

  async addIceCandidate(candidate: unknown) {
    this.added.push(candidate as Record<string, unknown>);
  }

  close() {
    this.connectionState = "closed";
  }
}

let peer: FakePeer;

const installWebRtc = () => {
  peer = new FakePeer();

  vi.stubGlobal(
    "RTCPeerConnection",
    vi.fn(function () {
      return peer;
    }),
  );

  vi.stubGlobal("navigator", {
    ...window.navigator,
    mediaDevices: {
      getUserMedia: vi.fn(async () => new FakeStream()),
    },
  });
};

beforeEach(() => {
  installWebRtc();
});

afterEach(() => {
  closeCall();
  vi.unstubAllGlobals();
});

describe("configuration", () => {
  it("always includes a STUN server", () => {
    const urls = rtcConfiguration.iceServers?.flatMap((server) =>
      Array.isArray(server.urls) ? server.urls : [server.urls],
    );

    expect(urls?.some((url) => url.startsWith("stun:"))).toBe(true);
  });
});

describe("peer connection lifecycle", () => {
  it("creates exactly one connection and hands it back", () => {
    const first = createPeerConnection();

    expect(first).toBe(peer as unknown as FakePeer);
    expect(getPeerConnection()).toBe(peer as unknown as FakePeer);
  });

  it("closes the previous connection before opening another", () => {
    createPeerConnection();
    const first = peer;

    installWebRtc();
    createPeerConnection();

    // A second call must not leave the first peer connection running.
    expect(first.connectionState).toBe("closed");
  });

  it("stops every microphone track on teardown", async () => {
    const stream = await getMicrophone();
    const tracks = stream.getAudioTracks() as unknown as FakeTrack[];

    createPeerConnection();
    closeCall();

    // The browser's recording indicator goes dark only if the tracks stop.
    expect(tracks.every((track) => track.stopped)).toBe(true);
    expect(getPeerConnection()).toBeNull();
  });

  it("is safe to close when nothing is open", () => {
    expect(() => closeCall()).not.toThrow();
  });
});

describe("microphone", () => {
  it("requests access once and reuses the stream", async () => {
    await getMicrophone();
    await getMicrophone();

    // A second prompt mid-call would be a bug.
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
  });

  it("toggles every audio track and reports the new state", async () => {
    await getMicrophone();

    expect(toggleMicrophone()).toBe(false);
    expect(isMicrophoneMuted()).toBe(true);

    expect(toggleMicrophone()).toBe(true);
    expect(isMicrophoneMuted()).toBe(false);
  });

  it("reports unmuted when no microphone is open", () => {
    expect(isMicrophoneMuted()).toBe(false);
    expect(toggleMicrophone()).toBe(false);
  });
});
