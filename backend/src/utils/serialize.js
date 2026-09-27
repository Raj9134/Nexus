const {
    shortDate,
    clockTime,
    time12,
    auditTimestamp,
    relativeTime,
    formatBytes,
    initials,
    fileCategory,
    clampPercent,
    workloadLevel
} = require("./format");

const {
    normalizeTaskStatus,
    normalizePriority,
    normalizeProjectStatus,
    normalizeNotificationCategory
} = require("../constants/nexus");

function idOf(value) {
    if (!value) {
        return "";
    }

    if (typeof value === "string") {
        return value;
    }

    if (value._id) {
        return String(value._id);
    }

    return "";
}

function nameOf(value) {
    if (!value) {
        return "";
    }

    if (typeof value === "string") {
        return value;
    }

    if (value.name) {
        return value.name;
    }

    return "";
}

function firstName(value) {
    const name = nameOf(value);

    return name ? name.split(/\s+/)[0] : "";
}

function serializeUser(user, stats = {}) {
    if (!user) {
        return null;
    }

    /*
        The label is whatever the caller knows: listUsers passes "Organization
        Admin" for the people who own one of the shared workspaces. It used to
        be derived from a global user.role that nothing ever set, so every
        account rendered as "Member" no matter what it was allowed to do.
    */
    const activeTasks = Number(stats.activeTasks) || 0;
    const completed = Number(stats.completed) || 0;
    const total = activeTasks + completed;

    return {
        id: idOf(user),
        name: user.name || "",
        email: user.email || "",
        role: stats.role || user.title || "Member",
        department: user.department || "General",
        avatar: user.avatar || initials(user.name),
        status: user.status || "Offline",
        activeTasks,
        completed,
        workload: stats.workload || workloadLevel(activeTasks, completed),
        projects: Number(stats.projects) || 0,
        completionRate: stats.completionRate !== undefined && stats.completionRate !== null
            ? Number(stats.completionRate)
            : (total ? Math.round((completed / total) * 100) : 0)
    };
}

function serializeOrganization(organization) {
    if (!organization) {
        return null;
    }

    return {
        id: idOf(organization),
        name: organization.name || "",
        description: organization.description || ""
    };
}

function serializeProject(project, stats = {}) {
    if (!project) {
        return null;
    }

    return {
        id: idOf(project),
        name: project.name || "",
        key: project.key || "",
        description: project.description || "",
        progress: clampPercent(project.progress),
        members: (project.members || []).map(idOf).filter(Boolean),
        tasks: Number(stats.tasks) || 0,
        completed: Number(stats.completed) || 0,
        due: shortDate(project.due),
        status: normalizeProjectStatus(project.status),
        icon: project.icon || initials(project.key || project.name)
    };
}

function serializeTask(task, context = {}) {
    if (!task) {
        return null;
    }

    return {
        id: task.key || idOf(task),
        title: task.title || "",
        description: task.description || "",
        projectId: idOf(task.project),
        project: context.projectName || "",
        priority: normalizePriority(task.priority),
        status: normalizeTaskStatus(task.status),
        assigneeId: idOf(task.assignedTo),
        assignee: context.assigneeName || "",
        reporter: context.reporterName || "",
        dueDate: shortDate(task.dueDate),
        labels: task.labels || [],
        comments: context.comments || [],
        attachments: Number(context.attachments) || 0,
        checklist: (task.checklist || []).map((item) => ({
            id: item.id,
            label: item.label,
            done: Boolean(item.done)
        })),
        activity: task.activity || []
    };
}

function serializeComment(comment, authorName) {
    if (!comment) {
        return null;
    }

    return {
        id: idOf(comment),
        authorId: idOf(comment.user),
        body: comment.text || "",
        time: relativeTime(comment.createdAt)
    };
}

function serializeMessage(message, authorName) {
    if (!message) {
        return null;
    }

    const channel = message.channel
        || (message.receiver ? `direct:${idOf(message.receiver)}` : "general");

    return {
        id: idOf(message),
        channel,
        authorId: idOf(message.sender),
        body: message.message || "",
        time: clockTime(message.createdAt),
        reactions: message.reactions || [],
        edited: Boolean(message.isEdited),
        /*
            Without these a voice or file message serialized to an empty body
            with nothing marking it as one, so a client could neither render a
            player nor fetch the audio.
        */
        messageType: message.messageType || "text",
        audioUrl: message.audioUrl || null,
        duration: message.duration === null || message.duration === undefined
            ? null
            : Number(message.duration),
        fileId: message.file ? idOf(message.file) : null
    };
}

function serializeFile(file, ownerName) {
    if (!file) {
        return null;
    }

    const displayName = file.originalName || file.fileName || "";

    return {
        id: idOf(file),
        name: displayName,
        type: fileCategory(displayName),
        owner: ownerName || "",
        size: formatBytes(file.size),
        modified: shortDate(file.createdAt),
        folder: file.folder || "General"
    };
}

function serializeEvent(event) {
    if (!event) {
        return null;
    }

    return {
        id: idOf(event),
        title: event.title || "",
        date: shortDate(event.startAt),
        time: time12(event.startAt),
        type: event.type || "Meeting",
        attendees: (event.attendees || []).map(nameOf).filter(Boolean),
        notes: event.notes || ""
    };
}

function serializeAuditLog(log, userName) {
    if (!log) {
        return null;
    }

    return {
        id: idOf(log),
        timestamp: auditTimestamp(log.createdAt),
        user: userName || log.userName || "System",
        action: log.action || "",
        resource: log.resource || "",
        ip: log.ip || "",
        status: log.status || "Success",
        detail: log.detail || ""
    };
}

function serializeActivity(activity, userName) {
    if (!activity) {
        return null;
    }

    return {
        id: idOf(activity),
        user: userName || "Unknown",
        projectId: idOf(activity.project),
        taskId: activity.task ? idOf(activity.task) : null,
        action: activity.action || "",
        description: activity.description || "",
        timestamp: auditTimestamp(activity.createdAt)
    };
}

function serializeNotification(notification) {
    if (!notification) {
        return null;
    }

    return {
        id: idOf(notification),
        title: notification.title || "",
        body: notification.message || "",
        category: normalizeNotificationCategory(notification.category || notification.type),
        time: relativeTime(notification.createdAt),
        read: Boolean(notification.isRead)
    };
}

function serializeChannel(channel) {
    if (!channel) {
        return null;
    }

    return {
        id: idOf(channel),
        name: channel.name || "",
        description: channel.description || "",
        isPrivate: Boolean(channel.isPrivate),
        members: (channel.members || []).map(idOf).filter(Boolean)
    };
}

/*
    A call's caller/receiver is a bare ObjectId right after a write and a
    populated { _id, name, email } on a read, so both shapes have to collapse
    into one reference. Otherwise the client cannot name the peer it just
    called, because the create response carries ids only.
*/
function userRef(value) {
    if (!value) {
        return null;
    }

    return {
        id: idOf(value),
        name: nameOf(value),
        email: (value && value.email) || ""
    };
}

function serializeCall(call) {
    if (!call) {
        return null;
    }

    return {
        id: idOf(call),
        caller: userRef(call.caller),
        receiver: userRef(call.receiver),
        status: call.status || "calling",
        startedAt: call.startedAt || null,
        endedAt: call.endedAt || null,
        duration: Number(call.duration) || 0,
        createdAt: call.createdAt || null
    };
}

module.exports = {
    idOf,
    nameOf,
    firstName,
    serializeUser,
    serializeOrganization,
    serializeProject,
    serializeTask,
    serializeComment,
    serializeMessage,
    serializeFile,
    serializeEvent,
    serializeAuditLog,
    serializeActivity,
    serializeNotification,
    serializeChannel,
    serializeCall
};
