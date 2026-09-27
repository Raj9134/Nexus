const mongoose = require("mongoose");

const organizationSchema = new mongoose.Schema({

    name: {
        type: String,
        required: true
    },

    description: {
        type: String
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

    // Emails captured during onboarding that have no account yet. Kept so the
    // intent is not lost; an admin can turn them into members later.
    pendingInvites: [
        {
            type: String,
            lowercase: true,
            trim: true
        }
    ],

    // Free-form onboarding choice, e.g. "Software Development".
    workspaceType: {
        type: String,
        trim: true,
        maxlength: 80,
        default: ""
    }

});

const Organization = mongoose.model(
    "Organization",
    organizationSchema
);

module.exports = Organization;