import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Check, Eye, EyeOff, KeyRound, Mail, ShieldCheck, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";

import { Avatar, Badge, BrandMark, Card, ProgressBar } from "@/components/nexus/primitives";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  api,
  AUTHENTICATED_EVENT,
  isAuthenticated,
  readRemember,
  /*
    Aliased on purpose. Naming the state setter `setRemember` shadowed the
    storage writer of the same name, so `setRemember(remember)` in submit was
    setting React state and nothing ever reached localStorage. Both take a
    boolean, so neither tsc nor eslint noticed.
  */
  setRemember as setRememberPreference,
} from "@/services/api";
import type { Organization, Project } from "@/types/nexus";

export type AuthMode = "login" | "register" | "forgot" | "reset" | "verify";

/** What the workspace actually looks like once setup finished. */
type SetupResult = {
  organization: Organization;
  project: Project;
  membersAdded: string[];
  invitesPending: string[];
};

export function AuthPage({ mode }: { mode: AuthMode }) {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [devToken, setDevToken] = useState<string | null>(null);
  /*
    Empty by default. The form used to ship pre-filled with a real account's
    address and "demo-password", so anyone who opened the login page was shown
    working credentials for someone else's workspace, and pressing Sign in just
    produced "Invalid email or password".
  */
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  // Remember me now decides where the tokens are stored. It had no state at all
  // and both tokens always went to localStorage, so the label promised
  // something the code never did.
  const [remember, setRemember] = useState(() => readRemember());
  // Reset and verification links carry ?token=...; there is no mail provider in
  // local dev, so the token can also be pasted in. Reading it in an effect keeps
  // the server render and the first client render identical, because window
  // does not exist while the page is rendered on the server.
  const [token, setToken] = useState("");
  useEffect(() => {
    if (mode === "reset" || mode === "verify") {
      setToken(new URLSearchParams(window.location.search).get("token") ?? "");
    }
  }, [mode]);

  // The route guard cannot settle this on the server (the session lives in
  // localStorage), so a signed-in visitor landing on /login or /register is
  // moved on once the app is running in the browser.
  useEffect(() => {
    if (mode === "login" || mode === "register") {
      if (isAuthenticated()) {
        void navigate({ to: "/app" });
      }
    }
  }, [mode, navigate]);
  const submit = async () => {
    setLoading(true);
    setError(null);
    setNotice(null);

    if ((mode === "register" || mode === "reset") && confirmPassword !== password) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    try {
      if (mode === "login") {
        // Set before the request, so the tokens land in the store the checkbox
        // chose rather than wherever the previous session happened to be.
        setRememberPreference(remember);
        await api.auth.login({ email, password });
        window.dispatchEvent(new Event(AUTHENTICATED_EVENT));
        await navigate({ to: "/app" });
      } else if (mode === "register") {
        await api.auth.register({ name, email, password });
        window.dispatchEvent(new Event(AUTHENTICATED_EVENT));
        await navigate({ to: "/onboarding" });
      } else if (mode === "forgot") {
        const result = await api.auth.forgotPassword(email);
        setNotice(result.message ?? "If that account exists, a reset link is on its way.");

        if (result.devToken) {
          setDevToken(result.devToken);
        }
      } else if (mode === "reset") {
        if (!token.trim()) {
          setError("Paste the reset token from your email to continue.");
          return;
        }

        await api.auth.resetPassword({ token: token.trim(), password });
        setNotice("Password updated. Sign in with your new password.");
        setPassword("");
        await navigate({ to: "/login" });
      } else {
        if (!token.trim()) {
          setError("Paste the verification token from your email to continue.");
          return;
        }

        await api.auth.verifyEmail(token.trim());
        setNotice("Email verified. You can sign in now.");
        await navigate({ to: "/login" });
      }
    } catch (caught) {
      setError(
        caught instanceof Error && caught.message
          ? caught.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };
  const title =
    mode === "login"
      ? "Welcome back"
      : mode === "register"
        ? "Create your account"
        : mode === "forgot"
          ? "Recover your account"
          : mode === "reset"
            ? "Set a new password"
            : "Verify your email";
  const description =
    mode === "verify"
      ? "We sent a verification link to your inbox. Open it to activate your NEXUS workspace."
      : "Access your secure NEXUS workspace and keep every team aligned.";
  return (
    <main className="grid min-h-screen lg:grid-cols-[0.9fr_1.1fr]">
      <section className="relative hidden overflow-hidden border-r border-border bg-panel/70 p-12 lg:flex lg:flex-col lg:justify-between">
        <BrandMark />
        <div className="max-w-lg">
          <p className="font-display text-4xl font-semibold leading-tight text-foreground">
            One workspace.
            <br />
            Every team.
            <br />
            Complete visibility.
          </p>
          <div className="mt-8 grid gap-3">
            {[
              "Enterprise project visibility",
              "Secure team collaboration",
              "Real-time delivery intelligence",
            ].map((item) => (
              <div key={item} className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="grid h-7 w-7 place-items-center rounded-md bg-success/10 text-success">
                  <Check className="h-4 w-4" />
                </span>
                {item}
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">NEXUS Labs · Enterprise Demo</p>
      </section>
      <section className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-md nexus-enter">
          <div className="mb-8 lg:hidden">
            <BrandMark />
          </div>
          <Link
            to="/"
            className="mb-7 inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to NEXUS
          </Link>
          <Card className="p-6 sm:p-8">
            <div className="grid h-11 w-11 place-items-center rounded-md bg-primary/10 text-primary">
              {mode === "register" ? (
                <UserPlus className="h-5 w-5" />
              ) : mode === "verify" ? (
                <Mail className="h-5 w-5" />
              ) : mode === "reset" ? (
                <KeyRound className="h-5 w-5" />
              ) : (
                <ShieldCheck className="h-5 w-5" />
              )}
            </div>
            <h1 className="mt-5 font-display text-2xl font-semibold text-foreground">{title}</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
            <form
              className="mt-6 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                submit();
              }}
            >
              {mode === "register" ? (
                <label className="block text-sm font-medium text-foreground">
                  Full Name
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="mt-2 h-11 w-full rounded-md border border-input bg-secondary/70 px-3 outline-none transition focus:border-primary"
                    required
                  />
                </label>
              ) : null}
              {mode !== "reset" ? (
                <label className="block text-sm font-medium text-foreground">
                  Email
                  <input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    type="email"
                    className="mt-2 h-11 w-full rounded-md border border-input bg-secondary/70 px-3 outline-none transition focus:border-primary"
                    required
                  />
                </label>
              ) : null}
              {mode === "reset" || mode === "verify" ? (
                <label className="block text-sm font-medium text-foreground">
                  {mode === "reset" ? "Reset token" : "Verification token"}
                  <input
                    value={token}
                    onChange={(event) => setToken(event.target.value)}
                    placeholder="Paste the token from your email"
                    className="mt-2 h-11 w-full rounded-md border border-input bg-secondary/70 px-3 font-mono text-xs outline-none transition focus:border-primary"
                    required
                  />
                </label>
              ) : null}
              {mode !== "forgot" && mode !== "verify" ? (
                <label className="block text-sm font-medium text-foreground">
                  Password
                  <span className="relative mt-2 block">
                    <input
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      type={showPassword ? "text" : "password"}
                      className="h-11 w-full rounded-md border border-input bg-secondary/70 px-3 pr-11 outline-none transition focus:border-primary"
                      required
                      minLength={8}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-muted"
                      aria-label="Toggle password visibility"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </span>
                </label>
              ) : null}
              {mode === "register" || mode === "reset" ? (
                <label className="block text-sm font-medium text-foreground">
                  Confirm Password
                  <input
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    type={showPassword ? "text" : "password"}
                    className="mt-2 h-11 w-full rounded-md border border-input bg-secondary/70 px-3 outline-none transition focus:border-primary"
                    required
                    minLength={8}
                  />
                </label>
              ) : null}
              {mode === "login" ? (
                <div className="flex items-center justify-between gap-3 text-sm">
                  <label className="flex items-center gap-2 text-muted-foreground">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-primary"
                      checked={remember}
                      onChange={(event) => setRemember(event.target.checked)}
                    />
                    Remember me
                  </label>
                  <Link to="/forgot-password" className="text-primary hover:underline">
                    Forgot password?
                  </Link>
                </div>
              ) : null}
              {notice ? (
                <p
                  role="status"
                  className="rounded-md border border-success/40 bg-success/10 px-3 py-2 text-sm text-success"
                >
                  {notice}
                </p>
              ) : null}
              {error ? (
                <p
                  role="alert"
                  className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  {error}
                </p>
              ) : null}
              {devToken ? (
                <div className="rounded-md border border-border bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">
                    No mail provider is configured in this environment, so the token is shown here:
                  </p>
                  <p className="mt-1 break-all font-mono">{devToken}</p>
                  <Button
                    type="button"
                    variant="secondary"
                    className="mt-2 w-full"
                    onClick={() => {
                      // The next page mounts fresh, so the token has to travel in
                      // the URL. Local state here would be thrown away.
                      void navigate({
                        to: mode === "forgot" ? "/reset-password" : "/email-verification",
                        search: { token: devToken },
                      });
                    }}
                  >
                    Continue with this token
                  </Button>
                </div>
              ) : null}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading
                  ? "Please wait..."
                  : mode === "login"
                    ? "Sign in"
                    : mode === "register"
                      ? "Create account"
                      : mode === "forgot"
                        ? "Send reset link"
                        : mode === "verify"
                          ? "Verify email"
                          : "Reset password"}
              </Button>
              {mode === "verify" && !devToken ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  disabled={loading}
                  onClick={async () => {
                    setError(null);
                    setNotice(null);

                    try {
                      const result = await api.auth.requestEmailVerification(email);

                      setNotice(
                        result.message ??
                          "If that account exists, a verification link is on its way.",
                      );

                      if (result.devToken) {
                        setToken(result.devToken);
                        setDevToken(result.devToken);
                      }
                    } catch (caught) {
                      setError(
                        caught instanceof Error && caught.message
                          ? caught.message
                          : "Could not send a verification link.",
                      );
                    }
                  }}
                >
                  Resend verification link
                </Button>
              ) : null}
            </form>
            <p className="mt-6 text-center text-sm text-muted-foreground">
              {mode === "login" ? (
                <>
                  New to NEXUS?{" "}
                  <Link to="/register" className="text-primary hover:underline">
                    Create account
                  </Link>
                </>
              ) : mode === "register" ? (
                <>
                  Already have an account?{" "}
                  <Link to="/login" className="text-primary hover:underline">
                    Sign in
                  </Link>
                </>
              ) : (
                <Link to="/login" className="text-primary hover:underline">
                  Return to sign in
                </Link>
              )}
            </p>
          </Card>
        </div>
      </section>
    </main>
  );
}

const workspaceTypes = ["Software Development", "Marketing", "Education", "Operations", "Other"];

export function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [workspaceType, setWorkspaceType] = useState("Software Development");
  const [organization, setOrganization] = useState("NEXUS Labs");
  const [project, setProject] = useState("Payment Platform");
  const [teammates, setTeammates] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Held back instead of navigating straight away, so the last step can confirm
  // what was actually created rather than flashing past it.
  const [result, setResult] = useState<SetupResult | null>(null);
  const [saving, setSaving] = useState(false);

  const finish = async () => {
    setSaving(true);
    setError(null);

    try {
      const completed = await api.onboarding.complete({
        organization,
        project,
        workspaceType,
        teammateEmails: teammates
          .split(/[\s,;]+/)
          .map((value) => value.trim())
          .filter(Boolean),
      });

      setResult(completed);
      setStep(6);
    } catch (caught) {
      setError(
        caught instanceof Error && caught.message
          ? caught.message
          : "Could not finish workspace setup.",
      );
    } finally {
      setSaving(false);
    }
  };

  const openWorkspace = async () => {
    // Pick up the new organization and project in the provider.
    window.dispatchEvent(new Event(AUTHENTICATED_EVENT));
    await navigate({ to: "/app" });
  };

  const isSummary = step === 6;

  const content = [
    {
      title: "Welcome to NEXUS",
      body: "Let's configure the workspace your team will use to plan, communicate, and deliver.",
    },
    {
      title: "Create organization",
      body: "Your organization keeps people, projects, permissions, and reporting together.",
    },
    {
      title: "Choose workspace type",
      body: "We'll tailor starter workflows and terminology to how your team operates.",
    },
    {
      title: "Invite teammates",
      body: "Bring in collaborators now, or invite them later from organization settings.",
    },
    {
      title: "Create first project",
      body: "Give your team a clear place to organize the work that matters most.",
    },
  ][step - 1];

  if (!content && !isSummary) return null;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        <div className="mb-8 flex items-center justify-between">
          <BrandMark />
          <span className="text-sm text-muted-foreground">
            {isSummary ? "All set" : `${step} / 5`}
          </span>
        </div>
        <ProgressBar value={isSummary ? 100 : step * 20} />
        <Card className="mt-5 p-6 sm:p-8">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">
            {isSummary ? "Workspace ready" : "Workspace setup"}
          </p>
          <h1 className="mt-3 font-display text-3xl font-semibold text-foreground">
            {isSummary ? "Your workspace is ready" : content?.title}
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {isSummary
              ? "Here is what was created. Open the workspace to start planning work."
              : content?.body}
          </p>
          <div className="mt-7 min-h-44">
            {step === 1 ? (
              <div className="grid gap-3 sm:grid-cols-3">
                {["Projects", "Communication", "Insights"].map((item) => (
                  <div
                    key={item}
                    className="rounded-md border border-border bg-secondary/50 p-4 text-center text-sm text-foreground"
                  >
                    {item}
                  </div>
                ))}
              </div>
            ) : null}
            {step === 2 ? (
              <label className="block text-sm font-medium">
                Organization name
                <input
                  value={organization}
                  onChange={(event) => setOrganization(event.target.value)}
                  className="mt-2 h-11 w-full rounded-md border border-input bg-secondary/70 px-3 outline-none focus:border-primary"
                />
              </label>
            ) : null}
            {step === 3 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {workspaceTypes.map((type) => (
                  <button
                    key={type}
                    onClick={() => setWorkspaceType(type)}
                    className={cn(
                      "rounded-md border p-4 text-left text-sm transition",
                      workspaceType === type
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-secondary/50 text-foreground hover:border-primary/50",
                    )}
                  >
                    {type}
                  </button>
                ))}
              </div>
            ) : null}
            {step === 4 ? (
              <label className="block text-sm font-medium">
                Teammate emails
                <textarea
                  value={teammates}
                  onChange={(event) => setTeammates(event.target.value)}
                  className="mt-2 min-h-28 w-full rounded-md border border-input bg-secondary/70 p-3 outline-none focus:border-primary"
                  placeholder="amit@company.com, priya@company.com"
                />
              </label>
            ) : null}
            {step === 5 ? (
              <label className="block text-sm font-medium">
                Project name
                <input
                  value={project}
                  onChange={(event) => setProject(event.target.value)}
                  className="mt-2 h-11 w-full rounded-md border border-input bg-secondary/70 px-3 outline-none focus:border-primary"
                />
              </label>
            ) : null}
            {isSummary && result ? (
              <dl className="grid gap-3">
                <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-secondary/50 px-4 py-3">
                  <dt className="text-sm text-muted-foreground">Organization</dt>
                  <dd className="flex min-w-0 items-center gap-2 text-sm font-medium text-foreground">
                    <Avatar name={result.organization.name} />
                    <span className="truncate">{result.organization.name}</span>
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-secondary/50 px-4 py-3">
                  <dt className="text-sm text-muted-foreground">Workspace type</dt>
                  <dd className="text-sm font-medium text-foreground">{workspaceType}</dd>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-secondary/50 px-4 py-3">
                  <dt className="text-sm text-muted-foreground">First project</dt>
                  <dd className="truncate text-sm font-medium text-foreground">
                    {result.project.name}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-secondary/50 px-4 py-3">
                  <dt className="text-sm text-muted-foreground">Teammates added</dt>
                  <dd>
                    {result.membersAdded.length ? (
                      <Badge tone="success">{result.membersAdded.length} added</Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">None</span>
                    )}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-secondary/50 px-4 py-3">
                  <dt className="text-sm text-muted-foreground">Invitations sent</dt>
                  <dd>
                    {result.invitesPending.length ? (
                      <Badge tone="info">{result.invitesPending.length} pending</Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">None</span>
                    )}
                  </dd>
                </div>
                {result.invitesPending.length ? (
                  <p className="text-xs text-muted-foreground">
                    Invitations are on their way to {result.invitesPending.join(", ")}. They can
                    accept from the link in the email.
                  </p>
                ) : null}
              </dl>
            ) : null}
          </div>
          {error ? (
            <p
              role="alert"
              className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          ) : null}
          <div className="mt-7 flex justify-between gap-3">
            <Button
              variant="secondary"
              onClick={() => setStep(Math.max(1, step - 1))}
              disabled={step === 1 || saving || isSummary}
            >
              Back
            </Button>
            {isSummary ? (
              <Button onClick={() => void openWorkspace()}>Open workspace</Button>
            ) : (
              <Button disabled={saving} onClick={() => (step < 5 ? setStep(step + 1) : finish())}>
                {saving ? "Setting up..." : step === 5 ? "Create workspace" : "Continue"}
              </Button>
            )}
          </div>
        </Card>
      </div>
    </main>
  );
}
