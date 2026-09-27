import { useEffect, useState } from "react";
import { Loader2, Play, VolumeX } from "lucide-react";

import { api } from "@/services/api";

/**
 * Plays a voice message.
 *
 * The audio endpoint sits behind authMiddleware, so a bare `src` on an
 * <audio> element would 401. The clip is fetched with the access token and
 * handed to the element as an object URL, which is revoked on unmount.
 */
export function VoicePlayer({ messageId, seconds }: { messageId: string; seconds: number | null }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;

    setUrl(null);
    setError(null);
    setLoading(true);

    void (async () => {
      try {
        const next = await api.messages.voiceObjectUrl(messageId);

        if (!active) {
          URL.revokeObjectURL(next);
          return;
        }

        objectUrl = next;
        setUrl(next);
      } catch (caught) {
        if (active) {
          setError(caught instanceof Error ? caught.message : "Could not load the audio");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [messageId]);

  const length =
    seconds === null || seconds === undefined
      ? "0:00"
      : `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, "0")}`;

  if (error) {
    return <span className="text-xs text-destructive">{error}</span>;
  }

  return (
    <span className="flex items-center gap-2">
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <VolumeX className="h-4 w-4 opacity-70" />
      )}
      <span className="font-mono text-xs tabular-nums">{length}</span>
      {url ? (
        <audio controls preload="none" src={url} className="h-8 max-w-48">
          <track kind="captions" />
        </audio>
      ) : null}
      {!url && !loading ? <Play className="h-4 w-4 opacity-50" /> : null}
    </span>
  );
}

export default VoicePlayer;
