const Task = require("../models/Task");

const {
    checkProjectAccess,
    checkTaskAccess,
    checkTaskManagement,
    isUserInProject,
    isValidObjectId
} = require("../services/permissionService");

const { createNotification } = require("../services/notificationService");
const auditService = require("../services/auditService");
const { taskView, listTasks } = require("../services/workspaceService");

const {
    isTaskStatus,
    isTaskPriority,
    normalizeTaskStatus,
    normalizePriority
} = require("../constants/nexus");

const { idOf } = require("../utils/serialize");

const TITLE_MAX_LENGTH = 200;
const DESCRIPTION_MAX_LENGTH = 5000;
const CHECKLIST_MAX = 40;
const LABEL_MAX = 20;
const LABEL_LENGTH = 40;
const ACTIVITY_LIMIT = 50;
const KEY_ATTEMPTS = 5;
const KEY_PREFIX = "NEX-";
const KEY_START = 100;

const cleanText = (value) => {
    return typeof value === "string" ? value.trim() : "";
};

const deniedMessage = (status, notFound, forbidden) => {
    return status === 404 ? notFound : forbidden;
};

const nextTaskNumber = async () => {
    const result = await Task.aggregate([
        { $match: { key: { $regex: /^NEX-\d+$/ } } },
        {
            $project: {
                number: {
                    $toInt: { $substrBytes: ["$key", KEY_PREFIX.length, 20] }
                }
            }
        },
        { $group: { _id: null, highest: { $max: "$number" } } }
    ]);

    const highest = result[0] && result[0].highest ? result[0].highest : KEY_START - 1;

    return highest + 1;
};

const nextTaskKey = async () => {
    return `${KEY_PREFIX}${await nextTaskNumber()}`;
};

/**
 * Every attempt uses a strictly larger number than the previous one.
 * Re-deriving the max on each retry would hand back the same colliding
 * key when no other writer has inserted in between.
 */
const createWithKey = async (payload) => {
    let lastError = null;
    const firstCandidate = await nextTaskNumber();

    for (let attempt = 0; attempt < KEY_ATTEMPTS; attempt += 1) {
        const key = `${KEY_PREFIX}${firstCandidate + attempt}`;

        try {
            return await Task.create({ ...payload, key });
        } catch (error) {
            lastError = error;

            if (error && error.code === 11000) {
                continue;
            }

            throw error;
        }
    }

    throw lastError;
};

/**
 * The frontend treats a task's public id as its key (for example "NEX-124"),
 * so accept either the Mongo id or the key.
 */
const resolveTaskId = async (identifier) => {
    const raw = String(identifier || "").trim();

    if (!raw) {
        return null;
    }

    if (isValidObjectId(raw)) {
        const byId = await Task.findById(raw).select("_id");

        if (byId) {
            return idOf(byId);
        }
    }

    const byKey = await Task.findOne({ key: raw.toUpperCase() }).select("_id");

    return byKey ? idOf(byKey) : null;
};

const pushActivity = (task, entry) => {
    task.activity.unshift(entry);
    task.activity = task.activity.slice(0, ACTIVITY_LIMIT);
};

const normalizeChecklist = (value) => {
    if (!Array.isArray(value)) {
        return null;
    }

    const seen = new Set();

    return value
        .filter((item) => item && typeof item === "object")
        .map((item, index) => {
            const label = cleanText(item.label);

            if (!label) {
                return null;
            }

            let id = cleanText(item.id);

            if (!id || seen.has(id)) {
                id = `c-${Date.now()}-${index}`;
            }

            seen.add(id);

            return { id, label: label.slice(0, 200), done: Boolean(item.done) };
        })
        .filter(Boolean)
        .slice(0, CHECKLIST_MAX);
};

const createTask = async (req, res) => {
    const title = cleanText(req.body.title);

    if (!title) {
        return res.status(400).json({ message: "Task title is required" });
    }

    if (title.length > TITLE_MAX_LENGTH) {
        return res.status(400).json({
            message: `Task title cannot exceed ${TITLE_MAX_LENGTH} characters`
        });
    }

    const description = cleanText(req.body.description);

    if (description.length > DESCRIPTION_MAX_LENGTH) {
        return res.status(400).json({
            message: `Task description cannot exceed ${DESCRIPTION_MAX_LENGTH} characters`
        });
    }

    const access = await checkProjectAccess(req.body.projectId, req.userId);

    if (!access.allowed) {
        return res.status(access.status).json({
            message: deniedMessage(
                access.status,
                "Project not found",
                "You are not a member of this project"
            )
        });
    }

    const status = req.body.status === undefined ? "Todo" : req.body.status;

    if (!isTaskStatus(status)) {
        return res.status(400).json({
            message: `Status must be one of: ${Task.STATUSES.join(", ")}`
        });
    }

    const priority = req.body.priority === undefined ? "Medium" : req.body.priority;

    if (!isTaskPriority(priority)) {
        return res.status(400).json({
            message: `Priority must be one of: ${Task.PRIORITIES.join(", ")}`
        });
    }

    let assignedTo = null;

    if (req.body.assignedTo) {
        if (!isUserInProject(access.project, req.body.assignedTo)) {
            return res.status(400).json({
                message: "Assigned user must be a member of this project"
            });
        }

        assignedTo = req.body.assignedTo;
    }

    const labels = Array.isArray(req.body.labels)
        ? req.body.labels
            .map((label) => cleanText(label).slice(0, LABEL_LENGTH))
            .filter(Boolean)
            .slice(0, LABEL_MAX)
        : [];

    const checklist = normalizeChecklist(req.body.checklist) || [];

    let dueDate = null;

    if (req.body.dueDate) {
        dueDate = new Date(req.body.dueDate);

        if (Number.isNaN(dueDate.getTime())) {
            return res.status(400).json({ message: "dueDate must be a valid date" });
        }
    }

    const normalizedStatus = normalizeTaskStatus(status);
    const task = await createWithKey({
        title,
        description,
        project: access.project._id,
        createdBy: req.userId,
        assignedTo,
        status: normalizedStatus,
        priority: normalizePriority(priority),
        labels,
        checklist,
        dueDate,
        order: Date.now(),
        activity: [`Created by you`],
        completedAt: normalizedStatus === "Done" ? new Date() : null
    });

    await auditService.record({
        req,
        organization: access.project.organization,
        action: "Created task",
        resource: task.title,
        resourceId: task.key,
        status: "Success",
        detail: `${task.key} created in ${access.project.name}`
    });

    if (assignedTo && idOf(assignedTo) !== req.userId) {
        await createNotification({
            user: assignedTo,
            type: "task",
            title: "Task assigned",
            message: `You have been assigned the task: ${task.title}`,
            relatedId: task._id,
            io: req.app.get("io")
        });
    }

    return res.status(201).json({
        message: "Task created successfully",
        task: await taskView(task)
    });
};

const getAllTasks = async (req, res) => {
    const tasks = await listTasks(req.user, {
        projectId: req.query.projectId,
        status: req.query.status,
        priority: req.query.priority,
        assigneeId: req.query.assigneeId,
        search: req.query.search
    });

    return res.status(200).json({ message: "Tasks fetched successfully", tasks });
};

const getTasks = async (req, res) => {
    const access = await checkProjectAccess(req.params.projectId, req.userId);

    if (!access.allowed) {
        return res.status(access.status).json({
            message: deniedMessage(
                access.status,
                "Project not found",
                "You are not a member of this project"
            )
        });
    }

    const tasks = await listTasks(req.user, { projectId: access.project._id });

    return res.status(200).json({ message: "Tasks fetched successfully", tasks });
};

const getTask = async (req, res) => {
    const taskId = await resolveTaskId(req.params.id);

    if (!taskId) {
        return res.status(404).json({ message: "Task not found" });
    }

    const access = await checkTaskAccess(taskId, req.userId);

    if (!access.allowed) {
        return res.status(access.status).json({
            message: deniedMessage(
                access.status,
                "Task not found",
                "You are not a member of this project"
            )
        });
    }

    return res.status(200).json({
        message: "Task fetched successfully",
        task: await taskView(access.task)
    });
};

const updateTask = async (req, res) => {
    const taskId = await resolveTaskId(req.params.id);

    if (!taskId) {
        return res.status(404).json({ message: "Task not found" });
    }

    const access = await checkTaskAccess(taskId, req.userId);

    if (!access.allowed) {
        return res.status(access.status).json({
            message: deniedMessage(
                access.status,
                "Task not found",
                "You are not a member of this project"
            )
        });
    }

    const task = access.task;
    const previousStatus = normalizeTaskStatus(task.status);
    const previousPriority = normalizePriority(task.priority);
    const changes = [];

    if (req.body.title !== undefined) {
        const title = cleanText(req.body.title);

        if (!title) {
            return res.status(400).json({ message: "Task title cannot be empty" });
        }

        if (title.length > TITLE_MAX_LENGTH) {
            return res.status(400).json({
                message: `Task title cannot exceed ${TITLE_MAX_LENGTH} characters`
            });
        }

        if (title !== task.title) {
            changes.push("title");
        }

        task.title = title;
    }

    if (req.body.description !== undefined) {
        const description = cleanText(req.body.description);

        if (description.length > DESCRIPTION_MAX_LENGTH) {
            return res.status(400).json({
                message: `Task description cannot exceed ${DESCRIPTION_MAX_LENGTH} characters`
            });
        }

        task.description = description;
    }

    if (req.body.status !== undefined) {
        if (!isTaskStatus(req.body.status)) {
            return res.status(400).json({
                message: `Status must be one of: ${Task.STATUSES.join(", ")}`
            });
        }

        const next = normalizeTaskStatus(req.body.status);

        if (next !== previousStatus) {
            pushActivity(task, `Status changed from ${previousStatus} to ${next}`);
            changes.push(`status: ${previousStatus} -> ${next}`);

            if (next === "Done") {
                task.completedAt = new Date();
            } else {
                task.completedAt = null;
            }
        }

        task.status = next;
    }

    if (req.body.priority !== undefined) {
        if (!isTaskPriority(req.body.priority)) {
            return res.status(400).json({
                message: `Priority must be one of: ${Task.PRIORITIES.join(", ")}`
            });
        }

        const next = normalizePriority(req.body.priority);

        if (next !== previousPriority) {
            pushActivity(task, `Priority changed from ${previousPriority} to ${next}`);
            changes.push(`priority: ${previousPriority} -> ${next}`);
        }

        task.priority = next;
    }

    if (req.body.labels !== undefined) {
        if (!Array.isArray(req.body.labels)) {
            return res.status(400).json({ message: "labels must be an array" });
        }

        task.labels = req.body.labels
            .map((label) => cleanText(label).slice(0, LABEL_LENGTH))
            .filter(Boolean)
            .slice(0, LABEL_MAX);
        changes.push("labels updated");
    }

    if (req.body.checklist !== undefined) {
        const checklist = normalizeChecklist(req.body.checklist);

        if (!checklist) {
            return res.status(400).json({ message: "checklist must be an array" });
        }

        task.checklist = checklist;
        changes.push("checklist updated");
    }

    if (req.body.dueDate !== undefined) {
        if (req.body.dueDate === null || req.body.dueDate === "") {
            task.dueDate = null;
        } else {
            const dueDate = new Date(req.body.dueDate);

            if (Number.isNaN(dueDate.getTime())) {
                return res.status(400).json({ message: "dueDate must be a valid date" });
            }

            task.dueDate = dueDate;
        }

        changes.push("due date updated");
    }

    if (req.body.order !== undefined) {
        const order = Number(req.body.order);

        if (!Number.isFinite(order)) {
            return res.status(400).json({ message: "order must be a number" });
        }

        task.order = order;
    }

    if (req.body.assignedTo !== undefined) {
        if (req.body.assignedTo === null) {
            task.assignedTo = null;
            changes.push("assignee removed");
        } else {
            if (!isUserInProject(access.project, req.body.assignedTo)) {
                return res.status(400).json({
                    message: "Assigned user must be a member of this project"
                });
            }

            task.assignedTo = req.body.assignedTo;
            changes.push("assignee updated");
        }
    }

    await task.save();

    if (changes.length) {
        await auditService.record({
            req,
            organization: access.project.organization,
            action: "Updated task",
            resource: task.title,
            resourceId: task.key,
            status: "Success",
            detail: changes.join(", ")
        });
    }

    const assignedTo = task.assignedTo ? idOf(task.assignedTo) : null;

    if (assignedTo && assignedTo !== req.userId) {
        if (previousStatus !== normalizeTaskStatus(task.status)) {
            await createNotification({
                user: assignedTo,
                type: "task",
                title: "Task status updated",
                message: `Task "${task.title}" status changed to ${task.status}`,
                relatedId: task._id,
                io: req.app.get("io")
            });
        }

        if (previousPriority !== normalizePriority(task.priority)) {
            await createNotification({
                user: assignedTo,
                type: "task",
                title: "Task priority updated",
                message: `Task "${task.title}" priority changed to ${task.priority}`,
                relatedId: task._id,
                io: req.app.get("io")
            });
        }
    }

    return res.status(200).json({
        message: "Task updated successfully",
        task: await taskView(task)
    });
};

const toggleChecklist = async (req, res) => {
    const taskId = await resolveTaskId(req.params.id);

    if (!taskId) {
        return res.status(404).json({ message: "Task not found" });
    }

    const access = await checkTaskAccess(taskId, req.userId);

    if (!access.allowed) {
        return res.status(access.status).json({
            message: deniedMessage(
                access.status,
                "Task not found",
                "You are not a member of this project"
            )
        });
    }

    const itemId = cleanText(req.body.itemId);

    if (!itemId) {
        return res.status(400).json({ message: "itemId is required" });
    }

    const task = access.task;
    const item = (task.checklist || []).find((entry) => entry.id === itemId);

    if (!item) {
        return res.status(404).json({ message: "Checklist item not found" });
    }

    const done = req.body.done === undefined ? !item.done : Boolean(req.body.done);

    item.done = done;
    task.markModified("checklist");

    await task.save();

    await auditService.record({
        req,
        organization: access.project.organization,
        action: "Updated checklist",
        resource: task.title,
        resourceId: task.key,
        status: "Success",
        detail: `${itemId} marked ${done ? "done" : "open"}`
    });

    return res.status(200).json({
        message: "Checklist updated successfully",
        task: await taskView(task)
    });
};

const deleteTask = async (req, res) => {
    const taskId = await resolveTaskId(req.params.id);

    if (!taskId) {
        return res.status(404).json({ message: "Task not found" });
    }

    const access = await checkTaskManagement(taskId, req.userId);

    if (!access.allowed) {
        return res.status(access.status).json({
            message: deniedMessage(
                access.status,
                "Task not found",
                "You are not allowed to delete this task"
            )
        });
    }

    await Task.findByIdAndDelete(access.task._id);

    await auditService.record({
        req,
        organization: access.project.organization,
        action: "Deleted task",
        resource: access.task.title,
        resourceId: access.task.key,
        status: "Warning",
        detail: `${access.task.key} deleted`
    });

    return res.status(200).json({ message: "Task deleted successfully" });
};

const assignTask = async (req, res) => {
    const taskId = await resolveTaskId(req.params.id);

    if (!taskId) {
        return res.status(404).json({ message: "Task not found" });
    }

    const access = await checkTaskManagement(taskId, req.userId);

    if (!access.allowed) {
        return res.status(access.status).json({
            message: deniedMessage(
                access.status,
                "Task not found",
                "You are not allowed to assign this task"
            )
        });
    }

    const userId = req.body.userId;

    if (typeof userId !== "string" || !userId) {
        return res.status(400).json({ message: "User ID is required" });
    }

    if (userId === req.userId) {
        return res.status(400).json({ message: "You cannot assign a task to yourself" });
    }

    if (!isUserInProject(access.project, userId)) {
        return res.status(400).json({
            message: "Task can only be assigned to a member of this project"
        });
    }

    const task = access.task;

    if (task.assignedTo && idOf(task.assignedTo) === userId) {
        return res.status(409).json({ message: "Task is already assigned to this user" });
    }

    task.assignedTo = userId;
    pushActivity(task, "Task reassigned");

    await task.save();

    await auditService.record({
        req,
        organization: access.project.organization,
        action: "Assigned task",
        resource: task.title,
        resourceId: task.key,
        status: "Success",
        detail: `${task.key} assigned`
    });

    await createNotification({
        user: userId,
        type: "task",
        title: "Task assigned",
        message: `You have been assigned the task: ${task.title}`,
        relatedId: task._id,
        io: req.app.get("io")
    });

    return res.status(200).json({
        message: "Task assigned successfully",
        task: await taskView(task)
    });
};

module.exports = {
    createTask,
    getAllTasks,
    getTasks,
    getTask,
    updateTask,
    toggleChecklist,
    deleteTask,
    assignTask,
    nextTaskKey,
    resolveTaskId
};
