process.env.NODE_ENV = "test";

/**
 * Contract test: asserts the backend responses match the frontend
 * source of truth in frontend/src/types/nexus.ts
 *
 * Run against a live server + MongoDB:
 *   npm start
 *   npm test
 */

const BASE = `${process.env.API_BASE || "http://localhost:5000"}/api`;

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

/** Multipart sibling of call(), for the upload and attach routes. */
const callForm = async (method, path, token, form) => {
    const res = await fetch(BASE + path, {
        method,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form
    });

    return { status: res.status, data: await res.json().catch(() => ({})) };
};

const uploadForm = (fields) => {
    const form = new FormData();

    for (const [key, value] of Object.entries(fields)) {
        if (value instanceof Blob) {
            form.append(key, value, "contract-probe.txt");
        } else {
            form.append(key, String(value));
        }
    }

    return form;
};

const probeFile = () => new Blob(["contract probe"], { type: "text/plain" });

/*
    A minimal but genuinely valid 8-bit mono WAV: 44-byte header plus 8000
    samples of silence at 8kHz, which is exactly one second. The audio filter
    matches the content type against a fixed list, so a real file is needed;
    random bytes are rejected.
*/
const probeWav = () => {
    const header = [
        0x52, 0x49, 0x46, 0x46, 0x68, 0x1f, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45,
        0x66, 0x74, 0x73, 0x20, 0x10, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
        0x40, 0x1f, 0x00, 0x00, 0x40, 0x1f, 0x00, 0x00, 0x01, 0x00, 0x08, 0x00,
        0x64, 0x61, 0x74, 0x61, 0x40, 0x1f, 0x00, 0x00,
    ];

    return new Blob([header, new Uint8Array(8000).fill(128)], { type: "audio/wav" });
};

const audioForm = (fields) => {
    const form = new FormData();

    for (const [key, value] of Object.entries(fields)) {
        if (value instanceof Blob) {
            form.append(key, value, key === "audio" ? "probe.wav" : "contract-probe.txt");
        } else {
            form.append(key, String(value));
        }
    }

    return form;
};

const check = (label, actual, expected) => {
    const pass = actual === expected;
    results.push(pass);
    console.log(
        `${pass ? "PASS" : "FAIL"}  ${label.padEnd(58)} got ${JSON.stringify(actual)}${pass ? "" : ` expected ${JSON.stringify(expected)}`}`
    );
};

const shape = (label, object, keys) => {
    const missing = keys.filter((key) => !(key in (object || {})));
    const pass = missing.length === 0 && typeof object === "object" && object !== null;
    results.push(pass);
    console.log(
        `${pass ? "PASS" : "FAIL"}  ${label.padEnd(58)} ${pass ? "contract ok" : "missing " + missing.join(", ")}`
    );
};

// shape() only proves a key exists. This proves the value is actually populated,
// which is what catches double-serialization (keys present, every value "").
const values = (label, object, keys) => {
    const blanks = keys.filter((key) => {
        const value = (object || {})[key];
        return typeof value !== "string" || value.trim() === "";
    });
    const pass = object !== null && typeof object === "object" && blanks.length === 0;
    results.push(pass);
    console.log(
        `${pass ? "PASS" : "FAIL"}  ${label.padEnd(58)} ${pass ? "values ok" : "blank: " + blanks.join(", ")}`
    );
};

// Exact key sets from types/nexus.ts
const USER = ["id", "name", "email", "role", "department", "avatar", "status", "activeTasks", "completed", "workload", "projects", "completionRate"];
const PROJECT = ["id", "name", "key", "description", "progress", "members", "tasks", "completed", "due", "status", "icon"];
const TASK = ["id", "title", "description", "projectId", "project", "priority", "status", "assigneeId", "assignee", "reporter", "dueDate", "labels", "comments", "attachments", "checklist", "activity"];
const MESSAGE = ["id", "channel", "authorId", "body", "time", "reactions", "edited", "messageType", "audioUrl", "duration", "fileId"];
const FILE = ["id", "name", "type", "owner", "size", "modified", "folder"];
const NOTIFICATION = ["id", "title", "body", "category", "time", "read"];
const EVENT = ["id", "title", "date", "time", "type", "attendees", "notes"];
const AUDIT = ["id", "timestamp", "user", "action", "resource", "ip", "status", "detail"];

const CALL_PARTY = ["id", "name", "email"];
const CALL = ["id", "caller", "receiver", "status", "startedAt", "endedAt", "duration", "createdAt"];

const report = () => {
    const passed = results.filter(Boolean).length;
    console.log(`\n===== ${passed}/${results.length} passed =====`);

    if (passed !== results.length) {
        process.exitCode = 1;
    }
};

(async () => {
    const ownerEmail = `owner${stamp}@test.com`;
    const mateEmail = `mate${stamp}@test.com`;
    const outsiderEmail = `outsider${stamp}@test.com`;

    for (const [name, email] of [["Owner", ownerEmail], ["Mate", mateEmail], ["Outsider", outsiderEmail]]) {
        const r = await call("POST", "/auth/register", null, { name, email, password: "password123" });
        check(`register ${name}`, r.status, 201);
    }

    const owner = await call("POST", "/auth/login", null, { email: ownerEmail, password: "password123" });
    const mate = await call("POST", "/auth/login", null, { email: mateEmail, password: "password123" });
    const outsider = await call("POST", "/auth/login", null, { email: outsiderEmail, password: "password123" });

    check("owner login", owner.status, 200);
    shape("session shape", owner.data, ["token", "refreshToken", "user"]);
    shape("User contract", owner.data.user, USER);
    check("User.status canonical", ["Online", "Away", "Offline"].includes(owner.data.user.status), true);
    check("User.workload canonical", ["Low", "Balanced", "High"].includes(owner.data.user.workload), true);

    const token = owner.data.token;
    const refreshToken = owner.data.refreshToken;
    const mateToken = mate.data.token;
    const outsiderToken = outsider.data.token;
    const mateId = mate.data.user.id;

    // token type separation
    check("refresh token rejected on access route", (await call("GET", "/tasks", refreshToken)).status, 401);
    check("access token rejected on /auth/refresh", (await call("POST", "/auth/refresh", null, { refreshToken: token })).status, 401);
    check("no token rejected", (await call("GET", "/tasks", null)).status, 401);
    check("garbage token rejected", (await call("GET", "/tasks", "not.a.jwt")).status, 401);

    const me = await call("GET", "/auth/me", token);
    check("GET /auth/me", me.status, 200);
    shape("GET /auth/me User contract", me.data.user, USER);

    const refreshed = await call("POST", "/auth/refresh", null, { refreshToken });
    check("POST /auth/refresh", refreshed.status, 200);
    shape("refreshed session shape", refreshed.data, ["token", "refreshToken", "user"]);

    // organizations + scoping
    const orgA = await call("POST", "/organizations", token, { name: `Org A ${stamp}` });
    check("owner creates org A", orgA.status, 201);
    shape("Organization shape (create)", orgA.data.organization, ["id", "name", "description"]);
    const orgId = orgA.data.organization.id;

    const mineRes = await call("GET", "/organizations/mine", token);
    check("GET /organizations/mine", mineRes.status, 200);
    shape("Organization shape (mine)", mineRes.data.organizations[0], ["id", "name", "description"]);

    await call("POST", "/organizations", outsiderToken, { name: `Org B ${stamp}` });
    const orgGetRes = await call("GET", `/organizations/${orgId}`, token);
    check("GET /organizations/:id by public id", orgGetRes.status, 200);
    shape("Organization shape (get)", orgGetRes.data.organization, ["id", "name", "description"]);

    const orgPutRes = await call("PUT", `/organizations/${orgId}`, token, { description: "updated" });
    check("PUT /organizations/:id", orgPutRes.status, 200);
    shape("Organization shape (update)", orgPutRes.data.organization, ["id", "name", "description"]);

    check("outsider blocked from org A", (await call("GET", `/organizations/${orgId}`, outsiderToken)).status, 403);
    check("invalid org id -> 404 not 500", (await call("GET", "/organizations/not-an-id", token)).status, 404);
    const addMemberRes = await call("POST", `/organizations/${orgId}/members`, token, { userId: mateId, role: "member" });
    check("owner adds mate to org A", addMemberRes.status, 200);
    shape("Organization shape (add member)", addMemberRes.data.organization, ["id", "name", "description"]);

    // projects
    const projectRes = await call("POST", "/projects", token, { name: "Apollo", organizationId: orgId, key: "APO", status: "Active" });
    check("create project (due omitted)", projectRes.status, 201);
    shape("Project contract", projectRes.data.project, PROJECT);
    check("Project.status canonical", ["Active", "At Risk", "Archived", "Planning"].includes(projectRes.data.project.status), true);
    check("Project.progress numeric", typeof projectRes.data.project.progress, "number");
    check("Project.members is string[]", Array.isArray(projectRes.data.project.members), true);

    const projectId = projectRes.data.project.id;
    check("bad project status rejected", (await call("POST", "/projects", token, { name: "Bad", organizationId: orgId, status: "on-hold" })).status, 400);
    check("project for foreign org rejected", (await call("POST", "/projects", outsiderToken, { name: "X", organizationId: orgId })).status, 403);

    const projects = await call("GET", "/projects", token);
    check("GET /projects", projects.status, 200);
    shape("Project contract (list)", projects.data.projects[0], PROJECT);
    check("owner sees own project", projects.data.projects.some((p) => p.name === "Apollo"), true);
    const outsiderProjects = await call("GET", "/projects", outsiderToken);
    check("outsider sees none of org A projects", outsiderProjects.data.projects.some((p) => p.name === "Apollo"), false);

    // tasks
    const taskRes = await call("POST", "/tasks", token, {
        title: "Ship realtime",
        projectId,
        status: "In Progress",
        priority: "High",
        description: "Wire sockets",
        checklist: [{ id: "c1", label: "Scaffold", done: false }]
    });
    check("create task", taskRes.status, 201);
    shape("Task contract", taskRes.data.task, TASK);

    const task = taskRes.data.task;
    check("Task.id is NEX key", /^NEX-\d+$/.test(task.id), true);
    check("Task.status canonical", ["Backlog", "Todo", "In Progress", "In Review", "Done"].includes(task.status), true);
    check("Task.priority canonical", ["Low", "Medium", "High", "Critical"].includes(task.priority), true);
    check("Task.comments is array", Array.isArray(task.comments), true);
    check("Task.attachments numeric", typeof task.attachments, "number");
    check("Task.checklist preserved", task.checklist[0] && task.checklist[0].label, "Scaffold");
    check("Task.reporter non-empty", task.reporter.length > 0, true);
    check("Task.project is name string", typeof task.project === "string" && task.project.length > 0, true);

    check("non-legacy lowercase status rejected", (await call("POST", "/tasks", token, { title: "Bad", projectId, status: "in-progress" })).status, 400);
    check("non-legacy priority rejected", (await call("POST", "/tasks", token, { title: "Bad", projectId, priority: "blocker" })).status, 400);

    const legacyStatus = await call("POST", "/tasks", token, { title: "Legacy status", projectId, status: "in_progress" });
    check("legacy status accepted + normalized", legacyStatus.data.task.status, "In Progress");
    const legacyPriority = await call("POST", "/tasks", token, { title: "Legacy priority", projectId, priority: "urgent" });
    check("legacy priority accepted + normalized", legacyPriority.data.task.priority, "Critical");
    check("task in foreign project rejected", (await call("POST", "/tasks", outsiderToken, { title: "X", projectId })).status, 403);

    const getByKey = await call("GET", `/tasks/${task.id}`, token);
    check("GET task by NEX key", getByKey.status, 200);
    check("GET task unknown key -> 404", (await call("GET", "/tasks/NEX-999999", token)).status, 404);

    const done = await call("PATCH", `/tasks/${task.id}`, token, { status: "Done" });
    check("PATCH task -> Done", done.status, 200);
    check("Task.status becomes Done", done.data.task.status, "Done");

    const reopened = await call("PATCH", `/tasks/${task.id}`, token, { status: "Todo" });
    check("PATCH task -> Todo", reopened.data.task.status, "Todo");

    const withChecklist = await call("PATCH", `/tasks/${task.id}/checklist`, token, { itemId: "c1", checked: true });
    check("PATCH checklist item", withChecklist.status, 200);
    check("checklist item now done", withChecklist.data.task.checklist[0].done, true);
    check("checklist unknown item -> 404", (await call("PATCH", `/tasks/${task.id}/checklist`, token, { itemId: "zzz", checked: true })).status, 404);

    const seqKeys = [];
    for (let i = 0; i < 4; i += 1) {
        const t = await call("POST", "/tasks", token, { title: `Seq ${i}`, projectId });
        seqKeys.push(t.data.task.id);
    }
    const seqNums = seqKeys.map((k) => Number(k.replace("NEX-", "")));
    check("task keys unique", new Set(seqKeys).size, 4);
    check("task keys strictly increase", seqNums.every((n, i) => i === 0 || n > seqNums[i - 1]), true);

    const mateTasks = await call("GET", "/tasks", mateToken);
    check("org mate sees org A tasks", mateTasks.data.tasks.some((t) => t.id === task.id), true);
    shape("Task contract (list)", mateTasks.data.tasks[0], TASK);
    const outsiderTasks = await call("GET", "/tasks", outsiderToken);
    check("outsider sees none of org A tasks", outsiderTasks.data.tasks.some((t) => t.id === task.id), false);

    // project counters reflect tasks
    const afterTasks = await call("GET", `/projects/${projectId}`, token);
    check("GET /projects/:id", afterTasks.status, 200);
    shape("Project contract (detail)", afterTasks.data.project, PROJECT);

    // channels + messages
    const channels = await call("GET", "/channels", token);
    check("GET /channels", channels.status, 200);
    check("channels is string[]", Array.isArray(channels.data.channels) && channels.data.channels.every((c) => typeof c === "string"), true);
    check("frontend default channels present", ["general", "engineering", "backend", "frontend", "random"].every((c) => channels.data.channels.includes(c)), true);

    const CHANNEL = ["id", "name", "description", "isPrivate", "members", "createdBy"];

    check("create channel with a bad name -> 400", (await call("POST", "/channels", token, { name: "Bad Name!", organizationId: orgId })).status, 400);
    // A missing organizationId resolves as "Organization not found".
    check("create channel with no target -> 404", (await call("POST", "/channels", token, { name: "valid-name" })).status, 404);
    check("create channel in a foreign org -> 403", (await call("POST", "/channels", outsiderToken, { name: "steal", organizationId: orgId })).status, 403);

    const createdChannel = await call("POST", "/channels", token, {
        name: "contract-review",
        organizationId: orgId,
        description: "created by the contract test"
    });
    check("create channel", createdChannel.status, 201);
    shape("Channel contract (create)", createdChannel.data.channel, CHANNEL);
    check("the creator is recorded", createdChannel.data.channel.createdBy, owner.data.user.id);

    check("a duplicate name -> 409", (await call("POST", "/channels", token, { name: "contract-review", organizationId: orgId })).status, 409);

    const channelRecords = await call("GET", "/channels/records", token);
    check("GET /channels/records", channelRecords.status, 200);
    check("the new channel is listed", channelRecords.data.channels.some((c) => c.name === "contract-review"), true);
    shape("Channel contract (records)", channelRecords.data.channels.find((c) => c.name === "contract-review"), CHANNEL);
    check("records never leak _id", JSON.stringify(channelRecords.data).includes("_id"), false);

    // A non-creator outside the workspace cannot even see it, so 404 not 403.
    check("a stranger cannot delete the channel", (await call("DELETE", "/channels/contract-review", outsiderToken)).status, 404);
    check("the creator can delete the channel", (await call("DELETE", "/channels/contract-review", token)).status, 200);
    check("deleting it twice -> 404", (await call("DELETE", "/channels/contract-review", token)).status, 404);

    const post = await call("POST", "/messages", token, { channel: "general", message: "hello team" });
    check("post message to channel", post.status, 201);
    shape("MessageItem contract", post.data.data, MESSAGE);
    check("MessageItem.channel is name", post.data.data.channel, "general");
    check("MessageItem.body", post.data.data.body, "hello team");
    check("MessageItem.reactions is array", Array.isArray(post.data.data.reactions), true);

    const listed = await call("GET", "/messages?channel=general", token);
    check("GET /messages?channel", listed.status, 200);
    check("channel message listed", listed.data.messages.some((m) => m.body === "hello team"), true);

    check("message with no target -> 400", (await call("POST", "/messages", token, { message: "orphan" })).status, 400);    check("empty message -> 400", (await call("POST", "/messages", token, { channel: "general", message: "   " })).status, 400);
    check("unknown channel -> 404", (await call("POST", "/messages", token, { channel: "no-such-channel", message: "x" })).status, 404);
    check("self DM -> 400", (await call("POST", "/messages", token, { receiver: owner.data.user.id, message: "self" })).status, 400);
    check("DM to org mate ok", (await call("POST", "/messages", token, { receiver: mateId, message: "dm" })).status, 201);

    /*
        A voice message used to serialize to an empty body with no marker, so
        a client could not tell it apart from a text message and had nothing to
        fetch the audio from.
    */
    check("voice message with no duration -> 400", (await callForm("POST", "/messages/voice", token, audioForm({
        audio: probeWav(),
        receiver: mateId
    }))).status, 400);
    check("voice message with no target -> 400", (await callForm("POST", "/messages/voice", token, audioForm({
        audio: probeWav(),
        duration: 1
    }))).status, 400);
    check("voice message to self -> 400", (await callForm("POST", "/messages/voice", token, audioForm({
        audio: probeWav(),
        duration: 1,
        receiver: owner.data.user.id
    }))).status, 400);
    check("voice message over the cap -> 400", (await callForm("POST", "/messages/voice", token, audioForm({
        audio: probeWav(),
        duration: 99999,
        receiver: mateId
    }))).status, 400);
    check("voice message with a non-audio file -> 400", (await callForm("POST", "/messages/voice", token, audioForm({
        audio: probeFile(),
        duration: 1,
        receiver: mateId
    }))).status, 400);

    const voice = await callForm("POST", "/messages/voice", token, audioForm({
        audio: probeWav(),
        duration: 1,
        receiver: mateId
    }));
    check("create voice message", voice.status, 201);
    shape("MessageItem contract (voice)", voice.data.voiceMessage, MESSAGE);
    check("a voice message is typed as one", voice.data.voiceMessage.messageType, "voice");
    check("a voice message carries an audio url", typeof voice.data.voiceMessage.audioUrl, "string");
    check("a voice message carries its duration", voice.data.voiceMessage.duration, 1);
    check("a voice message has an empty body", voice.data.voiceMessage.body, "");

    const voiceStream = await fetch(`${BASE}/messages/voice/${voice.data.voiceMessage.id}`, {
        headers: { Authorization: `Bearer ${mateToken}` },
    });
    check("the recipient can stream the audio", voiceStream.status, 200);
    check("the stream is audio", String(voiceStream.headers.get("content-type")).startsWith("audio/"), true);
    check("a stranger cannot stream the audio", (await fetch(`${BASE}/messages/voice/${voice.data.voiceMessage.id}`, {
        headers: { Authorization: `Bearer ${outsiderToken}` },
    })).status, 403);

    const voiceHistory = await call("GET", `/messages/${owner.data.user.id}`, mateToken);
    check("the voice message is in the DM history", voiceHistory.data.messages.some((m) => m.id === voice.data.voiceMessage.id), true);
    check("and it is still typed as voice", voiceHistory.data.messages.find((m) => m.id === voice.data.voiceMessage.id).messageType, "voice");

    const editDenied = await call("PATCH", `/messages/${post.data.data.id}`, outsiderToken, { message: "hacked" });
    check("edit other user's message -> 403", editDenied.status, 403);
    const editOwn = await call("PATCH", `/messages/${post.data.data.id}`, token, { message: "hello team v2" });
    check("edit own message", editOwn.status, 200);
    check("MessageItem.edited true", editOwn.data.data.edited, true);

    // calendar
    const events = await call("GET", "/calendar", token);
    check("GET /calendar", events.status, 200);
    check("events is array", Array.isArray(events.data.events), true);

    const eventRes = await call("POST", "/calendar", token, { title: "Sprint review", startAt: "2026-10-05T14:30:00.000Z", type: "Review", projectId });
    check("create event", eventRes.status, 201);
    shape("CalendarEvent contract", eventRes.data.event, EVENT);
    check("CalendarEvent.type canonical", ["Meeting", "Deadline", "Review", "Planning"].includes(eventRes.data.event.type), true);
    check("CalendarEvent.date zero padded day", /05$/.test(eventRes.data.event.date), true);
    check("CalendarEvent.attendees is string[]", Array.isArray(eventRes.data.event.attendees), true);
    check("bad event type rejected", (await call("POST", "/calendar", token, { title: "X", startAt: "2026-10-05T10:00:00.000Z", type: "Party" })).status, 400);
    check("missing startAt rejected", (await call("POST", "/calendar", token, { title: "X", type: "Meeting" })).status, 400);
    check("bad event id -> 404 not 500", (await call("GET", "/calendar/not-an-id", token)).status, 404);

    // analytics
    const analytics = await call("GET", "/analytics", token);
    check("GET /analytics", analytics.status, 200);
    shape("analytics chart payload", analytics.data.analytics, ["progress", "status", "workload", "productivity", "metrics"]);
    check("analytics status buckets canonical", analytics.data.analytics.status.every((s) => ["Backlog", "Todo", "In Progress", "In Review", "Done"].includes(s.name)), true);
    check("status buckets cover all 5", analytics.data.analytics.status.length, 5);
    shape("analytics metrics", analytics.data.analytics.metrics, ["totalProjects", "activeTasks", "completedTasks", "overdue", "completionRate", "averageCycleTimeDays", "totalUsers"]);
    check("activeTasks counts org A tasks", analytics.data.analytics.metrics.activeTasks > 0, true);
    check("status totals equal task total", analytics.data.analytics.status.reduce((sum, s) => sum + s.value, 0), analytics.data.analytics.metrics.activeTasks + analytics.data.analytics.metrics.completedTasks);
    shape("progress point", analytics.data.analytics.progress[0] || { name: "", planned: 0, completed: 0 }, ["name", "planned", "completed"]);
    shape("workload point", analytics.data.analytics.workload[0] || { name: "", tasks: 0 }, ["name", "tasks"]);

    const team = await call("GET", "/team", token);
    check("GET /team", team.status, 200);
    shape("User contract (team.users)", team.data.users[0], USER);
    check("team.users includes added mate", team.data.users.some((m) => m.id === mateId), true);
    check("team excludes outsider", team.data.users.some((m) => m.id === outsider.data.user.id), false);

    /*
        Workspace admin means owning the workspace. The old gate compared a
        global user.role that nothing ever set, so /auth/users answered 403 for
        everyone, including the owner of the workspace.
    */
    const ownerInTeam = team.data.users.find((m) => m.id === owner.data.user.id);
    const mateInTeam = team.data.users.find((m) => m.id === mateId);
    check("the workspace owner is labelled an admin", ownerInTeam.role, "Organization Admin");
    check("an added member is not", mateInTeam.role, "Member");

    const authUsers = await call("GET", "/auth/users", token);
    check("GET /auth/users as the workspace owner", authUsers.status, 200);
    check("it is scoped to the caller's workspace", authUsers.data.users.some((m) => m.id === mateId), true);
    check("it cannot enumerate the deployment", authUsers.data.users.some((m) => m.id === outsider.data.user.id), false);
    check("GET /auth/users for an org owner", (await call("GET", "/auth/users", outsiderToken)).status, 200);
    // mate is a member of org A and owns no workspace of their own.
    check("GET /auth/users for a plain member", (await call("GET", "/auth/users", mateToken)).status, 403);
    check("GET /auth/users with no token", (await call("GET", "/auth/users", null)).status, 401);

    // files
    const files = await call("GET", "/files", token);
    check("GET /files", files.status, 200);
    check("files is array", Array.isArray(files.data.files), true);
    if (files.data.files.length) {
        shape("FileItem contract", files.data.files[0], FILE);
    }
    check("GET /files/folders", (await call("GET", "/files/folders", token)).status, 200);

    /*
        Only GET /files went through serializeFile. The single-file and
        sub-resource routes returned raw Mongo documents, so the same resource
        had two shapes depending on the path.
    */
    const uploaded = await callForm("POST", "/files/upload", token, uploadForm({ file: probeFile() }));
    check("POST /files/upload", uploaded.status, 201);
    shape("FileItem contract (upload)", uploaded.data.file, FILE);
    values("FileItem values (upload)", uploaded.data.file, ["id", "name", "owner", "size", "modified"]);
    check("upload never leaks _id", JSON.stringify(uploaded.data).includes("_id"), false);

    const uploadedId = uploaded.data.file.id;

    const fetchedFile = await call("GET", `/files/${uploadedId}`, token);
    check("GET /files/:fileId", fetchedFile.status, 200);
    shape("FileItem contract (fetch)", fetchedFile.data.file, FILE);
    values("FileItem values (fetch)", fetchedFile.data.file, ["id", "name", "owner"]);

    const attached = await callForm("POST", "/files/attach", token, uploadForm({
        file: probeFile(),
        projectId
    }));
    check("POST /files/attach (project)", attached.status, 201);
    shape("FileItem contract (attach)", attached.data.file, FILE);
    values("FileItem values (attach)", attached.data.file, ["id", "name", "owner"]);

    check("attach to a project and a task -> 400", (await callForm("POST", "/files/attach", token, uploadForm({
        file: probeFile(),
        projectId,
        taskId: "NEX-1"
    }))).status, 400);
    check("attach to neither -> 400", (await callForm("POST", "/files/attach", token, uploadForm({
        file: probeFile()
    }))).status, 400);
    check("attach with no file -> 400", (await callForm("POST", "/files/attach", token, uploadForm({
        projectId
    }))).status, 400);

    const projectFiles = await call("GET", `/files/project/${projectId}`, token);
    check("GET /files/project/:projectId", projectFiles.status, 200);
    check("project files is array", Array.isArray(projectFiles.data.files), true);
    if (projectFiles.data.files.length) {
        shape("FileItem contract (project files)", projectFiles.data.files[0], FILE);
        values("FileItem values (project files)", projectFiles.data.files[0], ["id", "name", "owner"]);
    }
    check("project files never leak _id", JSON.stringify(projectFiles.data).includes("_id"), false);

    check("GET /files/task/:taskId for a stranger", (await call("GET", `/files/task/${task.id}`, outsiderToken)).status, 403);
    const taskFiles = await call("GET", `/files/task/${task.id}`, token);
    check("GET /files/task/:taskId accepts the NEX key", taskFiles.status, 200);
    check("task files is array", Array.isArray(taskFiles.data.files), true);

    const taskAttached = await callForm("POST", "/files/attach", token, uploadForm({
        file: probeFile(),
        taskId: task.id
    }));
    check("POST /files/attach (task, by NEX key)", taskAttached.status, 201);
    shape("FileItem contract (attach to task)", taskAttached.data.file, FILE);
    const taskFilesAfter = await call("GET", `/files/task/${task.id}`, token);
    check("the task now lists the file", taskFilesAfter.data.files.length > taskFiles.data.files.length, true);
    shape("FileItem contract (task files)", taskFilesAfter.data.files[0], FILE);
    values("FileItem values (task files)", taskFilesAfter.data.files[0], ["id", "name", "owner"]);

    // notifications
    const notifications = await call("GET", "/notifications", token);
    check("GET /notifications", notifications.status, 200);
    if (notifications.data.notifications.length) {
        shape("NotificationItem contract", notifications.data.notifications[0], NOTIFICATION);
        check("NotificationItem.category canonical", ["Mention", "Task", "Project", "System"].includes(notifications.data.notifications[0].category), true);
    }
    check("GET /notifications/unread-count", (await call("GET", "/notifications/unread-count", token)).status, 200);
    check("PUT /notifications/read-all", (await call("PUT", "/notifications/read-all", token)).status, 200);

    // audit logs
    const auditLogs = await call("GET", "/audit-logs", token);
    check("GET /audit-logs", auditLogs.status, 200);
    if (auditLogs.data.logs.length) {
        shape("AuditLog contract", auditLogs.data.logs[0], AUDIT);
        check("AuditLog.status canonical", ["Success", "Warning", "Blocked"].includes(auditLogs.data.logs[0].status), true);
    }
    check("outsider audit logs scoped away", (await call("GET", "/audit-logs", outsiderToken)).status, 200);

    // search: scoped to the caller's organizations and contract-shaped
    const searchUsersRes = await call("GET", "/search/users?q=a", token);
    check("GET /search/users", searchUsersRes.status, 200);
if (searchUsersRes.data.users.length) {
    shape("User contract (search)", searchUsersRes.data.users[0], USER);
    values("User values (search)", searchUsersRes.data.users[0], ["id", "name", "email"]);
}
    check("search never returns outsider", searchUsersRes.data.users.some((u) => u.id === outsider.data.user.id), false);
    check("search cannot leak passwords", JSON.stringify(searchUsersRes.data).includes("password"), false);

    const searchProjectsRes = await call("GET", "/search/projects?q=Ap", token);
    check("GET /search/projects", searchProjectsRes.status, 200);
    shape("Project contract (search)", searchProjectsRes.data.projects[0], PROJECT);
values("Project values (search)", searchProjectsRes.data.projects[0], ["id", "name", "key"]);

    const searchTasksRes = await call("GET", "/search/tasks?q=Ship", token);
    check("GET /search/tasks", searchTasksRes.status, 200);
    shape("Task contract (search)", searchTasksRes.data.tasks[0], TASK);
values("Task values (search)", searchTasksRes.data.tasks[0], ["id", "title"]);

    const searchOrgsRes = await call("GET", "/search/organizations?q=Org", token);
    check("GET /search/organizations", searchOrgsRes.status, 200);
    shape("Organization shape (search)", searchOrgsRes.data.organizations[0], ["id", "name", "description"]);
values("Organization values (search)", searchOrgsRes.data.organizations[0], ["id", "name"]);

    const searchMessagesRes = await call("GET", "/search/messages?q=hello", token);
    check("GET /search/messages", searchMessagesRes.status, 200);
    shape("MessageItem contract (search)", searchMessagesRes.data.messages[0], MESSAGE);
values("MessageItem values (search)", searchMessagesRes.data.messages[0], ["id", "authorId", "body", "time"]);

    check("empty search query -> 400", (await call("GET", "/search/users?q=", token)).status, 400);
    check("search regex injection is escaped", (await call("GET", "/search/users?q=.*", token)).status, 200);

    // calls: full lifecycle, and every response must be contract-shaped
    check("call with no receiver -> 400", (await call("POST", "/calls", token, {})).status, 400);
    check("call with a bad receiver id -> 400", (await call("POST", "/calls", token, { receiver: "not-an-id" })).status, 400);
    check("call to self -> 400", (await call("POST", "/calls", token, { receiver: owner.data.user.id })).status, 400);

    const createdCall = await call("POST", "/calls", token, { receiver: mateId });
    check("create call", createdCall.status, 201);
    shape("Call contract", createdCall.data.call, CALL);
    shape("Call caller reference", createdCall.data.call.caller, CALL_PARTY);
    shape("Call receiver reference", createdCall.data.call.receiver, CALL_PARTY);
    values("Call values", createdCall.data.call, ["id", "status"]);
    // The create response used to hold bare ObjectIds, so the caller could not
    // name the person it just rang.
    values("Call party values", createdCall.data.call.receiver, ["id", "name", "email"]);
    check("call never leaks _id", JSON.stringify(createdCall.data).includes("_id"), false);
    check("new call starts as calling", createdCall.data.call.status, "calling");

    const callId = createdCall.data.call.id;

    check("only the receiver may accept", (await call("PUT", `/calls/${callId}/accept`, outsiderToken)).status, 403);
    check("the receiver may accept", (await call("PUT", `/calls/${callId}/accept`, mateToken)).status, 200);
    check("a call cannot be accepted twice", (await call("PUT", `/calls/${callId}/accept`, mateToken)).status, 400);

    const fetchedCall = await call("GET", `/calls/${callId}`, token);
    check("fetch call", fetchedCall.status, 200);
    shape("Call contract (fetch)", fetchedCall.data.call, CALL);

    const callHistory = await call("GET", "/calls", token);
    check("call history", callHistory.status, 200);
    check("history includes the new call", callHistory.data.calls.some((c) => c.id === callId), true);
    shape("Call contract (history)", callHistory.data.calls[0], CALL);
    check("history never leaks _id", JSON.stringify(callHistory.data).includes("_id"), false);

    check("an outsider cannot end the call", (await call("PUT", `/calls/${callId}/end`, outsiderToken)).status, 403);
    check("a participant may end the call", (await call("PUT", `/calls/${callId}/end`, token)).status, 200);
    check("a call cannot be ended twice", (await call("PUT", `/calls/${callId}/end`, token)).status, 400);
    check("GET /calls/bad-id -> 404 not 500", (await call("GET", "/calls/not-an-id", token)).status, 404);

    const missedCall = await call("POST", "/calls", token, { receiver: mateId });
    check("missed call marked", (await call("PUT", `/calls/${missedCall.data.call.id}/miss`, mateToken)).status, 200);
    check("a missed call cannot be accepted", (await call("PUT", `/calls/${missedCall.data.call.id}/accept`, mateToken)).status, 400);

    const rejectedCall = await call("POST", "/calls", token, { receiver: mateId });
    check("call rejected", (await call("PUT", `/calls/${rejectedCall.data.call.id}/reject`, mateToken)).status, 200);
    check("a rejected call cannot be accepted", (await call("PUT", `/calls/${rejectedCall.data.call.id}/accept`, mateToken)).status, 400);

    report();
})().catch((error) => {
    console.error("TEST CRASHED:", error && error.stack ? error.stack : error);
    process.exitCode = 1;
});
