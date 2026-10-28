import { beforeEach, describe, expect, it, vi } from "vitest";

import { connectSocket, disconnectSocket, onSocketEvent } from "@/services/socket";

/**
 * Two realtime faults lived in this module and both looked like "the socket is
 * connected" instead of an error, so the browser proved them only as silent
 * missing messages:
 *
 *   - the token was read from localStorage alone, so a user who left
 *     "Remember me" unticked (the default) never got a socket at all
 *   - every subscription called connectSocket(), which tore down a socket
 *     that was still handshaking; only the last listener survived
 */

type Handler = (payload: unknown) => void;

const ioSpy = vi.hoisted(() => vi.fn());

vi.mock("socket.io-client", () => ({ io: ioSpy }));

const makeFakeSocket = (auth: { token?: string }) => {
  const handlers = new Map<string, Set<Handler>>();

  const socket = {
    auth,
    connected: false,
    active: true,
    emitted: [] as Array<{ event: string; payload: unknown }>,
    disconnects: 0,
    on(event: string, handler: Handler) {
      const set = handlers.get(event) ?? new Set<Handler>();
      set.add(handler);
      handlers.set(event, set);
      return socket;
    },
    off(event: string, handler: Handler) {
      handlers.get(event)?.delete(handler);
      return socket;
    },
    emit(event: string, payload: unknown) {
      socket.emitted.push({ event, payload });
      return socket;
    },
    disconnect() {
      socket.disconnects += 1;
      socket.connected = false;
      socket.active = false;
      return socket;
    },
    trigger(event: string, payload: unknown) {
      for (const handler of handlers.get(event) ?? []) {
        handler(payload);
      }
    },
    listenerCount(event: string) {
      return handlers.get(event)?.size ?? 0;
    },
  };

  return socket;
};

const created: Array<ReturnType<typeof makeFakeSocket>> = [];

beforeEach(() => {
  disconnectSocket();
  window.localStorage.clear();
  window.sessionStorage.clear();
  created.length = 0;
  ioSpy.mockReset();
  ioSpy.mockImplementation((_url: string, options: { auth: { token?: string } }) => {
    const socket = makeFakeSocket(options.auth);
    created.push(socket);
    return socket;
  });
});

const signIn = (token: string, remember = false) => {
  window.localStorage.setItem("nexus.remember", String(remember));
  (remember ? window.localStorage : window.sessionStorage).setItem("nexus.accessToken", token);
};

describe("connectSocket", () => {
  it("stays quiet until there is a token", () => {
    expect(connectSocket()).toBeNull();
    expect(ioSpy).not.toHaveBeenCalled();
  });

  it("uses the sessionStorage token that the default sign-in produces", () => {
    signIn("session-token", false);

    connectSocket();

    expect(ioSpy).toHaveBeenCalledTimes(1);
    expect(created[0]?.auth.token).toBe("session-token");
  });

  it("uses the localStorage token when Remember me was ticked", () => {
    signIn("remembered-token", true);

    connectSocket();

    expect(created[0]?.auth.token).toBe("remembered-token");
  });

  /*
    Regression: the first four subscriptions used to destroy the socket that
    was still connecting, so newChannelMessage/newMessage/newNotification were
    bound to dead instances and only userOffline survived on the live one.
  */
  it("keeps one connecting socket for every subscription", () => {
    signIn("session-token", false);

    const first = connectSocket();
    const second = connectSocket();

    expect(ioSpy).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);

    const received: string[] = [];

    onSocketEvent("newChannelMessage", (message) => received.push(message.id));
    onSocketEvent("newMessage", (message) => received.push(message.id));
    onSocketEvent("newNotification", () => received.push("notification"));
    onSocketEvent("userOnline", () => received.push("online"));

    // The handshake has not completed yet; the socket is still `connecting`
    // while every listener is attached.
    expect(created).toHaveLength(1);
    expect(created[0]?.connected).toBe(false);
    expect(created[0]?.listenerCount("newChannelMessage")).toBe(1);
    expect(created[0]?.listenerCount("newMessage")).toBe(1);
    expect(created[0]?.listenerCount("newNotification")).toBe(1);

    created[0]?.trigger("newChannelMessage", { id: "m1", channel: "backend" });

    expect(received).toEqual(["m1"]);
  });

  it("reuses the socket while it is reconnecting", () => {
    signIn("session-token", false);

    const first = connectSocket();
    created[0]!.connected = false;
    created[0]!.active = true;

    expect(connectSocket()).toBe(first);
    expect(ioSpy).toHaveBeenCalledTimes(1);
  });

  it("replaces the socket when a different account signs in", () => {
    signIn("first-token", false);
    const first = connectSocket();

    signIn("second-token", false);
    const second = connectSocket();

    expect(second).not.toBe(first);
    expect(ioSpy).toHaveBeenCalledTimes(2);
    expect((first as unknown as ReturnType<typeof makeFakeSocket>).disconnects).toBe(1);
    expect(created[1]?.auth.token).toBe("second-token");
  });

  it("only removes the listener whose disposer ran", () => {
    signIn("session-token", false);

    const one = vi.fn();
    const two = vi.fn();

    const disposeOne = onSocketEvent("newChannelMessage", one);
    onSocketEvent("newChannelMessage", two);

    disposeOne();
    created[0]?.trigger("newChannelMessage", { id: "m9", channel: "backend" });

    expect(one).not.toHaveBeenCalled();
    expect(two).toHaveBeenCalledTimes(1);
  });
});
