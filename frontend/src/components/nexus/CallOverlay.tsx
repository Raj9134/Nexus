import { useEffect, useState } from "react";
import { Mic, MicOff, Phone, PhoneOff, X } from "lucide-react";

import { Avatar } from "@/components/nexus/primitives";
import { Button } from "@/components/ui/button";
import { useCall } from "@/context/CallContext";

/**
 * The single call surface. It renders nothing while idle, so it is safe to
 * mount once at the root rather than inside any page.
 */

const formatElapsed = (from: number | null): string => {
  if (from === null) {
    return "0:00";
  }

  const seconds = Math.max(0, Math.floor((Date.now() - from) / 1000));
  const minutes = Math.floor(seconds / 60);

  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
};

function useTicker(active: boolean, from: number | null): string {
  const [label, setLabel] = useState(() => formatElapsed(from));

  useEffect(() => {
    if (!active || from === null) {
      return;
    }

    setLabel(formatElapsed(from));

    const timer = window.setInterval(() => {
      setLabel(formatElapsed(from));
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [active, from]);

  return label;
}

export function CallOverlay() {
  const {
    phase,
    peerName,
    startedAt,
    muted,
    error,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    dismiss,
    attachRemoteAudio,
  } = useCall();

  const elapsed = useTicker(phase === "active", startedAt);

  if (phase === "idle" && !error) {
    return null;
  }

  const heading =
    phase === "incoming"
      ? `Incoming call from ${peerName || "someone"}`
      : phase === "calling"
        ? `Calling ${peerName || "..."}`
        : phase === "connecting"
          ? `Connecting to ${peerName || "..."}`
          : phase === "active"
            ? peerName || "In call"
            : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Voice call"
        className="w-full max-w-sm rounded-xl border border-border bg-card p-6 text-card-foreground shadow-xl"
      >
        {/*
          The single sink for the remote WebRTC stream. It must stay mounted
          for the whole call or the audio track is dropped.
        */}
        <audio ref={attachRemoteAudio} autoPlay />

        <div className="flex flex-col items-center gap-4 text-center">
          <Avatar name={peerName || "?"} className="h-16 w-16 text-lg" />

          <div>
            <p className="font-display text-lg font-semibold">{heading}</p>
            {phase === "active" ? (
              <p className="mt-1 font-mono text-sm text-muted-foreground">{elapsed}</p>
            ) : null}
          </div>

          {error ? (
            <p className="w-full rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <div className="flex items-center gap-3">
            {phase === "incoming" ? (
              <>
                <Button variant="destructive" onClick={() => void rejectCall()}>
                  <PhoneOff />
                  Decline
                </Button>
                <Button onClick={() => void acceptCall()}>
                  <Phone />
                  Accept
                </Button>
              </>
            ) : null}

            {phase === "active" ? (
              <>
                <Button
                  variant={muted ? "secondary" : "outline"}
                  onClick={toggleMute}
                  aria-label={muted ? "Unmute" : "Mute"}
                >
                  {muted ? <MicOff /> : <Mic />}
                  {muted ? "Unmute" : "Mute"}
                </Button>
                <Button variant="destructive" onClick={() => void endCall()}>
                  <PhoneOff />
                  End
                </Button>
              </>
            ) : null}

            {phase === "calling" || phase === "connecting" ? (
              <Button variant="destructive" onClick={() => void endCall()}>
                <PhoneOff />
                Cancel
              </Button>
            ) : null}
          </div>

          {error ? (
            <Button variant="ghost" size="sm" onClick={dismiss}>
              <X />
              Dismiss
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default CallOverlay;
