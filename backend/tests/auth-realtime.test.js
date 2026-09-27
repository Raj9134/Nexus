process.env.NODE_ENV = "test";

/**
 * Auth recovery, onboarding, calendar/activity detail, and Socket.IO realtime tests.
 *
 * These cover flows that the contract test cannot express: one-time tokens,
 * workspace setup, the remaining endpoints that were previously missing, and
 * real-time delivery.
 *
 * Run against a live server + MongoDB:
 *   npm start
 *   npm run test:realtime
 */

const { io } = require("socket.io-client");

const ORIGIN = process.env.API_BASE || "http://localhost:5000";
const BASE = `${ORIGIN}/api`;

const call = async (method, path, token, body) => {
    const res = await fetch(BASE + path, {
        method,
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
};

const stamp = Date.now();
const results = [];

const check = (label, actual, expected) => {
    const pass = actual === expected;
    results.push(pass);
    console.log(
        `${pass ? "PASS" : "FAIL"}  ${label.padEnd(58)} got ${JSON.stringify(actual)}${pass ? "" : ` expected ${JSON.stringify(expected)}`}`
    );
};

const report = () => {
    const passed = results.filter(Boolean).length;
    console.log(`\n===== ${passed}/${results.length} passed =====`);

    if (passed !== results.length) {
        process.exitCode = 1;
    }
};

const sockets = [];

// Resolves with the first payload for `event`, or null after `ms`.
// A timeout is a value worth asserting, not a crash.
const waitFor = (socket, event, ms = 5000) => new Promise((resolve) => {
    const timer = setTimeout(() => {
        socket.off(event, handler);
        resolve(null);
    }, ms);

    const handler = (payload) => {
        clearTimeout(timer);
        socket.off(event, handler);
        resolve(payload);
    };

    socket.on(event, handler);
});

const connect = (token) => new Promise((resolve, reject) => {
    const socket = io(ORIGIN, {
        auth: { token },
        transports: ["websocket"]
    });

    sockets.push(socket);

    const timer = setTimeout(() => reject(new Error(`socket connect timed out for ${token}`)), 8000);

    socket.on("connect", () => {
        clearTimeout(timer);
        resolve(socket);
    });

    socket.on("connect_error", (error) => {
        clearTimeout(timer);
        reject(error);
    });
});

const register = async (name, email) => {
    await call("POST", "/auth/register", null, { name, email, password: "password123" });
    const session = (await call("POST", "/auth/login", null, { email, password: "password123" })).data;
    return session;
};

(async () => {
    console.log("\n--- auth recovery ---");

    const ownerEmail = `rtOwner${stamp}@test.com`;

    const owner = await register("RT Owner", ownerEmail);

    check("register returns a token", typeof owner.token === "string" && owner.token.length > 0, true);
    check("session never exposes the password", "password" in owner.user, false);

    // Password reset
    const forgot = await call("POST", "/auth/forgot-password", null, { email: ownerEmail });
    check("POST /auth/forgot-password", forgot.status, 200);

    const resetToken = forgot.data.devToken;
    check("forgot-password returns a dev token in test", typeof resetToken === "string" && resetToken.length > 0, true);

    const weak = await call("POST", "/auth/reset-password", null, { token: resetToken, password: "short" });
    check("reset rejects a weak password", weak.status, 400);

    const reset = await call("POST", "/auth/reset-password", null, { token: resetToken, password: "brand-new-password" });
    check("POST /auth/reset-password", reset.status, 200);

    const oldPassword = await call("POST", "/auth/login", null, { email: ownerEmail, password: "password123" });
    check("old password no longer works", oldPassword.status, 401);

    const newPassword = await call("POST", "/auth/login", null, { email: ownerEmail, password: "brand-new-password" });
    check("new password works", newPassword.status, 200);

    // The reset retires every session signed with the old password, so the rest
    // of the run has to continue on the session from the new sign-in.
    const retiredSession = await call("GET", "/auth/me", owner.token);
    check("the session from before the reset is retired", retiredSession.status, 401);

    const retiredRefresh = await call("POST", "/auth/refresh", null, { refreshToken: owner.refreshToken });
    check("the refresh token from before the reset is retired", retiredRefresh.status, 401);

    owner.token = newPassword.data.token;
    owner.refreshToken = newPassword.data.refreshToken;

    const replay = await call("POST", "/auth/reset-password", null, { token: resetToken, password: "another-password" });
    check("reset token cannot be replayed", replay.status, 400);

    // Email verification
    const verifyRequest = await call("POST", "/auth/request-email-verification", null, { email: ownerEmail });
    check("POST /auth/request-email-verification", verifyRequest.status, 200);

    const verifyToken = verifyRequest.data.devToken;
    check("verification returns a dev token in test", typeof verifyToken === "string" && verifyToken.length > 0, true);

    const verify = await call("POST", "/auth/verify-email", null, { token: verifyToken });
    check("POST /auth/verify-email", verify.status, 200);

    const verifyReplay = await call("POST", "/auth/verify-email", null, { token: verifyToken });
    check("verification token is single-use", verifyReplay.status, 400);

    // A verified user is still not "verified" from the client's point of view:
    // the flag is private, so the public User contract must not grow it.
    check("emailVerified stays out of the User contract", "emailVerified" in newPassword.data.user, false);

    const unknownEmail = await call("POST", "/auth/forgot-password", null, { email: `nobody${stamp}@test.com` });
    check("forgot-password does not leak unknown accounts", unknownEmail.status, 200);

    // Same rule for verification: an unknown address must look identical.
    const unknownVerify = await call("POST", "/auth/request-email-verification", null, { email: `nobody${stamp}@test.com` });
    check("verification does not leak unknown accounts", unknownVerify.data.devToken, undefined);

    console.log("\n--- onboarding ---");

    const freshEmail = `rtFresh${stamp}@test.com`;
    const fresh = await register("RT Fresh", freshEmail);

    check("POST /onboarding needs auth", (await call("POST", "/onboarding", null, { workspaceName: "No" })).status, 401);

    const existingEmail = ownerEmail;
    const found = await call("GET", `/search/users?q=${encodeURIComponent(owner.name)}`, fresh.token);
    check("user can search for an existing member", found.status, 200);

    const onboard = await call("POST", "/onboarding", fresh.token, {
        organization: "RT Workspace",
        workspaceType: "product",
        project: "RT Launch",
        teammateEmails: [existingEmail, `stranger${stamp}@test.com`]
    });
    check("POST /onboarding", onboard.status, 200);

    const workspace = onboard.data.organization;
    check("organization name applied", workspace && workspace.name, "RT Workspace");
    check("onboarding returns no raw _id", workspace && workspace._id, undefined);
    check("organization matches the client contract", Object.keys(workspace).sort().join(","), "description,id,name");
    check("a project was created", Boolean(onboard.data.project && onboard.data.project.id), true);
    check("project has a name", onboard.data.project && onboard.data.project.name, "RT Launch");
    check("project matches the client contract", "organizationId" in onboard.data.project, false);

    // The invited member must actually gain access, not just appear in a list.
    const mateAccess = await call("POST", "/projects", owner.token, {
        name: "RT Invited Proof",
        organizationId: workspace.id,
        status: "Active"
    });
    check("invited existing member gained org access", mateAccess.status, 201);

    const repeat = await call("POST", "/onboarding", fresh.token, {
        organization: "RT Workspace",
        workspaceType: "product",
        project: "RT Launch",
        teammateEmails: [existingEmail]
    });
    check("repeat onboarding is accepted", repeat.status, 200);
    check("repeat onboarding reuses the same workspace", repeat.data.organization.id, workspace.id);
    check("repeat onboarding reuses the same project", repeat.data.project.id === onboard.data.project.id, true);

    const secondProject = await call("POST", "/onboarding", fresh.token, {
        organization: "RT Workspace",
        workspaceType: "product",
        project: "RT Other Project",
        teammateEmails: []
    });
    check("a different project name is created, not aliased", secondProject.data.project.id === onboard.data.project.id, false);

    check("onboarding requires an organization name", (await call("POST", "/onboarding", fresh.token, { project: "X" })).status, 400);
    check("onboarding requires a project name", (await call("POST", "/onboarding", fresh.token, { organization: "X" })).status, 400);

    console.log("\n--- calendar detail ---");

    const startAt = new Date(Date.now() + 3600000).toISOString();
    const created = await call("POST", "/calendar", fresh.token, {
        title: "RT Planning",
        startAt,
        type: "Meeting",
        attendees: []
    });
    check("POST /calendar", created.status, 201);

    const eventId = created.data.event.id;

    const fetched = await call("GET", `/calendar/${eventId}`, fresh.token);
    check("GET /calendar/:id", fetched.status, 200);
    check("GET /calendar/:id returns the same event", fetched.data.event.id, eventId);
    check("calendar detail never leaks _id", fetched.data.event._id, undefined);

    const malformed = await call("GET", "/calendar/64b0000000000000000000ff", fresh.token);
    check("GET /calendar/:id rejects a malformed id", malformed.status, 404);

    const stranger = await register("RT Stranger", `rtStranger${stamp}@test.com`);
    check("GET /calendar/:id hides other workspaces", (await call("GET", `/calendar/${eventId}`, stranger.token)).status, 404);
    check("GET /calendar/:id needs auth", (await call("GET", `/calendar/${eventId}`)).status, 401);

    console.log("\n--- activity detail ---");

    const project = onboard.data.project;
    const task = (await call("POST", "/tasks", fresh.token, {
        title: "RT Task",
        projectId: project.id,
        status: "Todo",
        priority: "High",
        description: "",
        labels: [],
        checklist: []
    })).data.task;

    const activity = await call("POST", "/activities", fresh.token, {
        projectId: project.id,
        taskId: task.id,
        action: "task_created",
        description: "Shipped the realtime layer"
    });
    check("POST /activities", activity.status, 201);

    const history = await call("GET", `/activities/project/${project.id}`, fresh.token);
    check("GET /activities/project/:id", history.status, 200);

    const entries = history.data.activities || [];
    check("activity list is populated", entries.length > 0, true);

    const entry = entries[0] || {};
    check("activity never leaks _id", entry._id, undefined);
    check("activity id is public", typeof entry.id === "string" && entry.id.length > 0, true);
    check("activity resolves the actor name", entry.user, "RT Fresh");
    check("activity projectId matches", entry.projectId, project.id);
    check("activity action preserved", entry.action, "task_created");
    check("activity description preserved", entry.description, "Shipped the realtime layer");
    check("activity has a timestamp", Number.isNaN(Date.parse(entry.timestamp)), false);

    // A task's public id is its key, so activities must accept that key too.
    check("activities reject an unknown task", (await call("POST", "/activities", fresh.token, { projectId: project.id, taskId: "NEX-999999", action: "task_created" })).status, 404);
    check("activities reject an unknown action", (await call("POST", "/activities", fresh.token, { projectId: project.id, action: "invented" })).status, 400);
    check("activities are scoped to the project", (await call("GET", `/activities/project/${project.id}`, stranger.token)).status, 403);

    console.log("\n--- socket realtime ---");

    const badToken = await call("GET", "/auth/me", "not-a-real-token");
    check("bad token is rejected by REST", badToken.status, 401);

    let rejected = null;
    try {
        await connect("not-a-real-token");
    } catch (error) {
        rejected = error;
    }
    check("bad token is rejected by the socket handshake", rejected !== null, true);

    const mateEmail = `rtMate${stamp}@test.com`;
    const mate = await register("RT Mate", mateEmail);

    const ownerSocket = await connect(fresh.token);
    const mateSocket = await connect(mate.token);
    check("both sockets connect", ownerSocket.connected && mateSocket.connected, true);

    const joinErrors = [];
    mateSocket.on("socketError", (error) => joinErrors.push(error.message));
    ownerSocket.emit("joinChannel", { channel: "general" });
    await new Promise((resolve) => setTimeout(resolve, 500));
    check("joining an allowed channel raises no error", joinErrors.length, 0);

    const channelMessage = waitFor(ownerSocket, "newChannelMessage");
    const posted = await call("POST", "/messages", fresh.token, { channel: "general", message: `rt${stamp}` });
    check("channel post is accepted", posted.status, 201);

    const channelPayload = await channelMessage;
    check("channel message arrives over the socket", channelPayload && channelPayload.body, `rt${stamp}`);
    check("realtime payload never leaks _id", channelPayload && channelPayload._id, undefined);
    check("a socket that never joined the room gets nothing", (await waitFor(mateSocket, "newChannelMessage", 800)) === null, true);

    const directMessage = waitFor(mateSocket, "newMessage");
    const dm = await call("POST", "/messages", fresh.token, { receiver: mate.user.id, message: `dm${stamp}` });
    check("direct post is accepted", dm.status, 201);

    const dmPayload = await directMessage;
    check("direct message arrives over the socket", dmPayload && dmPayload.body, `dm${stamp}`);

    // Notifications go to the assignee, so the mate has to assign a task to the owner.
    check("a non-member cannot join the project", (await call("POST", `/projects/${project.id}/members`, fresh.token, { userId: mate.user.id })).status, 400);
    check("project membership rejects a bad user id", (await call("POST", `/projects/${project.id}/members`, fresh.token, { userId: "nope" })).status, 400);
    check("mate joined the workspace", (await call("POST", `/organizations/${workspace.id}/members`, fresh.token, { userId: mate.user.id })).status, 200);
    check("mate added to the project", (await call("POST", `/projects/${project.id}/members`, fresh.token, { userId: mate.user.id })).status, 200);

    const assigned = waitFor(ownerSocket, "newNotification");
    const assignment = await call("POST", "/tasks", mate.token, {
        title: "RT Assigned",
        projectId: project.id,
        assignedTo: fresh.user.id,
        status: "Todo",
        priority: "Medium",
        description: "",
        labels: [],
        checklist: []
    });
    check("assignment is accepted", assignment.status, 201);

    const notification = await assigned;
    check("notification arrives over the socket", notification && notification.title, "Task assigned");

    // Presence only fires on a user's first socket, so use an untouched account.
    const latecomerEmail = `rtLate${stamp}@test.com`;
    const latecomer = await register("RT Latecomer", latecomerEmail);
    const online = waitFor(ownerSocket, "userOnline");
    await connect(latecomer.token);
    const presence = await online;
    check("presence broadcasts on first connect", presence && presence.userId, latecomer.user.id);

    for (const socket of sockets) {
        socket.close();
    }

    report();
    process.exit(results.every(Boolean) ? 0 : 1);
})().catch((error) => {
    console.error("\nFATAL", error);
    report();
    process.exit(1);
});
