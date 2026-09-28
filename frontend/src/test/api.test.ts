import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, ApiError, isAuthenticated, setRemember } from "@/services/api";

/**
 * The API client is the only place the frontend decides what the server said.
 * Three bugs lived here:
 *
 *   - reads were served from the HTTP cache, so the browser replayed a 304 from
 *     before a workspace existed and the caller silently read {} as data
 *   - a 304 was treated as success rather than as a failed read
 *   - an error body was replaced by a generic message, hiding the real reason
 */

const jsonResponse = (status: number, body: unknown) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as Response;

const mockFetch = (impl: (url: string, init?: RequestInit) => Response | Promise<Response>) => {
  const spy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
    impl(String(input), init),
  );

  vi.stubGlobal("fetch", spy);

  return spy;
};

const signIn = () => {
  window.localStorage.setItem("nexus.accessToken", "test-token");
  window.localStorage.setItem("nexus.refreshToken", "test-refresh");
};

beforeEach(() => {
  // Both stores, because a session lives in one or the other depending on
  // whether Remember me was ticked, and a leftover in either would leak between
  // tests.
  window.localStorage.clear();
  window.sessionStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("caching", () => {
  it("bypasses the HTTP cache on every request", async () => {
    signIn();

    const spy = mockFetch(() => jsonResponse(200, { projects: [] }));

    await api.projects.list();

    const init = spy.mock.calls[0]?.[1] as RequestInit | undefined;

    expect(init?.cache).toBe("no-store");
  });

  it("raises a 304 as a failure instead of returning an empty object", async () => {
    signIn();

    mockFetch(() => jsonResponse(304, {}));

    // A 304 has no body, so before the fix the caller received {} and then
    // unwrap() turned that into an empty list, indistinguishable from "no
    // projects" rather than "the read failed".
    await expect(api.projects.list()).rejects.toBeInstanceOf(ApiError);
  });
});

describe("sessions", () => {
  it("keeps the session in sessionStorage when Remember me is off", async () => {
    setRemember(false);

    mockFetch(() =>
      jsonResponse(200, {
        message: "Login successful",
        token: "access-1",
        refreshToken: "refresh-1",
        user: { id: "u1", name: "Raj", email: "raj@example.com" },
      }),
    );

    await api.auth.login({ email: "raj@example.com", password: "secret123" });

    // Closing the browser must end the session unless the user asked otherwise.
    expect(window.sessionStorage.getItem("nexus.accessToken")).toBe("access-1");
    expect(window.sessionStorage.getItem("nexus.refreshToken")).toBe("refresh-1");
    expect(window.localStorage.getItem("nexus.accessToken")).toBeNull();
    expect(isAuthenticated()).toBe(true);
  });

  it("keeps the session in localStorage when Remember me is on", async () => {
    setRemember(true);

    mockFetch(() =>
      jsonResponse(200, {
        message: "Login successful",
        token: "access-remembered",
        refreshToken: "refresh-remembered",
        user: { id: "u1", name: "Raj", email: "raj@example.com" },
      }),
    );

    await api.auth.login({ email: "raj@example.com", password: "secret123" });

    expect(window.localStorage.getItem("nexus.accessToken")).toBe("access-remembered");
    expect(window.localStorage.getItem("nexus.refreshToken")).toBe("refresh-remembered");
    // Never both, or the two stores could disagree about the current session.
    expect(window.sessionStorage.getItem("nexus.accessToken")).toBeNull();
    expect(isAuthenticated()).toBe(true);
  });

  it("drops a remembered session when Remember me is turned off", async () => {
    setRemember(true);

    mockFetch(() =>
      jsonResponse(200, {
        message: "Login successful",
        token: "access-old",
        refreshToken: "refresh-old",
        user: { id: "u1", name: "Raj", email: "raj@example.com" },
      }),
    );

    await api.auth.login({ email: "raj@example.com", password: "secret123" });
    expect(window.localStorage.getItem("nexus.accessToken")).toBe("access-old");

    // Unticking the box has to take effect now, not at the next sign-in, or a
    // persistent session would outlive the choice the user just made.
    setRemember(false);

    expect(window.localStorage.getItem("nexus.accessToken")).toBeNull();
    expect(window.localStorage.getItem("nexus.refreshToken")).toBeNull();
  });

  it("clears both stores on logout even if the request fails", async () => {
    setRemember(true);
    signIn();

    mockFetch(() => {
      throw new TypeError("Failed to fetch");
    });

    await expect(api.auth.logout()).rejects.toBeTruthy();

    // The session is gone regardless, or a failed logout would leave the app
    // believing it is still signed in.
    expect(isAuthenticated()).toBe(false);
  });

  it("refreshes once and retries the original request after a 401", async () => {
    setRemember(true);
    signIn();

    let projectCalls = 0;

    const spy = mockFetch((url, init) => {
      const auth = new Headers(init?.headers).get("Authorization") ?? "";

      if (url.includes("/auth/refresh")) {
        return jsonResponse(200, {
          token: "access-2",
          refreshToken: "refresh-2",
          user: { id: "u1" },
        });
      }

      projectCalls += 1;

      // The stale token is rejected; only the refreshed one is accepted.
      if (auth === "Bearer test-token") {
        return jsonResponse(401, { message: "expired" });
      }

      return jsonResponse(200, { projects: [{ id: "p1" }] });
    });

    const projects = await api.projects.list();

    expect(projects).toHaveLength(1);
    expect(projectCalls).toBe(2);
    expect(window.localStorage.getItem("nexus.accessToken")).toBe("access-2");

    // The retry must carry the new token, not the one that just failed.
    const retryInit = spy.mock.calls.at(-1)?.[1] as RequestInit | undefined;

    expect(new Headers(retryInit?.headers).get("Authorization")).toBe("Bearer access-2");
  });

  it("does not retry a non-401 failure", async () => {
    signIn();

    let calls = 0;

    mockFetch(() => {
      calls += 1;

      return jsonResponse(500, { message: "Server error" });
    });

    await expect(api.projects.list()).rejects.toBeInstanceOf(ApiError);
    expect(calls).toBe(1);
  });
});

describe("error messages", () => {
  it("surfaces the server's own message", async () => {
    signIn();

    mockFetch(() =>
      jsonResponse(403, { message: "Audit logs are restricted to organization admins" }),
    );

    await expect(api.audit.list()).rejects.toThrow(/restricted to organization admins/);
  });

  it("falls back to a status message when the body has none", async () => {
    signIn();

    mockFetch(() => jsonResponse(500, {}));

    await expect(api.projects.list()).rejects.toThrow(/500/);
  });
});

describe("response unwrapping", () => {
  it("unwraps the documented key", async () => {
    signIn();

    mockFetch(() => jsonResponse(200, { message: "ok", projects: [{ id: "p1" }] }));

    expect(await api.projects.list()).toEqual([{ id: "p1" }]);
  });

  it("returns an empty list rather than throwing when the key is absent", async () => {
    signIn();

    mockFetch(() => jsonResponse(200, { message: "ok" }));

    expect(await api.projects.list()).toEqual([]);
  });

  it("exposes the call record fields the UI needs to play audio", async () => {
    signIn();

    mockFetch(() =>
      jsonResponse(201, {
        message: "Voice message sent successfully",
        voiceMessage: {
          id: "m1",
          channel: "direct:u2",
          authorId: "u1",
          body: "",
          time: "09:41",
          reactions: [],
          edited: false,
          messageType: "voice",
          audioUrl: "/api/messages/voice/m1",
          duration: 4,
        },
      }),
    );

    const message = await api.messages.sendVoice({
      audio: new Blob(["x"], { type: "audio/webm" }),
      duration: 4,
      receiver: "u2",
    });

    // Without these the client cannot tell a voice note from an empty message.
    expect(message.messageType).toBe("voice");
    expect(message.audioUrl).toBe("/api/messages/voice/m1");
    expect(message.duration).toBe(4);
  });

  it("exposes createdBy on a channel so the UI knows who may delete it", async () => {
    signIn();

    mockFetch(() =>
      jsonResponse(201, {
        message: "Channel created successfully",
        channel: {
          id: "c1",
          name: "design-review",
          description: "",
          isPrivate: false,
          members: ["u1"],
          createdBy: "u1",
        },
      }),
    );

    const channel = await api.channels.create({
      name: "design-review",
      organizationId: "o1",
    });

    expect(channel.createdBy).toBe("u1");
  });
});
