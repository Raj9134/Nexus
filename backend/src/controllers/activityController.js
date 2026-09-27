const Activity = require("../models/Activity");
const Task = require("../models/Task");
const User = require("../models/User");

const { serializeActivity } = require("../utils/serialize");
const { resolveTaskId } = require("./taskController");

const {
    checkProjectAccess
} = require("../services/permissionService");

const DESCRIPTION_MAX_LENGTH = 1000;
const HISTORY_MAX_LIMIT = 100;

const cleanText = (value) => {
    return typeof value === "string" ? value.trim() : "";
};

const deniedMessage = (status, notFound, forbidden) => {
    return status === 404 ? notFound : forbidden;
};

const createActivity = async (req, res) => {

    const action = cleanText(req.body.action);

    if (!action) {
        return res.status(400).json({
            message: "Activity action is required"
        });
    }

    if (!Activity.ACTIONS.includes(action)) {
        return res.status(400).json({
            message: `Action must be one of: ${Activity.ACTIONS.join(", ")}`
        });
    }

    const description = cleanText(req.body.description);

    if (description.length > DESCRIPTION_MAX_LENGTH) {
        return res.status(400).json({
            message: `Activity description cannot exceed ${DESCRIPTION_MAX_LENGTH} characters`
        });
    }

    const access = await checkProjectAccess(
        req.body.projectId,
        req.userId
    );

    if (!access.allowed) {
        return res.status(access.status).json({
            message: deniedMessage(
                access.status,
                "Project not found",
                "You are not a member of this project"
            )
        });
    }

    let task = null;

    if (req.body.taskId) {
        // A task's public id is its key (for example "NEX-124"), so accept
        // either that key or the Mongo id, exactly like the task routes do.
        const taskId = await resolveTaskId(req.body.taskId);

        if (!taskId) {
            return res.status(404).json({
                message: "Task not found"
            });
        }

        task = await Task.findById(taskId);


        if (!task) {
            return res.status(404).json({
                message: "Task not found"
            });
        }

        if (task.project.toString() !== access.project._id.toString()) {
            return res.status(400).json({
                message: "Task does not belong to this project"
            });
        }

    }

    const activity = await Activity.create({
        user: req.userId,
        project: access.project._id,
        task: task ? task._id : null,
        action: action,
        description: description
    });

    return res.status(201).json({
        message: "Activity created successfully",
        activity: activity
    });

};

const getActivities = async (req, res) => {

    const access = await checkProjectAccess(
        req.params.projectId,
        req.userId
    );

    if (!access.allowed) {
        return res.status(access.status).json({
            message: deniedMessage(
                access.status,
                "Project not found",
                "You are not a member of this project"
            )
        });
    }

    const limit = Math.min(
        Number.parseInt(req.query.limit, 10) || HISTORY_MAX_LIMIT,
        HISTORY_MAX_LIMIT
    );

    const activities = await Activity.find({
        project: access.project._id
    })
        .sort({ createdAt: -1 })
        .limit(limit);

    const actorIds = [...new Set(
        activities
            .map((activity) => (activity.user ? activity.user.toString() : null))
            .filter(Boolean)
    )];

    const actors = await User.find({ _id: { $in: actorIds } }).select("name");
    const actorNames = new Map(actors.map((actor) => [actor._id.toString(), actor.name]));

    return res.status(200).json({
        message: "Activities fetched successfully",
        activities: activities.map((activity) => serializeActivity(
            activity,
            actorNames.get(activity.user ? activity.user.toString() : "")
        ))
    });

};

module.exports = {
    createActivity,
    getActivities
};
