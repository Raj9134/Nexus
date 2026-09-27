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
  roles,
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
  organizations: Organization[];
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

export function NexusProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<User>(seedUser);
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

    try {
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
        api.auth.me(),
        api.projects.list(),
        api.tasks.list(),
        api.team.list(),
        api.channels.list(),
        api.messages.list(),
        api.notifications.list(),
        api.files.list(),
        api.files.folders(),
        api.calendar.list(),
        api.analytics.get(),
        // Audit logs are admin-only, so a plain member gets a 403 here. That is
        // an expected answer, not a broken API, and it must not take the rest
        // of the workspace down with it.
        api.audit.list().catch((error: unknown) => {
          if (error instanceof ApiError && error.status === 403) {
            return [] as AuditLog[];
          }
          throw error;
        }),
        api.organizations.list(),
      ]);

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
      setOrganizations(orgList);
      setIsDemo(false);
    } catch (error) {
      // A failed hydration must not wipe the shell; keep the seed and say why.
      setIsDemo(true);
      reportFailure(error, "Could not reach the NEXUS API");
    } finally {
      setIsLoading(false);
    }
  }, [reportFailure]);

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
      setIsDemo(true);
    }
  }, []);

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
          setMessages((items) => [...items, sent]);
          pushToast("Message sent", "success");
        } catch (error) {
          reportFailure(error, "Could not send the message");
        }
      })();
    },
    [pushToast, reportFailure],
  );

  const value = useMemo<NexusState>(
    () => ({
      currentUser,
      organization,
      organizations,
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
      organizations,
      projects,
      pushToast,
      reload,
      selectedAudit,
      selectedEvent,
      selectedFile,
      selectedTask,
      selectedUser,
      signOut,
      sidebarCollapsed,
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
