const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
    {
        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        receiver: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },

        channel: {
            type: String,
            trim: true,
            lowercase: true,
            maxlength: 64,
            default: null
        },

        messageType: {
            type: String,
            enum: ["text", "voice", "file"],
            default: "text"
        },

        message: {
            type: String,
            default: ""
        },

        reactions: {
            type: [String],
            default: []
        },

        audioUrl: {
            type: String,
            default: null
        },

        audioFileName: {
            type: String,
            default: null
        },

        duration: {
            type: Number,
            default: null
        },

        file: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "File",
            default: null
        },

        isEdited: {
            type: Boolean,
            default: false
        },

        editedAt: {
            type: Date,
            default: null
        },

        isDeleted: {
            type: Boolean,
            default: false
        },

        deletedAt: {
            type: Date,
            default: null
        },

        isRead: {
            type: Boolean,
            default: false
        },

        readAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true
    }
);

messageSchema.index({ channel: 1, createdAt: -1 });
messageSchema.index({ sender: 1, receiver: 1, createdAt: -1 });

messageSchema.pre("validate", function () {
    if (!this.channel && !this.receiver) {
        this.invalidate("receiver", "A message requires either a channel or a receiver");
    }

    if (Array.isArray(this.reactions)) {
        this.reactions = this.reactions
            .map((reaction) => String(reaction || "").trim())
            .filter(Boolean)
            .slice(0, 20);
    }
});

module.exports = mongoose.model("Message", messageSchema);
