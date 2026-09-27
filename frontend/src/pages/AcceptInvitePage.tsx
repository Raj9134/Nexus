import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { api, isAuthenticated, type InvitePreview } from "@/services/api";
import {
  Avatar,
  Badge,
  BrandMark,
  Card,
  ErrorState,
  SkeletonBlock,
  SubmitButton,
} from "@/components/nexus/primitives";

/**
 * Landing page for a workspace invitation link.
 *
 * The link can arrive in three states, and each needs a different next step:
 *  - no session: the address has to sign up or sign in first
 *  - a session for a different address: the backend refuses it, so say so
 *  - a session for the invited address: accept and land on the workspace
 */
export function AcceptInvitePage({ token }: { token: string }) {
  const navigate = useNavigate();
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);

  const load = useCallback(async () => {
    if (!token) {
      setError("This link is missing its invitation token.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      setPreview(await api.invitations.preview(token));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "This invitation is invalid or has expired.",
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    setSignedIn(isAuthenticated());
    void load();
  }, [load]);

  const accept = async () => {
    setAccepting(true);
    setError(null);

    try {
      await api.invitations.accept(token);
      await navigate({ to: "/app" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We could not accept this invitation.");
      setAccepting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <BrandMark />
        </div>
      </header>

      <main className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-16">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-normal text-foreground">
            Workspace invitation
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Accepting gives you access to the workspace projects, tasks, and files.
          </p>
        </div>

        {loading ? (
          <Card className="p-6">
            <SkeletonBlock className="h-5 w-48" />
            <SkeletonBlock className="mt-4 h-4 w-72" />
            <SkeletonBlock className="mt-2 h-4 w-56" />
          </Card>
        ) : error && !preview ? (
          <ErrorState
            title="Invitation unavailable"
            description={error}
            onRetry={() => void load()}
          />
        ) : preview ? (
          <>
            <Card className="p-6">
              <div className="flex items-start gap-4">
                <Avatar name={preview.organization} className="h-11 w-11 text-sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-lg font-semibold text-foreground">
                    {preview.organization}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {preview.inviter} invited you to join as{" "}
                    <Badge tone="info">{preview.role}</Badge>
                  </p>
                </div>
              </div>

              <dl className="mt-6 grid gap-3 border-t border-border pt-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Invited address</dt>
                  <dd className="mt-0.5 truncate font-medium text-foreground">{preview.email}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Workspace type</dt>
                  <dd className="mt-0.5 font-medium text-foreground">
                    {preview.workspaceType || "Not set"}
                  </dd>
                </div>
              </dl>
            </Card>

            {error ? (
              <p className="rounded-md border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </p>
            ) : null}

            {signedIn ? (
              <SubmitButton loading={accepting} onClick={() => void accept()}>
                Accept invitation
              </SubmitButton>
            ) : (
              <Card className="flex flex-col gap-3 p-6">
                <p className="text-sm text-muted-foreground">
                  Sign in as <span className="font-medium text-foreground">{preview.email}</span> to
                  accept, or create an account with that address.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link
                    to="/login"
                    className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                  >
                    Sign in
                  </Link>
                  <Link
                    to="/register"
                    className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-foreground"
                  >
                    Create account
                  </Link>
                </div>
              </Card>
            )}
          </>
        ) : null}
      </main>
    </div>
  );
}
