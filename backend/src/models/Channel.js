const mongoose = require("mongoose");

const channelSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
            maxlength: 64
        },

        description: {
            type: String,
            default: "",
            maxlength: 500
        },

        organization: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Organization",
            required: true
        },

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },

        members: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User"
            }
        ],

        isPrivate: {
            type: Boolean,
            default: false
        }
    },
    {
        timestamps: true
    }
);

channelSchema.index({ organization: 1, name: 1 }, { unique: true });
channelSchema.index({ organization: 1 });

module.exports = mongoose.model("Channel", channelSchema);
