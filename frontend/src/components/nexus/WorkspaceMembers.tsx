import { useState } from "react";
import { Loader2, Trash2, UserPlus } from "lucide-react";

import { Avatar, Badge, Card, EmptyState } from "@/components/nexus/primitives";
import { Button } from "@/components/ui/button";
import { useNexus } from "@/context/NexusContext";
import { api, isAuthenticated } from "@/services/api";

/**
 * Workspace membership.
 *
 * Admin means owning the workspace, and only the owner can add or remove
 * people, so those controls are hidden from everyone else rather than left
 * there to fail. Adding someone who has no account yet goes out as an
 * invitation; adding an existing account binds them directly.
 */
export function WorkspaceMembers() {
  const nexus = useNexus();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const org = nexus.organizations[0];
  const live = nexus.isDemo === false && isAuthenticated();

  const isOwner = nexus.organizations.length > 0 && nexus.currentUser.role === "Organization Admin";
  const canManage = live && Boolean(org) && isOwner;

  const add = async () => {
    const value = email.trim();

    if (!value || !org) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const result = await api.invitations.send(org.id, [value]);

      if (result.invited.length > 0) {
        nexus.pushToast(`Invitation sent to ${value}`, "success");
      } else {
        nexus.pushToast(`${value} is already a member`, "warning");
      }

      setEmail("");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Could not send the invitation";

      setError(message);
      nexus.pushToast(message, "error");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (userId: string, name: string) => {
    if (!org) {
      return;
    }

    setBusy(true);

    try {
      await api.organizations.removeMember(org.id, userId);
      nexus.pushToast(`Removed ${name}`, "success");
      await nexus.reload();
    } catch (caught) {
      nexus.pushToast(
        caught instanceof Error ? caught.message : "Could not remove that member",
        "error",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-foreground">Members</h2>
          <p className="text-sm text-muted-foreground">
            {nexus.organization} · {nexus.users.length}{" "}
            {nexus.users.length === 1 ? "person" : "people"}
          </p>
        </div>
        {canManage ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void add();
            }}
            className="flex items-center gap-2"
          >
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              placeholder="teammate@company.com"
              className="h-9 w-56 rounded-md border border-input bg-secondary/70 px-3 text-sm outline-none focus:border-primary"
            />
            <Button type="submit" size="sm" disabled={busy || !email.trim()}>
              {busy ? <Loader2 className="animate-spin" /> : <UserPlus />}
              Invite
            </Button>
          </form>
        ) : null}
      </div>

      {error ? (
        <p className="border-b border-border bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {nexus.users.length === 0 ? (
        <div className="p-4">
          <EmptyState
            icon={<UserPlus />}
            title="No members yet"
            description="Invite the first teammate to this workspace."
          />
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {nexus.users.map((user) => {
            const owner = user.role === "Organization Admin";

            return (
              <li key={user.id} className="flex items-center gap-3 p-4">
                <Avatar name={user.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{user.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                </div>
                <Badge tone={owner ? "info" : "neutral"}>{user.role}</Badge>
                <Badge tone={user.status === "Online" ? "success" : "neutral"}>{user.status}</Badge>
                {canManage && !owner && user.id !== nexus.currentUser.id ? (
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Remove ${user.name}`}
                    disabled={busy}
                    onClick={() => void remove(user.id, user.name)}
                  >
                    <Trash2 />
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

export default WorkspaceMembers;
