import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Mic, Square, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Records a voice note and hands the blob plus its length to `onSend`.
 *
 * MediaRecorder tags its blob `audio/webm;codecs=opus`, but the backend's
 * audio filter compares the multipart content type against a fixed list and
 * the codec suffix would fail it, so the recording is re-wrapped with a bare
 * `audio/webm` type and a matching filename before it is appended.
 */

const MAX_SECONDS = 300;

export interface VoiceRecording {
  blob: Blob;
  /** Whole seconds, which is what the backend validates. */
  duration: number;
}

export function VoiceRecorder({
  onSend,
  onCancel,
  disabled,
}: {
  onSend: (recording: VoiceRecording) => Promise<void> | void;
  onCancel?: () => void;
  disabled?: boolean;
}) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startedAtRef = useRef(0);
  const tickRef = useRef<number | null>(null);

  const stopTimer = useCallback(() => {
    if (tickRef.current !== null) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  useEffect(() => stopTimer, [stopTimer]);

  const start = useCallback(async () => {
    setError(null);

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Recording is not supported in this browser");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);

      chunksRef.current = [];
      startedAtRef.current = Date.now();

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        stopTimer();
        setRecording(false);
      };

      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
      setElapsed(0);

      tickRef.current = window.setInterval(() => {
        const seconds = Math.floor((Date.now() - startedAtRef.current) / 1000);

        setElapsed(seconds);

        if (seconds >= MAX_SECONDS) {
          recorderRef.current?.stop();
        }
      }, 250);
    } catch (caught) {
      setError(
        caught instanceof Error && caught.name === "NotAllowedError"
          ? "Microphone permission was denied"
          : "Could not start recording",
      );
    }
  }, [stopTimer]);

  const stopAndSend = useCallback(async () => {
    const recorder = recorderRef.current;

    if (!recorder) {
      return;
    }

    const duration = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });

      void (async () => {
        setSending(true);

        try {
          await onSend({ blob, duration });
        } finally {
          setSending(false);
        }
      })();
    };

    recorder.stop();
    recorderRef.current = null;
  }, [onSend]);

  const cancel = useCallback(() => {
    const recorder = recorderRef.current;

    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = () => {
        recorder.stream.getTracks().forEach((track) => track.stop());
      };
      recorder.stop();
    }

    recorderRef.current = null;
    chunksRef.current = [];
    stopTimer();
    setRecording(false);
    setElapsed(0);
    onCancel?.();
  }, [onCancel, stopTimer]);

  if (error) {
    return (
      <div className="flex items-center gap-2 text-sm text-destructive">
        <span>{error}</span>
        <Button size="sm" variant="ghost" onClick={() => setError(null)}>
          Dismiss
        </Button>
      </div>
    );
  }

  if (!recording) {
    return (
      <Button
        type="button"
        size="icon"
        variant="ghost"
        aria-label="Record a voice message"
        disabled={disabled}
        onClick={() => void start()}
      >
        <Mic />
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="flex items-center gap-2 text-sm text-foreground">
        <span className="h-2 w-2 animate-pulse rounded-full bg-destructive" />
        <span className="font-mono tabular-nums">
          {String(Math.floor(elapsed / 60)).padStart(2, "0")}:
          {String(elapsed % 60).padStart(2, "0")}
        </span>
      </span>
      <Button type="button" size="icon" variant="ghost" aria-label="Discard" onClick={cancel}>
        <Trash2 />
      </Button>
      <Button
        type="button"
        size="icon"
        aria-label="Send the recording"
        disabled={sending}
        onClick={() => void stopAndSend()}
      >
        {sending ? <Loader2 className="animate-spin" /> : <Square />}
      </Button>
    </div>
  );
}

export default VoiceRecorder;
