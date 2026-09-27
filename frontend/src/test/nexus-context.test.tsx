import {
  render,
  renderHook,
  screen,
  waitFor,
  waitFor as waitForHook,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NexusProvider, useNexus } from "@/context/NexusContext";

/*
  AppShell only needs location, navigation and Link from the router. Standing up
  a real TanStack router for one assertion buys nothing, and mocking the three
  keeps the page under test in the same module graph as the provider, which a
  vi.resetModules() between the two would break.
*/
vi.mock("@tanstack/react-router", async () => {
  const actual =
    await vi.importActual<typeof import("@tanstack/react-router")>("@tanstack/react-router");

  return {
    ...actual,
    useLocation: () => ({ pathname: "/app", search: "", hash: "", state: {} }),
    useNavigate: () => vi.fn(),
    useParams: () => ({}),
    Link: ({ children }: { children: ReactNode }) => <a href="/">{children}</a>,
  };
});

/**
 * The dashboard once reported 5 projects, 72 tasks and 6 teammates for a
 * workspace holding 1 project and 0 tasks, labelled "Live". Three separate
 * causes let that happen, and each is pinned below.
 *
 * These are the tests that matter most in this codebase: they assert the app
 * never presents seed data as if it came from the server.
 */

const SEED_PROJECT_COUNT = 5;
const SEED_TASK_COUNT = 72;
const SEED_TEAM_COUNT = 6;

const REAL_USER = {
  id: "u1",
  name: "Raj Kumar",
  email: "raj@nexuslabs.dev",
  role: "Organization Admin",
  department: "Engineering",
  avatar: "RK",
  status: "Offline" as const,
  activeTasks: 0,
  completed: 0,
  workload: "Low" as const,
  projects: 0,
  completionRate: 0,
};

const REAL_PROJECT = {
  id: "p1",
  name: "Payment Platform",
  key: "PP",
  description: "",
  progress: 0,
  members: [],
  tasks: 0,
  completed: 0,
  due: "",
  status: "Active" as const,
  icon: "PP",
};

const EMPTY_ANALYTICS = {
  metrics: {
    totalProjects: 1,
    activeTasks: 0,
    completedTasks: 0,
    overdue: 0,
    completionRate: 0,
    averageCycleTimeDays: 0,
    totalUsers: 1,
  },
  progress: [],
  status: [],
  workload: [],
  productivity: [],
};

type Route = { status?: number; body?: unknown; networkError?: boolean };

/** Mocks fetch with one answer per path, defaulting to an empty success. */
const mockApi = (routes: Record<string, Route>) => {
  const calls: string[] = [];

  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);

      const path = url.replace(/^https?:\/\/[^/]+/, "").split("?")[0] ?? "";
      const route = routes[path];

      if (route?.networkError) {
        throw new TypeError("Failed to fetch");
      }

      const status = route?.status ?? 200;
      const body = route?.body ?? { message: "ok" };

      return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
      } as Response;
    }),
  );

  return calls;
};

const signIn = () => {
  window.localStorage.setItem("nexus.accessToken", "test-token");
  window.localStorage.setItem("nexus.refreshToken", "test-refresh");
};

const wrapper = ({ children }: { children: ReactNode }) => (
  <NexusProvider>{children}</NexusProvider>
);

const renderNexus = () => renderHook(() => useNexus(), { wrapper });

beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal("fetch", vi.fn());
});

describe("NexusProvider hydration", () => {
  it("shows the server's numbers, not the seed's", async () => {
    signIn();

    mockApi({
      "/api/auth/me": { body: { user: REAL_USER } },
      "/api/projects": { body: { projects: [REAL_PROJECT] } },
      "/api/tasks": { body: { tasks: [] } },
      "/api/team": { body: { users: [REAL_USER] } },
      "/api/analytics": { body: { analytics: EMPTY_ANALYTICS } },
    });

    const { result } = renderNexus();

    await waitForHook(() => expect(result.current.isDemo).toBe(false));

    expect(result.current.projects).toHaveLength(1);
    expect(result.current.tasks).toHaveLength(0);
    expect(result.current.users).toHaveLength(1);

    // The specific numbers the bug produced.
    expect(result.current.projects).not.toHaveLength(SEED_PROJECT_COUNT);
    expect(result.current.analytics.metrics?.totalProjects).toBe(1);
    expect(result.current.analytics.metrics?.totalProjects).not.toBe(SEED_PROJECT_COUNT);
    expect(result.current.users).not.toHaveLength(SEED_TEAM_COUNT);
  });

  it("keeps the panels that succeeded when one endpoint fails", async () => {
    signIn();

    // The exact shape that produced the fake dashboard: one unreachable
    // endpoint, everything else healthy.
    mockApi({
      "/api/auth/me": { body: { user: REAL_USER } },
      "/api/projects": { body: { projects: [REAL_PROJECT] } },
      "/api/tasks": { body: { tasks: [] } },
      "/api/team": { body: { users: [REAL_USER] } },
      "/api/analytics": { body: { analytics: EMPTY_ANALYTICS } },
      "/api/organizations/mine": { networkError: true },
    });

    const { result } = renderNexus();

    await waitForHook(() => expect(result.current.isDemo).toBe(false));

    // The healthy panels landed rather than being discarded together.
    expect(result.current.projects).toHaveLength(1);
    expect(result.current.analytics.metrics?.totalProjects).toBe(1);

    // And the failed one degraded to nothing rather than to the seed.
    expect(result.current.organizations).toHaveLength(0);
  });

  it("never reports the seed task count once the server answered", async () => {
    signIn();

    mockApi({
      "/api/auth/me": { body: { user: REAL_USER } },
      "/api/projects": { body: { projects: [] } },
      "/api/tasks": { body: { tasks: [] } },
      "/api/team": { body: { users: [] } },
      "/api/analytics": { body: { analytics: EMPTY_ANALYTICS } },
    });

    const { result } = renderNexus();

    await waitForHook(() => expect(result.current.isDemo).toBe(false));

    expect(result.current.tasks).toHaveLength(0);
    expect(result.current.analytics.metrics?.activeTasks).toBe(0);
    expect(result.current.analytics.metrics?.activeTasks).not.toBe(SEED_TASK_COUNT);
  });

  it("stays in demo mode with the seed when there is no session", async () => {
    mockApi({});

    const { result } = renderNexus();

    await waitForHook(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isDemo).toBe(true);
    expect(result.current.projects).toHaveLength(SEED_PROJECT_COUNT);
  });

  it("treats a 403 on audit logs as empty, not as a failure", async () => {
    signIn();

    mockApi({
      "/api/auth/me": { body: { user: REAL_USER } },
      "/api/projects": { body: { projects: [] } },
      "/api/tasks": { body: { tasks: [] } },
      "/api/team": { body: { users: [REAL_USER] } },
      "/api/analytics": { body: { analytics: EMPTY_ANALYTICS } },
      // A plain member cannot read the audit log. That is an expected answer.
      "/api/audit-logs": { status: 403, body: { message: "restricted" } },
    });

    const { result } = renderNexus();

    await waitForHook(() => expect(result.current.isDemo).toBe(false));

    expect(result.current.auditLogs).toEqual([]);
  });

  it("derives the role list from the loaded team, not a fixed catalogue", async () => {
    signIn();

    mockApi({
      "/api/auth/me": { body: { user: REAL_USER } },
      "/api/projects": { body: { projects: [] } },
      "/api/tasks": { body: { tasks: [] } },
      "/api/team": {
        body: { users: [REAL_USER, { ...REAL_USER, id: "u2", name: "Amit", role: "Member" }] },
      },
      "/api/analytics": { body: { analytics: EMPTY_ANALYTICS } },
    });

    const { result } = renderNexus();

    await waitForHook(() => expect(result.current.isDemo).toBe(false));

    expect(result.current.roles).toEqual(["Member", "Organization Admin"]);

    // The six roles the old catalogue advertised cannot be assigned.
    expect(result.current.roles).not.toContain("SUPER ADMIN");
    expect(result.current.roles).not.toContain("PROJECT MANAGER");
  });
});

describe("DashboardPage numbers", () => {
  it("renders the API's metrics rather than the seed's", async () => {
    signIn();

    mockApi({
      "/api/auth/me": { body: { user: REAL_USER } },
      "/api/projects": { body: { projects: [REAL_PROJECT] } },
      "/api/tasks": { body: { tasks: [] } },
      "/api/team": { body: { users: [REAL_USER] } },
      "/api/analytics": { body: { analytics: EMPTY_ANALYTICS } },
    });

    const { DashboardPage } = await import("@/pages/AppPages");
    const { CallProvider } = await import("@/context/CallContext");

    // The same provider stack the root route mounts, minus the router.
    render(
      <NexusProvider>
        <CallProvider>
          <DashboardPage />
        </CallProvider>
      </NexusProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Total Projects")).toBeInTheDocument();
    });

    // The card holding the label, so the seed's 5 cannot be mistaken for it.
    const card = screen.getByText("Total Projects").closest("div")?.parentElement;

    await waitFor(() => {
      expect(card?.textContent).toContain("1");
    });

    expect(screen.queryByText(String(SEED_PROJECT_COUNT))).not.toBeInTheDocument();
  });
});
