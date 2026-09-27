import { io, type Socket } from "socket.io-client";

import type { MessageItem, NotificationItem } from "@/types/nexus";

const SOCKET_URL: string =
  (import.meta.env["VITE_SOCKET_URL"] as string | undefined) ??
  (import.meta.env["VITE_API_URL"] as string | undefined)?.replace(/\/api\/?$/, "") ??
  "http://localhost:5000";

const readAccessToken = (): string | null => {
  try {
    return window.localStorage.getItem("nexus.accessToken");
  } catch {
    return null;
  }
};

let socket: Socket | null = null;

/** Opens (or reuses) the authenticated socket. Returns null when signed out. */
export const connectSocket = (): Socket | null => {
  const token = readAccessToken();

  if (!token) {
    return null;
  }

  if (socket?.connected) {
    return socket;
  }

  if (socket) {
    socket.disconnect();
    socket = null;
  }

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ["websocket", "polling"],
    reconnectionDelay: 1000,
    reconnectionDelayMax: 8000,
  });

  return socket;
};

export const disconnectSocket = (): void => {
  socket?.disconnect();
  socket = null;
};

export const getSocket = (): Socket | null => socket;

export const joinChannel = (channel: string): void => {
  socket?.emit("joinChannel", { channel });
};

export const leaveChannel = (channel: string): void => {
  socket?.emit("leaveChannel", { channel });
};

type EventMap = {
  newChannelMessage: MessageItem;
  newMessage: MessageItem;
  newNotification: NotificationItem;
  messageRead: { messageId: string; readerId: string };
  userOnline: { userId: string };
  userOffline: { userId: string };
  socketError: { message: string };
};

type Handler<K extends keyof EventMap> = (payload: EventMap[K]) => void;

/** Subscribes to a server event for as long as the returned disposer lives. */
export const onSocketEvent = <K extends keyof EventMap>(
  event: K,
  handler: Handler<K>,
): (() => void) => {
  const active = connectSocket();

  if (!active) {
    return () => undefined;
  }

  active.on(event, handler as never);

  return () => {
    active.off(event, handler as never);
  };
};
