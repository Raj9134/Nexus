const Organization = require("../models/Organization");
const Project = require("../models/Project");
const Task = require("../models/Task");
const User = require("../models/User");
const Message = require("../models/Message");
const File = require("../models/File");
const Comment = require("../models/Comment");
const Channel = require("../models/Channel");
const CalendarEvent = require("../models/CalendarEvent");
const Notification = require("../models/Notification");
const AuditLog = require("../models/AuditLog");

const {
    serializeUser,
    serializeProject,
    serializeTask,
    serializeComment,
    serializeMessage,
    serializeFile,
    serializeEvent,
    serializeNotification,
    serializeChannel,
    serializeAuditLog,
    idOf,
    firstName
} = require("../utils/serialize");

const {
    TASK_STATUSES,
    normalizeTaskStatus,
    DEFAULT_CHANNELS
} = require("../constants/nexus");

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MESSAGE_LIMIT = 200;
const AUDIT_LIMIT = 100;
const FILE_LIMIT = 200;
const TASK_LIMIT = 500;

const startOfDay = (value) => {
    const date = new Date(value);

    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const addDays = (value, count) => {
    const date = new Date(value.getTime());
    date.setDate(date.getDate() + count);

    return date;
};

const startOfWeek = (value) => {
    const day = startOfDay(value);
    const offset = (day.getDay() + 6) % 7;

    return addDays(day, -offset);
};

const uniqueIds = (values) => {
    const seen = new Set();

    return values.filter((value) => {
        const key = idOf(value);

        if (!key || seen.has(key)) {
            return false;
        }

        seen.add(key);

        return true;
    });
};

const accessibleOrganizationIds = async (user) => {
    const organizations = await Organization.find({
        $or: [
            { members: user._id },
            { createdBy: user._id }
        ]
    }).select("_id");

    return organizations.map((organization) => organization._id);
};

const accessibleProjectIds = async (user) => {
    const organizationIds = await accessibleOrganizationIds(user);

    const projects = await Project.find({
        $or: [
            { members: user._id },
            { createdBy: user._id },
            { organization: { $in: organizationIds } }
        ]
    }).select("_id");

    return projects.map((project) => project._id);
};

const listUsers = async (user) => {
    const organizationIds = await accessibleOrganizationIds(user);

    if (!organizationIds.length) {
        const alone = await User.find({ _id: user._id });
        return alone.map((entry) => serializeUser(entry));
    }

    const organizations = await Organization.find({
        _id: { $in: organizationIds }
    }).select("members createdBy");

    const memberIds = [];

    for (const organization of organizations) {
        memberIds.push(...(organization.members || []), organization.createdBy);
    }

    const userIds = uniqueIds(memberIds.length ? memberIds : [user._id]);

    if (!userIds.length) {
        return [];
    }

    const users = await User.find({ _id: { $in: userIds } }).sort({ name: 1 });

    const taskStats = await Task.aggregate([
        { $match: { assignedTo: { $in: userIds } } },
        {
            $group: {
                _id: "$assignedTo",
                active: {
                    $sum: {
                        $cond: [{ $eq: ["$status", "Done"] }, 0, 1]
                    }
                },
                completed: {
                    $sum: {
                        $cond: [{ $eq: ["$status", "Done"] }, 1, 0]
                    }
                }
            }
        }
    ]);

    const projectStats = await Project.aggregate([
        { $match: { members: { $in: userIds } } },
        { $unwind: "$members" },
        { $group: { _id: "$members", projects: { $sum: 1 } } }
    ]);

    const statsByUser = new Map();

    for (const entry of taskStats) {
        statsByUser.set(idOf(entry._id), {
            activeTasks: entry.active,
            completed: entry.completed
        });
    }

    for (const entry of projectStats) {
        const current = statsByUser.get(idOf(entry._id)) || { activeTasks: 0, completed: 0 };
        current.projects = entry.projects;
        statsByUser.set(idOf(entry._id), current);
    }

    /*
        Owning a workspace is what makes someone an admin here, so the label
        has to come from the same place the permission checks read.
    */
    const ownerIds = new Set(organizations.map((organization) => idOf(organization.createdBy)));

    return users.map((entry) => {
        const userId = idOf(entry);
        const stats = statsByUser.get(userId) || {};

        if (ownerIds.has(userId)) {
            stats.role = "Organization Admin";
        }

        return serializeUser(entry, stats);
    });
};

/*
    Owning a workspace is what makes someone an admin, so the label has to come
    from the same place the permission checks read. GET /auth/me used to report
    the stored User.role, which nothing has ever set, so the owner of a
    workspace was "Member" on their own profile and "Organization Admin" in the
    team list at the same moment.
*/
const serializeUserWithRole = async (user, stats) => {
    const owns = await Organization.exists({ createdBy: idOf(user._id) });
    const shaped = serializeUser(user, stats || {});

    if (owns) {
        shaped.role = "Organization Admin";
    }

    return shaped;
};


const listProjects = async (user, { status, search, organizationId } = {}) => {
    let projectIds = await accessibleProjectIds(user);

    if (!projectIds.length) {
        return [];
    }

    if (organizationId) {
        const scoped = await Project.find({
            _id: { $in: projectIds },
            organization: organizationId
        }).select("_id");

        projectIds = scoped.map((project) => project._id);

        if (!projectIds.length) {
            return [];
        }
    }

    const query = { _id: { $in: projectIds } };

    if (status) {
        query.status = status;
    }

    if (search) {
        const safe = String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        query.$or = [
            { name: { $regex: safe, $options: "i" } },
            { key: { $regex: safe, $options: "i" } }
        ];
    }

    const projects = await Project.find(query)
        .populate("members", "name email avatar")
        .sort({ createdAt: -1 });

    const counts = await Task.aggregate([
        { $match: { project: { $in: projectIds } } },
        {
            $group: {
                _id: "$project",
                tasks: { $sum: 1 },
                completed: {
                    $sum: {
                        $cond: [{ $eq: ["$status", "Done"] }, 1, 0]
                    }
                }
            }
        }
    ]);

    const countsByProject = new Map(counts.map((entry) => [idOf(entry._id), entry]));

    return projects.map((project) => {
        const stats = countsByProject.get(idOf(project)) || {};
        const serialized = serializeProject(project, stats);

        if (project.progress === 0 && stats.tasks) {
            serialized.progress = Math.round(((stats.completed || 0) / stats.tasks) * 100);
        }

        return serialized;
    });
};

const listTasks = async (user, { projectId, status, priority, assigneeId, search } = {}) => {
    let projectIds = await accessibleProjectIds(user);

    if (!projectIds.length) {
        return [];
    }

    if (projectId) {
        projectIds = projectIds.filter((entry) => idOf(entry) === String(projectId));

        if (!projectIds.length) {
            return [];
        }
    }

    const query = { project: { $in: projectIds } };

    if (status) {
        query.status = status;
    }

    if (priority) {
        query.priority = priority;
    }

    if (assigneeId) {
        query.assignedTo = assigneeId;
    }

    if (search) {
        const safe = String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        query.$or = [
            { title: { $regex: safe, $options: "i" } },
            { key: { $regex: safe, $options: "i" } },
            { description: { $regex: safe, $options: "i" } }
        ];
    }

    const tasks = await Task.find(query)
        .populate("project", "name key")
        .populate("assignedTo", "name avatar")
        .populate("createdBy", "name avatar")
        .sort({ order: 1, createdAt: -1 })
        .limit(TASK_LIMIT);

    if (!tasks.length) {
        return [];
    }

    const taskIds = tasks.map((task) => task._id);

    const comments = await Comment.find({ task: { $in: taskIds } })
        .populate("user", "name avatar")
        .sort({ createdAt: 1 });

    const attachmentCounts = await File.aggregate([
        { $match: { task: { $in: taskIds } } },
        { $group: { _id: "$task", count: { $sum: 1 } } }
    ]);

    const commentsByTask = new Map();
    const attachmentsByTask = new Map(attachmentCounts.map((entry) => [idOf(entry._id), entry.count]));

    for (const comment of comments) {
        const key = idOf(comment.task);
        const bucket = commentsByTask.get(key) || [];

        bucket.push(serializeComment(comment, comment.user ? comment.user.name : ""));
        commentsByTask.set(key, bucket);
    }

    return tasks.map((task) => serializeTask(task, {
        projectName: task.project ? task.project.name : "",
        assigneeName: task.assignedTo ? task.assignedTo.name : "",
        reporterName: task.createdBy ? task.createdBy.name : "",
        comments: commentsByTask.get(idOf(task)) || [],
        attachments: attachmentsByTask.get(idOf(task)) || 0
    }));
};

const listMessages = async (user, { channel, limit = MESSAGE_LIMIT } = {}) => {
    const organizationIds = await accessibleOrganizationIds(user);
    const channels = await Channel.find({
        organization: { $in: organizationIds }
    }).select("name isPrivate members");

    const readable = channels
        .filter((entry) => !entry.isPrivate || (entry.members || []).some((member) => idOf(member) === idOf(user._id)))
        .map((entry) => entry.name);

    const allowed = readable.length ? readable : DEFAULT_CHANNELS;

    const query = {
        isDeleted: false,
        $or: [
            { channel: { $in: allowed } },
            { sender: user._id },
            { receiver: user._id }
        ]
    };

    if (channel) {
        if (!allowed.includes(String(channel).toLowerCase())) {
            return { allowed: false, status: 403, messages: [] };
        }

        delete query.$or;
        query.channel = String(channel).toLowerCase();
    }

    const messages = await Message.find(query)
        .populate("sender", "name avatar")
        .sort({ createdAt: -1 })
        .limit(Math.min(Number(limit) || MESSAGE_LIMIT, MESSAGE_LIMIT));

    return {
        allowed: true,
        status: 200,
        messages: messages
            .slice()
            .reverse()
            .map((message) => serializeMessage(message, message.sender ? message.sender.name : ""))
    };
};

const listChannels = async (user) => {
    const organizationIds = await accessibleOrganizationIds(user);

    if (!organizationIds.length) {
        return DEFAULT_CHANNELS;
    }

    const channels = await Channel.find({ organization: { $in: organizationIds } })
        .sort({ name: 1 });

    const names = channels.map((entry) => entry.name);

    return names.length ? names : DEFAULT_CHANNELS;
};

const listChannelRecords = async (user) => {
    const organizationIds = await accessibleOrganizationIds(user);

    if (!organizationIds.length) {
        return [];
    }

    const channels = await Channel.find({ organization: { $in: organizationIds } })
        .populate("members", "name avatar")
        .sort({ name: 1 });

    return channels.map((entry) => serializeChannel(entry));
};

const listFiles = async (user) => {
    const projectIds = await accessibleProjectIds(user);

    const tasks = await Task.find({
        project: { $in: projectIds },
        assignedTo: user._id
    }).select("_id");

    const taskIds = tasks.map((task) => task._id);

    const query = {
        $or: [
            { uploadedBy: user._id },
            { project: { $in: projectIds } },
            { task: { $in: taskIds } }
        ]
    };

    const files = await File.find(query)
        .populate("uploadedBy", "name avatar")
        .sort({ createdAt: -1 })
        .limit(FILE_LIMIT);

    return files.map((file) => serializeFile(file, file.uploadedBy ? file.uploadedBy.name : ""));
};

const listFileFolders = async (user) => {
    const files = await listFiles(user);
    const folders = new Set();

    for (const file of files) {
        folders.add(file.folder || "General");
    }

    return [...folders].sort();
};

const listEvents = async (user) => {
    const organizationIds = await accessibleOrganizationIds(user);

    if (!organizationIds.length) {
        return [];
    }

    const events = await CalendarEvent.find({ organization: { $in: organizationIds } })
        .populate("attendees", "name avatar")
        .sort({ startAt: 1 });

    return events.map((event) => serializeEvent(event));
};

const listNotifications = async (user) => {
    const notifications = await Notification.find({ user: user._id })
        .sort({ createdAt: -1 })
        .limit(100);

    return notifications.map((entry) => serializeNotification(entry));
};

const listAuditLogs = async (user, { limit = AUDIT_LIMIT } = {}) => {
    const organizationIds = await accessibleOrganizationIds(user);

    if (!organizationIds.length) {
        return [];
    }

    const logs = await AuditLog.find({ organization: { $in: organizationIds } })
        .populate("user", "name avatar")
        .sort({ createdAt: -1 })
        .limit(Math.min(Number(limit) || AUDIT_LIMIT, AUDIT_LIMIT));

    return logs.map((log) => serializeAuditLog(log, log.user ? log.user.name : log.userName));
};

const computeAnalytics = async (user) => {
    const projectIds = await accessibleProjectIds(user);
    const organizationIds = await accessibleOrganizationIds(user);

    if (!projectIds.length) {
        return {
            progress: [],
            status: TASK_STATUSES.map((name) => ({ name, value: 0 })),
            workload: [],
            productivity: [],
            metrics: {
                totalProjects: 0,
                activeTasks: 0,
                completedTasks: 0,
                overdue: 0,
                completionRate: 0,
                averageCycleTimeDays: 0,
                totalUsers: 0
            }
        };
    }

    const tasks = await Task.find({ project: { $in: projectIds } })
        .select("status priority dueDate completedAt createdAt assignedTo");

    const statusCounts = new Map(TASK_STATUSES.map((status) => [status, 0]));
    const workloadCounts = new Map();
    const now = new Date();
    let activeTasks = 0;
    let completedTasks = 0;
    let overdue = 0;
    let cycleTotal = 0;
    let cycleSamples = 0;

    for (const task of tasks) {
        const status = normalizeTaskStatus(task.status);

        statusCounts.set(status, (statusCounts.get(status) || 0) + 1);

        if (status === "Done") {
            completedTasks += 1;

            if (task.completedAt && task.createdAt) {
                const days = (new Date(task.completedAt) - new Date(task.createdAt)) / 86400000;
                cycleTotal += days;
                cycleSamples += 1;
            }
        } else {
            activeTasks += 1;

            if (task.dueDate && new Date(task.dueDate) < now) {
                overdue += 1;
            }

            if (task.assignedTo) {
                const key = idOf(task.assignedTo);
                workloadCounts.set(key, (workloadCounts.get(key) || 0) + 1);
            }
        }
    }

    const progress = [];

    for (let index = 5; index >= 0; index -= 1) {
        const start = startOfWeek(addDays(startOfWeek(now), index * 7));
        const end = addDays(start, 7);

        let planned = 0;
        let completed = 0;

        for (const task of tasks) {
            if (!task.dueDate) {
                continue;
            }

            const due = new Date(task.dueDate);

            if (due >= start && due < end) {
                planned += 1;

                if (normalizeTaskStatus(task.status) === "Done") {
                    completed += 1;
                }
            }
        }

        progress.push({ name: `Week ${6 - index}`, planned, completed });
    }

    const workloadUsers = await User.find({ _id: { $in: [...workloadCounts.keys()] } })
        .select("name");

    const nameById = new Map(workloadUsers.map((entry) => [idOf(entry), firstName(entry)]));

    const workload = [...workloadCounts.entries()]
        .map(([userId, count]) => ({ name: nameById.get(userId) || "Unknown", tasks: count }))
        .sort((left, right) => right.tasks - left.tasks)
        .slice(0, 10);

    const productivity = [];

    for (let index = 6; index >= 0; index -= 1) {
        const day = addDays(startOfDay(now), index);
        const next = addDays(day, 1);

        let points = 0;

        for (const task of tasks) {
            if (!task.completedAt) {
                continue;
            }

            const completedAt = new Date(task.completedAt);

            if (completedAt >= day && completedAt < next) {
                points += 1;
            }
        }

        productivity.push({ name: DAY_NAMES[day.getDay()], points });
    }

    const totalUsers = await User.countDocuments({
        _id: { $in: await organizationMemberIds(organizationIds) }
    });

    return {
        progress,
        status: TASK_STATUSES.map((name) => ({ name, value: statusCounts.get(name) || 0 })),
        workload,
        productivity,
        metrics: {
            totalProjects: projectIds.length,
            activeTasks,
            completedTasks,
            overdue,
            completionRate: tasks.length ? Math.round((completedTasks / tasks.length) * 100) : 0,
            averageCycleTimeDays: cycleSamples ? Math.round((cycleTotal / cycleSamples) * 10) / 10 : 0,
            totalUsers
        }
    };
};

const organizationMemberIds = async (organizationIds) => {
    if (!organizationIds.length) {
        return [];
    }

    const organizations = await Organization.find({ _id: { $in: organizationIds } })
        .select("members createdBy");

    const ids = [];

    for (const organization of organizations) {
        ids.push(...(organization.members || []), organization.createdBy);
    }

    return uniqueIds(ids);
};

const userStats = async (userId) => {
    const taskStats = await Task.aggregate([
        { $match: { assignedTo: userId } },
        {
            $group: {
                _id: "$assignedTo",
                active: {
                    $sum: { $cond: [{ $eq: ["$status", "Done"] }, 0, 1] }
                },
                completed: {
                    $sum: { $cond: [{ $eq: ["$status", "Done"] }, 1, 0] }
                }
            }
        }
    ]);

    const projectCount = await Project.countDocuments({ members: userId });

    const entry = taskStats[0] || { active: 0, completed: 0 };

    return {
        activeTasks: entry.active,
        completed: entry.completed,
        projects: projectCount
    };
};

const projectView = async (project) => {
    const counts = await Task.aggregate([
        { $match: { project: project._id } },
        {
            $group: {
                _id: "$project",
                tasks: { $sum: 1 },
                completed: {
                    $sum: {
                        $cond: [{ $eq: ["$status", "Done"] }, 1, 0]
                    }
                }
            }
        }
    ]);

    const stats = counts[0] || {};
    const serialized = serializeProject(project, stats);

    if (!project.progress && stats.tasks) {
        serialized.progress = Math.round(((stats.completed || 0) / stats.tasks) * 100);
    }

    return serialized;
};

const taskView = async (task) => {
    const populated = await Task.findById(task._id)
        .populate("project", "name key")
        .populate("assignedTo", "name avatar")
        .populate("createdBy", "name avatar");

    if (!populated) {
        return null;
    }

    const comments = await Comment.find({ task: populated._id })
        .populate("user", "name avatar")
        .sort({ createdAt: 1 });

    const attachmentCounts = await File.aggregate([
        { $match: { task: populated._id } },
        { $group: { _id: "$task", count: { $sum: 1 } } }
    ]);

    return serializeTask(populated, {
        projectName: populated.project ? populated.project.name : "",
        assigneeName: populated.assignedTo ? populated.assignedTo.name : "",
        reporterName: populated.createdBy ? populated.createdBy.name : "",
        comments: comments.map((comment) => serializeComment(
            comment,
            comment.user ? comment.user.name : ""
        )),
        attachments: attachmentCounts[0] ? attachmentCounts[0].count : 0
    });
};

module.exports = {
    accessibleOrganizationIds,
    accessibleProjectIds,
    listUsers,
    listProjects,
    listTasks,
    listMessages,
    listChannels,
    listChannelRecords,
    listFiles,
    listFileFolders,
    listEvents,
    listNotifications,
    listAuditLogs,
    computeAnalytics,
    projectView,
    taskView,
    userStats,
    serializeUserWithRole,
    uniqueIds
};
