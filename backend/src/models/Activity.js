const mongoose = require("mongoose");

const ACTIONS = [
    "task_created",
    "task_updated",
    "task_deleted",
    "task_assigned",
    "comment_created",
    "file_attached",
    "project_updated",
    "member_added",
    "member_removed"
];

const activitySchema = new mongoose.Schema({

    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    project: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Project",
        required: true
    },

    task: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Task",
        default: null
    },

    action: {
        type: String,
        required: true,
        enum: ACTIONS
    },

    description: {
        type: String,
        default: "",
        maxlength: 1000
    }

}, {
    timestamps: true
});

const Activity = mongoose.model("Activity", activitySchema);

Activity.ACTIONS = ACTIONS;

module.exports = Activity;
