const mongoose = require("mongoose");

const {
    TASK_STATUSES,
    TASK_PRIORITIES,
    normalizeTaskStatus,
    normalizePriority
} = require("../constants/nexus");

const checklistItemSchema = new mongoose.Schema(
    {
        id: {
            type: String,
            required: true,
            maxlength: 64
        },

        label: {
            type: String,
            required: true,
            trim: true,
            maxlength: 200
        },

        done: {
            type: Boolean,
            default: false
        }
    },
    { _id: false }
);

const taskSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 200
        },

        description: {
            type: String,
            default: "",
            maxlength: 5000
        },

        project: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Project",
            required: true
        },

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        assignedTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },

        key: {
            type: String,
            trim: true,
            maxlength: 32,
            default: null
        },

        status: {
            type: String,
            enum: TASK_STATUSES,
            default: "Todo"
        },

        priority: {
            type: String,
            enum: TASK_PRIORITIES,
            default: "Medium"
        },

        labels: {
            type: [String],
            default: []
        },

        checklist: {
            type: [checklistItemSchema],
            default: []
        },

        dueDate: {
            type: Date,
            default: null
        },

        activity: {
            type: [String],
            default: []
        },

        completedAt: {
            type: Date,
            default: null
        },

        order: {
            type: Number,
            default: 0
        }
    },
    {
        timestamps: true
    }
);

taskSchema.index({ project: 1, status: 1 });
taskSchema.index({ assignedTo: 1, status: 1 });
taskSchema.index({ key: 1 }, { unique: true, sparse: true });

taskSchema.pre("validate", function () {
    this.status = normalizeTaskStatus(this.status);
    this.priority = normalizePriority(this.priority);

    if (Array.isArray(this.labels)) {
        this.labels = this.labels
            .map((label) => String(label || "").trim())
            .filter(Boolean)
            .slice(0, 20);
    }
});

const Task = mongoose.model("Task", taskSchema);

Task.STATUSES = TASK_STATUSES;
Task.PRIORITIES = TASK_PRIORITIES;

module.exports = Task;
