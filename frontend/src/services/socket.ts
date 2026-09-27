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

/**
 * Outgoing call signalling. `offer`, `answer` and `candidate` are the raw
 * strings, never the WebRTC objects that produced them.
 */
export const emitCallEvent = <K extends keyof CallOutbox>(
  event: K,
  payload: CallOutbox[K],
): void => {
  getSocket()?.emit(event, payload as never);
};

/**
 * Call signalling.
 *
 * SDP and candidate payloads are plain strings, not RTCSessionDescription /
 * RTCIceCandidate objects: server.js validates them with readText, which
 * rejects anything that is not a string. An earlier client sent the objects
 * and every offer was refused with "Invalid WebRTC offer".
 *
 * Inbound events carry the peer ids the server resolved. Outbound events
 * deliberately carry only a callId: the server takes the sender's identity
 * from the authenticated socket (socket.data.userId) and looks the peer up
 * from the Call record, so anything the client claims about identity is
 * ignored at best.
 */
type CallInbox = {
  incomingCall: { callId: string; caller: string; receiver: string };
  callAccepted: { callId: string; receiver: string };
  callRejected: { callId: string; receiver: string };
  callMissed: { callId: string; caller: string; receiver: string };
  callEnded: { callId: string };
  webrtcOffer: { callId: string; caller: string; receiver: string; offer: string };
  webrtcAnswer: { callId: string; receiver: string; answer: string };
  iceCandidate: { callId: string; caller: string; receiver: string; candidate: string };
};

type CallOutbox = {
  callUser: { callId: string };
  callAccepted: { callId: string };
  callRejected: { callId: string };
  callMissed: { callId: string };
  endCall: { callId: string };
  webrtcOffer: { callId: string; offer: string };
  webrtcAnswer: { callId: string; answer: string };
  iceCandidate: { callId: string; candidate: string };
};

type EventMap = {
  newChannelMessage: MessageItem;
  newMessage: MessageItem;
  newNotification: NotificationItem;
  messageRead: { messageId: string; readerId: string };
  userOnline: { userId: string };
  userOffline: { userId: string };
  socketError: { message: string };
} & CallInbox;

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
