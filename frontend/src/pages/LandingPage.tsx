import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Files,
  LockKeyhole,
  MessageSquare,
  Search,
  Shield,
  Sparkles,
  Workflow,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge, BrandMark, Card, ProgressBar } from "@/components/nexus/primitives";

const features: Array<[string, string, LucideIcon]> = [
  [
    "Project Management",
    "Plan work, track ownership, and keep delivery signals visible.",
    Workflow,
  ],
  [
    "Real-time Collaboration",
    "Channel conversations, mentions, reactions, and shared context.",
    MessageSquare,
  ],
  ["Team Analytics", "Velocity, workload, cycle time, and completion insights.", BarChart3],
  [
    "Enterprise Security",
    "Role-based access, audit history, and secure workspace controls.",
    Shield,
  ],
  ["File Management", "Keep documentation, reports, and technical artifacts close to work.", Files],
  ["Powerful Search", "Find projects, tasks, people, files, and conversations instantly.", Search],
];

export function LandingPage() {
  return (
    <div className="min-h-screen overflow-hidden bg-background text-foreground">
      <header className="fixed left-0 right-0 top-0 z-40 border-b border-border bg-background/78 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <BrandMark />
          <nav
            className="hidden items-center gap-6 text-sm text-muted-foreground md:flex"
            aria-label="Marketing navigation"
          >
            <a href="#platform" className="transition hover:text-foreground">
              Platform
            </a>
            <a href="#security" className="transition hover:text-foreground">
              Security
            </a>
            <a href="#showcase" className="transition hover:text-foreground">
              Showcase
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="ghost" asChild>
              <Link to="/login">Sign in</Link>
            </Button>
            <Button asChild>
              <Link to="/app">View Demo</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative mx-auto grid min-h-[92vh] max-w-7xl items-center gap-12 px-4 pb-20 pt-28 sm:px-6 lg:grid-cols-[minmax(0,0.82fr)_minmax(460px,1fr)]">
          <div className="nexus-enter max-w-3xl">
            <Badge tone="info">
              <Sparkles className="mr-1 h-3 w-3" /> Built for serious teams
            </Badge>
            <h1 className="mt-6 font-display text-5xl font-semibold leading-tight tracking-normal text-foreground sm:text-6xl lg:text-7xl">
              NEXUS
            </h1>
            <p className="mt-5 font-display text-3xl font-semibold leading-tight text-foreground sm:text-5xl">
              One workspace.
              <br />
              Every team.
              <br />
              Complete visibility.
            </p>
            <p className="mt-6 max-w-2xl text-base leading-8 text-muted-foreground sm:text-lg">
              Plan projects, manage tasks, collaborate with your team, communicate in real time, and
              understand your organization's performance — all from one intelligent workspace.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" asChild>
                <Link to="/register">
                  Get Started <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="secondary" asChild>
                <Link to="/app">View Demo</Link>
              </Button>
            </div>
          </div>

          <div className="relative nexus-enter" id="showcase">
            <div className="surface-card rounded-lg p-3 shadow-2xl">
              <div className="grid grid-cols-[1.05fr_0.95fr] gap-3">
                <div className="space-y-3">
                  <div className="rounded-md border border-border bg-secondary/50 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Payment Platform</span>
                      <Badge tone="success">72%</Badge>
                    </div>
                    <ProgressBar value={72} className="mt-3" />
                  </div>
                  {[
                    "NEX-142 Implement payment webhook",
                    "NEX-124 JWT Authentication",
                    "NEX-151 Payment validation",
                  ].map((task, index) => (
                    <div
                      key={task}
                      className="rounded-md border border-border bg-elevated p-3 transition hover:border-primary/60"
                      style={{ animationDelay: `${index * 90}ms` }}
                    >
                      <p className="truncate text-sm font-medium text-foreground">{task}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Backend · High priority · Raj
                      </p>
                    </div>
                  ))}
                </div>
                <div className="space-y-3">
                  <div className="rounded-md border border-border bg-secondary/50 p-3">
                    <p className="text-sm font-medium">Weekly productivity</p>
                    <div className="mt-4 flex h-28 items-end gap-2">
                      {[48, 66, 58, 82, 74, 26, 18].map((height, index) => (
                        <span
                          key={index}
                          className="flex-1 rounded-t bg-primary/70 transition-all hover:bg-primary"
                          style={{ height: `${height}%` }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="rounded-md border border-border bg-elevated p-3">
                    <p className="text-xs text-muted-foreground">Team activity</p>
                    <p className="mt-2 text-sm text-foreground">Priya mentioned Raj in #backend</p>
                    {/*
                      This panel is an illustration on the marketing page, not a
                      live feed. It used to read "Raj is typing..." in a fixed
                      primary colour, which is indistinguishable from a real
                      typing indicator for anyone who saw the app and the
                      landing page side by side. Labelled as a sample instead.
                    */}
                    <p className="mt-1 text-xs text-muted-foreground">Sample activity</p>
                  </div>
                  <div className="rounded-md border border-border bg-elevated p-3">
                    <p className="text-xs text-muted-foreground">Notifications</p>
                    <p className="mt-2 text-sm text-foreground">3 urgent updates need review</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="glow-line absolute -bottom-6 left-16 h-px w-2/3" />
          </div>
        </section>

        <section className="border-y border-border bg-panel/40 py-8">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-8 px-4 text-sm font-medium text-muted-foreground sm:px-6">
            <span>Trusted by modern teams</span>
            <span>FintechOps</span>
            <span>Cloudlane</span>
            <span>Northstar AI</span>
            <span>Atlas Systems</span>
            <span>SignalWorks</span>
          </div>
        </section>

        <section id="platform" className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <div className="max-w-2xl">
            <h2 className="font-display text-3xl font-semibold text-foreground sm:text-4xl">
              Everything your team needs
            </h2>
            <p className="mt-4 text-sm leading-7 text-muted-foreground">
              A cohesive command center for delivery, collaboration, analytics, files, security, and
              workflow automation.
            </p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(([title, description, Icon]) => (
              <Card key={title} interactive>
                <Icon className="h-5 w-5 text-primary" />
                <h3 className="mt-5 font-display text-lg font-semibold text-foreground">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
              </Card>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
          <Card className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[0.8fr_1.2fr]" id="security">
            <div>
              <Badge tone="accent">
                <LockKeyhole className="mr-1 h-3 w-3" /> Enterprise security
              </Badge>
              <h2 className="mt-5 font-display text-3xl font-semibold text-foreground">
                Built for teams that move fast.
              </h2>
              <p className="mt-4 text-sm leading-7 text-muted-foreground">
                Security, auditability, and governance are built into the daily workflow instead of
                buried in admin screens.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {["Role-based access", "Audit logs", "Secure authentication", "Data isolation"].map(
                (item) => (
                  <div
                    key={item}
                    className="flex items-center gap-3 rounded-md border border-border bg-secondary/50 p-4"
                  >
                    <CheckCircle2 className="h-5 w-5 text-success" />
                    <span className="text-sm font-medium text-foreground">{item}</span>
                  </div>
                ),
              )}
            </div>
          </Card>
        </section>

        <section className="border-t border-border px-4 py-16 sm:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="font-display text-3xl font-semibold text-foreground">
              Bring your entire workflow together.
            </h2>
            <div className="mt-6">
              <Button size="lg" asChild>
                <Link to="/register">Get Started</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
