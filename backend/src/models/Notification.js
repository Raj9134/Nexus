const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({

    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    type: {
        type: String,
        enum: [
            "message",
            "call",
            "comment",
            "mention",
            "task"
        ],
        required: true
    },

    title: {
        type: String,
        required: true
    },

    message: {
        type: String,
        required: true
    },

    relatedId: {
        type: mongoose.Schema.Types.ObjectId
    },

    isRead: {
        type: Boolean,
        default: false
    },

    readAt: {
        type: Date
    }

}, {
    timestamps: true
});

const Notification = mongoose.model(
    "Notification",
    notificationSchema
);

module.exports = Notification;