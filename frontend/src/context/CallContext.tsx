import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { api, isAuthenticated } from "@/services/api";
import {
  closeCall,
  createPeerConnection,
  getMicrophone,
  getPeerConnection,
  toggleMicrophone,
} from "@/services/callManager";
import { emitCallEvent, getSocket, onSocketEvent } from "@/services/socket";
import type { CallRecord } from "@/types/nexus";

/**
 * Drives one voice call at a time.
 *
 * The backend owns call state, so every transition is a REST write first and
 * the socket is only used to notify the peer and to carry SDP. The peer
 * connection itself is owned by callManager, never by React state, so a
 * re-render cannot drop a call.
 */

export type CallPhase = "idle" | "calling" | "incoming" | "connecting" | "active" | "ended";

interface CallContextValue {
  phase: CallPhase;
  /** The live call, or the one that just ended so the UI can name it. */
  call: CallRecord | null;
  peerName: string;
  startedAt: number | null;
  muted: boolean;
  error: string | null;
  startCall: (receiverId: string, peerName: string) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => Promise<void>;
  missCall: () => Promise<void>;
  endCall: () => Promise<void>;
  toggleMute: () => void;
  dismiss: () => void;
  remoteAudio: HTMLAudioElement | null;
  attachRemoteAudio: (element: HTMLAudioElement | null) => void;
}

const CallContext = createContext<CallContextValue | null>(null);

export function CallProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<CallPhase>("idle");
  const [call, setCall] = useState<CallRecord | null>(null);
  const [peerName, setPeerName] = useState("");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remoteAudio, setRemoteAudio] = useState<HTMLAudioElement | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const startedAtRef = useRef<number | null>(null);
  /*
    The socket handlers need the current phase to decide whether an incoming
    call should interrupt, but putting `phase` in their effect's dependencies
    would tear down and rebuild every subscription on each state change, which
    drops events mid-call. A ref gives them a live read with no re-subscribe.
  */
  const phaseRef = useRef<CallPhase>(phase);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const attachRemoteAudio = useCallback((element: HTMLAudioElement | null) => {
    audioRef.current = element;
    setRemoteAudio(element);
  }, []);

  const reset = useCallback(() => {
    closeCall();

    setPhase("idle");
    setCall(null);
    setPeerName("");
    setStartedAt(null);
    setMuted(false);
    setError(null);
    startedAtRef.current = null;

    if (audioRef.current) {
      audioRef.current.srcObject = null;
    }
  }, []);

  const fail = useCallback((reason: string) => {
    closeCall();

    /*
        Clear the call state without clearing the error. This used to call
        reset(), which set the error and then nulled it on the next line, so a
        failed call returned to idle having told the user nothing at all.
      */
    setPhase("idle");
    setCall(null);
    setPeerName("");
    setStartedAt(null);
    setMuted(false);
    startedAtRef.current = null;

    if (audioRef.current) {
      audioRef.current.srcObject = null;
    }

    setError(reason);
  }, []);

  /* Outbound: we are the caller, so we own the offer. */
  const makeOffer = useCallback(
    async (callId: string) => {
      const microphone = await getMicrophone();
      const connection = createPeerConnection();

      connection.ontrack = (event) => {
        const [stream] = event.streams;

        if (audioRef.current && stream) {
          audioRef.current.srcObject = stream;
        }
      };

      connection.onicecandidate = (event) => {
        if (event.candidate) {
          emitCallEvent("iceCandidate", {
            callId,
            // The server validates this with readText, so it must be the
            // string, not the RTCIceCandidate.
            candidate: event.candidate.candidate,
          });
        }
      };

      connection.onconnectionstatechange = () => {
        if (connection.connectionState === "failed") {
          fail("The call connection failed");
        }
      };

      microphone.getTracks().forEach((track) => {
        connection.addTrack(track, microphone);
      });

      const offer = await connection.createOffer();

      await connection.setLocalDescription(offer);

      emitCallEvent("webrtcOffer", { callId, offer: offer.sdp ?? "" });
    },
    [fail],
  );

  /* Inbound: we accepted, so we answer. */
  const makeAnswer = useCallback(
    async (callId: string, offerSdp: string) => {
      const microphone = await getMicrophone();
      const connection = createPeerConnection();

      connection.ontrack = (event) => {
        const [stream] = event.streams;

        if (audioRef.current && stream) {
          audioRef.current.srcObject = stream;
        }
      };

      connection.onicecandidate = (event) => {
        if (event.candidate) {
          emitCallEvent("iceCandidate", { callId, candidate: event.candidate.candidate });
        }
      };

      connection.onconnectionstatechange = () => {
        if (connection.connectionState === "failed") {
          fail("The call connection failed");
        }
      };

      microphone.getTracks().forEach((track) => {
        connection.addTrack(track, microphone);
      });

      await connection.setRemoteDescription({ type: "offer", sdp: offerSdp });

      const answer = await connection.createAnswer();

      await connection.setLocalDescription(answer);

      emitCallEvent("webrtcAnswer", { callId, answer: answer.sdp ?? "" });
    },
    [fail],
  );

  const startCall = useCallback(
    async (receiverId: string, name: string) => {
      if (!isAuthenticated()) {
        setError("Sign in to place a call");
        return;
      }

      if (phase === "calling" || phase === "active") {
        return;
      }

      setError(null);
      setPeerName(name);
      setPhase("calling");

      try {
        const created = await api.calls.start(receiverId);

        setCall(created);
        emitCallEvent("callUser", { callId: created.id });
      } catch (caught) {
        fail(caught instanceof Error ? caught.message : "Could not place the call");
      }
    },
    [fail, phase],
  );

  const acceptCall = useCallback(async () => {
    if (!call) {
      return;
    }

    setPhase("connecting");

    try {
      await api.calls.accept(call.id);
      emitCallEvent("callAccepted", { callId: call.id });

      /*
        The offer is already waiting: the caller starts negotiating as soon as
        we accept, so it is normally in flight. If it has not landed yet the
        socket handler below will pick it up.
      */
      const connection = getPeerConnection();

      if (connection?.remoteDescription) {
        setPhase("active");
        setStartedAt(Date.now());
        startedAtRef.current = Date.now();
      }
    } catch (caught) {
      fail(caught instanceof Error ? caught.message : "Could not accept the call");
    }
  }, [call, fail]);

  const rejectCall = useCallback(async () => {
    if (!call) {
      return;
    }

    const callId = call.id;

    try {
      await api.calls.reject(callId);
      emitCallEvent("callRejected", { callId });
    } catch {
      /* the call is going away regardless */
    }

    reset();
  }, [call, reset]);

  const missCall = useCallback(async () => {
    if (!call) {
      return;
    }

    try {
      await api.calls.miss(call.id);
      emitCallEvent("callMissed", { callId: call.id });
    } catch {
      /* ignore */
    }

    reset();
  }, [call, reset]);

  const endCall = useCallback(async () => {
    if (!call) {
      reset();
      return;
    }

    const callId = call.id;

    try {
      await api.calls.end(callId);
      emitCallEvent("endCall", { callId });
    } catch {
      /* the peer may have ended it first */
    }

    reset();
  }, [call, reset]);

  const toggleMute = useCallback(() => {
    setMuted(toggleMicrophone());
  }, []);

  const dismiss = useCallback(() => {
    setError(null);
  }, []);

  /* Socket: the peer rang us. */
  useEffect(() => {
    const offIncoming = onSocketEvent("incomingCall", async ({ callId }) => {
      const current = phaseRef.current;

      if (current === "active" || current === "connecting" || current === "calling") {
        return;
      }

      setPhase("incoming");

      try {
        const record = await api.calls.get(callId);

        setCall(record);
        setPeerName(record.caller.name || "Unknown caller");
      } catch {
        setPeerName("Unknown caller");
      }
    });

    const offAccepted = onSocketEvent("callAccepted", async ({ callId }) => {
      if (call?.id !== callId) {
        return;
      }

      setPhase("connecting");

      try {
        await makeOffer(callId);
      } catch (caught) {
        fail(caught instanceof Error ? caught.message : "Could not start the call");
      }
    });

    const offOffer = onSocketEvent("webrtcOffer", async ({ callId, caller, offer }) => {
      if (call?.id !== callId) {
        return;
      }

      setPhase("connecting");

      try {
        await makeAnswer(callId, offer);
      } catch (caught) {
        fail(caught instanceof Error ? caught.message : "Could not answer the call");
      }
    });

    const offAnswer = onSocketEvent("webrtcAnswer", async ({ callId, answer }) => {
      const connection = getPeerConnection();

      if (!connection || connection.signalingState === "stable") {
        return;
      }

      try {
        await connection.setRemoteDescription({ type: "answer", sdp: answer });

        setPhase("active");

        const now = Date.now();

        setStartedAt(now);
        startedAtRef.current = now;
      } catch (caught) {
        fail(caught instanceof Error ? caught.message : "Could not complete the call");
      }
    });

    const offCandidate = onSocketEvent("iceCandidate", async ({ candidate }) => {
      const connection = getPeerConnection();

      if (!connection) {
        return;
      }

      try {
        await connection.addIceCandidate({ candidate });
      } catch {
        /* a candidate can arrive before the description; it is not fatal */
      }
    });

    const offRejected = onSocketEvent("callRejected", () => {
      reset();
    });

    const offMissed = onSocketEvent("callMissed", () => {
      reset();
    });

    const offEnded = onSocketEvent("callEnded", () => {
      reset();
    });

    const offError = onSocketEvent("socketError", ({ message }) => {
      setError(message);
    });

    return () => {
      offIncoming();
      offAccepted();
      offOffer();
      offAnswer();
      offCandidate();
      offRejected();
      offMissed();
      offEnded();
      offError();
    };
  }, [call?.id, fail, makeAnswer, makeOffer, reset]);

  /* A call cannot outlive the tab or the session. */
  useEffect(() => {
    const onUnload = () => {
      closeCall();
    };

    const socket = getSocket();
    const onDisconnect = () => {
      if (startedAtRef.current) {
        closeCall();
      }
    };

    window.addEventListener("beforeunload", onUnload);
    socket?.on("disconnect", onDisconnect);

    return () => {
      window.removeEventListener("beforeunload", onUnload);
      socket?.off("disconnect", onDisconnect);
      closeCall();
    };
  }, []);

  const value = useMemo<CallContextValue>(
    () => ({
      phase,
      call,
      peerName,
      startedAt,
      muted,
      error,
      startCall,
      acceptCall,
      rejectCall,
      missCall,
      endCall,
      toggleMute,
      dismiss,
      remoteAudio,
      attachRemoteAudio,
    }),
    [
      acceptCall,
      attachRemoteAudio,
      call,
      dismiss,
      endCall,
      error,
      missCall,
      muted,
      peerName,
      phase,
      rejectCall,
      remoteAudio,
      startCall,
      startedAt,
      toggleMute,
    ],
  );

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}

export function useCall(): CallContextValue {
  const context = useContext(CallContext);

  if (!context) {
    throw new Error("useCall must be used within CallProvider");
  }

  return context;
}
