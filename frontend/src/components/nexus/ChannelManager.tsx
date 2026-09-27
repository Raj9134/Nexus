import { useCallback, useEffect, useState } from "react";
import { Hash, Loader2, Lock, Plus, Trash2 } from "lucide-react";

import { Badge, Card } from "@/components/nexus/primitives";
import { Button } from "@/components/ui/button";
import { useNexus } from "@/context/NexusContext";
import { api, isAuthenticated } from "@/services/api";
import type { ChannelRecord } from "@/types/nexus";

/**
 * Create and remove channels.
 *
 * Names are lowercased and must be alphanumeric with hyphens; the backend
 * enforces that pattern and answers 409 for a duplicate. Only a channel's
 * creator may delete it, so the control is hidden for everyone else.
 */
export function ChannelManager() {
  const nexus = useNexus();
  const [records, setRecords] = useState<ChannelRecord[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const live = nexus.isDemo === false && isAuthenticated();
  const org = nexus.organizations[0];

  const load = useCallback(async () => {
    if (!live) {
      return;
    }

    setError(null);

    try {
      setRecords(await api.channels.records());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load channels");
    }
  }, [live]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    /*
      The backend validates the name against /^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$/
      and does not rewrite it, so "Design Review" is a 400. Slugify here so
      typing a normal phrase works.
    */
    const value = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    if (!value || !org) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await api.channels.create({ name: value, organizationId: org.id });

      setName("");
      nexus.pushToast(`#${value} created`, "success");
      await Promise.all([load(), nexus.reload()]);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Could not create the channel";

      setError(message);
      nexus.pushToast(message, "error");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (channel: ChannelRecord) => {
    setBusy(true);

    try {
      await api.channels.remove(channel.name);

      nexus.pushToast(`#${channel.name} deleted`, "success");
      await Promise.all([load(), nexus.reload()]);
    } catch (caught) {
      nexus.pushToast(
        caught instanceof Error ? caught.message : "Could not delete the channel",
        "error",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-0">
      <div className="border-b border-border p-4">
        <h2 className="font-display text-lg font-semibold text-foreground">Channels</h2>
        <p className="text-sm text-muted-foreground">
          Lowercase letters, numbers and hyphens. Only a channel's creator can remove it.
        </p>
      </div>

      {live ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void create();
          }}
          className="flex items-center gap-2 border-b border-border p-4"
        >
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="design-review"
            maxLength={64}
            className="h-9 flex-1 rounded-md border border-input bg-secondary/70 px-3 text-sm outline-none focus:border-primary"
          />
          <Button type="submit" size="sm" disabled={busy || !name.trim() || !org}>
            {busy ? <Loader2 className="animate-spin" /> : <Plus />}
            Create
          </Button>
        </form>
      ) : null}

      {error ? (
        <p className="border-b border-border bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {records.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">
          {live ? "No channels yet." : "Sign in to manage channels."}
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {records.map((channel) => (
            <li key={channel.id} className="flex items-center gap-3 p-4">
              {channel.isPrivate ? (
                <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
              ) : (
                <Hash className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{channel.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {channel.description || "No description"}
                </p>
              </div>
              {channel.isPrivate ? <Badge tone="warning">Private</Badge> : null}
              <Badge>{channel.members.length} members</Badge>
              {channel.createdBy === nexus.currentUser.id ? (
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Delete #${channel.name}`}
                  disabled={busy}
                  onClick={() => void remove(channel)}
                >
                  <Trash2 />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default ChannelManager;
