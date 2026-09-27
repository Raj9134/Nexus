const mongoose = require("mongoose");

/**
 * A support request raised from the sidebar's "Help & Support" control.
 *
 * The button used to show a "Support team has been notified" toast and send
 * nothing, so the message was never recorded anywhere. Requests are stored
 * rather than emailed, because the backend has no mail transport configured by
 * default and a request that silently vanished was worse than none.
 */
const supportRequestSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        organization: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Organization",
            default: null
        },

        subject: {
            type: String,
            required: true,
            trim: true,
            maxlength: 200
        },

        message: {
            type: String,
            required: true,
            trim: true,
            maxlength: 5000
        },

        status: {
            type: String,
            enum: ["open", "closed"],
            default: "open"
        },

        // The page the user was on, so a report about a broken screen carries
        // the route that was broken.
        page: {
            type: String,
            trim: true,
            maxlength: 200,
            default: ""
        }
    },
    { timestamps: true }
);

// The owner's own list, newest first.
supportRequestSchema.index({ user: 1, createdAt: -1 });

module.exports =
    mongoose.models.SupportRequest || mongoose.model("SupportRequest", supportRequestSchema);
