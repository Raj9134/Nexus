const path = require("path");

const backend = path.resolve(__dirname, "..");
const mongoose = require(path.join(backend, "node_modules", "mongoose"));

const User = require(path.join(backend, "src", "models", "User"));
const Organization = require(path.join(backend, "src", "models", "Organization"));
const Project = require(path.join(backend, "src", "models", "Project"));
const Task = require(path.join(backend, "src", "models", "Task"));

const { computeAnalytics } = require(path.join(backend, "src", "services", "workspaceService"));

/**
 * The analytics date-range filter, with dates the test controls.
 *
 * This cannot be proven through HTTP. Every task a request creates has
 * createdAt of "now", so "in range" is always true by creation and no range
 * ever narrows anything: the contract suite can only assert that a range never
 * reports *more* than no range, which is a weaker property. Worse, the
 * Analytics page's range dropdown was wired to `() => undefined` in the first
 * place, so "the numbers do not change" is exactly the failure this guards.
 *
 * So the tasks are inserted directly with backdated timestamps and
 * computeAnalytics is called in process.
 */

const URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/NEXUS";

const results = [];

const check = (label, actual, expected) => {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  results.push(pass);
  console.log(
    `${pass ? "PASS" : "FAIL"}  ${label.padEnd(64)} got ${JSON.stringify(actual)}${pass ? "" : ` expected ${JSON.stringify(expected)}`}`,
  );
};

const daysAgo = (count) => new Date(Date.now() - count * 86400000);
const daysAhead = (count) => new Date(Date.now() + count * 86400000);

(async () => {
  await mongoose.connect(URI);

  const stamp = Date.now();
  const suffix = `range${stamp}@nexus.test`;

  const owner = await User.create({
    name: "Range Owner",
    email: suffix,
    password: "Range@2026",
  });

  const org = await Organization.create({
    name: `Range Org ${stamp}`,
    createdBy: owner._id,
    members: [owner._id],
  });

  const project = await Project.create({
    name: `Range Project ${stamp}`,
    createdBy: owner._id,
    organization: org._id,
    members: [owner._id],
    status: "Active",
  });

  // A task inside a 7 day window by every measure.
  const recent = await Task.create({
    key: `NEX-R${stamp % 1000}`,
    title: "Due in three days",
    project: project._id,
    createdBy: owner._id,
    assignedTo: owner._id,
    status: "Todo",
    priority: "High",
    dueDate: daysAhead(3),
  });

  // Created inside the window but due long ago: an overdue item, which should
  // not vanish from a "7 days" view of near-term delivery.
  const overdueButNew = await Task.create({
    key: `NEX-S${stamp % 1000}`,
    title: "Overdue but created recently",
    project: project._id,
    createdBy: owner._id,
    assignedTo: owner._id,
    status: "Todo",
    priority: "High",
    dueDate: daysAgo(120),
  });

  // Created 60 days ago: outside a 7 day window, inside a 90 day one. That is
  // the only shape where the two windows legitimately differ.
  const ancient = await Task.create({
    key: `NEX-T${stamp % 1000}`,
    title: "Ancient",
    project: project._id,
    createdBy: owner._id,
    assignedTo: owner._id,
    status: "Todo",
    priority: "Low",
    dueDate: daysAgo(55),
  });

  /*
    Mongoose sets createdAt on insert and overwrites whatever the document
    carried, so every task above would be "now" and every range would match.
    The { timestamps: false } option on updateOne is ignored for createdAt in
    this version, so the write goes through the raw collection, which bypasses
    both the timestamp hook and the path immutability.

    One clock reading, so the write and the assertion cannot disagree by a few
    milliseconds of test runtime.
  */
  const written = {
    recent: daysAgo(2),
    overdueButNew: daysAgo(1),
    ancient: daysAgo(60),
  };

  const raw = mongoose.connection.collection("tasks");

  await raw.updateOne({ _id: recent._id }, { $set: { createdAt: written.recent } });
  await raw.updateOne({ _id: overdueButNew._id }, { $set: { createdAt: written.overdueButNew } });
  await raw.updateOne({ _id: ancient._id }, { $set: { createdAt: written.ancient } });

  // Read back, so a silently ignored write cannot make every range match.
  const stored = await Task.find({ _id: { $in: [recent._id, overdueButNew._id, ancient._id] } })
    .select("title createdAt dueDate")
    .lean();

  for (const doc of stored) {
    console.log(`      stored: ${doc.title} createdAt=${doc.createdAt.toISOString()}`);
  }

  check(
    "the backdated write actually landed",
    stored.find((doc) => doc.title === "Ancient")?.createdAt?.toISOString(),
    written.ancient.toISOString(),
  );

  const user = await User.findById(owner._id);

  const all = await computeAnalytics(user);
  const week = await computeAnalytics(user, { range: "7 days" });
  const quarter = await computeAnalytics(user, { range: "90 days" });

  const ids = (analytics) => analytics.workload.map((row) => row.name);

  check("no range counts every task", all.metrics.activeTasks, 3);
  check("a 7 day window drops the ancient task", week.metrics.activeTasks, 2);
  check("a 90 day window keeps the ancient task", quarter.metrics.activeTasks, 3);
  check("no range is never smaller than a range", all.metrics.activeTasks >= week.metrics.activeTasks, true);

  // The status donut and the metric row are computed from the same filtered set,
  // so a narrowed range must not leave the two disagreeing.
  const donutTotal = (analytics) =>
    analytics.status.reduce((sum, row) => sum + row.value, 0);

  check("7 day status total matches its metrics", donutTotal(week), week.metrics.activeTasks + week.metrics.completedTasks);
  check("90 day status total matches its metrics", donutTotal(quarter), quarter.metrics.activeTasks + quarter.metrics.completedTasks);

  // Progress buckets are due-date driven, so the ancient task is not "planned"
  // in this week's line either.
  const weekPlanned = week.progress.reduce((sum, row) => sum + row.planned, 0);
  const quarterPlanned = quarter.progress.reduce((sum, row) => sum + row.planned, 0);

  check("a 7 day window plans no more than a 90 day one", weekPlanned <= quarterPlanned, true);

  // Overdue is a due-date fact, so a 90 day window must not hide a miss just
  // because the task itself is older than the window.
  check("the recent overdue task is still counted overdue at 90 days", quarter.metrics.overdue >= 1, true);
  check("a narrowed window can still report an overdue task", week.metrics.overdue >= 1, true);

  const other = await User.create({
    name: "Range Stranger",
    email: `stranger${stamp}@nexus.test`,
    password: "Range@2026",
  });
  const stranger = await User.findById(other._id);

  const strangerView = await computeAnalytics(stranger);
  check("a stranger sees nothing from this project", strangerView.metrics.activeTasks, 0);
  check("a stranger still gets the full status shape", strangerView.status.length, 5);
  check("a stranger still gets zeroed metrics", strangerView.metrics.totalProjects, 0);

  const scoped = await computeAnalytics(user, { projectId: String(project._id) });
  check("a project filter narrows to that project", scoped.metrics.totalProjects, 1);

  const foreign = await computeAnalytics(stranger, { projectId: String(project._id) });
  check("a project filter cannot reach a foreign project", foreign.metrics.activeTasks, 0);

  const assigned = await computeAnalytics(user, { assigneeId: String(other._id) });
  check("an assignee with no tasks yields nothing", assigned.metrics.activeTasks, 0);

  check("an unknown range is treated as no range", (await computeAnalytics(user, { range: "last fortnight" })).metrics.activeTasks, 3);

  await Promise.all([
    Task.deleteMany({ project: project._id }),
    Project.deleteOne({ _id: project._id }),
    Organization.deleteOne({ _id: org._id }),
    User.deleteOne({ _id: owner._id }),
    User.deleteOne({ _id: other._id }),
  ]);

  await mongoose.disconnect();

  const passed = results.filter(Boolean).length;
  console.log(`\n===== ${passed}/${results.length} passed =====`);

  if (passed !== results.length) {
    process.exitCode = 1;
  }
})().catch((error) => {
  console.error("TEST CRASHED:", error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
