const mongoose = require("mongoose");

const { AUDIT_STATUSES } = require("../constants/nexus");

const auditLogSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },

        userName: {
            type: String,
            default: "",
            maxlength: 120
        },

        organization: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Organization",
            default: null
        },

        action: {
            type: String,
            required: true,
            trim: true,
            maxlength: 120
        },

        resource: {
            type: String,
            default: "",
            maxlength: 200
        },

        resourceId: {
            type: String,
            default: "",
            maxlength: 120
        },

        ip: {
            type: String,
            default: "",
            maxlength: 64
        },

        status: {
            type: String,
            enum: AUDIT_STATUSES,
            default: "Success"
        },

        detail: {
            type: String,
            default: "",
            maxlength: 1000
        }
    },
    {
        timestamps: true
    }
);

auditLogSchema.index({ organization: 1, createdAt: -1 });
auditLogSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
