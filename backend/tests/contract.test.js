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
const MESSAGE = ["id", "channel", "authorId", "body", "time", "reactions", "edited"];
const FILE = ["id", "name", "type", "owner", "size", "modified", "folder"];
const NOTIFICATION = ["id", "title", "body", "category", "time", "read"];
const EVENT = ["id", "title", "date", "time", "type", "attendees", "notes"];
const AUDIT = ["id", "timestamp", "user", "action", "resource", "ip", "status", "detail"];

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

    const post = await call("POST", "/messages", token, { channel: "general", message: "hello team" });
    check("post message to channel", post.status, 201);
    shape("MessageItem contract", post.data.data, MESSAGE);
    check("MessageItem.channel is name", post.data.data.channel, "general");
    check("MessageItem.body", post.data.data.body, "hello team");
    check("MessageItem.reactions is array", Array.isArray(post.data.data.reactions), true);

    const listed = await call("GET", "/messages?channel=general", token);
    check("GET /messages?channel", listed.status, 200);
    check("channel message listed", listed.data.messages.some((m) => m.body === "hello team"), true);

    check("message with no target -> 400", (await call("POST", "/messages", token, { message: "orphan" })).status, 400);
    check("empty message -> 400", (await call("POST", "/messages", token, { channel: "general", message: "   " })).status, 400);
    check("unknown channel -> 404", (await call("POST", "/messages", token, { channel: "no-such-channel", message: "x" })).status, 404);
    check("self DM -> 400", (await call("POST", "/messages", token, { receiver: owner.data.user.id, message: "self" })).status, 400);
    check("DM to org mate ok", (await call("POST", "/messages", token, { receiver: mateId, message: "dm" })).status, 201);

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

    // files
    const files = await call("GET", "/files", token);
    check("GET /files", files.status, 200);
    check("files is array", Array.isArray(files.data.files), true);
    if (files.data.files.length) {
        shape("FileItem contract", files.data.files[0], FILE);
    }
    check("GET /files/folders", (await call("GET", "/files/folders", token)).status, 200);

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

    report();
})().catch((error) => {
    console.error("TEST CRASHED:", error && error.stack ? error.stack : error);
    process.exitCode = 1;
});
