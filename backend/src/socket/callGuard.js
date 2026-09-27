const mongoose = require("mongoose");

const Call = require("../models/Call");


/*
    Call document hi WebRTC signaling ka source of truth hai.
    Client ke bheje caller/receiver ko kabhi trust nahi karte,
    warna koi bhi teesra user kisi aur call me SDP/ICE inject kar sakta hai.
*/
const resolveCallPeer = async (callId, userId) => {

    if (
        !callId ||
        !mongoose.isValidObjectId(callId)
    ) {
        return {
            ok: false,
            reason: "invalid"
        };
    }

    const call = await Call.findById(callId)
        .select("caller receiver status")
        .lean();

    if (!call) {
        return {
            ok: false,
            reason: "notFound"
        };
    }

    const callerId = call.caller.toString();
    const receiverId = call.receiver.toString();

    if (callerId === userId) {
        return {
            ok: true,
            call: call,
            role: "caller",
            peerId: receiverId
        };
    }

    if (receiverId === userId) {
        return {
            ok: true,
            call: call,
            role: "receiver",
            peerId: callerId
        };
    }

    return {
        ok: false,
        reason: "forbidden"
    };

};


module.exports = {
    resolveCallPeer
};
