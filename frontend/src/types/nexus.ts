import type { ReactNode } from "react";

export type Priority = "Low" | "Medium" | "High" | "Critical";
export type TaskStatus = "Backlog" | "Todo" | "In Progress" | "In Review" | "Done";
export type ProjectStatus = "Active" | "At Risk" | "Archived" | "Planning";
export type ViewDensity = "Compact" | "Comfortable";

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  avatar: string;
  status: "Online" | "Away" | "Offline";
  activeTasks: number;
  completed: number;
  workload: "Low" | "Balanced" | "High";
  projects: number;
  completionRate: number;
}

/** Mirrors the backend's serializeOrganization() output. */
export interface Organization {
  id: string;
  name: string;
  description?: string;
}

export interface Project {
  id: string;
  name: string;
  key: string;
  description: string;
  progress: number;
  members: string[];
  tasks: number;
  completed: number;
  due: string;
  status: ProjectStatus;
  icon: string;
}

export interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

export interface Comment {
  id: string;
  authorId: string;
  body: string;
  time: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  projectId: string;
  project: string;
  priority: Priority;
  status: TaskStatus;
  assigneeId: string;
  assignee: string;
  reporter: string;
  dueDate: string;
  labels: string[];
  comments: Comment[];
  attachments: number;
  checklist: ChecklistItem[];
  activity: string[];
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  category: "Mention" | "Task" | "Project" | "System";
  time: string;
  read: boolean;
}

export interface MessageItem {
  id: string;
  channel: string;
  authorId: string;
  body: string;
  time: string;
  reactions: string[];
  edited?: boolean;
  /** A voice or file message has an empty body and carries its payload here. */
  messageType?: "text" | "voice" | "file";
  /** Server path to the audio, present only on voice messages. */
  audioUrl?: string | null;
  /** Seconds, present only on voice messages. */
  duration?: number | null;
  fileId?: string | null;
}

export interface FileItem {
  id: string;
  name: string;
  type: string;
  owner: string;
  size: string;
  modified: string;
  folder: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  type: "Meeting" | "Deadline" | "Review" | "Planning";
  attendees: string[];
  notes: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  resource: string;
  ip: string;
  status: "Success" | "Warning" | "Blocked";
  detail: string;
}

/** A support request the signed-in user raised. */
export interface SupportRequest {
  id: string;
  subject: string;
  message: string;
  /** The route the user was on, so a report carries where it happened. */
  page: string;
  status: "open" | "closed";
  createdAt: string | null;
}

export interface Analytics {
  progress: { name: string; planned: number; completed: number }[];
  status: { name: TaskStatus; value: number }[];
  workload: { name: string; tasks: number }[];
  productivity: { name: string; points: number }[];
  metrics?: {
    totalProjects: number;
    activeTasks: number;
    completedTasks: number;
    overdue: number;
    completionRate: number;
    averageCycleTimeDays: number;
    totalUsers: number;
  };
}

export interface ToastItem {
  id: string;
  title: string;
  intent: "success" | "warning" | "error" | "info";
}

export interface ModalState {
  type:
    | "task"
    | "project"
    | "invite"
    | "team"
    | "event"
    | "upload"
    | "delete"
    | "role"
    | "profile"
    | "support"
    | null;
  payload?: unknown;
}

export interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
}

/** A call party as serializeCall emits it: populated, never a bare ObjectId. */
export interface CallParty {
  id: string;
  name: string;
  email: string;
}

/** A channel with its full record, as /channels/records returns it. */
export interface ChannelRecord {
  id: string;
  name: string;
  description: string;
  isPrivate: boolean;
  members: string[];
  /** Only this user may delete the channel. */
  createdBy: string;
}

export type CallStatus = "calling" | "accepted" | "rejected" | "ended" | "missed";
export interface CallRecord {
  id: string;
  caller: CallParty;
  receiver: CallParty;
  status: CallStatus;
  startedAt: string | null;
  endedAt: string | null;
  /** Seconds, filled in by the backend when the call ends. */
  duration: number;
  createdAt: string | null;
}
