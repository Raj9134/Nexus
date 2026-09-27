const mongoose = require("mongoose");

const {
    PROJECT_STATUSES,
    normalizeProjectStatus
} = require("../constants/nexus");

const projectSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 120
        },

        key: {
            type: String,
            trim: true,
            maxlength: 10,
            default: ""
        },

        description: {
            type: String,
            default: "",
            maxlength: 2000
        },

        organization: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Organization",
            required: true
        },

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        members: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User"
            }
        ],

        status: {
            type: String,
            enum: PROJECT_STATUSES,
            default: "Active"
        },

        icon: {
            type: String,
            trim: true,
            maxlength: 4,
            default: ""
        },

        progress: {
            type: Number,
            default: 0,
            min: 0,
            max: 100
        },

        due: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true
    }
);

projectSchema.index({ organization: 1 });
projectSchema.index({ organization: 1, key: 1 });

projectSchema.pre("validate", function () {
    this.status = normalizeProjectStatus(this.status);

    if (typeof this.progress === "number" && !Number.isFinite(this.progress)) {
        this.progress = 0;
    }
});

const Project = mongoose.model("Project", projectSchema);

Project.STATUSES = PROJECT_STATUSES;

module.exports = Project;
