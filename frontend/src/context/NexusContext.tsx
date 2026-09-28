import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "@tanstack/react-router";

import {
  analytics as analyticsData,
  auditLogs as auditSeed,
  calendarEvents as eventSeed,
  channels as channelSeed,
  currentUser as seedUser,
  files as fileSeed,
  folders as folderSeed,
  messages as messageSeed,
  notifications as notificationSeed,
  projects as projectSeed,
  tasks as taskSeed,
  users as userSeed,
} from "@/data/mockData";
import {
  api,
  ApiError,
  AUTHENTICATED_EVENT,
  AUTH_EXPIRED_EVENT,
  isAuthenticated,
} from "@/services/api";
import {
  disconnectSocket,
  getSocket,
  joinChannel,
  leaveChannel,
  onSocketEvent,
} from "@/services/socket";
import type {
  Analytics,
  AuditLog,
  CalendarEvent,
  FileItem,
  MessageItem,
  ModalState,
  NotificationItem,
  Organization,
  Project,
  Task,
  TaskStatus,
  ToastItem,
  User,
  ViewDensity,
} from "@/types/nexus";

interface NexusState {
  currentUser: User;
  organization: string;
  /** Null until hydration settles and the user has at least one workspace. */
  organizationId: string | null;
  organizations: Organization[];
  switchOrganization: (id: string) => void;
  users: User[];
  projects: Project[];
  tasks: Task[];
  notifications: NotificationItem[];
  messages: MessageItem[];
  files: FileItem[];
  events: CalendarEvent[];
  auditLogs: AuditLog[];
  analytics: Analytics;
  channels: string[];
  folders: string[];
  roles: string[];
  /** False once the workspace has been hydrated from the API. */
  isDemo: boolean;
  isLoading: boolean;
  reload: () => Promise<void>;
  signOut: () => Promise<void>;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (value: boolean) => void;
  mobileSidebarOpen: boolean;
  setMobileSidebarOpen: (value: boolean) => void;
  commandOpen: boolean;
  setCommandOpen: (value: boolean) => void;
  modal: ModalState;
  openModal: (type: Exclude<ModalState["type"], null>, payload?: unknown) => void;
  closeModal: () => void;
  selectedTask: Task | null;
  openTask: (task: Task) => void;
  closeTask: () => void;
  selectedUser: User | null;
  openUser: (user: User) => void;
  closeUser: () => void;
  selectedFile: FileItem | null;
  openFile: (file: FileItem) => void;
  closeFile: () => void;
  selectedEvent: CalendarEvent | null;
  openEvent: (event: CalendarEvent) => void;
  closeEvent: () => void;
  selectedAudit: AuditLog | null;
  openAudit: (audit: AuditLog) => void;
  closeAudit: () => void;
  toasts: ToastItem[];
  pushToast: (title: string, intent?: ToastItem["intent"]) => void;
  dismissToast: (id: string) => void;
  updateTaskStatus: (taskId: string, status: TaskStatus) => void;
  toggleChecklist: (taskId: string, itemId: string) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  addMessage: (channel: string, body: string) => void;
  theme: "dark" | "light" | "system";
  setTheme: (theme: "dark" | "light" | "system") => void;
  density: ViewDensity;
  setDensity: (density: ViewDensity) => void;
}

const NexusContext = createContext<NexusState | null>(null);

/**
 * The backend stores exactly two roles (see the `role` enum in User.js), and
 * serialize.js renders them as display labels. Deriving the list from the
 * loaded team keeps Settings honest instead of advertising roles that cannot
 * be assigned. Demo mode has no server roles to read, so it falls back to the
 * two that exist.
 */
const FALLBACK_ROLES = ["Organization Admin", "Member"];

/** Real zeroes, not the seed's numbers, for a panel whose request failed. */
const emptyAnalytics: Analytics = {
  progress: [],
  status: [],
  workload: [],
  productivity: [],
};

export function NexusProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<User>(seedUser);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [organization, setOrganization] = useState("NEXUS Labs");
  // The whole list, so surfaces that manage access (invites, workspace switch)
  // can pick an organization instead of guessing the primary one.
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [users, setUsers] = useState<User[]>(userSeed);
  const [projects, setProjects] = useState<Project[]>(projectSeed);
  const [tasks, setTasks] = useState<Task[]>(taskSeed);
  const [notifications, setNotifications] = useState<NotificationItem[]>(notificationSeed);
  const [messages, setMessages] = useState<MessageItem[]>(messageSeed);
  const [files, setFiles] = useState<FileItem[]>(fileSeed);
  const [events, setEvents] = useState<CalendarEvent[]>(eventSeed);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(auditSeed);
  const [analytics, setAnalytics] = useState<Analytics>(analyticsData);
  const [channels, setChannels] = useState<string[]>(channelSeed);
  const [folders, setFolders] = useState<string[]>(folderSeed);
  const [isDemo, setIsDemo] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [modal, setModal] = useState<ModalState>({ type: null });
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [selectedAudit, setSelectedAudit] = useState<AuditLog | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [theme, setThemeState] = useState<"dark" | "light" | "system">("dark");
  const [density, setDensity] = useState<ViewDensity>("Comfortable");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("light", theme === "light");
  }, [theme]);

  const dismissToast = useCallback((id: string) => {
    setToasts((items) => items.filter((item) => item.id !== id));
  }, []);

  const pushToast = useCallback(
    (title: string, intent: ToastItem["intent"] = "success") => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setToasts((items) => [{ id, title, intent }, ...items].slice(0, 4));
      window.setTimeout(() => dismissToast(id), 4200);
    },
    [dismissToast],
  );

  const reportFailure = useCallback(
    (error: unknown, fallback: string) => {
      const message = error instanceof Error && error.message ? error.message : fallback;
      pushToast(message, "error");
    },
    [pushToast],
  );

  const reload = useCallback(async () => {
    if (!isAuthenticated()) {
      setIsDemo(true);
      return;
    }

    setIsLoading(true);

    /*
      Every panel is settled on its own rather than through one Promise.all.
      A single unreachable endpoint used to reject the whole batch, so the
      catch below kept every seed value on screen: one flaky
      organizations/mine made a workspace with 1 real project display the
      demo's 5. Settling each call independently means a failure degrades one
      panel instead of silently replacing the entire app with fake numbers.
    */
    const settle = <T,>(label: string, call: Promise<T>, fallback: T): Promise<T> =>
      call.catch((error: unknown) => {
        failed.push(label);
        console.warn(`NEXUS: ${label} failed to load`, error);
        return fallback;
      });

    const failed: string[] = [];

    const [
      me,
      projectList,
      taskList,
      team,
      channelList,
      messageList,
      notificationList,
      fileList,
      folderList,
      eventList,
      analyticsResult,
      auditList,
      orgList,
    ] = await Promise.all([
      // The identity call is the one thing that must not be faked: without it
      // there is no session, and the caller already checked for a token.
      api.auth.me(),
      settle("projects", api.projects.list(), [] as Project[]),
      settle("tasks", api.tasks.list(), [] as Task[]),
      settle("team", api.team.list(), [] as User[]),
      settle("channels", api.channels.list(), [] as string[]),
      settle("messages", api.messages.list(), [] as MessageItem[]),
      settle("notifications", api.notifications.list(), [] as NotificationItem[]),
      settle("files", api.files.list(), [] as FileItem[]),
      settle("folders", api.files.folders(), [] as string[]),
      settle("calendar", api.calendar.list(), [] as CalendarEvent[]),
      settle("analytics", api.analytics.get(), emptyAnalytics),
      // Audit logs are admin-only, so a plain member gets a 403 here. That is
      // an expected answer, not a broken API, and it must not take the rest
      // of the workspace down with it.
      api.audit.list().catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 403) {
          return [] as AuditLog[];
        }
        throw error;
      }),
      settle("organizations", api.organizations.list(), [] as Organization[]),
    ]);

    if (failed.length > 0) {
      pushToast(`Could not load ${failed.join(", ")}. Other areas are still live.`, "warning");
    }

    setCurrentUser(me);
    setProjects(projectList);
    setTasks(taskList);
    setUsers(team);
    setChannels(channelList);
    setMessages(messageList);
    setNotifications(notificationList);
    setFiles(fileList);
    setFolders(folderList);
    setEvents(eventList);
    setAnalytics(analyticsResult);
    setAuditLogs(auditList);

    const primaryOrg = orgList[0];
    setOrganization(primaryOrg ? primaryOrg.name : "NEXUS");
    setOrganizationId((previous) => {
      // Keep the user's choice across a reload, but never keep an id that is
      // no longer one of theirs.
      if (previous && orgList.some((org) => org.id === previous)) {
        return previous;
      }

      return primaryOrg ? primaryOrg.id : null;
    });

    setOrganizations(orgList);
    /*
      Real data has landed, so this is no longer a demo even if some panels
      failed. Leaving it true is what made the seed values look authoritative.
    */
    setIsDemo(false);
    setIsLoading(false);
  }, [pushToast]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Login/register happen outside the provider's lifetime, so the app shell
  // would keep rendering seed data until a manual reload. Hydrate instead.
  useEffect(() => {
    const handleAuthenticated = () => {
      void reload();
    };

    window.addEventListener(AUTHENTICATED_EVENT, handleAuthenticated);

    return () => {
      window.removeEventListener(AUTHENTICATED_EVENT, handleAuthenticated);
    };
  }, [reload]);

  // The refresh token is gone, so there is nothing left to hydrate.
  useEffect(() => {
    const handleExpired = () => {
      setIsDemo(true);
      void navigate({ to: "/login" });
    };

    window.addEventListener(AUTH_EXPIRED_EVENT, handleExpired);

    return () => {
      window.removeEventListener(AUTH_EXPIRED_EVENT, handleExpired);
    };
  }, [navigate]);

  const signOut = useCallback(async () => {
    try {
      await api.auth.logout();
    } finally {
      disconnectSocket();
      setCurrentUser(seedUser);
      setUsers(userSeed);
      setProjects(projectSeed);
      setTasks(taskSeed);
      setNotifications(notificationSeed);
      setMessages(messageSeed);
      setFiles(fileSeed);
      setEvents(eventSeed);
      setAuditLogs(auditSeed);
      setAnalytics(analyticsData);
      setChannels(channelSeed);
      setFolders(folderSeed);
      // The workspace and the chosen organization were left behind, so the next
      // person to sign in on a shared browser saw the previous one's name.
      setOrganization("NEXUS Labs");
      setOrganizationId(null);
      setOrganizations([]);
      setIsDemo(true);
      await navigate({ to: "/login" });
    }
  }, [navigate]);

  // Live updates. Every handler guards on !isDemo so demo data is never mixed
  // with server payloads, and each one de-duplicates against the local list
  // because an optimistic REST write and the socket echo can both arrive.
  const isLive = !isDemo;

  useEffect(() => {
    if (!isLive) {
      return;
    }

    const upsertMessage = (incoming: MessageItem) => {
      if (!incoming?.id) {
        return;
      }

      setMessages((items) =>
        items.some((item) => item.id === incoming.id) ? items : [...items, incoming],
      );
    };

    const offChannelMessage = onSocketEvent("newChannelMessage", upsertMessage);
    const offDirectMessage = onSocketEvent("newMessage", upsertMessage);
    const offNotification = onSocketEvent("newNotification", (incoming) => {
      if (!incoming?.id) {
        return;
      }

      setNotifications((items) =>
        items.some((item) => item.id === incoming.id) ? items : [incoming, ...items],
      );
    });
    const offOnline = onSocketEvent("userOnline", ({ userId }) => {
      setUsers((items) =>
        items.map((item) => (item.id === userId ? { ...item, status: "Online" } : item)),
      );
    });
    const offOffline = onSocketEvent("userOffline", ({ userId }) => {
      setUsers((items) =>
        items.map((item) => (item.id === userId ? { ...item, status: "Offline" } : item)),
      );
    });

    // Channel rooms are per-socket, so they are (re)joined by the effect below.
    return () => {
      offChannelMessage();
      offDirectMessage();
      offNotification();
      offOnline();
      offOffline();
    };
  }, [isLive]);

  useEffect(() => {
    if (!isLive) {
      return;
    }

    const joinAll = () => {
      channels.forEach((channel) => joinChannel(channel));
    };

    // A reconnect gets a brand new socket id, so the rooms must be re-joined.
    const active = getSocket();
    active?.on("connect", joinAll);
    joinAll();

    return () => {
      active?.off("connect", joinAll);
      channels.forEach((channel) => leaveChannel(channel));
    };
  }, [isLive, channels]);

  const replaceTask = useCallback((task: Task) => {
    setTasks((items) => items.map((item) => (item.id === task.id ? task : item)));
    setSelectedTask((open) => (open && open.id === task.id ? task : open));
  }, []);

  const updateTaskStatus = useCallback(
    (taskId: string, status: TaskStatus) => {
      if (!isAuthenticated()) {
        pushToast("Sign in to update tasks", "warning");
        return;
      }

      void (async () => {
        try {
          replaceTask(await api.tasks.update(taskId, { status }));
          pushToast(`Task moved to ${status}`, "success");
        } catch (error) {
          reportFailure(error, "Could not update the task");
        }
      })();
    },
    [pushToast, replaceTask, reportFailure],
  );

  const toggleChecklist = useCallback(
    (taskId: string, itemId: string) => {
      if (!isAuthenticated()) {
        pushToast("Sign in to update checklists", "warning");
        return;
      }

      const current = tasks.find((task) => task.id === taskId);
      const item = current?.checklist.find((entry) => entry.id === itemId);

      if (!current || !item) {
        return;
      }

      void (async () => {
        try {
          replaceTask(await api.tasks.toggleChecklist(taskId, itemId, !item.done));
          pushToast("Checklist updated", "info");
        } catch (error) {
          reportFailure(error, "Could not update the checklist");
        }
      })();
    },
    [pushToast, replaceTask, reportFailure, tasks],
  );

  const markNotificationRead = useCallback(
    (id: string) => {
      setNotifications((items) =>
        items.map((item) => (item.id === id ? { ...item, read: true } : item)),
      );

      if (!isAuthenticated()) {
        return;
      }

      void (async () => {
        try {
          await api.notifications.markRead(id);
        } catch (error) {
          reportFailure(error, "Could not mark the notification as read");
        }
      })();
    },
    [reportFailure],
  );

  const markAllNotificationsRead = useCallback(() => {
    setNotifications((items) => items.map((item) => ({ ...item, read: true })));

    if (!isAuthenticated()) {
      pushToast("Sign in to manage notifications", "warning");
      return;
    }

    void (async () => {
      try {
        await api.notifications.markAllRead();
        pushToast("All notifications marked as read", "success");
      } catch (error) {
        reportFailure(error, "Could not update notifications");
      }
    })();
  }, [pushToast, reportFailure]);

  const addMessage = useCallback(
    (channel: string, body: string) => {
      const trimmed = body.trim();

      if (!trimmed) {
        return;
      }

      if (!isAuthenticated()) {
        pushToast("Sign in to send messages", "warning");
        return;
      }

      void (async () => {
        try {
          const sent = await api.messages.send(channel, trimmed);

          /*
            The sender also receives its own message back over the socket, and
            the upsert in the realtime handler is meant to swallow that. It
            only de-duplicates on `id`, and an optimistic write plus a socket
            echo that arrive with different ids rendered the message twice.
            Replacing by id, and ignoring anything already present, is what
            the comment above that handler always claimed.
          */
          setMessages((items) =>
            items.some((item) => item.id === sent.id) ? items : [...items, sent],
          );

          pushToast("Message sent", "success");
        } catch (error) {
          reportFailure(error, "Could not send the message");
        }
      })();
    },
    [pushToast, reportFailure],
  );

  const roles = useMemo<string[]>(() => {
    const present = Array.from(
      new Set(users.map((user) => user.role).filter((role): role is string => Boolean(role))),
    );

    return present.length > 0 ? present.sort() : FALLBACK_ROLES;
  }, [users]);

  /*
    The switcher used to render a hardcoded list of three names and only push a
    "Switched to ..." toast, so it looked like it worked while the app kept
    showing whatever it had loaded. Only the id moves here; the panels reload
    on the next hydration.
  */
  const switchOrganization = useCallback(
    (id: string) => {
      const target = organizations.find((org) => org.id === id);

      if (!target) {
        return;
      }

      setOrganizationId(target.id);
      setOrganization(target.name);
      pushToast(`Switched to ${target.name}`, "info");
    },
    [organizations, pushToast],
  );

  const value = useMemo<NexusState>(
    () => ({
      currentUser,
      organization,
      organizationId,
      organizations,
      switchOrganization,
      users,
      projects,
      tasks,
      notifications,
      messages,
      files,
      events,
      auditLogs,
      analytics,
      channels,
      folders,
      roles,
      isDemo,
      isLoading,
      reload,
      signOut,
      sidebarCollapsed,
      setSidebarCollapsed,
      mobileSidebarOpen,
      setMobileSidebarOpen,
      commandOpen,
      setCommandOpen,
      modal,
      openModal: (type, payload) => setModal({ type, payload }),
      closeModal: () => setModal({ type: null }),
      selectedTask,
      openTask: setSelectedTask,
      closeTask: () => setSelectedTask(null),
      selectedUser,
      openUser: setSelectedUser,
      closeUser: () => setSelectedUser(null),
      selectedFile,
      openFile: setSelectedFile,
      closeFile: () => setSelectedFile(null),
      selectedEvent,
      openEvent: setSelectedEvent,
      closeEvent: () => setSelectedEvent(null),
      selectedAudit,
      openAudit: setSelectedAudit,
      closeAudit: () => setSelectedAudit(null),
      toasts,
      pushToast,
      dismissToast,
      updateTaskStatus,
      toggleChecklist,
      markNotificationRead,
      markAllNotificationsRead,
      addMessage,
      theme,
      setTheme: (nextTheme) => {
        setThemeState(nextTheme);
        pushToast(`Appearance set to ${nextTheme}`, "info");
      },
      density,
      setDensity: (nextDensity) => {
        setDensity(nextDensity);
        pushToast(`Density set to ${nextDensity}`, "info");
      },
    }),
    [
      addMessage,
      analytics,
      auditLogs,
      channels,
      commandOpen,
      currentUser,
      density,
      dismissToast,
      events,
      files,
      folders,
      isDemo,
      isLoading,
      markAllNotificationsRead,
      markNotificationRead,
      messages,
      mobileSidebarOpen,
      modal,
      notifications,
      organization,
      organizationId,
      organizations,
      projects,
      pushToast,
      reload,
      roles,
      selectedAudit,
      selectedEvent,
      selectedFile,
      selectedTask,
      selectedUser,
      signOut,
      sidebarCollapsed,
      switchOrganization,
      tasks,
      theme,
      toasts,
      toggleChecklist,
      updateTaskStatus,
      users,
    ],
  );

  return <NexusContext.Provider value={value}>{children}</NexusContext.Provider>;
}

export function useNexus() {
  const context = useContext(NexusContext);
  if (!context) {
    throw new Error("useNexus must be used within NexusProvider");
  }
  return context;
}
