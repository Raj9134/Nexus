import { useCallback, useEffect, useState } from "react";
import { MessageSquare, Paperclip, Send } from "lucide-react";

import {
  Avatar,
  Badge,
  Card,
  EmptyState,
  ErrorState,
  SkeletonBlock,
} from "@/components/nexus/primitives";
import { Button } from "@/components/ui/button";
import { useNexus } from "@/context/NexusContext";
import { VoicePlayer } from "@/components/nexus/VoicePlayer";
import { VoiceRecorder, type VoiceRecording } from "@/components/nexus/VoiceRecorder";
import { api, isAuthenticated } from "@/services/api";
import type { MessageItem, User } from "@/types/nexus";

/**
 * A real direct-message thread.
 *
 * Channel messages arrive over the socket and live in NexusContext, but a DM
 * history is only reachable through GET /messages/:userId, so this loads its
 * own copy and appends to it. Seed data is never mixed in: if there is no
 * session there is nothing real to show, and the empty state says so.
 */
export function DirectThread({ peer }: { peer: User }) {
  const nexus = useNexus();
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const me = nexus.currentUser;
  const live = nexus.isDemo === false && isAuthenticated();

  const load = useCallback(async () => {
    if (!live) {
      setError("Sign in to read your messages");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      setMessages(await api.messages.conversation(peer.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load this conversation");
    } finally {
      setLoading(false);
    }
  }, [live, peer.id]);

  useEffect(() => {
    setMessages([]);
    void load();
  }, [load]);

  const send = useCallback(async () => {
    const body = draft.trim();

    if (!body || sending) {
      return;
    }

    setSending(true);

    try {
      const sent = await api.messages.sendDirect(peer.id, body);

      setMessages((items) => [...items, sent]);
      setDraft("");
    } catch (caught) {
      nexus.pushToast(
        caught instanceof Error ? caught.message : "Could not send the message",
        "error",
      );
    } finally {
      setSending(false);
    }
  }, [draft, nexus, peer.id, sending]);

  const sendVoice = useCallback(
    async (recording: VoiceRecording) => {
      try {
        const sent = await api.messages.sendVoice({
          audio: recording.blob,
          duration: recording.duration,
          receiver: peer.id,
        });

        setMessages((items) => [...items, sent]);
      } catch (caught) {
        nexus.pushToast(
          caught instanceof Error ? caught.message : "Could not send the voice message",
          "error",
        );
      }
    },
    [nexus, peer.id],
  );

  return (
    <Card className="flex min-h-[560px] flex-col p-0">
      <header className="flex items-center gap-3 border-b border-border p-4">
        <Avatar name={peer.name} />
        <div className="min-w-0">
          <p className="truncate font-display text-base font-semibold text-foreground">
            {peer.name}
          </p>
          <p className="truncate text-xs text-muted-foreground">{peer.email}</p>
        </div>
        <Badge tone={peer.status === "Online" ? "success" : "neutral"}>{peer.role}</Badge>
      </header>

      <div className="nexus-scrollbar flex-1 space-y-3 overflow-auto p-4">
        {loading ? (
          <div className="space-y-3">
            <SkeletonBlock className="h-12 w-2/3" />
            <SkeletonBlock className="ml-auto h-12 w-1/2" />
            <SkeletonBlock className="h-12 w-3/4" />
          </div>
        ) : error ? (
          <ErrorState
            title="Conversation unavailable"
            description={error}
            onRetry={() => void load()}
          />
        ) : messages.length === 0 ? (
          <EmptyState
            icon={<MessageSquare />}
            title={`No messages with ${peer.name.split(" ")[0]} yet`}
            description="Start the conversation below."
          />
        ) : (
          messages.map((message) => {
            const mine = message.authorId === me.id;

            return (
              <div key={message.id} className={mine ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={
                    mine
                      ? "max-w-[75%] rounded-lg rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground"
                      : "max-w-[75%] rounded-lg rounded-bl-sm bg-secondary px-3 py-2 text-sm text-foreground"
                  }
                >
                  {message.messageType === "voice" ? (
                    <VoicePlayer messageId={message.id} seconds={message.duration ?? null} />
                  ) : (
                    <p className="whitespace-pre-wrap break-words">{message.body}</p>
                  )}
                  <span
                    className={
                      mine
                        ? "mt-1 block text-right text-[10px] text-primary-foreground/70"
                        : "mt-1 block text-[10px] text-muted-foreground"
                    }
                  >
                    {message.time}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      <footer className="border-t border-border p-3">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
          className="flex items-end gap-2"
        >
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send();
              }
            }}
            rows={1}
            placeholder={`Message ${peer.name.split(" ")[0]}...`}
            className="max-h-32 min-h-9 flex-1 resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <Button type="button" size="icon" variant="ghost" aria-label="Attach a file" disabled>
            <Paperclip />
          </Button>
          <VoiceRecorder onSend={sendVoice} disabled={!live} />
          <Button type="submit" size="icon" disabled={!draft.trim() || sending}>
            <Send />
          </Button>
        </form>
      </footer>
    </Card>
  );
}

export default DirectThread;
