import { Link, useLocation } from "@tanstack/react-router";
import {
  Bell,
  CalendarDays,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  CircleHelp,
  Command,
  FileText,
  FolderKanban,
  Home,
  Inbox,
  LayoutDashboard,
  Menu,
  MessageSquare,
  Moon,
  Plus,
  Search,
  Settings,
  Shield,
  Sparkles,
  Users,
  X,
  BarChart3,
  ClipboardList,
  Phone,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Attachments } from "@/components/nexus/Attachments";
import { useNexus } from "@/context/NexusContext";
import { useCall } from "@/context/CallContext";
import { cn } from "@/lib/utils";
import { api } from "@/services/api";
import type { ModalState } from "@/types/nexus";
import {
  Avatar,
  Badge,
  BrandMark,
  Drawer,
  initials,
  Modal,
  SearchInput,
  SelectField,
  SubmitButton,
  ToastStack,
} from "./primitives";

const mainNav = [
  { label: "Overview", href: "/app", icon: Home },
  { label: "Inbox", href: "/notifications", icon: Inbox },
  { label: "My Tasks", href: "/tasks", icon: ClipboardList },
  { label: "Projects", href: "/projects", icon: FolderKanban },
  { label: "Teams", href: "/teams", icon: Users },
  { label: "Messages", href: "/messages", icon: MessageSquare },
  { label: "Calendar", href: "/calendar", icon: CalendarDays },
  { label: "Files", href: "/files", icon: FileText },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
];

const mobileNav = mainNav.filter((item) =>
  ["Overview", "My Tasks", "Projects", "Messages"].includes(item.label),
);

export function AppShell({ children, title }: { children: ReactNode; title?: string }) {
  const location = useLocation();
  const nexus = useNexus();
  const [createOpen, setCreateOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [orgOpen, setOrgOpen] = useState(false);
  const unread = nexus.notifications.filter((item) => !item.read).length;
  const activeProject = nexus.projects[0];

  const openModal = (type: Exclude<ModalState["type"], null>) => {
    setCreateOpen(false);
    nexus.openModal(type);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <ToastStack toasts={nexus.toasts} dismiss={nexus.dismissToast} />
      <CommandPalette />
      <GlobalModals />
      <TaskDetailDrawer />
      <MemberDrawer />
      <FileDrawer />
      <EventModal />
      <AuditDrawer />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden border-r border-border bg-panel/95 backdrop-blur-xl transition-all duration-300 lg:block",
          nexus.sidebarCollapsed ? "w-20" : "w-72",
        )}
      >
        <div className="flex h-full flex-col p-3">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-1 py-2">
            <BrandMark compact={nexus.sidebarCollapsed} />
            <button
              type="button"
              onClick={() => nexus.setSidebarCollapsed(!nexus.sidebarCollapsed)}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
              aria-label="Toggle sidebar"
            >
              {nexus.sidebarCollapsed ? (
                <ChevronsRight className="h-4 w-4" />
              ) : (
                <ChevronsLeft className="h-4 w-4" />
              )}
            </button>
          </div>

          <div className="relative mt-3">
            <button
              type="button"
              onClick={() => setOrgOpen(!orgOpen)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md border border-border bg-secondary/70 px-3 py-2 text-left text-sm transition hover:border-primary/50",
                nexus.sidebarCollapsed && "justify-center px-2",
              )}
              aria-label="Switch organization"
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/15 text-xs font-semibold text-primary">
                {initials(nexus.organization)}
              </span>
              {!nexus.sidebarCollapsed ? (
                <>
                  <span className="min-w-0 flex-1 truncate">{nexus.organization}</span>
                  {nexus.organizations.length > 1 ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : null}
                </>
              ) : null}
            </button>
            {orgOpen && nexus.organizations.length > 1 ? (
              <div className="surface-card absolute left-0 right-0 top-12 z-20 rounded-lg p-2">
                {nexus.organizations.map((org) => (
                  <button
                    key={org.id}
                    type="button"
                    onClick={() => {
                      setOrgOpen(false);
                      nexus.switchOrganization(org.id);
                    }}
                    className="block w-full rounded-md px-3 py-2 text-left text-sm text-foreground transition hover:bg-muted"
                  >
                    {org.name}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <nav className="mt-5 flex-1 space-y-1" aria-label="Primary navigation">
            {mainNav.map((item) => {
              const Icon = item.icon;
              const active =
                location.pathname === item.href ||
                (item.href !== "/app" && location.pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  title={nexus.sidebarCollapsed ? item.label : undefined}
                  className={cn(
                    "group grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground",
                    nexus.sidebarCollapsed && "grid-cols-1 justify-items-center px-2",
                    active && "bg-primary/10 text-primary",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!nexus.sidebarCollapsed ? <span className="truncate">{item.label}</span> : null}
                </Link>
              );
            })}
            <div className="pt-4">
              {!nexus.sidebarCollapsed ? (
                <p className="px-3 pb-2 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Projects
                </p>
              ) : null}
              {nexus.projects.slice(0, 4).map((project) => (
                <Link
                  key={project.id}
                  to="/projects/$projectId"
                  params={{ projectId: project.id }}
                  title={project.name}
                  className={cn(
                    "grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground",
                    nexus.sidebarCollapsed && "grid-cols-1 justify-items-center px-2",
                  )}
                >
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-subtle text-[10px] font-semibold text-foreground">
                    {project.icon}
                  </span>
                  {!nexus.sidebarCollapsed ? (
                    <span className="truncate">{project.name}</span>
                  ) : null}
                </Link>
              ))}
              <button
                type="button"
                onClick={() => openModal("project")}
                className={cn(
                  "mt-1 grid w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-md px-3 py-2 text-sm text-primary transition hover:bg-primary/10",
                  nexus.sidebarCollapsed && "grid-cols-1 justify-items-center px-2",
                )}
              >
                <Plus className="h-4 w-4" />
                {!nexus.sidebarCollapsed ? <span>Create Project</span> : null}
              </button>
            </div>
          </nav>

          <div className="space-y-1 border-t border-border pt-3">
            <Link
              to="/audit"
              className={cn(
                "grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground",
                nexus.sidebarCollapsed && "grid-cols-1 justify-items-center px-2",
              )}
            >
              <Shield className="h-4 w-4" />
              {!nexus.sidebarCollapsed ? <span>Audit Logs</span> : null}
            </Link>
            <Link
              to="/admin"
              className={cn(
                "grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground",
                nexus.sidebarCollapsed && "grid-cols-1 justify-items-center px-2",
              )}
            >
              <LayoutDashboard className="h-4 w-4" />
              {!nexus.sidebarCollapsed ? <span>Admin</span> : null}
            </Link>
            <Link
              to="/settings"
              className={cn(
                "grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground",
                nexus.sidebarCollapsed && "grid-cols-1 justify-items-center px-2",
              )}
            >
              <Settings className="h-4 w-4" />
              {!nexus.sidebarCollapsed ? <span>Settings</span> : null}
            </Link>
            <button
              type="button"
              onClick={() => nexus.pushToast("Support team has been notified", "info")}
              className={cn(
                "grid w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground",
                nexus.sidebarCollapsed && "grid-cols-1 justify-items-center px-2",
              )}
            >
              <CircleHelp className="h-4 w-4" />
              {!nexus.sidebarCollapsed ? <span>Help & Support</span> : null}
            </button>
            <button
              type="button"
              onClick={() => nexus.openUser(nexus.currentUser)}
              className={cn(
                "mt-2 grid w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-md border border-border bg-secondary/50 p-2 text-left transition hover:border-primary/50",
                nexus.sidebarCollapsed && "grid-cols-1 justify-items-center",
              )}
            >
              <Avatar name={nexus.currentUser.name} />
              {!nexus.sidebarCollapsed ? (
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-foreground">
                    {nexus.currentUser.name}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {nexus.currentUser.role}
                  </span>
                </span>
              ) : null}
            </button>
          </div>
        </div>
      </aside>

      <MobileDrawer />

      <div
        className={cn("transition-all duration-300 lg:pl-72", nexus.sidebarCollapsed && "lg:pl-20")}
      >
        <header className="sticky top-0 z-30 border-b border-border bg-background/86 backdrop-blur-xl">
          <div className="grid h-16 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 sm:px-6">
            <button
              type="button"
              onClick={() => nexus.setMobileSidebarOpen(true)}
              className="grid h-10 w-10 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => nexus.setCommandOpen(true)}
              className="hidden h-10 min-w-0 max-w-xl items-center gap-3 rounded-md border border-input bg-secondary/60 px-3 text-left text-sm text-muted-foreground transition hover:border-primary/60 sm:flex"
              aria-label="Open global search"
            >
              <Search className="h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate">Search projects, tasks, people...</span>
              <kbd className="rounded border border-border bg-elevated px-1.5 py-0.5 text-[11px] text-muted-foreground">
                ⌘ K
              </kbd>
            </button>
            <h2 className="truncate font-display text-base font-semibold text-foreground sm:hidden">
              {title ?? "NEXUS"}
            </h2>
            <div className="flex items-center justify-end gap-2">
              <div className="relative">
                <Button onClick={() => setCreateOpen(!createOpen)}>
                  <Plus className="h-4 w-4" />
                  Create
                </Button>
                {createOpen ? <CreateMenu openModal={openModal} /> : null}
              </div>
              <div className="relative hidden sm:block">
                <button
                  type="button"
                  onClick={() => setNotificationsOpen(!notificationsOpen)}
                  className="relative grid h-10 w-10 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  aria-label="Notifications"
                >
                  <Bell className="h-5 w-5" />
                  {unread ? (
                    <span className="absolute right-2 top-2 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                      {unread}
                    </span>
                  ) : null}
                </button>
                {notificationsOpen ? <NotificationMenu /> : null}
              </div>
              <Link
                to="/messages"
                className="hidden h-10 w-10 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground sm:grid"
                aria-label="Messages"
              >
                <MessageSquare className="h-5 w-5" />
              </Link>
              <button
                type="button"
                onClick={() => nexus.setTheme(nexus.theme === "dark" ? "light" : "dark")}
                className="hidden h-10 w-10 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground sm:grid"
                aria-label="Toggle theme"
              >
                <Moon className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => nexus.openUser(nexus.currentUser)}
                aria-label="Open profile"
              >
                <Avatar name={nexus.currentUser.name} className="h-10 w-10" />
              </button>
            </div>
          </div>
        </header>

        <main className="min-h-[calc(100vh-4rem)] px-4 py-5 pb-24 sm:px-6 lg:pb-8">{children}</main>
      </div>

      <nav
        className="fixed bottom-0 left-0 right-0 z-40 grid grid-cols-5 border-t border-border bg-background/92 px-2 py-2 backdrop-blur-xl lg:hidden"
        aria-label="Mobile navigation"
      >
        {[...mobileNav, { label: "Profile", href: "/settings", icon: Settings }].map((item) => {
          const Icon = item.icon;
          const active =
            location.pathname === item.href ||
            (item.href !== "/app" && location.pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex flex-col items-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-medium text-muted-foreground",
                active && "bg-primary/10 text-primary",
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function CreateMenu({
  openModal,
}: {
  openModal: (type: Exclude<ModalState["type"], null>) => void;
}) {
  const options = [
    ["task", "Create Task"],
    ["project", "Create Project"],
    ["invite", "Invite Member"],
    ["team", "Create Team"],
  ] as const;
  return (
    <div className="surface-card absolute right-0 top-12 z-40 w-56 rounded-lg p-2">
      {options.map(([type, label]) => (
        <button
          key={type}
          type="button"
          onClick={() => openModal(type)}
          className="block w-full rounded-md px-3 py-2 text-left text-sm text-foreground transition hover:bg-muted"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function NotificationMenu() {
  const nexus = useNexus();
  return (
    <div className="surface-card absolute right-0 top-12 z-40 w-96 rounded-lg p-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-1 pb-2">
        <h3 className="font-display text-sm font-semibold text-foreground">Notifications</h3>
        <Button variant="ghost" size="sm" onClick={nexus.markAllNotificationsRead}>
          Mark all as read
        </Button>
      </div>
      <div className="max-h-96 space-y-2 overflow-auto nexus-scrollbar">
        {nexus.notifications.slice(0, 5).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => nexus.markNotificationRead(item.id)}
            className="grid w-full grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-md p-2 text-left transition hover:bg-muted"
          >
            <span
              className={cn(
                "mt-1 h-2 w-2 rounded-full",
                item.read ? "bg-muted" : "bg-primary nexus-glow",
              )}
            />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-foreground">
                {item.title}
              </span>
              <span className="block truncate text-xs text-muted-foreground">{item.body}</span>
              <span className="mt-1 block text-[11px] text-muted-foreground">
                {item.category} · {item.time}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function MobileDrawer() {
  const nexus = useNexus();
  return (
    <Drawer
      open={nexus.mobileSidebarOpen}
      title="NEXUS"
      onClose={() => nexus.setMobileSidebarOpen(false)}
    >
      <div className="space-y-2">
        {mainNav.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              to={item.href}
              onClick={() => nexus.setMobileSidebarOpen(false)}
              className="flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium text-foreground hover:bg-muted"
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </Drawer>
  );
}

function CommandPalette() {
  const nexus = useNexus();
  const [query, setQuery] = useState("");
  const results = useMemo(() => {
    const q = query.toLowerCase();
    const rows = [
      ...nexus.tasks.map((item) => ({
        type: "Tasks",
        title: item.title,
        subtitle: `${item.id} · ${item.project}`,
        action: () => nexus.openTask(item),
      })),
      ...nexus.projects.map((item) => ({
        type: "Projects",
        title: item.name,
        subtitle: item.description,
        action: () => nexus.pushToast(`Opened ${item.name}`, "info"),
      })),
      ...nexus.users.map((item) => ({
        type: "People",
        title: item.name,
        subtitle: `${item.role} · ${item.status}`,
        action: () => nexus.openUser(item),
      })),
      ...nexus.messages.map((item) => ({
        type: "Messages",
        title: item.body,
        subtitle: `#${item.channel}`,
        action: () => nexus.pushToast("Message copied to your review queue", "info"),
      })),
      ...nexus.files.map((item) => ({
        type: "Files",
        title: item.name,
        subtitle: `${item.type} · ${item.owner}`,
        action: () => nexus.openFile(item),
      })),
    ];
    return rows
      .filter((row) => !q || `${row.type} ${row.title} ${row.subtitle}`.toLowerCase().includes(q))
      .slice(0, 10);
  }, [nexus, query]);
  return (
    <Modal
      open={nexus.commandOpen}
      title="Search NEXUS"
      description="Search tasks, projects, people, teams, messages, and files."
      onClose={() => nexus.setCommandOpen(false)}
    >
      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="Search authentication, Payment Platform, Priya..."
      />
      {!query ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Badge>Recent: authentication</Badge>
          <Badge>Recent: payment webhook</Badge>
          <Badge tone="info">⌘ K Search</Badge>
          <Badge tone="accent">G then P Projects</Badge>
        </div>
      ) : null}
      <div className="mt-4 space-y-2">
        {results.map((result) => (
          <button
            key={`${result.type}-${result.title}`}
            type="button"
            onClick={() => {
              result.action();
              nexus.setCommandOpen(false);
            }}
            className="grid w-full grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-md border border-border bg-secondary/50 p-3 text-left transition hover:border-primary/50 hover:bg-muted"
          >
            <Command className="mt-0.5 h-4 w-4 text-primary" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-foreground">
                {result.title}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {result.type} · {result.subtitle}
              </span>
            </span>
          </button>
        ))}
      </div>
    </Modal>
  );
}

function GlobalModals() {
  const nexus = useNexus();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  // The invite modal is a real API call, not a placeholder, so it needs its own
  // state: several addresses, the target workspace, and per-address results.
  const [inviteEmails, setInviteEmails] = useState("");
  const [inviteOrgId, setInviteOrgId] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const type = nexus.modal.type;
  const titles: Record<Exclude<ModalState["type"], null>, string> = {
    task: "Create Task",
    project: "Create Project",
    invite: "Invite Member",
    team: "Create Team",
    event: "Create Event",
    upload: "Upload File",
    delete: "Delete project?",
    role: "Change Role",
    profile: "Edit Profile",
  };

  const inviteEmails_ = useMemo(
    () =>
      inviteEmails
        .split(/[\s,;]+/)
        .map((value) => value.trim())
        .filter(Boolean),
    [inviteEmails],
  );

  const submit = () => {
    setLoading(true);
    window.setTimeout(() => {
      setLoading(false);
      nexus.closeModal();
      setName("");
      nexus.pushToast(
        type === "delete" ? "Project deleted" : `${titles[type ?? "task"]} saved`,
        type === "delete" ? "warning" : "success",
      );
    }, 650);
  };

  const sendInvites = async () => {
    const target = inviteOrgId || nexus.organizations[0]?.id;

    if (!target) {
      setInviteError("You are not a member of any workspace yet.");
      return;
    }

    if (!inviteEmails_.length) {
      setInviteError("Add at least one email address.");
      return;
    }

    setLoading(true);
    setInviteError(null);

    try {
      const result = await api.invitations.send(target, inviteEmails_);
      const invited = result.invited.length;
      const skipped = result.skipped.length;

      nexus.closeModal();
      setInviteEmails("");

      if (invited) {
        nexus.pushToast(`${invited} invitation${invited > 1 ? "s" : ""} sent`, "success");
      }

      if (skipped) {
        nexus.pushToast(`${skipped} already had access`, "info");
      }

      // The pending list changed on the server, so the shell needs fresh data.
      await nexus.reload();
    } catch (error) {
      setInviteError(
        error instanceof Error ? error.message : "We could not send those invitations.",
      );
    } finally {
      setLoading(false);
    }
  };

  if (!type) return null;
  const destructive = type === "delete";
  const isInvite = type === "invite";
  return (
    <Modal
      open
      title={titles[type]}
      description={
        destructive
          ? "This action cannot be undone."
          : isInvite
            ? "Send an invitation link. It works for both new and existing accounts."
            : "Complete the required fields to continue."
      }
      onClose={nexus.closeModal}
      footer={
        <>
          <Button variant="outline" onClick={nexus.closeModal}>
            Cancel
          </Button>
          {isInvite ? (
            <SubmitButton loading={loading} onClick={() => void sendInvites()}>
              Send invitations
            </SubmitButton>
          ) : (
            <SubmitButton
              loading={loading}
              onClick={submit}
              intent={destructive ? "destructive" : "default"}
            >
              {destructive ? "Delete" : "Save"}
            </SubmitButton>
          )}
        </>
      }
    >
      {destructive ? (
        <p className="text-sm text-muted-foreground">
          Payment Platform will remain in demo data after refresh, but this action shows the
          production confirmation flow.
        </p>
      ) : isInvite ? (
        <div className="grid gap-4">
          {nexus.organizations.length > 1 ? (
            <SelectField
              label="Workspace"
              value={inviteOrgId || nexus.organizations[0]?.id || ""}
              onChange={setInviteOrgId}
              options={nexus.organizations.map((org) => org.id)}
              optionLabels={nexus.organizations.map((org) => org.name)}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Inviting to <span className="font-medium text-foreground">{nexus.organization}</span>
            </p>
          )}
          <label className="text-sm font-medium text-foreground">
            Email addresses
            <textarea
              value={inviteEmails}
              onChange={(event) => setInviteEmails(event.target.value)}
              className="mt-2 min-h-24 w-full rounded-md border border-input bg-secondary/70 p-3 text-sm outline-none focus:border-primary"
              placeholder="amit@company.com, priya@company.com"
            />
          </label>
          <p className="text-xs text-muted-foreground">
            {inviteEmails_.length
              ? `${inviteEmails_.length} address${inviteEmails_.length > 1 ? "es" : ""} will receive a link valid for 14 days.`
              : "Separate multiple addresses with commas."}
          </p>
          {inviteError ? (
            <p role="alert" className="text-xs text-destructive">
              {inviteError}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-4">
          <label className="text-sm font-medium text-foreground">
            Name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-2 h-10 w-full rounded-md border border-input bg-secondary/70 px-3 text-sm outline-none focus:border-primary"
              placeholder={titles[type]}
            />
          </label>
          <SelectField
            label="Priority"
            value="High"
            onChange={() => undefined}
            options={["High", "Medium", "Low"]}
          />
          <label className="text-sm font-medium text-foreground">
            Notes
            <textarea
              className="mt-2 min-h-24 w-full rounded-md border border-input bg-secondary/70 p-3 text-sm outline-none focus:border-primary"
              placeholder="Add context for the team"
            />
          </label>
          {!name.trim() ? <p className="text-xs text-warning">Name is required.</p> : null}
        </div>
      )}
    </Modal>
  );
}

function TaskDetailDrawer() {
  const nexus = useNexus();
  const task = nexus.selectedTask;
  if (!task) return null;
  return (
    <Drawer open title={`${task.id} · ${task.status}`} onClose={nexus.closeTask} wide>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
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
          {task.labels.map((label) => (
            <Badge key={label} tone="info">
              {label}
            </Badge>
          ))}
        </div>
        <div>
          <h3 className="font-display text-2xl font-semibold text-foreground">{task.title}</h3>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{task.description}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            ["Project", task.project],
            ["Assignee", task.assignee],
            ["Reporter", task.reporter],
            ["Due date", task.dueDate],
          ].map(([label, value]) => (
            <div key={label} className="rounded-md border border-border bg-secondary/50 p-3">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
            </div>
          ))}
        </div>
        <div>
          <h4 className="mb-2 text-sm font-semibold text-foreground">Checklist</h4>
          <div className="space-y-2">
            {task.checklist.map((item) => (
              <label
                key={item.id}
                className="flex items-center gap-3 rounded-md bg-secondary/50 p-2 text-sm text-foreground"
              >
                <input
                  type="checkbox"
                  checked={item.done}
                  onChange={() => nexus.toggleChecklist(task.id, item.id)}
                  className="h-4 w-4 accent-primary"
                />{" "}
                <span className={cn(item.done && "text-muted-foreground line-through")}>
                  {item.label}
                </span>
              </label>
            ))}
          </div>
        </div>
        <div>
          <h4 className="mb-2 text-sm font-semibold text-foreground">Attachments</h4>
          <Attachments target={{ taskId: task.id }} label="this task" />
        </div>
        <div>
          <h4 className="mb-2 text-sm font-semibold text-foreground">Comments</h4>
          <div className="space-y-3">
            {task.comments.map((comment) => {
              const author = nexus.users.find((user) => user.id === comment.authorId);
              return (
                <div key={comment.id} className="flex gap-3 rounded-md bg-secondary/50 p-3">
                  <Avatar name={author?.name ?? "User"} />
                  <div>
                    <p className="text-sm font-medium text-foreground">{author?.name}</p>
                    <p className="text-sm text-muted-foreground">{comment.body}</p>
                    <span className="text-xs text-muted-foreground">{comment.time}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div>
          <h4 className="mb-2 text-sm font-semibold text-foreground">Activity</h4>
          <div className="space-y-2">
            {task.activity.map((activity) => (
              <p
                key={activity}
                className="rounded-md border border-border bg-secondary/40 p-2 text-sm text-muted-foreground"
              >
                {activity}
              </p>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => nexus.pushToast("Task edit mode opened", "info")}>Edit</Button>
          <Button variant="secondary" onClick={() => nexus.pushToast("Assign menu opened", "info")}>
            Assign
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              nexus.updateTaskStatus(task.id, task.status === "Done" ? "In Progress" : "Done")
            }
          >
            Change Status
          </Button>
          <Button variant="destructive" onClick={() => nexus.openModal("delete")}>
            Delete
          </Button>
        </div>
      </div>
    </Drawer>
  );
}

function MemberDrawer() {
  const nexus = useNexus();
  const user = nexus.selectedUser;
  const { startCall, phase } = useCall();
  if (!user) return null;
  const isSelf = user.id === nexus.currentUser.id;
  const busy = phase === "calling" || phase === "connecting" || phase === "active";
  return (
    <Drawer open title={user.name} onClose={nexus.closeUser}>
      <div className="space-y-5">
        <div className="flex items-center gap-4">
          <Avatar name={user.name} className="h-16 w-16 text-lg" />
          <div>
            <p className="font-display text-xl font-semibold text-foreground">{user.name}</p>
            <p className="text-sm text-muted-foreground">{user.role}</p>
            <Badge tone={user.status === "Online" ? "success" : "warning"}>{user.status}</Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => void startCall(user.id, user.name)}
            disabled={isSelf || busy}
          >
            <Phone />
            {isSelf ? "This is you" : busy ? "Call in progress" : "Call"}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => nexus.pushToast(`Opened a chat with ${user.name}`)}
            disabled={isSelf}
          >
            <MessageSquare />
            Message
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            ["Active Tasks", user.activeTasks],
            ["Completed", user.completed],
            ["Projects", user.projects],
            ["Completion Rate", `${user.completionRate}%`],
          ].map(([label, value]) => (
            <div key={label} className="rounded-md border border-border bg-secondary/50 p-3">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 font-display text-2xl font-semibold text-foreground">{value}</p>
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-foreground">Recent activity</h4>
          {nexus.tasks
            .filter((task) => task.assigneeId === user.id)
            .slice(0, 4)
            .map((task) => (
              <button
                key={task.id}
                onClick={() => nexus.openTask(task)}
                className="block w-full rounded-md bg-secondary/50 p-3 text-left text-sm text-foreground hover:bg-muted"
              >
                {task.title}
                <span className="block text-xs text-muted-foreground">
                  {task.status} · {task.dueDate}
                </span>
              </button>
            ))}
        </div>
      </div>
    </Drawer>
  );
}

function FileDrawer() {
  const nexus = useNexus();
  const file = nexus.selectedFile;
  if (!file) return null;
  return (
    <Drawer open title={file.name} onClose={nexus.closeFile}>
      <div className="space-y-4">
        <div className="grid aspect-[4/3] place-items-center rounded-lg border border-border bg-secondary/50">
          <FileText className="h-16 w-16 text-primary" />
        </div>
        {[
          ["Type", file.type],
          ["Owner", file.owner],
          ["Size", file.size],
          ["Modified", file.modified],
          ["Folder", file.folder],
        ].map(([label, value]) => (
          <div key={label} className="grid grid-cols-[8rem_minmax(0,1fr)] gap-2 text-sm">
            <span className="text-muted-foreground">{label}</span>
            <span className="truncate text-foreground">{value}</span>
          </div>
        ))}
        <Button onClick={() => nexus.pushToast("Preview opened", "info")}>Open Preview</Button>
      </div>
    </Drawer>
  );
}

function EventModal() {
  const nexus = useNexus();
  const event = nexus.selectedEvent;
  return (
    <Modal
      open={Boolean(event)}
      title={event?.title ?? "Event"}
      description={event ? `${event.date} · ${event.time}` : "Event details"}
      onClose={nexus.closeEvent}
      footer={<Button onClick={nexus.closeEvent}>Done</Button>}
    >
      {event ? (
        <div className="space-y-3">
          <Badge tone="info">{event.type}</Badge>
          <p className="text-sm leading-6 text-muted-foreground">{event.notes}</p>
          <p className="text-sm text-foreground">Attendees: {event.attendees.join(", ")}</p>
        </div>
      ) : null}
    </Modal>
  );
}

function AuditDrawer() {
  const nexus = useNexus();
  const audit = nexus.selectedAudit;
  if (!audit) return null;
  return (
    <Drawer open title="Audit details" onClose={nexus.closeAudit}>
      <div className="space-y-3">
        {[
          ["Timestamp", audit.timestamp],
          ["User", audit.user],
          ["Action", audit.action],
          ["Resource", audit.resource],
          ["IP", audit.ip],
          ["Status", audit.status],
          ["Detail", audit.detail],
        ].map(([label, value]) => (
          <div key={label} className="rounded-md border border-border bg-secondary/50 p-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-sm text-foreground">{value}</p>
          </div>
        ))}
      </div>
    </Drawer>
  );
}
