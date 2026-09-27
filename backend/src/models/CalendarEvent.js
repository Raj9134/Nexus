const mongoose = require("mongoose");

const { EVENT_TYPES } = require("../constants/nexus");

const calendarEventSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 200
        },

        startAt: {
            type: Date,
            required: true
        },

        type: {
            type: String,
            enum: EVENT_TYPES,
            default: "Meeting"
        },

        attendees: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User"
            }
        ],

        notes: {
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
        }
    },
    {
        timestamps: true
    }
);

calendarEventSchema.index({ organization: 1, startAt: 1 });

module.exports = mongoose.model("CalendarEvent", calendarEventSchema);
