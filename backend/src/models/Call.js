const mongoose = require("mongoose");

const callSchema = new mongoose.Schema({

    caller: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    receiver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    status: {
        type: String,
        enum: [
            "calling",
            "accepted",
            "rejected",
            "ended",
            "missed"
        ],
        default: "calling"
    },

    startedAt: {
        type: Date
    },

    endedAt: {
        type: Date
    },

    duration: {
        type: Number,
        default: 0
    }

}, {
    timestamps: true
});

const Call = mongoose.model(
    "Call",
    callSchema
);

module.exports = Call;