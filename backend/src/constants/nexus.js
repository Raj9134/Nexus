const TASK_STATUSES = ["Backlog", "Todo", "In Progress", "In Review", "Done"];

const TASK_PRIORITIES = ["Low", "Medium", "High", "Critical"];

const PROJECT_STATUSES = ["Active", "At Risk", "Archived", "Planning"];

const EVENT_TYPES = ["Meeting", "Deadline", "Review", "Planning"];

const AUDIT_STATUSES = ["Success", "Warning", "Blocked"];

const NOTIFICATION_CATEGORIES = ["Mention", "Task", "Project", "System"];

const USER_STATUSES = ["Online", "Away", "Offline"];

const WORKLOAD_LEVELS = ["Low", "Balanced", "High"];

const DEFAULT_CHANNELS = ["general", "engineering", "backend", "frontend", "random"];

const FILE_FOLDERS = ["Engineering", "Design", "Documentation", "Reports"];

const ROLES = ["SUPER ADMIN", "ORG ADMIN", "PROJECT MANAGER", "TEAM LEAD", "MEMBER", "GUEST"];

const LEGACY_TASK_STATUS = {
    pending: "Todo",
    in_progress: "In Progress",
    completed: "Done",
    todo: "Todo",
    review: "In Review",
    done: "Done"
};

const LEGACY_PRIORITY = {
    low: "Low",
    medium: "Medium",
    high: "High",
    urgent: "Critical"
};

const LEGACY_PROJECT_STATUS = {
    active: "Active",
    archived: "Archived",
    completed: "Archived"
};

const LEGACY_NOTIFICATION_TYPE = {
    message: "System",
    call: "System",
    comment: "Mention",
    mention: "Mention",
    task: "Task"
};

function normalizeTaskStatus(value) {
    if (!value) {
        return "Todo";
    }

    if (TASK_STATUSES.includes(value)) {
        return value;
    }

    return LEGACY_TASK_STATUS[value] || "Todo";
}

function normalizePriority(value) {
    if (!value) {
        return "Medium";
    }

    if (TASK_PRIORITIES.includes(value)) {
        return value;
    }

    return LEGACY_PRIORITY[String(value).toLowerCase()] || "Medium";
}

function normalizeProjectStatus(value) {
    if (!value) {
        return "Active";
    }

    if (PROJECT_STATUSES.includes(value)) {
        return value;
    }

    return LEGACY_PROJECT_STATUS[String(value).toLowerCase()] || "Active";
}

function normalizeNotificationCategory(value) {
    if (NOTIFICATION_CATEGORIES.includes(value)) {
        return value;
    }

    return LEGACY_NOTIFICATION_TYPE[value] || "System";
}

const isTaskStatus = (value) => {
    return TASK_STATUSES.includes(value)
        || Object.prototype.hasOwnProperty.call(LEGACY_TASK_STATUS, value);
};

const isTaskPriority = (value) => {
    return TASK_PRIORITIES.includes(value)
        || Object.prototype.hasOwnProperty.call(LEGACY_PRIORITY, value);
};

const isProjectStatus = (value) => {
    return PROJECT_STATUSES.includes(value)
        || Object.prototype.hasOwnProperty.call(LEGACY_PROJECT_STATUS, value);
};

module.exports = {
    TASK_STATUSES,
    TASK_PRIORITIES,
    PROJECT_STATUSES,
    EVENT_TYPES,
    AUDIT_STATUSES,
    NOTIFICATION_CATEGORIES,
    USER_STATUSES,
    WORKLOAD_LEVELS,
    DEFAULT_CHANNELS,
    FILE_FOLDERS,
    ROLES,
    normalizeTaskStatus,
    normalizePriority,
    normalizeProjectStatus,
    normalizeNotificationCategory,
    isTaskStatus,
    isTaskPriority,
    isProjectStatus
};
