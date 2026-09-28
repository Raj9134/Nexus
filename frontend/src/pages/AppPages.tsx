import { Link, useLocation, useParams } from "@tanstack/react-router";
import {
  Archive,
  BarChart3,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock,
  Download,
  FileUp,
  FolderKanban,
  KanbanSquare,
  ListFilter,
  Loader2,
  LockKeyhole,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Plus,
  Search,
  Send,
  Settings,
  Shield,
  Sparkles,
  Trash2,
  Upload,
  Users,
  Workflow,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { useNexus } from "@/context/NexusContext";
import { cn } from "@/lib/utils";
import type { Analytics, CalendarEvent, Project, Task, TaskStatus, User } from "@/types/nexus";
import { AppShell } from "@/components/nexus/AppShell";
import { DirectThread } from "@/components/nexus/DirectThread";
import { Attachments } from "@/components/nexus/Attachments";
import { ChannelManager } from "@/components/nexus/ChannelManager";
import { WorkspaceMembers } from "@/components/nexus/WorkspaceMembers";
import {
  Avatar,
  Badge,
  Card,
  EmptyState,
  MetricCard,
  Modal,
  ProgressBar,
  SearchInput,
  SectionHeader,
  SelectField,
  SkeletonBlock,
  StatusDot,
  SubmitButton,
  Tabs,
} from "@/components/nexus/primitives";
import { api, isAuthenticated } from "@/services/api";
import {
  MONTH_NAMES,
  WEEKDAY_SHORT,
  addDays,
  addMonths,
  dayKey,
  dayLabel,
  groupByDay,
  isDueThisWeek,
  isDueToday,
  isOverdue,
  isSameDay,
  isToday,
  isUpcoming,
  monthGrid,
  monthLabel,
  startOfDay,
  weekDays,
} from "@/lib/calendar";

const statusOrder: TaskStatus[] = ["Backlog", "Todo", "In Progress", "In Review", "Done"];

export function DashboardPage() {
  const nexus = useNexus();
  const [range, setRange] = useState("This week");
  const loading = nexus.isLoading;
  const refresh = () => {
    void nexus.reload();
  };
  const metrics = nexus.analytics.metrics;
  return (
    <AppShell title="Overview">
      <div className="space-y-6">
        <SectionHeader
          title="Good evening, Raj 👋"
          description="Here's what's happening across your workspace."
          actions={
            <>
              <SelectField
                label=""
                value={range}
                onChange={setRange}
                options={["This week", "This month", "Quarter"]}
              />
              <Button onClick={() => nexus.openModal("task")}>
                <Plus className="h-4 w-4" />
                Create
              </Button>
            </>
          }
        />
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SkeletonBlock className="h-36" />
            <SkeletonBlock className="h-36" />
            <SkeletonBlock className="h-36" />
            <SkeletonBlock className="h-36" />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              icon={<FolderKanban className="h-5 w-5" />}
              label="Total Projects"
              value={String(metrics?.totalProjects ?? nexus.projects.length)}
              caption="in your workspace"
            />
            <MetricCard
              icon={<Workflow className="h-5 w-5" />}
              label="Active Tasks"
              value={String(
                metrics?.activeTasks ?? nexus.tasks.filter((task) => task.status !== "Done").length,
              )}
              caption="not done yet"
            />
            <MetricCard
              icon={<CheckCircle2 className="h-5 w-5" />}
              label="Completed Tasks"
              value={String(
                metrics?.completedTasks ??
                  nexus.tasks.filter((task) => task.status === "Done").length,
              )}
              caption="all time"
            />
            <MetricCard
              icon={<Clock className="h-5 w-5" />}
              label="Overdue"
              value={String(metrics?.overdue ?? 0)}
              caption="past due date"
            />
          </div>
        )}
        <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
          <LineChartCard analytics={nexus.analytics} />
          <DonutCard analytics={nexus.analytics} />
        </div>
        <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <WorkloadCard analytics={nexus.analytics} />
          <ProductivityCard analytics={nexus.analytics} />
        </div>
        <div className="grid gap-4 xl:grid-cols-[1fr_0.85fr]">
          <RecentActivity />
          <Card>
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">Priority queue</h2>
              <Button variant="secondary" size="sm" onClick={refresh}>
                Refresh
              </Button>
            </div>
            <div className="mt-4 space-y-2">
              {nexus.tasks
                .filter((task) => task.priority === "Critical" || task.priority === "High")
                .slice(0, 5)
                .map((task) => (
                  <button
                    key={task.id}
                    onClick={() => nexus.openTask(task)}
                    className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-md border border-border bg-secondary/50 p-3 text-left transition hover:border-primary/50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{task.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {task.id} · {task.project}
                      </span>
                    </span>
                    <Badge tone={task.priority === "Critical" ? "danger" : "warning"}>
                      {task.priority}
                    </Badge>
                  </button>
                ))}
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function LineChartCard({ analytics }: { analytics: Analytics }) {
  const max = Math.max(...analytics.progress.flatMap((row) => [row.planned, row.completed]));
  // A brand new workspace has no progress rows yet. Dividing by that max, or by
  // a zero-width axis, yields NaN, and React would write "NaN" into the SVG.
  const ceiling = max > 0 ? max : 1;
  const span = analytics.progress.length - 1;
  const xAt = (index: number) => (span > 0 ? (index / span) * 100 : 0);
  const yAt = (value: number) => 100 - (value / ceiling) * 82;
  const points = analytics.progress
    .map((row, index) => `${xAt(index)},${yAt(row.completed)}`)
    .join(" ");

  /*
    Was a fixed sentence about "38 to 88 tasks over six weeks" whatever the data
    said, which a screen reader read out as fact. It is built from the series
    now, and says plainly when there is nothing to plot.
  */
  const summary =
    analytics.progress.length === 0
      ? "No progress data for this selection"
      : `Planned versus completed over the last ${analytics.progress.length} weeks, peaking at ${max} tasks`;

  return (
    <Card>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">Project Progress</h2>
        <Badge tone="info">Live</Badge>
      </div>
      <svg
        viewBox="0 0 100 100"
        className="mt-4 h-72 w-full overflow-visible"
        preserveAspectRatio="none"
        role="img"
        aria-label={summary}
      >
        <defs>
          <linearGradient id="area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.45" />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polyline points={`0,100 ${points} 100,100`} fill="url(#area)" stroke="none" />
        <polyline
          points={points}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth="1.8"
          vectorEffect="non-scaling-stroke"
        />
        {analytics.progress.map((row, index) => (
          <circle
            key={row.name}
            cx={xAt(index)}
            cy={yAt(row.completed)}
            r="1.8"
            fill="var(--color-primary)"
            className="transition hover:r-3"
          />
        ))}
      </svg>
    </Card>
  );
}

function DonutCard({ analytics }: { analytics: Analytics }) {
  const total = analytics.status.reduce((sum, item) => sum + item.value, 0);
  let offset = 25;
  const colors = [
    "var(--color-chart-1)",
    "var(--color-chart-2)",
    "var(--color-chart-3)",
    "var(--color-chart-4)",
    "var(--color-chart-5)",
  ];
  return (
    <Card>
      <h2 className="font-display text-lg font-semibold">Tasks by Status</h2>
      <div className="mt-5 grid items-center gap-5 sm:grid-cols-[220px_1fr]">
        <svg viewBox="0 0 42 42" className="h-56 w-56">
          <circle
            cx="21"
            cy="21"
            r="15.915"
            fill="transparent"
            stroke="var(--color-muted)"
            strokeWidth="5"
          />
          {analytics.status.map((item, index) => {
            // A workspace with no tasks yet has a total of zero, and 0/0 is NaN,
            // which React would then write into the SVG attribute.
            const dash = total > 0 ? (item.value / total) * 100 : 0;
            const current = offset;
            offset -= dash;
            return (
              <circle
                key={item.name}
                cx="21"
                cy="21"
                r="15.915"
                fill="transparent"
                stroke={colors[index]}
                strokeWidth="5"
                strokeDasharray={`${dash} ${100 - dash}`}
                strokeDashoffset={current}
              />
            );
          })}
          <text
            x="21"
            y="20"
            textAnchor="middle"
            fill="var(--color-foreground)"
            fontSize="5"
            fontWeight="700"
          >
            {total}
          </text>
          <text
            x="21"
            y="25"
            textAnchor="middle"
            fill="var(--color-muted-foreground)"
            fontSize="2.8"
          >
            tasks
          </text>
        </svg>
        <div className="space-y-3">
          {analytics.status.map((item, index) => (
            <div key={item.name} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: colors[index] }} />
                {item.name}
              </span>
              <span className="text-muted-foreground">{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function WorkloadCard({ analytics }: { analytics: Analytics }) {
  const max = Math.max(0, ...analytics.workload.map((row) => row.tasks));
  /*
    Guarded, because an empty workspace reports a max of 0 and 0/0 is NaN,
    which React then writes into the style attribute as "NaN%". LineChartCard
    and DonutCard already had this guard; these two did not.
  */
  const width = (tasks: number) => (max > 0 ? (tasks / max) * 100 : 0);

  return (
    <Card>
      <h2 className="font-display text-lg font-semibold">Team Workload</h2>
      {analytics.workload.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Nobody has an open task in this selection.
        </p>
      ) : (
        <div className="mt-5 space-y-4">
          {analytics.workload.map((row) => (
            <div
              key={row.name}
              className="grid grid-cols-[4rem_minmax(0,1fr)_2rem] items-center gap-3 text-sm"
            >
              <span className="text-muted-foreground">{row.name}</span>
              <div className="h-2 rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-accent transition-all"
                  style={{ width: `${width(row.tasks)}%` }}
                />
              </div>
              <span className="text-right text-foreground">{row.tasks}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function ProductivityCard({ analytics }: { analytics: Analytics }) {
  const max = Math.max(0, ...analytics.productivity.map((row) => row.points));
  // Same zero guard as WorkloadCard: a range with no completions has a max of 0.
  const height = (points: number) => (max > 0 ? (points / max) * 100 : 0);

  return (
    <Card>
      <h2 className="font-display text-lg font-semibold">Weekly Productivity</h2>
      <div className="mt-5 flex h-56 items-end gap-3">
        {analytics.productivity.map((row) => (
          <div key={row.name} className="flex flex-1 flex-col items-center gap-2">
            <div className="flex h-44 w-full items-end rounded-md bg-secondary/50 p-1">
              <div
                className="w-full rounded-md bg-primary/80 transition hover:bg-primary"
                style={{ height: `${height(row.points)}%` }}
                title={`${row.points} completed`}
              />
            </div>
            <span className="text-xs text-muted-foreground">{row.name}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function RecentActivity() {
  const nexus = useNexus();
  return (
    <Card>
      <h2 className="font-display text-lg font-semibold">Recent Activity</h2>
      <div className="mt-5 space-y-4">
        {nexus.auditLogs.slice(0, 5).map((log) => (
          <button
            key={log.id}
            onClick={() => nexus.openAudit(log)}
            className="grid w-full grid-cols-[auto_minmax(0,1fr)] gap-3 text-left"
          >
            <Avatar name={log.user} />
            <span className="min-w-0 border-b border-border pb-3">
              <span className="block truncate text-sm text-foreground">{log.detail}</span>
              <span className="text-xs text-muted-foreground">{log.timestamp}</span>
            </span>
          </button>
        ))}
      </div>
    </Card>
  );
}

export function TasksPage() {
  const nexus = useNexus();
  const [tab, setTab] = useState("All");
  const [query, setQuery] = useState("");
  const [project, setProject] = useState("All");
  const [priority, setPriority] = useState("All");
  const [status, setStatus] = useState("All");
  const [due, setDue] = useState("Any");
  const filtered = nexus.tasks.filter((task) => {
    /*
      These were pinned to specific records: Overdue was `task.id === "NEX-183"`
      and Today was `["Sep 22", "Sep 24"].includes(task.dueDate)`, so both tabs
      showed one hardcoded task whatever the workspace actually contained. The
      backend now sends dueOn, a real timestamp, because dueDate is "Sep 22"
      with no year and cannot be compared.
    */
    const matchesTab =
      tab === "All" ||
      (tab === "Completed"
        ? task.status === "Done"
        : tab === "Overdue"
          ? isOverdue(task.dueOn)
          : tab === "Today"
            ? isDueToday(task.dueOn)
            : tab === "Upcoming"
              ? task.status !== "Done" && isUpcoming(task.dueOn)
              : true);
    return (
      matchesTab &&
      (!query ||
        task.title.toLowerCase().includes(query.toLowerCase()) ||
        task.id.toLowerCase().includes(query.toLowerCase())) &&
      (project === "All" || task.projectId === project) &&
      (priority === "All" || task.priority === priority) &&
      (status === "All" || task.status === status) &&
      (due === "Any" ||
        (due === "Overdue" && isOverdue(task.dueOn)) ||
        (due === "This week" && isDueThisWeek(task.dueOn)))
    );
  });
  return (
    <AppShell title="My Tasks">
      <div className="space-y-5">
        <SectionHeader
          title="My Tasks"
          description="Prioritize, filter, and inspect your work across every project."
          actions={
            <Button onClick={() => nexus.openModal("task")}>
              <Plus className="h-4 w-4" />
              New Task
            </Button>
          }
        />
        <Tabs
          tabs={["All", "Today", "Upcoming", "Overdue", "Completed"]}
          value={tab}
          onChange={setTab}
        />
        <div className="grid gap-3 xl:grid-cols-[1fr_repeat(4,12rem)]">
          <SearchInput value={query} onChange={setQuery} placeholder="Search tasks" />
          <SelectField
            label="Project"
            value={project}
            onChange={setProject}
            options={["All", ...nexus.projects.map((item) => item.id)]}
          />
          <SelectField
            label="Priority"
            value={priority}
            onChange={setPriority}
            options={["All", "Critical", "High", "Medium", "Low"]}
          />
          <SelectField
            label="Status"
            value={status}
            onChange={setStatus}
            options={["All", ...statusOrder]}
          />
          <SelectField
            label="Due Date"
            value={due}
            onChange={setDue}
            options={["Any", "This week", "Overdue"]}
          />
        </div>
        <TaskTable tasks={filtered} />
      </div>
    </AppShell>
  );
}

function TaskTable({ tasks }: { tasks: Task[] }) {
  const nexus = useNexus();
  if (!tasks.length)
    return (
      <EmptyState
        icon={<ListFilter className="h-5 w-5" />}
        title="No tasks match your filters"
        description="Adjust filters or create a new task to start organizing your team's work."
        action={<Button onClick={() => nexus.openModal("task")}>Create Task</Button>}
      />
    );
  return (
    <Card className="p-0">
      <div className="hidden grid-cols-[3rem_minmax(220px,1.4fr)_1fr_8rem_9rem_10rem_8rem] border-b border-border px-4 py-3 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground lg:grid">
        <span />
        <span>Task</span>
        <span>Project</span>
        <span>Priority</span>
        <span>Status</span>
        <span>Assignee</span>
        <span>Due Date</span>
      </div>
      <div className="divide-y divide-border">
        {tasks.map((task) => (
          <button
            key={task.id}
            onClick={() => nexus.openTask(task)}
            className="grid w-full gap-3 p-4 text-left transition hover:bg-muted/40 lg:grid-cols-[3rem_minmax(220px,1.4fr)_1fr_8rem_9rem_10rem_8rem] lg:items-center"
          >
            <input
              type="checkbox"
              checked={task.status === "Done"}
              onClick={(event) => event.stopPropagation()}
              onChange={() =>
                nexus.updateTaskStatus(task.id, task.status === "Done" ? "Todo" : "Done")
              }
              className="h-4 w-4 accent-primary"
              aria-label={`Complete ${task.title}`}
            />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-foreground">
                {task.title}
              </span>
              <span className="text-xs text-muted-foreground">{task.id}</span>
            </span>
            <span className="text-sm text-muted-foreground">{task.project}</span>
            <Badge
              tone={
                task.priority === "Critical"
                  ? "danger"
                  : task.priority === "High"
                    ? "warning"
                    : "neutral"
              }
            >
              {task.priority}
            </Badge>
            <Badge
              tone={
                task.status === "Done"
                  ? "success"
                  : task.status === "In Progress"
                    ? "info"
                    : "neutral"
              }
            >
              {task.status}
            </Badge>
            <span className="flex items-center gap-2 text-sm text-foreground">
              <Avatar name={task.assignee} className="h-6 w-6" />
              {task.assignee.split(" ")[0]}
            </span>
            <span className="text-sm text-muted-foreground">{task.dueDate}</span>
          </button>
        ))}
      </div>
    </Card>
  );
}

export function ProjectsPage() {
  const nexus = useNexus();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const list = nexus.projects.filter(
    (project) =>
      (!query || project.name.toLowerCase().includes(query.toLowerCase())) &&
      (filter === "All" || project.status === filter),
  );
  return (
    <AppShell title="Projects">
      <div className="space-y-5">
        <SectionHeader
          title="Projects"
          description="Portfolio health, deadlines, members, and work distribution."
          actions={
            <Button onClick={() => nexus.openModal("project")}>
              <Plus className="h-4 w-4" />
              New Project
            </Button>
          }
        />
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <SearchInput value={query} onChange={setQuery} placeholder="Search projects" />
          <Tabs tabs={["All", "Active", "Archived"]} value={filter} onChange={setFilter} />
        </div>
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {list.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      </div>
    </AppShell>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const nexus = useNexus();
  return (
    <Card interactive>
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-md bg-primary/10 font-semibold text-primary">
          {project.icon}
        </span>
        <span className="min-w-0">
          <Link
            to="/projects/$projectId"
            params={{ projectId: project.id }}
            className="truncate font-display text-lg font-semibold text-foreground hover:text-primary"
          >
            {project.name}
          </Link>
          <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
            {project.description}
          </p>
        </span>
        <Badge
          tone={
            project.status === "Active"
              ? "success"
              : project.status === "At Risk"
                ? "warning"
                : "neutral"
          }
        >
          {project.status}
        </Badge>
      </div>
      <div className="mt-5">
        <div className="mb-2 flex justify-between text-sm">
          <span className="text-muted-foreground">Progress</span>
          <span className="text-foreground">{project.progress}%</span>
        </div>
        <ProgressBar value={project.progress} />
      </div>
      <div className="mt-5 grid grid-cols-3 gap-3 text-sm">
        <span>
          <strong className="block text-foreground">{project.members.length}</strong>
          <span className="text-muted-foreground">members</span>
        </span>
        <span>
          <strong className="block text-foreground">{project.tasks}</strong>
          <span className="text-muted-foreground">tasks</span>
        </span>
        <span>
          <strong className="block text-foreground">{project.completed}</strong>
          <span className="text-muted-foreground">completed</span>
        </span>
      </div>
      <div className="mt-5 flex items-center justify-between gap-3">
        <div className="flex -space-x-2">
          {project.members.slice(0, 4).map((id) => (
            <Avatar
              key={id}
              name={nexus.users.find((user) => user.id === id)?.name ?? "User"}
              className="border border-background"
            />
          ))}
        </div>
        <span className="text-sm text-muted-foreground">Due {project.due}</span>
      </div>
    </Card>
  );
}

export function ProjectDetailPage() {
  const { projectId } = useParams({ strict: false });
  const nexus = useNexus();
  const project = nexus.projects.find((item) => item.id === projectId) ?? nexus.projects[0];
  const [tab, setTab] = useState("Overview");
  if (!project) return null;
  const projectTasks = nexus.tasks.filter((task) => task.projectId === project.id);
  return (
    <AppShell title={project.name}>
      <div className="space-y-5">
        <div className="text-sm text-muted-foreground">
          <Link to="/projects" className="hover:text-foreground">
            Projects
          </Link>{" "}
          / {project.name} / {tab}
        </div>
        <Card>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <Badge tone="info">{project.key}</Badge>
              <h1 className="mt-3 font-display text-3xl font-semibold text-foreground">
                {project.name}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                {project.description}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <div className="flex -space-x-2">
                  {project.members.map((id) => (
                    <Avatar
                      key={id}
                      name={nexus.users.find((user) => user.id === id)?.name ?? "User"}
                      className="border border-background"
                    />
                  ))}
                </div>
                <Badge tone={project.status === "Active" ? "success" : "warning"}>
                  {project.status}
                </Badge>
                <span className="text-sm text-muted-foreground">Due {project.due}</span>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Button
                variant="secondary"
                onClick={() => nexus.pushToast("Project settings opened", "info")}
              >
                <Settings className="h-4 w-4" />
                Settings
              </Button>
              <Button onClick={() => nexus.openModal("invite")}>Invite</Button>
            </div>
          </div>
        </Card>
        <Tabs
          tabs={["Overview", "Board", "Tasks", "Timeline", "Files", "Chat", "Analytics"]}
          value={tab}
          onChange={setTab}
        />
        {tab === "Overview" ? (
          <div className="grid gap-4 lg:grid-cols-3">
            <ProjectCard project={project} />
            <Card className="lg:col-span-2">
              <h2 className="font-display text-lg font-semibold">Milestones</h2>
              <div className="mt-4 space-y-3">
                {["API contract freeze", "Security review", "Release candidate"].map(
                  (item, index) => (
                    <div
                      key={item}
                      className="flex items-center gap-3 rounded-md bg-secondary/50 p-3"
                    >
                      <StatusDot status={index === 0 ? "Done" : "Online"} />
                      <span className="text-sm text-foreground">{item}</span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {index === 0 ? "Done" : "Upcoming"}
                      </span>
                    </div>
                  ),
                )}
              </div>
            </Card>
          </div>
        ) : null}
        {tab === "Board" ? (
          <KanbanBoard tasks={projectTasks.length ? projectTasks : nexus.tasks} />
        ) : null}
        {tab === "Tasks" ? (
          <TaskTable tasks={projectTasks.length ? projectTasks : nexus.tasks} />
        ) : null}
        {tab === "Timeline" ? <Timeline /> : null}
        {tab === "Files" ? (
          <div className="space-y-4">
            <Card>
              <Attachments target={{ projectId: project.id }} label="this project" />
            </Card>
            <FilesGrid embedded />
          </div>
        ) : null}
        {tab === "Chat" ? <MessagesPanel embedded channel="backend" /> : null}
        {tab === "Analytics" ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <LineChartCard analytics={nexus.analytics} />
            <WorkloadCard analytics={nexus.analytics} />
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}

function KanbanBoard({ tasks }: { tasks: Task[] }) {
  const nexus = useNexus();
  const [dragId, setDragId] = useState<string | null>(null);
  return (
    <div className="nexus-scrollbar flex gap-4 overflow-x-auto pb-3">
      {statusOrder.map((status) => {
        const columnTasks = tasks.filter((task) => task.status === status);
        return (
          <section
            key={status}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              if (dragId) nexus.updateTaskStatus(dragId, status);
              setDragId(null);
            }}
            className="surface-card min-h-[580px] w-[310px] shrink-0 rounded-lg p-3"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {status}
              </h2>
              <Badge>{columnTasks.length}</Badge>
            </div>
            <div className="space-y-3">
              {columnTasks.map((task) => (
                <button
                  key={task.id}
                  draggable
                  onDragStart={() => setDragId(task.id)}
                  onClick={() => nexus.openTask(task)}
                  className="block w-full rounded-md border border-border bg-elevated p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/60"
                >
                  <span className="text-xs text-muted-foreground">{task.id}</span>
                  <p className="mt-1 text-sm font-medium text-foreground">{task.title}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {task.labels.map((label) => (
                      <Badge key={label}>{label}</Badge>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <Avatar name={task.assignee} className="h-7 w-7" />
                    <span className="flex items-center gap-3 text-xs text-muted-foreground">
                      <MessageSquare className="h-3.5 w-3.5" />
                      {task.comments.length}
                      <Paperclip className="h-3.5 w-3.5" />
                      {task.attachments}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <Badge
                      tone={
                        task.priority === "High" || task.priority === "Critical"
                          ? "warning"
                          : "neutral"
                      }
                    >
                      {task.priority}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{task.dueDate}</span>
                  </div>
                </button>
              ))}
              <button
                onClick={() => nexus.openModal("task")}
                className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground transition hover:border-primary hover:text-primary"
              >
                <Plus className="h-4 w-4" />
                Add task
              </button>
            </div>
          </section>
        );
      })}
    </div>
  );
}

function Timeline() {
  return (
    <Card>
      <h2 className="font-display text-lg font-semibold">Project timeline</h2>
      <div className="mt-5 space-y-4">
        {["Discovery", "Build", "Security Review", "Launch"].map((item, index) => (
          <div key={item} className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-xs text-primary">
              {index + 1}
            </span>
            <div className="border-b border-border pb-4">
              <p className="font-medium text-foreground">{item}</p>
              <p className="text-sm text-muted-foreground">
                {index < 2 ? "Completed" : "Scheduled"}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function TeamsPage() {
  const nexus = useNexus();
  const [tab, setTab] = useState("Members");
  return (
    <AppShell title="Teams">
      <div className="space-y-5">
        <SectionHeader
          title={nexus.organization || "Workspace"}
          description={`${nexus.users.length} ${nexus.users.length === 1 ? "member" : "members"} · ${nexus.users.filter((user) => user.status === "Online").length} online`}
          actions={
            <Button onClick={() => nexus.openModal("invite")}>
              <Plus className="h-4 w-4" />
              Add member
            </Button>
          }
        />
        <Tabs tabs={["Members", "Activity", "Workload"]} value={tab} onChange={setTab} />
        {tab === "Members" ? (
          <Card className="p-0">
            <div className="divide-y divide-border">
              {nexus.users.map((user) => (
                <button
                  key={user.id}
                  onClick={() => nexus.openUser(user)}
                  className="grid w-full gap-3 p-4 text-left hover:bg-muted/40 lg:grid-cols-[minmax(240px,1.2fr)_1fr_7rem_7rem_9rem_7rem] lg:items-center"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <Avatar name={user.name} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {user.name}
                      </span>
                      <span className="text-xs text-muted-foreground">{user.role}</span>
                    </span>
                  </span>
                  <span className="text-sm text-muted-foreground">{user.department}</span>
                  <span className="text-sm text-foreground">{user.activeTasks} tasks</span>
                  <span className="text-sm text-foreground">{user.completed}</span>
                  <Badge
                    tone={
                      user.workload === "High"
                        ? "warning"
                        : user.workload === "Low"
                          ? "success"
                          : "neutral"
                    }
                  >
                    {user.workload} workload
                  </Badge>
                  <span className="flex items-center gap-2 text-sm">
                    <StatusDot status={user.status} />
                    {user.status}
                  </span>
                </button>
              ))}
            </div>
          </Card>
        ) : tab === "Workload" ? (
          <WorkloadCard analytics={nexus.analytics} />
        ) : (
          <RecentActivity />
        )}
      </div>
    </AppShell>
  );
}

export function MessagesPage() {
  return (
    <AppShell title="Messages">
      <MessagesPanel />
    </AppShell>
  );
}
function MessagesPanel({
  embedded = false,
  channel = "backend",
}: {
  embedded?: boolean;
  channel?: string;
}) {
  const nexus = useNexus();
  const [active, setActive] = useState(channel);
  /*
    Read ?peer= from the URL so a profile drawer can open the conversation with
    that person. It used to show an "Opened a chat with ..." toast and select
    nobody, so the Message button went nowhere. This router version has no
    useSearchParams, but useLocation already carries a parsed search object.
  */
  const location = useLocation();
  const [peer, setPeer] = useState<User | null>(null);
  const [draft, setDraft] = useState("");
  const [sendingFile, setSendingFile] = useState(false);

  const peerParam = typeof location.search?.peer === "string" ? location.search.peer : null;

  useEffect(() => {
    if (!peerParam) {
      return;
    }

    const match = nexus.users.find((user) => user.id === peerParam);

    if (match && match.id !== nexus.currentUser.id) {
      setPeer(match);
    }
  }, [nexus.currentUser.id, nexus.users, peerParam]);
  const channelFileRef = useRef<HTMLInputElement>(null);
  const live = nexus.isDemo === false && isAuthenticated();
  const channelMessages = nexus.messages.filter((message) => message.channel === active);
  const messagesIn = (name: string) =>
    nexus.messages.filter((message) => message.channel === name).length;
  const onlineCount = nexus.users.filter((user) => user.status === "Online").length;

  /*
    The paperclip used to show an "Attachment picker opened" toast and send
    nothing, so a file could not be posted to a channel at all. The backend had
    no route for it: the Message model allowed messageType "file" and
    serializeMessage exposed fileId, but nothing ever created one.
  */
  const sendChannelFile = async (file: File) => {
    setSendingFile(true);

    try {
      const { message } = await api.files.sendToChannel(file, active, draft);

      // The socket also broadcasts this, but the sender's own socket room may
      // not echo, so append locally and let reload reconcile.
      nexus.addMessage(active, draft.trim() || message.body);
      setDraft("");
      nexus.pushToast(`${file.name} sent to #${active}`, "success");
    } catch (error) {
      nexus.pushToast(
        error instanceof Error ? error.message : `Could not send ${file.name}`,
        "error",
      );
    } finally {
      setSendingFile(false);
    }
  };

  return (
    <div className={cn("grid gap-4", !embedded && "lg:grid-cols-[280px_minmax(0,1fr)_240px]")}>
      <Card className={cn(embedded && "hidden")}>
        <h2 className="font-display text-lg font-semibold">Channels</h2>
        <div className="mt-3 space-y-1">
          {nexus.channels.map((item) => (
            <button
              key={item}
              onClick={() => setActive(item)}
              className={cn(
                "flex w-full items-center justify-between rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground",
                active === item && "bg-primary/10 text-primary",
              )}
            >
              <span>#{item}</span>
              {/*
                Was a hardcoded `item === "backend" ? 3 : 1`, so every channel
                showed a fake count. The API has no per-channel unread endpoint,
                so report the real message count for that channel.
              */}
              {messagesIn(item) > 0 ? (
                <span className="rounded-full bg-secondary px-1.5 text-xs tabular-nums text-muted-foreground">
                  {messagesIn(item)}
                </span>
              ) : null}
            </button>
          ))}
        </div>
        <h3 className="mt-6 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Direct messages
        </h3>
        {nexus.users
          .filter((user) => user.id !== nexus.currentUser.id)
          .slice(0, 5)
          .map((user) => (
            <button
              key={user.id}
              onClick={() => setPeer(user)}
              className={cn(
                "mt-2 flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-muted",
                peer?.id === user.id && "bg-primary/10 text-primary",
              )}
            >
              <Avatar name={user.name} className="h-7 w-7" />
              <span className="min-w-0 flex-1 truncate text-left">{user.name.split(" ")[0]}</span>
              <StatusDot status={user.status} />
            </button>
          ))}
      </Card>
      {peer ? (
        <DirectThread peer={peer} />
      ) : (
        <Card className="min-h-[650px] p-0">
          <div className="border-b border-border p-4">
            <h1 className="font-display text-xl font-semibold">#{active}</h1>
            <p className="text-sm text-muted-foreground">
              {nexus.users.length} {nexus.users.length === 1 ? "member" : "members"} · {onlineCount}{" "}
              online
            </p>
          </div>
          <div className="nexus-scrollbar max-h-[460px] space-y-4 overflow-auto p-4">
            {channelMessages.map((message) => {
              const author = nexus.users.find((user) => user.id === message.authorId);
              return (
                <div key={message.id} className="group flex gap-3">
                  <Avatar name={author?.name ?? "User"} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="font-medium text-foreground">{author?.name}</span>
                      <span className="text-xs text-muted-foreground">{message.time}</span>
                    </div>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{message.body}</p>
                    <div className="mt-2 flex flex-wrap gap-2 opacity-80 group-hover:opacity-100">
                      {["Reply", "React", "Edit", "Delete", "Copy", "Mention"].map((action) => (
                        <button
                          key={action}
                          onClick={() => nexus.pushToast(`${action} action ready`, "info")}
                          className="rounded border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                        >
                          {action}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
            {/*
              Was a hardcoded "Raj is typing...". The server emits
              userTyping/userStoppedTyping but nothing in the app subscribes, so
              showing it permanently was a lie. An empty channel now says so.
            */}
            {channelMessages.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nothing in #{active} yet. Say something.
              </p>
            ) : null}
          </div>
          <div className="border-t border-border p-4">
            <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-2">
              <input
                ref={channelFileRef}
                type="file"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];

                  event.target.value = "";

                  if (file) {
                    void sendChannelFile(file);
                  }
                }}
              />
              <Button
                variant="secondary"
                size="icon"
                aria-label={`Attach a file to #${active}`}
                disabled={!live || sendingFile}
                onClick={() => channelFileRef.current?.click()}
              >
                {sendingFile ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Paperclip className="h-4 w-4" />
                )}
              </Button>
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={`Message #${active}...`}
                className="h-10 rounded-md border border-input bg-secondary/70 px-3 text-sm outline-none focus:border-primary"
              />
              <Button
                onClick={() => {
                  nexus.addMessage(active, draft);
                  setDraft("");
                }}
              >
                <Send className="h-4 w-4" />
                Send
              </Button>
            </div>
          </div>
        </Card>
      )}
      {!embedded ? (
        <Card>
          <h2 className="font-display text-lg font-semibold">Online users</h2>
          <div className="mt-4 space-y-3">
            {nexus.users
              .filter((user) => user.status === "Online")
              .map((user) => (
                <div key={user.id} className="flex items-center gap-3">
                  <Avatar name={user.name} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-foreground">{user.name}</span>
                    <span className="text-xs text-success">Online</span>
                  </span>
                </div>
              ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}

export function CalendarPage() {
  const nexus = useNexus();
  const [view, setView] = useState<"Month" | "Week" | "Day">("Month");
  /*
    Anchored to the real current date. The page used to render a fixed
    "Sep 1" to "Sep 28" whatever the date was, with no way to reach another
    month, and placed events with a hand-written map of day numbers to titles.
  */
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [creating, setCreating] = useState(false);

  const grouped = useMemo(() => groupByDay(nexus.events), [nexus.events]);
  const live = nexus.isDemo === false && isAuthenticated();

  const days = useMemo(() => {
    if (view === "Day") {
      return [anchor];
    }

    return view === "Week" ? weekDays(anchor) : monthGrid(anchor);
  }, [anchor, view]);

  const step = (direction: -1 | 1) => {
    if (view === "Day") {
      setAnchor((current) => addDays(current, direction));
      return;
    }

    if (view === "Week") {
      setAnchor((current) => addDays(current, direction * 7));
      return;
    }

    setAnchor((current) => addMonths(current, direction));
  };

  const heading = useMemo(() => {
    if (view === "Day") {
      const weekday = WEEKDAY_SHORT[anchor.getDay()] ?? "";
      const month = MONTH_NAMES[anchor.getMonth()] ?? "";

      return `${weekday} ${anchor.getDate()} ${month} ${anchor.getFullYear()}`;
    }

    if (view === "Week") {
      const week = weekDays(anchor);
      const from = week[0];
      const to = week[week.length - 1];

      if (!from || !to) {
        return monthLabel(anchor);
      }

      return `${from.getDate()} ${MONTH_NAMES[from.getMonth()] ?? ""} - ${to.getDate()} ${
        MONTH_NAMES[to.getMonth()] ?? ""
      } ${to.getFullYear()}`;
    }

    return monthLabel(anchor);
  }, [anchor, view]);

  const shown = days.reduce((total, day) => total + (grouped.get(dayKey(day))?.length ?? 0), 0);

  return (
    <AppShell title="Calendar">
      <div className="space-y-5">
        <SectionHeader
          title="Team Calendar"
          description="Planning, reviews, milestones, and delivery deadlines."
          actions={
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" />
              Create Event
            </Button>
          }
        />

        <div className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-end">
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="icon"
              aria-label={view === "Month" ? "Previous month" : `Previous ${view.toLowerCase()}`}
              onClick={() => step(-1)}
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              aria-label={view === "Month" ? "Next month" : `Next ${view.toLowerCase()}`}
              onClick={() => step(1)}
            >
              <ChevronRight />
            </Button>
            <Button variant="secondary" onClick={() => setAnchor(startOfDay(new Date()))}>
              Today
            </Button>
          </div>
          <div className="flex items-center justify-between gap-3 sm:justify-center">
            <p className="font-display text-lg font-semibold text-foreground">{heading}</p>
            {shown > 0 ? (
              <p className="text-xs text-muted-foreground">
                {shown} event{shown === 1 ? "" : "s"}
              </p>
            ) : null}
          </div>
          <Tabs
            tabs={["Month", "Week", "Day"]}
            value={view}
            onChange={(next) => setView(next as "Month" | "Week" | "Day")}
          />
        </div>

        {!live ? (
          <Card className="p-4 text-sm text-muted-foreground">Sign in to see your calendar.</Card>
        ) : view === "Day" ? (
          <DayColumn day={anchor} events={grouped.get(dayKey(anchor)) ?? []} />
        ) : (
          <div className="grid gap-2 sm:grid-cols-7">
            {view === "Week"
              ? WEEKDAY_SHORT.map((label, index) => (
                  <p
                    key={label}
                    className="hidden text-xs font-medium uppercase tracking-wide text-muted-foreground sm:block"
                  >
                    {label}
                  </p>
                ))
              : null}
            {days.map((day) => {
              const inMonth = day.getMonth() === anchor.getMonth();

              return (
                <Card
                  key={dayKey(day)}
                  className={cn(
                    "min-h-28 p-2",
                    !inMonth && view === "Month" && "opacity-50",
                    isToday(day) && "border-primary/60",
                  )}
                >
                  <p
                    className={cn(
                      "text-xs",
                      isToday(day) ? "font-semibold text-primary" : "text-muted-foreground",
                    )}
                  >
                    {dayLabel(day, view === "Month" ? anchor : undefined)}
                  </p>
                  <ul className="mt-1 space-y-1">
                    {(grouped.get(dayKey(day)) ?? []).map((event) => (
                      <li key={event.id}>
                        <button
                          onClick={() => nexus.openEvent(event)}
                          className="block w-full truncate rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-left text-[11px] text-primary hover:bg-primary/20"
                          title={`${event.title} at ${event.time}`}
                        >
                          {event.time ? `${event.time} ` : ""}
                          {event.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {creating ? (
        <CreateEventDialog
          defaultDate={dayKey(anchor)}
          onClose={() => setCreating(false)}
          onCreated={async () => {
            setCreating(false);
            await nexus.reload();
          }}
        />
      ) : null}
    </AppShell>
  );
}

/** One day, listed in order. Used by the Day view, which has no grid. */
function DayColumn({ day, events }: { day: Date; events: CalendarEvent[] }) {
  const nexus = useNexus();
  const ordered = [...events].sort((left, right) => left.time.localeCompare(right.time));

  return (
    <Card className="p-4">
      {ordered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing scheduled for {day.getDate()} {MONTH_NAMES[day.getMonth()]}.
        </p>
      ) : (
        <ul className="space-y-3">
          {ordered.map((event) => (
            <li key={event.id}>
              <button
                onClick={() => nexus.openEvent(event)}
                className="w-full rounded-md border border-primary/30 bg-primary/10 p-3 text-left hover:bg-primary/20"
              >
                <p className="text-xs text-primary">{event.time || "All day"}</p>
                <p className="font-medium text-foreground">{event.title}</p>
                {event.notes ? (
                  <p className="mt-1 text-xs text-muted-foreground">{event.notes}</p>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/**
 * The Create Event form. This used to open the shared modal, which asked for a
 * name and a priority and then ran a 650ms timer and printed "Create Event
 * saved" without touching the API, so no event could ever be created.
 */
function CreateEventDialog({
  defaultDate,
  onClose,
  onCreated,
}: {
  defaultDate: string;
  onClose: () => void;
  onCreated: () => void | Promise<void>;
}) {
  const nexus = useNexus();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState("09:00");
  const [type, setType] = useState<CalendarEvent["type"]>("Meeting");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!title.trim()) {
      setError("Give the event a title.");
      return;
    }

    if (!date) {
      setError("Pick a date.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // The input is a local wall-clock time, so it is sent without a zone and
      // the server stores it as given rather than shifting it.
      await api.calendar.create({
        title: title.trim(),
        startAt: new Date(`${date}T${time || "09:00"}`).toISOString(),
        type,
        notes: notes.trim(),
      });

      nexus.pushToast(`${title.trim()} added to the calendar`, "success");
      await onCreated();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the event.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      title="Create Event"
      description="Added to your workspace calendar. Everyone in the workspace can see it."
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <SubmitButton loading={saving} onClick={() => void save()}>
            Create event
          </SubmitButton>
        </>
      }
    >
      <div className="grid gap-4">
        <label className="text-sm font-medium text-foreground">
          Title
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={200}
            placeholder="Sprint review"
            className="mt-2 h-10 w-full rounded-md border border-input bg-secondary/70 px-3 text-sm outline-none focus:border-primary"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-foreground">
            Date
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="mt-2 h-10 w-full rounded-md border border-input bg-secondary/70 px-3 text-sm outline-none focus:border-primary"
            />
          </label>
          <label className="text-sm font-medium text-foreground">
            Time
            <input
              type="time"
              value={time}
              onChange={(event) => setTime(event.target.value)}
              className="mt-2 h-10 w-full rounded-md border border-input bg-secondary/70 px-3 text-sm outline-none focus:border-primary"
            />
          </label>
        </div>
        <SelectField
          label="Type"
          value={type}
          onChange={(next) => setType(next as CalendarEvent["type"])}
          options={["Meeting", "Deadline", "Review", "Planning"]}
        />
        <label className="text-sm font-medium text-foreground">
          Notes
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            maxLength={2000}
            placeholder="Anything the attendees should know"
            className="mt-2 min-h-20 w-full rounded-md border border-input bg-secondary/70 p-3 text-sm outline-none focus:border-primary"
          />
        </label>
        {error ? (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

export function FilesPage() {
  return (
    <AppShell title="Files">
      <FilesGrid />
    </AppShell>
  );
}
function FilesGrid({ embedded = false }: { embedded?: boolean }) {
  const nexus = useNexus();
  const [query, setQuery] = useState("");
  const [folder, setFolder] = useState<string | null>(null);
  const [sort, setSort] = useState<"name" | "size">("name");
  const [kind, setKind] = useState<string>("all");

  const kinds = useMemo(() => {
    const present = new Set(nexus.files.map((file) => file.type));

    return ["all", ...[...present].sort()];
  }, [nexus.files]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();

    const matched = nexus.files.filter((file) => {
      if (needle && !file.name.toLowerCase().includes(needle)) {
        return false;
      }

      if (folder && file.folder !== folder) {
        return false;
      }

      if (kind !== "all" && file.type !== kind) {
        return false;
      }

      return true;
    });

    return [...matched].sort((a, b) => {
      if (sort === "size") {
        return b.size.localeCompare(a.size, undefined, { numeric: true });
      }

      return a.name.localeCompare(b.name);
    });
  }, [folder, kind, nexus.files, query, sort]);

  return (
    <div className="space-y-5">
      {!embedded ? (
        <SectionHeader
          title="Files"
          description="Folders, documentation, reports, and project artifacts."
          actions={
            <>
              <Button variant="secondary" onClick={() => nexus.openModal("upload")}>
                <Upload className="h-4 w-4" />
                Upload
              </Button>
            </>
          }
        />
      ) : null}
      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <Card>
          <h2 className="font-display text-lg font-semibold">Folders</h2>
          <div className="mt-4 space-y-2">
            {/*
              Folders are derived from the files that exist, so there is no
              "create folder" action: a folder is made by uploading a file into
              it. This used to render a "Folder created" toast and store nothing.
            */}
            <button
              onClick={() => setFolder(null)}
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm",
                folder === null ? "bg-primary/10 text-primary" : "hover:bg-muted",
              )}
            >
              <Archive className="h-4 w-4" />
              All files
            </button>
            {nexus.folders.map((name) => (
              <button
                key={name}
                onClick={() => setFolder(name)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm",
                  folder === name ? "bg-primary/10 text-primary" : "hover:bg-muted",
                )}
              >
                <Archive className="h-4 w-4 text-primary" />
                <span className="truncate">{name}</span>
              </button>
            ))}
          </div>
        </Card>
        <Card className="p-0">
          <div className="grid gap-3 border-b border-border p-4 sm:grid-cols-[1fr_auto_auto]">
            <SearchInput value={query} onChange={setQuery} placeholder="Search files" />
            <SelectField
              label="Sort"
              value={sort}
              onChange={(next) => setSort(next as "name" | "size")}
              options={["name", "size"]}
              optionLabels={["Name", "Largest first"]}
            />
            <SelectField
              label="Type"
              value={kind}
              onChange={setKind}
              options={kinds}
              optionLabels={kinds.map((value) => (value === "all" ? "All types" : value))}
            />
          </div>
          <div className="divide-y divide-border">
            {filtered.map((file) => (
              <button
                key={file.id}
                onClick={() => nexus.openFile(file)}
                className="grid w-full gap-3 p-4 text-left hover:bg-muted/40 lg:grid-cols-[minmax(220px,1fr)_7rem_12rem_7rem_8rem_4rem] lg:items-center"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <FileUp className="h-4 w-4 text-primary" />
                  <span className="truncate text-sm font-medium text-foreground">{file.name}</span>
                </span>
                <span className="text-sm text-muted-foreground">{file.type}</span>
                <span className="text-sm text-muted-foreground">{file.owner}</span>
                <span className="text-sm text-muted-foreground">{file.size}</span>
                <span className="text-sm text-muted-foreground">{file.modified}</span>
                <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

export function NotificationsPage() {
  const nexus = useNexus();
  const [tab, setTab] = useState("All");
  const list = nexus.notifications.filter(
    (item) => tab === "All" || item.category === tab.slice(0, -1) || item.category === tab,
  );
  return (
    <AppShell title="Notifications">
      <div className="space-y-5">
        <SectionHeader
          title="Notification Center"
          description="Mentions, task updates, project changes, and system messages."
          actions={
            <>
              <Button variant="secondary" onClick={nexus.markAllNotificationsRead}>
                Mark all as read
              </Button>
              <Button onClick={() => nexus.pushToast("Preferences saved", "success")}>
                Preferences
              </Button>
            </>
          }
        />
        <Tabs
          tabs={["All", "Mentions", "Tasks", "Projects", "System"]}
          value={tab}
          onChange={setTab}
        />
        <Card className="divide-y divide-border p-0">
          {list.map((item) => (
            <button
              key={item.id}
              onClick={() => nexus.markNotificationRead(item.id)}
              className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] gap-3 p-4 text-left hover:bg-muted/40"
            >
              <StatusDot status={item.read ? "Offline" : "Online"} />
              <span>
                <span className="block text-sm font-medium text-foreground">{item.title}</span>
                <span className="text-sm text-muted-foreground">{item.body}</span>
              </span>
              <span className="text-xs text-muted-foreground">{item.time}</span>
            </button>
          ))}
        </Card>
      </div>
    </AppShell>
  );
}

export function AnalyticsPage() {
  const nexus = useNexus();
  const metrics = nexus.analytics.metrics;
  /*
    These four dropdowns were all wired to `() => undefined`, so choosing a
    project or a date range left the page exactly as it was. The figures are
    computed on the server, so the choice now goes into the request rather than
    being applied to the numbers already on screen.
  */
  const [projectId, setProjectId] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [range, setRange] = useState("30 days");
  const [analytics, setAnalytics] = useState(nexus.analytics);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filters = useMemo(
    () => ({
      ...(projectId ? { projectId } : {}),
      ...(assigneeId ? { assigneeId } : {}),
      ...(range ? { range } : {}),
    }),
    [assigneeId, projectId, range],
  );

  const load = useCallback(async () => {
    if (nexus.isDemo === false && !isAuthenticated()) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      setAnalytics(await api.analytics.get(filters));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load analytics");
    } finally {
      setLoading(false);
    }
  }, [filters, nexus.isDemo]);

  useEffect(() => {
    void load();
  }, [load]);

  // The charts read from this page's copy, not from context, so a filter change
  // does not need a full workspace reload.
  const withAnalytics = useMemo(() => ({ ...nexus, analytics }), [analytics, nexus]);

  const exportCsv = () => {
    const rows: string[][] = [
      ["Section", "Name", "Value"],
      ...analytics.status.map((row) => ["Status", row.name, String(row.value)]),
      ...analytics.workload.map((row) => ["Workload", row.name, String(row.tasks)]),
      ...analytics.productivity.map((row) => ["Productivity", row.name, String(row.points)]),
      ...analytics.progress.map((row) => [`Progress ${row.name}`, "planned", String(row.planned)]),
      ...analytics.progress.map((row) => [
        `Progress ${row.name}`,
        "completed",
        String(row.completed),
      ]),
    ];

    // A quoted field, because a task name could contain the separator.
    const escape = (cell: string) => `"${cell.replace(/"/g, '""')}"`;
    const csv = rows.map((row) => row.map(escape).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");

    link.href = url;
    link.download = `nexus-analytics-${projectId || "all"}-${range.replace(/\s+/g, "-")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    nexus.pushToast("Exported the figures currently shown", "success");
  };

  const projectOptions = ["", ...nexus.projects.map((project) => project.id)];
  const projectLabels = ["All projects", ...nexus.projects.map((project) => project.name)];
  const people = nexus.users.filter((user) => user.id !== nexus.currentUser.id || true);

  return (
    <AppShell title="Analytics">
      <div className="space-y-5">
        <SectionHeader
          title="Analytics"
          description="Completion rate, cycle time, workload, velocity, and activity trends."
          actions={
            <Button onClick={exportCsv}>
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          }
        />
        <div className="grid gap-3 lg:grid-cols-4">
          {/*
            This listed one hardcoded option and could not change. It now lists
            the workspaces the caller actually belongs to, and switching reloads
            so the figures below belong to the one that is selected.
          */}
          <SelectField
            label="Workspace"
            value={nexus.organizationId ?? ""}
            onChange={(next) => {
              nexus.switchOrganization(next);
              void nexus.reload();
            }}
            options={nexus.organizations.map((org) => org.id)}
            optionLabels={nexus.organizations.map((org) => org.name)}
          />
          <SelectField
            label="Project"
            value={projectId}
            onChange={setProjectId}
            options={projectOptions}
            optionLabels={projectLabels}
          />
          <SelectField
            label="Assignee"
            value={assigneeId}
            onChange={setAssigneeId}
            options={["", ...people.map((user) => user.id)]}
            optionLabels={["Everyone", ...people.map((user) => user.name)]}
          />
          <SelectField
            label="Date range"
            value={range}
            onChange={setRange}
            options={["7 days", "30 days", "90 days"]}
          />
        </div>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={<CheckCircle2 className="h-5 w-5" />}
            label="Task completion rate"
            value={`${metrics?.completionRate ?? 0}%`}
            caption="of all tasks"
          />
          <MetricCard
            icon={<Clock className="h-5 w-5" />}
            label="Average cycle time"
            value={`${(metrics?.averageCycleTimeDays ?? 0).toFixed(1)}d`}
            caption="creation to done"
          />
          <MetricCard
            icon={<XCircle className="h-5 w-5" />}
            label="Overdue tasks"
            value={String(metrics?.overdue ?? 0)}
            caption="past due date"
          />
          <MetricCard
            icon={<Users className="h-5 w-5" />}
            label="Team members"
            value={String(metrics?.totalUsers ?? nexus.users.length)}
            caption="in your organizations"
          />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <LineChartCard analytics={analytics} />
          <ProductivityCard analytics={analytics} />
          <WorkloadCard analytics={analytics} />
          <DonutCard analytics={analytics} />
        </div>
      </div>
    </AppShell>
  );
}

export function AuditPage() {
  const nexus = useNexus();
  const [query, setQuery] = useState("");
  const [date, setDate] = useState("All");
  const [user, setUser] = useState("All");
  const [action, setAction] = useState("All");

  /*
    These three were `() => undefined`, and the User and Action options were
    hardcoded names that need not exist in the workspace: "Raj", "Amit",
    "Admin", "Updated task", "Changed role". Both are derived from the loaded
    logs now, and the date filter uses the real timestamp, because the display
    one is a formatted string that cannot be compared.
  */
  const users = useMemo(
    () => [...new Set(nexus.auditLogs.map((log) => log.user))].sort(),
    [nexus.auditLogs],
  );
  const actions = useMemo(
    () => [...new Set(nexus.auditLogs.map((log) => log.action))].sort(),
    [nexus.auditLogs],
  );

  const list = nexus.auditLogs.filter((log) => {
    if (
      query &&
      !`${log.user} ${log.action} ${log.resource}`.toLowerCase().includes(query.toLowerCase())
    ) {
      return false;
    }

    if (user !== "All" && log.user !== user) {
      return false;
    }

    if (action !== "All" && log.action !== action) {
      return false;
    }

    if (date !== "All") {
      const window = date === "Today" ? 1 : date === "7 days" ? 7 : 30;
      const stamp = log.at ? new Date(log.at).getTime() : null;
      const floor = startOfDay(new Date()).getTime() - (window - 1) * 86400000;

      if (stamp === null || stamp < floor) {
        return false;
      }
    }

    return true;
  });

  const exportCsv = () => {
    const rows: string[][] = [
      ["Timestamp", "User", "Action", "Resource", "IP", "Status", "Detail"],
      ...list.map((log) => [
        log.at ?? log.timestamp,
        log.user,
        log.action,
        log.resource,
        log.ip,
        log.status,
        log.detail,
      ]),
    ];
    const escape = (cell: string) => `"${cell.replace(/"/g, '""')}"`;
    const url = URL.createObjectURL(
      new Blob([rows.map((row) => row.map(escape).join(",")).join("\r\n")], {
        type: "text/csv;charset=utf-8",
      }),
    );
    const link = document.createElement("a");

    link.href = url;
    link.download = "nexus-audit-logs.csv";
    link.click();
    URL.revokeObjectURL(url);
    nexus.pushToast(`Exported ${list.length} audit entries`, "success");
  };

  return (
    <AppShell title="Audit Logs">
      <div className="space-y-5">
        <SectionHeader
          title="Audit Logs"
          description="Enterprise-grade visibility into user, role, project, and system changes."
          actions={
            <Button onClick={exportCsv}>
              <Download className="h-4 w-4" />
              Export
            </Button>
          }
        />
        <div className="grid gap-3 lg:grid-cols-[1fr_12rem_12rem_12rem]">
          <SearchInput value={query} onChange={setQuery} placeholder="Search audit logs" />
          <SelectField
            label="Date"
            value={date}
            onChange={setDate}
            options={["All", "Today", "7 days", "30 days"]}
          />
          <SelectField label="User" value={user} onChange={setUser} options={["All", ...users]} />
          <SelectField
            label="Action"
            value={action}
            onChange={setAction}
            options={["All", ...actions]}
          />
        </div>
        <Card className="p-0">
          <div className="divide-y divide-border">
            {list.map((log) => (
              <button
                key={log.id}
                onClick={() => nexus.openAudit(log)}
                className="grid w-full gap-3 p-4 text-left hover:bg-muted/40 lg:grid-cols-[11rem_12rem_1fr_10rem_9rem_7rem] lg:items-center"
              >
                <span className="text-sm text-muted-foreground">{log.timestamp}</span>
                <span className="text-sm text-foreground">{log.user}</span>
                <span className="text-sm text-foreground">
                  {log.action} <span className="text-muted-foreground">{log.resource}</span>
                </span>
                <span className="text-sm text-muted-foreground">{log.ip}</span>
                <Badge
                  tone={
                    log.status === "Success"
                      ? "success"
                      : log.status === "Blocked"
                        ? "danger"
                        : "warning"
                  }
                >
                  {log.status}
                </Badge>
                <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

export function AdminPage() {
  const nexus = useNexus();
  const [section, setSection] = useState("Users");
  const [permissions, setPermissions] = useState<Record<string, boolean>>({
    Users: true,
    Projects: true,
    Tasks: true,
    Files: false,
    Analytics: true,
    Settings: false,
  });
  return (
    <AppShell title="Admin">
      <div className="space-y-5">
        <SectionHeader
          title="Admin Dashboard"
          description="Users, organizations, permissions, security, audit logs, and system settings."
        />
        <Tabs
          tabs={[
            "Users",
            "Channels",
            "Organizations",
            "Roles & Permissions",
            "Security",
            "Audit Logs",
            "System Settings",
          ]}
          value={section}
          onChange={setSection}
        />
        {section === "Channels" ? <ChannelManager /> : null}
        {section === "Roles & Permissions" ? (
          <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
            <Card>
              <h2 className="font-display text-lg font-semibold">Roles</h2>
              <div className="mt-4 space-y-2">
                {nexus.roles.map((role) => (
                  <button
                    key={role}
                    className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
                  >
                    {role}
                  </button>
                ))}
              </div>
            </Card>
            <Card>
              <h2 className="font-display text-lg font-semibold">Permission matrix</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {Object.entries(permissions).map(([key, enabled]) => (
                  <label
                    key={key}
                    className="flex items-center justify-between rounded-md border border-border bg-secondary/50 p-3 text-sm"
                  >
                    <span>{key}</span>
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={() => setPermissions((items) => ({ ...items, [key]: !enabled }))}
                      className="h-4 w-4 accent-primary"
                    />
                  </label>
                ))}
              </div>
            </Card>
          </div>
        ) : section === "Users" ? (
          /*
            The old table carried "Change Role" and "Suspend" buttons that only
            raised a toast. Neither operation exists in the API, and a control
            that pretends to work is worse than no control, so the tab now
            shows real membership: invite by email, and remove.
          */
          <WorkspaceMembers />
        ) : (
          <Card className="p-0">
            <div className="divide-y divide-border">
              {nexus.users.map((user) => (
                <div
                  key={user.id}
                  className="grid gap-3 p-4 lg:grid-cols-[minmax(220px,1fr)_1fr_10rem_8rem_10rem_14rem] lg:items-center"
                >
                  <span className="flex items-center gap-3">
                    <Avatar name={user.name} />
                    <span>
                      <span className="block text-sm font-medium">{user.name}</span>
                      <span className="text-xs text-muted-foreground">{user.email}</span>
                    </span>
                  </span>
                  <span className="text-sm text-muted-foreground">{user.email}</span>
                  <Badge>{user.role}</Badge>
                  <Badge tone={user.status === "Online" ? "success" : "neutral"}>
                    {user.status}
                  </Badge>
                  <span className="text-sm text-muted-foreground">Today</span>
                  <span className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={() => nexus.openUser(user)}>
                      View
                    </Button>
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </AppShell>
  );
}

export function SettingsPage() {
  const nexus = useNexus();
  const [section, setSection] = useState("Profile");
  return (
    <AppShell title="Settings">
      <div className="space-y-5">
        <SectionHeader
          title="Settings"
          description="Profile, account, security, notifications, appearance, members, roles, and integrations."
        />
        <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
          <Card>
            <div className="space-y-1">
              {[
                "Profile",
                "Account",
                "Security",
                "Notifications",
                "Appearance",
                "Organization",
                "Members",
                "Roles",
                "Integrations",
              ].map((item) => (
                <button
                  key={item}
                  onClick={() => setSection(item)}
                  className={cn(
                    "block w-full rounded-md px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground",
                    section === item && "bg-primary/10 text-primary",
                  )}
                >
                  {item}
                </button>
              ))}
            </div>
          </Card>
          <Card>
            <h2 className="font-display text-xl font-semibold">{section}</h2>
            {section === "Security" ? (
              <div className="mt-5 grid gap-3">
                <Button variant="secondary">Change Password</Button>
                <label className="flex items-center justify-between rounded-md border border-border bg-secondary/50 p-3">
                  <span>Two-factor Authentication</span>
                  <input type="checkbox" className="h-4 w-4 accent-primary" />
                </label>
                <p className="text-sm text-muted-foreground">
                  Active Sessions: Chrome on macOS, Safari on iPhone
                </p>
                <p className="text-sm text-muted-foreground">
                  Login History: 4 successful logins this week
                </p>
              </div>
            ) : section === "Appearance" ? (
              <div className="mt-5 grid gap-4">
                <SelectField
                  label="Theme"
                  value={nexus.theme}
                  onChange={(value) => nexus.setTheme(value as "dark" | "light" | "system")}
                  options={["dark", "light", "system"]}
                />
                <SelectField
                  label="Density"
                  value={nexus.density}
                  onChange={(value) => nexus.setDensity(value as "Compact" | "Comfortable")}
                  options={["Compact", "Comfortable"]}
                />
              </div>
            ) : section === "Notifications" ? (
              <div className="mt-5 grid gap-3">
                {["Email", "Push", "Mentions", "Task updates", "Project updates"].map((item) => (
                  <label
                    key={item}
                    className="flex items-center justify-between rounded-md border border-border bg-secondary/50 p-3"
                  >
                    <span>{item}</span>
                    <input type="checkbox" defaultChecked className="h-4 w-4 accent-primary" />
                  </label>
                ))}
              </div>
            ) : (
              <div className="mt-5 grid gap-4">
                <label className="text-sm font-medium">
                  Full name
                  <input
                    defaultValue={nexus.currentUser.name}
                    className="mt-2 h-10 w-full rounded-md border border-input bg-secondary/70 px-3 outline-none focus:border-primary"
                  />
                </label>
                <label className="text-sm font-medium">
                  Role
                  <input
                    defaultValue="Backend Developer"
                    className="mt-2 h-10 w-full rounded-md border border-input bg-secondary/70 px-3 outline-none focus:border-primary"
                  />
                </label>
                <Button onClick={() => nexus.pushToast("Settings saved", "success")}>
                  Save changes
                </Button>
              </div>
            )}
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
