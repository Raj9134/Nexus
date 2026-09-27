const mongoose = require("mongoose");
const Call = require("../models/Call");
const User = require("../models/User");
const { createNotification } = require("../services/notificationService");
const { isValidObjectId } = require("../services/permissionService");
const { serializeCall } = require("../utils/serialize");

/*
    Every call response goes out through serializeCall, and always with both
    parties populated. A freshly saved document still holds bare ObjectIds, so
    without this the caller would get back a peer it cannot name.
*/
const withParties = (call) =>
    Call.findById(call._id)
        .populate("caller", "name email")
        .populate("receiver", "name email");

const createCall = async (req, res) => {

try {

    const caller = req.userId;
    const { receiver } = req.body;

    if (!receiver) {

        return res.status(400).json({
            message: "Receiver is required"
        });

    }

    if (!mongoose.Types.ObjectId.isValid(receiver)) {

        return res.status(400).json({
            message: "Invalid receiver ID"
        });

    }

    if (caller === receiver) {

        return res.status(400).json({
            message: "You cannot call yourself"
        });

    }

    const receiverUser = await User.findById(receiver);

    if (!receiverUser) {

        return res.status(404).json({
            message: "Receiver user not found"
        });

    }

    const call = await Call.create({

        caller: caller,
        receiver: receiver,
        status: "calling"

    });

    const io = req.app.get("io");

    await createNotification({
        user: receiver,
        type: "call",
        title: "Incoming call",
        message: "You have an incoming voice call",
        relatedId: call._id,
        io: io
    });

    res.status(201).json({

        message: "Call created successfully",

        call: serializeCall(await withParties(call))

    });

} catch (error) {

    console.log("Error creating call:", error.message);

    res.status(500).json({

        message: "Server error"

    });

}

};

const acceptCall = async (req, res) => {

try {

    const { callId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(callId)) {

        return res.status(400).json({
            message: "Invalid call ID"
        });

    }

    const call = await Call.findById(callId);

    if (!call) {

        return res.status(404).json({
            message: "Call not found"
        });

    }

    if (call.receiver.toString() !== req.userId) {

        return res.status(403).json({
            message: "You are not the receiver of this call"
        });

    }

    if (call.status !== "calling") {

        return res.status(400).json({
            message: "Call cannot be accepted"
        });

    }

    call.status = "accepted";
    call.startedAt = new Date();

    await call.save();

    const io = req.app.get("io");

    await createNotification({
        user: call.caller,
        type: "call",
        title: "Call accepted",
        message: "Your voice call was accepted",
        relatedId: call._id,
        io: io
    });

    res.status(200).json({

        message: "Call accepted successfully",

        call: serializeCall(await withParties(call))

    });

} catch (error) {

    console.log("Error accepting call:", error.message);

    res.status(500).json({
        message: "Server error"
    });

}

};

const rejectCall = async (req, res) => {

try {

    const { callId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(callId)) {

        return res.status(400).json({
            message: "Invalid call ID"
        });

    }

    const call = await Call.findById(callId);

    if (!call) {

        return res.status(404).json({
            message: "Call not found"
        });

    }

    if (call.receiver.toString() !== req.userId) {

        return res.status(403).json({
            message: "You are not the receiver of this call"
        });

    }

    if (call.status !== "calling") {

        return res.status(400).json({
            message: "Call cannot be rejected"
        });

    }

    call.status = "rejected";

    await call.save();

    const io = req.app.get("io");

    await createNotification({
        user: call.caller,
        type: "call",
        title: "Call rejected",
        message: "Your voice call was rejected",
        relatedId: call._id,
        io: io
    });

    res.status(200).json({

        message: "Call rejected successfully",

        call: serializeCall(await withParties(call))

    });

} catch (error) {

    console.log("Error rejecting call:", error.message);

    res.status(500).json({
        message: "Server error"
    });

}

};

const missCall = async (req, res) => {

try {

    const { callId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(callId)) {

        return res.status(400).json({
            message: "Invalid call ID"
        });

    }

    const call = await Call.findById(callId);

    if (!call) {

        return res.status(404).json({
            message: "Call not found"
        });

    }

    if (call.receiver.toString() !== req.userId) {

        return res.status(403).json({
            message: "You are not the receiver of this call"
        });

    }

    if (call.status !== "calling") {

        return res.status(400).json({
            message: "Call cannot be marked as missed"
        });

    }

    call.status = "missed";

    await call.save();

    const io = req.app.get("io");

    await createNotification({
        user: call.caller,
        type: "call",
        title: "Call missed",
        message: "Your voice call was missed",
        relatedId: call._id,
        io: io
    });

    res.status(200).json({

        message: "Call marked as missed",

        call: serializeCall(await withParties(call))

    });

} catch (error) {

    console.log(
        "Error marking call as missed:",
        error.message
    );

    res.status(500).json({
        message: "Server error"
    });

}

};

const endCall = async (req, res) => {

try {

    const { callId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(callId)) {

        return res.status(400).json({
            message: "Invalid call ID"
        });

    }

    const call = await Call.findById(callId);

    if (!call) {

        return res.status(404).json({
            message: "Call not found"
        });

    }

    const userId = req.userId;

    if (
        call.caller.toString() !== userId &&
        call.receiver.toString() !== userId
    ) {

        return res.status(403).json({
            message: "You are not part of this call"
        });

    }

    if (
        call.status !== "accepted" &&
        call.status !== "calling"
    ) {

        return res.status(400).json({
            message: "Call cannot be ended"
        });

    }

    call.status = "ended";
    call.endedAt = new Date();

    if (call.startedAt) {

        call.duration = Math.floor(
            (call.endedAt - call.startedAt) / 1000
        );

    }

    await call.save();

    res.status(200).json({

        message: "Call ended successfully",

        call: serializeCall(await withParties(call))

    });

} catch (error) {

    console.log("Error ending call:", error.message);

    res.status(500).json({
        message: "Server error"
    });

}

};

const getMyCalls = async (req, res) => {

try {

    const userId = req.userId;

    const calls = await Call.find({

        $or: [
            { caller: userId },
            { receiver: userId }
        ]

    })
    .populate("caller", "name email")
    .populate("receiver", "name email")
    .sort({ createdAt: -1 });

    res.status(200).json({

        message: "Call history fetched successfully",

        calls: calls.map(serializeCall)

    });

} catch (error) {

    console.log("Error fetching call history:", error.message);

    res.status(500).json({

        message: "Server error"

    });

}

};

const getCallById = async (req, res) => {

    try {

        const { callId } = req.params;

        // Matches getEvent: a GET for something that cannot exist is a 404,
        // not a 400. Callers only ever send ids the socket handed them.
        if (!isValidObjectId(callId)) {

            return res.status(404).json({
                message: "Call not found"
            });

        }

    const call = await Call.findById(callId)
        .populate("caller", "name email")
        .populate("receiver", "name email");

    if (!call) {

        return res.status(404).json({
            message: "Call not found"
        });

    }

    const userId = req.userId;

    if (
        call.caller._id.toString() !== userId &&
        call.receiver._id.toString() !== userId
    ) {

        return res.status(403).json({
            message: "You are not part of this call"
        });

    }

    res.status(200).json({

        message: "Call fetched successfully",

        call: serializeCall(call)

    });

} catch (error) {

    console.log("Error fetching call:", error.message);

    res.status(500).json({
        message: "Server error"
    });

}

};

module.exports = {
    createCall,
    acceptCall,
    rejectCall,
    missCall,
    endCall,
    getMyCalls,
    getCallById
};