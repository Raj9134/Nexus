import type {
  Analytics,
  AuditLog,
  CalendarEvent,
  CallRecord,
  ChannelRecord,
  FileItem,
  MessageItem,
  NotificationItem,
  Organization,
  Project,
  ProjectStatus,
  Task,
  TaskStatus,
  User,
} from "@/types/nexus";

/**
 * Single data-access seam for the whole app.
 *
 * Every call goes through `request`, which attaches the access token,
 * transparently refreshes it once on a 401, and unwraps the backend's
 * `{ message, ... }` envelopes so callers only ever see the shapes
 * declared in `@/types/nexus`.
 */

const API_BASE: string = import.meta.env["VITE_API_URL"] ?? "http://localhost:5000/api";

const ACCESS_TOKEN_KEY = "nexus.accessToken";
const REFRESH_TOKEN_KEY = "nexus.refreshToken";

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const readStorage = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeStorage = (key: string, value: string): void => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage unavailable (private mode / disabled cookies) */
  }
};

const clearTokens = (): void => {
  try {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch {
    /* ignore */
  }
};

interface Session {
  token: string;
  refreshToken: string;
  user: User;
}

let refreshInFlight: Promise<Session | null> | null = null;

const rawRequest = async <T>(path: string, init: RequestInit, token: string | null): Promise<T> => {
  const headers = new Headers(init.headers);

  if (init.body !== undefined && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  /*
    Every call bypasses the HTTP cache. These responses are scoped to the
    bearer token, so a shared cache key is wrong regardless, and in practice
    the browser was replaying a 304 from before a workspace was created: the
    app showed a stale body and the caller could not tell it apart from
    current data. Mutations already bust the cache; reads must too.
  */
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers, cache: "no-store" });

  // A 304 carries no body, so response.json() would reject and the caller
  // would silently receive {}. With no-store this should not happen, but a
  // 304 is a failure for an API read rather than a success.
  if (response.status === 304) {
    throw new ApiError(304, "The API returned no data for this request");
  }

  const payload: unknown = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      "message" in payload &&
      typeof payload.message === "string"
        ? payload.message
        : `Request failed with status ${response.status}`;

    throw new ApiError(response.status, message);
  }

  return payload as T;
};

const performRefresh = async (): Promise<Session | null> => {
  const refreshToken = readStorage(REFRESH_TOKEN_KEY);

  if (!refreshToken) {
    return null;
  }

  try {
    const session = await rawRequest<Session>(
      "/auth/refresh",
      { method: "POST", body: JSON.stringify({ refreshToken }) },
      null,
    );

    writeStorage(ACCESS_TOKEN_KEY, session.token);
    writeStorage(REFRESH_TOKEN_KEY, session.refreshToken);

    return session;
  } catch {
    clearTokens();

    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
    }

    return null;
  }
};

/** Single-flight so a burst of 401s triggers exactly one refresh. */
const refreshAccessToken = (): Promise<string | null> => {
  if (!refreshInFlight) {
    refreshInFlight = performRefresh().finally(() => {
      refreshInFlight = null;
    });
  }

  return refreshInFlight.then((session) => session?.token ?? null);
};

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  anonymous?: boolean;
}

const request = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
  const method = options.method ?? "GET";
  const init: RequestInit = { method };

  if (options.body !== undefined) {
    init.body = JSON.stringify(options.body);
  }

  if (options.anonymous) {
    return rawRequest<T>(path, init, null);
  }

  const accessToken = readStorage(ACCESS_TOKEN_KEY);

  try {
    return await rawRequest<T>(path, init, accessToken);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) {
      throw error;
    }

    const renewed = await refreshAccessToken();

    if (!renewed) {
      clearTokens();
      throw error;
    }

    return rawRequest<T>(path, init, renewed);
  }
};

const unwrap = <T>(payload: unknown, key: string, fallback: T): T => {
  if (payload && typeof payload === "object" && key in payload) {
    return (payload as Record<string, unknown>)[key] as T;
  }

  return fallback;
};

const one = <T>(payload: unknown, key: string, fallback: T): T => unwrap<T>(payload, key, fallback);

/** Only forward values the backend can parse as a real date. */
const toIsoDate = (value: string | undefined | null): string | undefined => {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
};

/**
 * Builds a PATCH body where the date field is always explicit:
 * undefined -> key omitted, null -> key cleared, parseable -> ISO,
 * unparseable -> key dropped rather than forwarding a display string.
 * Spreading `patch` directly would leak the raw display value.
 */
const withDatePatch = <T extends object>(patch: T, key: string): Record<string, unknown> => {
  const { [key]: raw, ...rest } = patch as Record<string, unknown>;

  if (raw === undefined) {
    return rest;
  }

  if (raw === null) {
    return { ...rest, [key]: null };
  }

  const iso = toIsoDate(typeof raw === "string" ? raw : undefined);

  return iso ? { ...rest, [key]: iso } : rest;
};

export interface ProjectInput {
  name: string;
  organizationId: string;
  description?: string;
  key?: string;
  icon?: string;
  status?: ProjectStatus;
  progress?: number;
  due?: string;
}

export interface ProjectPatch {
  name?: string;
  description?: string;
  key?: string;
  icon?: string;
  status?: ProjectStatus;
  progress?: number;
  due?: string;
}

export interface TaskInput {
  title: string;
  projectId: string;
  description?: string;
  status?: TaskStatus;
  priority?: Task["priority"];
  dueDate?: string;
  labels?: string[];
  checklist?: Task["checklist"];
  assignedTo?: string;
}

export interface TaskPatch {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: Task["priority"];
  dueDate?: string | null;
  labels?: string[];
  assignedTo?: string | null;
}

export interface EventInput {
  title: string;
  /** ISO datetime. The backend stores a single `startAt`. */
  startAt: string;
  type?: CalendarEvent["type"];
  notes?: string;
  attendees?: string[];
}

export interface InvitePreview {
  organization: string;
  workspaceType?: string;
  role: string;
  inviter: string;
  email: string;
  expiresAt: string;
}

export interface InviteSendResult {
  invited: string[];
  skipped: string[];
}

export const api = {
  auth: {
    async register(input: { name: string; email: string; password: string }): Promise<Session> {
      const session = await request<Session>("/auth/register", {
        method: "POST",
        body: input,
        anonymous: true,
      });

      writeStorage(ACCESS_TOKEN_KEY, session.token);
      writeStorage(REFRESH_TOKEN_KEY, session.refreshToken);

      return session;
    },

    async login(input: { email: string; password: string }): Promise<Session> {
      const session = await request<Session>("/auth/login", {
        method: "POST",
        body: input,
        anonymous: true,
      });

      writeStorage(ACCESS_TOKEN_KEY, session.token);
      writeStorage(REFRESH_TOKEN_KEY, session.refreshToken);

      return session;
    },

    async logout(): Promise<void> {
      try {
        await request<unknown>("/auth/logout", { method: "POST" });
      } finally {
        clearTokens();
      }
    },

    async refresh(): Promise<Session> {
      if (!refreshInFlight) {
        refreshInFlight = performRefresh().finally(() => {
          refreshInFlight = null;
        });
      }

      const session = await refreshInFlight;

      if (!session) {
        throw new ApiError(401, "Session expired");
      }

      return session;
    },

    /**
     * Backend never reveals whether the account exists. `devToken` is only
     * present outside production, where there is no mail provider to deliver
     * the link.
     */
    async forgotPassword(email: string): Promise<{ message?: string; devToken?: string }> {
      const payload = await request<{ message?: string; devToken?: string }>(
        "/auth/forgot-password",
        {
          method: "POST",
          body: { email },
          anonymous: true,
        },
      );

      return payload ?? {};
    },

    async resetPassword(input: { token: string; password: string }): Promise<void> {
      await request<unknown>("/auth/reset-password", {
        method: "POST",
        body: input,
        anonymous: true,
      });
    },

    async requestEmailVerification(
      email: string,
    ): Promise<{ message?: string; devToken?: string }> {
      const payload = await request<{ message?: string; devToken?: string }>(
        "/auth/request-email-verification",
        {
          method: "POST",
          body: { email },
          anonymous: true,
        },
      );

      return payload ?? {};
    },

    async verifyEmail(token: string): Promise<void> {
      await request<unknown>("/auth/verify-email", {
        method: "POST",
        body: { token },
        anonymous: true,
      });
    },

    async me(): Promise<User> {
      const payload = await request<unknown>("/auth/me");

      return one<User>(payload, "user", payload as User);
    },

    /**
     * The current identity with live task counts. Unlike /auth/me this also
     * returns the name and email at the top level.
     */
    async profile(): Promise<{ name: string; email: string; user: User }> {
      const payload = await request<{ name: string; email: string; user: User }>("/auth/profile");

      return payload;
    },

    /** Admin only: every user in the caller's organizations. Answers 403 otherwise. */
    async users(): Promise<User[]> {
      const payload = await request<unknown>("/auth/users");

      return unwrap<User[]>(payload, "users", []);
    },

    async updateProfile(patch: {
      name?: string;
      department?: string;
      avatar?: string;
    }): Promise<User> {
      const payload = await request<unknown>("/auth/me", { method: "PATCH", body: patch });

      return one<User>(payload, "user", payload as User);
    },
  },

  organizations: {
    async list(): Promise<Organization[]> {
      const payload = await request<unknown>("/organizations/mine");

      return unwrap<Organization[]>(payload, "organizations", []);
    },

    async get(id: string): Promise<unknown> {
      const payload = await request<unknown>(`/organizations/${id}`);

      return one<unknown>(payload, "organization", payload);
    },

    async create(name: string, description?: string): Promise<unknown> {
      const payload = await request<unknown>("/organizations", {
        method: "POST",
        body: description ? { name, description } : { name },
      });

      return one<unknown>(payload, "organization", payload);
    },

    async update(
      id: string,
      patch: { name?: string; description?: string },
    ): Promise<Organization> {
      const payload = await request<unknown>(`/organizations/${id}`, {
        method: "PUT",
        body: patch,
      });

      return one<Organization>(payload, "organization", payload as Organization);
    },

    async remove(id: string): Promise<void> {
      await request<unknown>(`/organizations/${id}`, { method: "DELETE" });
    },

    async addMember(
      id: string,
      userId: string,
      role: "admin" | "member" = "member",
    ): Promise<Organization> {
      const payload = await request<unknown>(`/organizations/${id}/members`, {
        method: "POST",
        body: { userId, role },
      });

      return one<Organization>(payload, "organization", payload as Organization);
    },

    async removeMember(id: string, userId: string): Promise<Organization> {
      const payload = await request<unknown>(`/organizations/${id}/members/${userId}`, {
        method: "DELETE",
      });

      return one<Organization>(payload, "organization", payload as Organization);
    },
  },

  invitations: {
    /**
     * Public: a signed-out invitee needs this before they have an account, so
     * the call is deliberately anonymous and only reveals the workspace name.
     */
    async preview(token: string): Promise<InvitePreview> {
      const payload = await request<InvitePreview>(
        `/organizations/invitations/preview/${encodeURIComponent(token)}`,
        { anonymous: true },
      );

      return payload;
    },

    async accept(token: string): Promise<{ message?: string; role?: string }> {
      // Not anonymous: redeeming an invitation needs a session, and the token
      // has to be the one belonging to the invited address.
      const payload = await request<{ message?: string; role?: string }>(
        "/organizations/invitations/accept",
        { method: "POST", body: { token } },
      );

      return payload ?? {};
    },

    async list(organizationId: string): Promise<InvitePreview[]> {
      const payload = await request<unknown>(`/organizations/${organizationId}/invitations`);

      return unwrap<InvitePreview[]>(payload, "invitations", []);
    },

    async send(organizationId: string, emails: string[]): Promise<InviteSendResult> {
      const payload = await request<unknown>(`/organizations/${organizationId}/invitations`, {
        method: "POST",
        body: { emails },
      });

      return {
        invited: (payload as { invited?: string[] })?.invited ?? [],
        skipped: (payload as { skipped?: string[] })?.skipped ?? [],
      };
    },
  },

  projects: {
    async list(): Promise<Project[]> {
      const payload = await request<unknown>("/projects");

      return unwrap<Project[]>(payload, "projects", []);
    },

    async get(id: string): Promise<Project> {
      const payload = await request<unknown>(`/projects/${id}`);

      return one<Project>(payload, "project", payload as Project);
    },

    async create(input: ProjectInput): Promise<Project> {
      const due = toIsoDate(input.due);

      const payload = await request<unknown>("/projects", {
        method: "POST",
        body: {
          name: input.name,
          organizationId: input.organizationId,
          description: input.description ?? "",
          status: input.status ?? "Active",
          progress: input.progress ?? 0,
          ...(input.key ? { key: input.key } : {}),
          ...(input.icon ? { icon: input.icon } : {}),
          ...(due ? { due } : {}),
        },
      });

      return one<Project>(payload, "project", payload as Project);
    },

    async update(id: string, patch: ProjectPatch): Promise<Project> {
      const payload = await request<unknown>(`/projects/${id}`, {
        method: "PATCH",
        body: withDatePatch(patch, "due"),
      });

      return one<Project>(payload, "project", payload as Project);
    },

    async remove(id: string): Promise<void> {
      await request<unknown>(`/projects/${id}`, { method: "DELETE" });
    },
  },

  tasks: {
    async list(): Promise<Task[]> {
      const payload = await request<unknown>("/tasks");

      return unwrap<Task[]>(payload, "tasks", []);
    },

    async get(id: string): Promise<Task> {
      const payload = await request<unknown>(`/tasks/${id}`);

      return one<Task>(payload, "task", payload as Task);
    },

    async create(input: TaskInput): Promise<Task> {
      const dueDate = toIsoDate(input.dueDate);

      const payload = await request<unknown>("/tasks", {
        method: "POST",
        body: {
          title: input.title,
          projectId: input.projectId,
          description: input.description ?? "",
          status: input.status ?? "Todo",
          priority: input.priority ?? "Medium",
          labels: input.labels ?? [],
          checklist: input.checklist ?? [],
          ...(dueDate ? { dueDate } : {}),
          ...(input.assignedTo ? { assignedTo: input.assignedTo } : {}),
        },
      });

      return one<Task>(payload, "task", payload as Task);
    },

    async update(id: string, patch: TaskPatch): Promise<Task> {
      const payload = await request<unknown>(`/tasks/${id}`, {
        method: "PATCH",
        body: withDatePatch(patch, "dueDate"),
      });

      return one<Task>(payload, "task", payload as Task);
    },

    async toggleChecklist(id: string, itemId: string, checked: boolean): Promise<Task> {
      const payload = await request<unknown>(`/tasks/${id}/checklist`, {
        method: "PATCH",
        body: { itemId, checked },
      });

      return one<Task>(payload, "task", payload as Task);
    },

    async remove(id: string): Promise<void> {
      await request<unknown>(`/tasks/${id}`, { method: "DELETE" });
    },
  },

  messages: {
    async list(channel?: string): Promise<MessageItem[]> {
      const query = channel ? `?channel=${encodeURIComponent(channel)}` : "";

      const payload = await request<unknown>(`/messages${query}`);

      return unwrap<MessageItem[]>(payload, "messages", []);
    },

    async send(channel: string, body: string): Promise<MessageItem> {
      const payload = await request<unknown>("/messages", {
        method: "POST",
        body: { channel, message: body },
      });

      return one<MessageItem>(payload, "data", payload as MessageItem);
    },

    /**
     * Direct message. The backend stamps these with a `direct:<userId>`
     * channel, which is how a thread is told apart from a real channel.
     */
    async sendDirect(receiverId: string, body: string): Promise<MessageItem> {
      const payload = await request<unknown>("/messages", {
        method: "POST",
        body: { receiver: receiverId, message: body },
      });

      return one<MessageItem>(payload, "data", payload as MessageItem);
    },

    async update(id: string, body: string): Promise<MessageItem> {
      const payload = await request<unknown>(`/messages/${id}`, {
        method: "PATCH",
        body: { message: body },
      });

      return one<MessageItem>(payload, "data", payload as MessageItem);
    },

    async remove(id: string): Promise<void> {
      await request<unknown>(`/messages/${id}`, { method: "DELETE" });
    },

    /** Direct-message history with one person, oldest first. */
    async conversation(userId: string): Promise<MessageItem[]> {
      const payload = await request<unknown>(`/messages/${userId}`);

      return unwrap<MessageItem[]>(payload, "messages", []);
    },

    /** Channel messages are not tracked per user; the backend rejects this. */
    async markRead(id: string): Promise<void> {
      await request<unknown>(`/messages/${id}/read`, { method: "PUT" });
    },

    /**
     * `duration` is required by the backend and must be a positive number of
     * seconds, so the recorder has to measure it rather than the server
     * guessing from the file.
     */
    async sendVoice(input: {
      audio: Blob;
      duration: number;
      receiver?: string;
      channel?: string;
    }): Promise<MessageItem> {
      const form = new FormData();

      form.append("audio", input.audio, "voice-message");
      form.append("duration", String(input.duration));

      if (input.receiver) {
        form.append("receiver", input.receiver);
      }

      if (input.channel) {
        form.append("channel", input.channel);
      }

      const payload = await rawRequest<unknown>(
        "/messages/voice",
        { method: "POST", body: form },
        readStorage(ACCESS_TOKEN_KEY),
      );

      return one<MessageItem>(payload, "voiceMessage", payload as MessageItem);
    },

    /**
     * The audio endpoint needs the Authorization header, so a bare `src` on an
     * <audio> element would 401. Fetch it and hand back an object URL, which
     * the caller must revoke.
     */
    async voiceObjectUrl(messageId: string): Promise<string> {
      const response = await fetch(`${API_BASE}/messages/voice/${messageId}`, {
        headers: { Authorization: `Bearer ${readStorage(ACCESS_TOKEN_KEY) ?? ""}` },
      });

      if (!response.ok) {
        throw new ApiError(response.status, "Could not load the voice message");
      }

      return URL.createObjectURL(await response.blob());
    },
  },

  channels: {
    async list(): Promise<string[]> {
      const payload = await request<unknown>("/channels");

      return unwrap<string[]>(payload, "channels", []);
    },

    /** Full channel records, including description, privacy and members. */
    async records(): Promise<ChannelRecord[]> {
      const payload = await request<unknown>("/channels/records");

      return unwrap<ChannelRecord[]>(payload, "channels", []);
    },

    async create(input: {
      name: string;
      organizationId: string;
      description?: string;
      isPrivate?: boolean;
    }): Promise<ChannelRecord> {
      const payload = await request<unknown>("/channels", {
        method: "POST",
        body: {
          name: input.name,
          organizationId: input.organizationId,
          description: input.description ?? "",
          isPrivate: input.isPrivate ?? false,
        },
      });

      return one<ChannelRecord>(payload, "channel", payload as ChannelRecord);
    },

    async remove(name: string): Promise<void> {
      await request<unknown>(`/channels/${encodeURIComponent(name)}`, { method: "DELETE" });
    },
  },

  notifications: {
    async list(): Promise<NotificationItem[]> {
      const payload = await request<unknown>("/notifications");

      return unwrap<NotificationItem[]>(payload, "notifications", []);
    },

    async unreadCount(): Promise<number> {
      const payload = await request<{ unreadCount?: number }>("/notifications/unread-count");

      return typeof payload.unreadCount === "number" ? payload.unreadCount : 0;
    },

    async markRead(id: string): Promise<void> {
      await request<unknown>(`/notifications/${id}/read`, { method: "PUT" });
    },

    async markAllRead(): Promise<void> {
      await request<unknown>("/notifications/read-all", { method: "PUT" });
    },
  },

  files: {
    async list(): Promise<FileItem[]> {
      const payload = await request<unknown>("/files");

      return unwrap<FileItem[]>(payload, "files", []);
    },

    async folders(): Promise<string[]> {
      const payload = await request<unknown>("/files/folders");

      return unwrap<string[]>(payload, "folders", []);
    },

    /**
     * A loose upload into the file library. The backend ignores any project or
     * task field here, so associating a file with one is `attach`'s job.
     */
    async upload(file: File): Promise<FileItem> {
      const form = new FormData();

      form.append("file", file);

      const payload = await rawRequest<unknown>(
        "/files/upload",
        { method: "POST", body: form },
        readStorage(ACCESS_TOKEN_KEY),
      );

      return one<FileItem>(payload, "file", payload as FileItem);
    },

    /** Uploads and binds in one step. Exactly one of projectId/taskId. */
    async attach(
      file: File,
      target: { projectId: string } | { taskId: string },
    ): Promise<FileItem> {
      const form = new FormData();

      form.append("file", file);

      if ("projectId" in target) {
        form.append("projectId", target.projectId);
      } else {
        form.append("taskId", target.taskId);
      }

      const payload = await rawRequest<unknown>(
        "/files/attach",
        { method: "POST", body: form },
        readStorage(ACCESS_TOKEN_KEY),
      );

      return one<FileItem>(payload, "file", payload as FileItem);
    },

    async forProject(projectId: string): Promise<FileItem[]> {
      const payload = await request<unknown>(`/files/project/${projectId}`);

      return unwrap<FileItem[]>(payload, "files", []);
    },

    async forTask(taskId: string): Promise<FileItem[]> {
      const payload = await request<unknown>(`/files/task/${taskId}`);

      return unwrap<FileItem[]>(payload, "files", []);
    },

    /** Sends a file as a direct message. Answers with the message, not the file. */
    async sendAsMessage(file: File, receiverId: string): Promise<MessageItem> {
      const form = new FormData();

      form.append("file", file);
      form.append("receiver", receiverId);

      const payload = await rawRequest<unknown>(
        "/files/message",
        { method: "POST", body: form },
        readStorage(ACCESS_TOKEN_KEY),
      );

      return one<MessageItem>(payload, "data", payload as MessageItem);
    },

    async download(id: string, filename: string): Promise<void> {
      const response = await fetch(`${API_BASE}/files/download/${id}`, {
        headers: { Authorization: `Bearer ${readStorage(ACCESS_TOKEN_KEY) ?? ""}` },
      });

      if (!response.ok) {
        throw new ApiError(response.status, "Download failed");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    },

    async remove(id: string): Promise<void> {
      await request<unknown>(`/files/${id}`, { method: "DELETE" });
    },
  },

  calendar: {
    async list(): Promise<CalendarEvent[]> {
      const payload = await request<unknown>("/calendar");

      return unwrap<CalendarEvent[]>(payload, "events", []);
    },

    async create(input: EventInput): Promise<CalendarEvent> {
      const payload = await request<unknown>("/calendar", {
        method: "POST",
        body: {
          title: input.title,
          startAt: input.startAt,
          type: input.type ?? "Meeting",
          notes: input.notes ?? "",
          attendees: input.attendees ?? [],
        },
      });

      return one<CalendarEvent>(payload, "event", payload as CalendarEvent);
    },

    async update(id: string, patch: Partial<EventInput>): Promise<CalendarEvent> {
      const payload = await request<unknown>(`/calendar/${id}`, { method: "PATCH", body: patch });

      return one<CalendarEvent>(payload, "event", payload as CalendarEvent);
    },

    async remove(id: string): Promise<void> {
      await request<unknown>(`/calendar/${id}`, { method: "DELETE" });
    },
  },

  team: {
    async list(): Promise<User[]> {
      const payload = await request<unknown>("/team");

      return unwrap<User[]>(payload, "users", []);
    },
  },

  analytics: {
    async get(): Promise<Analytics> {
      const payload = await request<unknown>("/analytics");

      return one<Analytics>(payload, "analytics", {
        progress: [],
        status: [],
        workload: [],
        productivity: [],
      });
    },
  },

  audit: {
    async list(): Promise<AuditLog[]> {
      const payload = await request<unknown>("/audit-logs");

      return unwrap<AuditLog[]>(payload, "logs", []);
    },
  },

  search: {
    async tasks(query: string): Promise<Task[]> {
      const payload = await request<unknown>(`/search/tasks?q=${encodeURIComponent(query)}`);

      return unwrap<Task[]>(payload, "tasks", []);
    },

    async users(query: string): Promise<User[]> {
      const payload = await request<unknown>(`/search/users?q=${encodeURIComponent(query)}`);

      return unwrap<User[]>(payload, "users", []);
    },

    async projects(query: string): Promise<Project[]> {
      const payload = await request<unknown>(`/search/projects?q=${encodeURIComponent(query)}`);

      return unwrap<Project[]>(payload, "projects", []);
    },

    async organizations(query: string): Promise<Organization[]> {
      const payload = await request<unknown>(
        `/search/organizations?q=${encodeURIComponent(query)}`,
      );

      return unwrap<Organization[]>(payload, "organizations", []);
    },

    async messages(query: string): Promise<MessageItem[]> {
      const payload = await request<unknown>(`/search/messages?q=${encodeURIComponent(query)}`);

      return unwrap<MessageItem[]>(payload, "messages", []);
    },
  },

  calls: {
    /** Creates the call record, then rings the receiver over the socket. */
    async start(receiverId: string): Promise<CallRecord> {
      const payload = await request<unknown>("/calls", {
        method: "POST",
        body: { receiver: receiverId },
      });

      return one<CallRecord>(payload, "call", payload as CallRecord);
    },

    async accept(callId: string): Promise<CallRecord> {
      const payload = await request<unknown>(`/calls/${callId}/accept`, { method: "PUT" });

      return one<CallRecord>(payload, "call", payload as CallRecord);
    },

    async reject(callId: string): Promise<CallRecord> {
      const payload = await request<unknown>(`/calls/${callId}/reject`, { method: "PUT" });

      return one<CallRecord>(payload, "call", payload as CallRecord);
    },

    /** The receiver reporting they could not pick up. */
    async miss(callId: string): Promise<CallRecord> {
      const payload = await request<unknown>(`/calls/${callId}/miss`, { method: "PUT" });

      return one<CallRecord>(payload, "call", payload as CallRecord);
    },

    async end(callId: string): Promise<CallRecord> {
      const payload = await request<unknown>(`/calls/${callId}/end`, { method: "PUT" });

      return one<CallRecord>(payload, "call", payload as CallRecord);
    },

    async get(callId: string): Promise<CallRecord> {
      const payload = await request<unknown>(`/calls/${callId}`);

      return one<CallRecord>(payload, "call", payload as CallRecord);
    },

    async list(): Promise<CallRecord[]> {
      const payload = await request<unknown>("/calls");

      return unwrap<CallRecord[]>(payload, "calls", []);
    },
  },

  onboarding: {
    async complete(input: {
      organization: string;
      project: string;
      workspaceType?: string;
      teammateEmails?: string[];
    }): Promise<{
      organization: Organization;
      project: Project;
      membersAdded: string[];
      invitesPending: string[];
    }> {
      const payload = await request<unknown>("/onboarding", {
        method: "POST",
        body: input,
      });

      return {
        organization: one<Organization>(
          payload,
          "organization",
          (payload as { organization: Organization }).organization,
        ),
        project: one<Project>(payload, "project", (payload as { project: Project }).project),
        membersAdded: (payload as { membersAdded?: string[] }).membersAdded ?? [],
        invitesPending: (payload as { invitesPending?: string[] }).invitesPending ?? [],
      };
    },
  },
};

export const isAuthenticated = (): boolean => readStorage(ACCESS_TOKEN_KEY) !== null;

/**
 * Dispatched after a successful login/register so the mounted NexusProvider
 * re-hydrates from the API instead of showing seed data.
 */
export const AUTHENTICATED_EVENT = "nexus:authenticated";

/**
 * Dispatched when a refresh fails and the tokens are gone. Without this the
 * router guard would keep sending the user to /app with no usable session.
 */
export const AUTH_EXPIRED_EVENT = "nexus:auth-expired";
