const mongoose = require("mongoose");

const { USER_STATUSES } = require("../constants/nexus");

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 120
        },

        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },

        password: {
            type: String,
            required: true
        },

        role: {
            type: String,
            enum: ["admin", "member"],
            default: "member"
        },

        title: {
            type: String,
            trim: true,
            maxlength: 80,
            default: ""
        },

        department: {
            type: String,
            trim: true,
            maxlength: 80,
            default: ""
        },

        avatar: {
            type: String,
            trim: true,
            maxlength: 4,
            default: ""
        },

        status: {
            type: String,
            enum: USER_STATUSES,
            default: "Offline"
        },

        // Bumped whenever the password changes. It is embedded in every issued
        // JWT and compared on use, so a reset immediately kills every session
        // that was signed with the old password.
        tokenVersion: {
            type: Number,
            default: 0
        },

        // Set by POST /auth/verify-email. Intentionally not part of the
        // frontend User contract, so it is not serialized.
        emailVerified: {
            type: Boolean,
            default: false
        },

        emailVerifiedAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true
    }
);

const User = mongoose.model("User", userSchema);

module.exports = User;
