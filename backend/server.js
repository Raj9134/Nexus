require("dotenv").config();

const http = require("http");

const { Server } = require("socket.io");

const app = require("./src/app");
const connectDatabase = require("./src/config/db");
const emailService = require("./src/services/emailService");
const Message = require("./src/models/Message");
const User = require("./src/models/User");
const { socketAuthMiddleware } = require("./src/socket/socketAuth");
const { resolveCallPeer } = require("./src/socket/callGuard");
const { checkChannelAccess } = require("./src/services/permissionService");
/*
    Railway, Render, Fly and Heroku all assign a port at deploy time and pass it
    in PORT. Hardcoding 5000 meant the server listened where it was told not to,
    the health check never passed, and the deploy failed with a timeout that says
    nothing about the cause.
*/
const PORT = Number(process.env.PORT) || 5000;

const HOST = process.env.HOST || "0.0.0.0";

const MAX_MESSAGE_LENGTH = 2000;
const MAX_SDP_LENGTH = 20000;
const MAX_ICE_CANDIDATE_LENGTH = 2000;
const server = http.createServer(app);



const isValidUserId = (value) => typeof value === "string" && /^[a-fA-F0-9]{24}$/.test(value);

const readUserId = (value) => {

    if (typeof value !== "string") {
        return null;
    }

    const trimmed = value.trim();

    if (!isValidUserId(trimmed)) {
        return null;
    }

    return trimmed;

};

const readText = (value, maxLength) => {

    if (typeof value !== "string") {
        return null;
    }

    const trimmed = value.trim();

    if (!trimmed || trimmed.length > maxLength) {
        return null;
    }

    return trimmed;

};

const readPayload = (value) => {

    if (!value || typeof value !== "object") {
        return {};
    }

    return value;

};


/*
    Wildcard origin hataya gaya.
    CLIENT_ORIGIN env se allow-list lo, aur development me
    localhost ke kisi bhi port ko jaane do.
*/
const allowedOrigins = (process.env.CLIENT_ORIGIN || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

const checkCorsOrigin = (origin, callback) => {

    if (!origin) {
        return callback(null, true);
    }

    if (allowedOrigins.includes("*")) {
        return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
        return callback(null, true);
    }

    if (process.env.NODE_ENV !== "production") {
        try {
            const parsed = new URL(origin);

            if (
                parsed.hostname === "localhost" ||
                parsed.hostname === "127.0.0.1"
            ) {
                return callback(null, true);
            }

        } catch (error) {
            return callback(null, false);
        }
    }

    return callback(
        new Error("Origin not allowed by CORS"),
        false
    );

};


const io = new Server(server, {
    cors: {
        origin: checkCorsOrigin,
        methods: ["GET", "POST"]
    }
});


io.use(socketAuthMiddleware);


app.set("io", io);

/*
    REST routes app.js me already mounted hain
    (search aur files bhi), isliye yahan duplicate mount nahi karte.
*/


/*
    Ek user ke kai tabs ya kai devices ho sakte hain,
    isliye online/offline tab count se decide karte hain.
*/
const onlineSockets = new Map();

const addOnlineSocket = (userId, socketId) => {

    const existing = onlineSockets.get(userId);

    if (!existing) {
        onlineSockets.set(userId, new Set([socketId]));
        return true;
    }

    existing.add(socketId);

    return false;

};

const removeOnlineSocket = (userId, socketId) => {

    const existing = onlineSockets.get(userId);

    if (!existing) {
        return false;
    }

    existing.delete(socketId);

    if (existing.size > 0) {
        return false;
    }

    onlineSockets.delete(userId);

    return true;

};

const userIsOnline = (userId) => onlineSockets.has(userId);


const emitError = (socket, message) => {

    socket.emit(
        "socketError",
        {
            message: message
        }
    );

    console.log(
        `Socket error (${socket.data.userId || "unknown"}):`,
        message
    );

};


io.on("connection", (socket) => {

    const currentUserId = socket.data.userId;

    socket.join(currentUserId);

    const becameOnline = addOnlineSocket(
        currentUserId,
        socket.id
    );

    if (becameOnline) {
        io.emit(
            "userOnline",
            {
                userId: currentUserId
            }
        );
    }

    console.log(
        "User connected:",
        currentUserId,
        `(${socket.id})`
    );


    /* Backward compatibility: ab identity server se aati hai, payload se nahi. */

    socket.on("joinRoom", () => {

        socket.join(currentUserId);

    });


    /*
        Channel messages `io.to("channel:<name>")` par emit hote hain,
        isliye client ko room join karna hi padta warna wo event
        kabhi kisi tak nahi pahunchega. Private channel ke liye
        wahi permission check chalta hai jo REST par lagta hai.
    */
    socket.on("joinChannel", async (rawData) => {

        const data = readPayload(rawData);

        const channelName = readText(
            typeof data.channel === "string"
                ? data.channel.trim().toLowerCase()
                : "",
            80
        );

        if (!channelName) {
            return;
        }

        try {
            const user = await User.findById(currentUserId).lean();

            if (!user) {
                return;
            }

            const access = await checkChannelAccess(channelName, user);

            if (!access.allowed) {
                return emitError(
                    socket,
                    "You are not allowed to join this channel"
                );
            }

            socket.join(`channel:${channelName}`);

        } catch (error) {
            emitError(
                socket,
                "Could not join channel"
            );
        }

    });


    socket.on("leaveChannel", (rawData) => {

        const data = readPayload(rawData);

        const channelName = readText(
            typeof data.channel === "string"
                ? data.channel.trim().toLowerCase()
                : "",
            80
        );

        if (channelName) {
            socket.leave(`channel:${channelName}`);
        }

    });


    socket.on("callUser", async (rawData) => {

        const data = readPayload(rawData);

        /*
            Sirf usi user ko ring kar sakte ho jiska Call record
            MongoDB me us callId ke liye caller bana hua hai.
            Warna koi bhi fake callId bana ke kisi ko ring kar sakta tha.
        */
        const guard = await resolveCallPeer(
            data.callId,
            currentUserId
        );

        if (!guard.ok) {
            return emitError(
                socket,
                "Not allowed to place this call"
            );
        }

        if (guard.role !== "caller") {
            return emitError(
                socket,
                "Only the call creator can place this call"
            );
        }

        io.to(guard.peerId).emit(
            "incomingCall",
            {
                callId: data.callId,
                caller: currentUserId,
                receiver: guard.peerId
            }
        );

    });


    socket.on("callAccepted", async (rawData) => {

        const data = readPayload(rawData);

        const guard = await resolveCallPeer(
            data.callId,
            currentUserId
        );

        if (!guard.ok) {
            return emitError(
                socket,
                "Not allowed to accept this call"
            );
        }

        io.to(guard.peerId).emit(
            "callAccepted",
            {
                callId: data.callId,
                receiver: currentUserId
            }
        );

    });


    socket.on("callRejected", async (rawData) => {

        const data = readPayload(rawData);

        const guard = await resolveCallPeer(
            data.callId,
            currentUserId
        );

        if (!guard.ok) {
            return emitError(
                socket,
                "Not allowed to reject this call"
            );
        }

        io.to(guard.peerId).emit(
            "callRejected",
            {
                callId: data.callId,
                receiver: currentUserId
            }
        );

    });


    socket.on("callMissed", async (rawData) => {

        const data = readPayload(rawData);

        const guard = await resolveCallPeer(
            data.callId,
            currentUserId
        );

        if (!guard.ok) {
            return emitError(
                socket,
                "Not allowed to report this call"
            );
        }

        io.to(guard.peerId).emit(
            "callMissed",
            {
                callId: data.callId,
                caller: currentUserId,
                receiver: guard.peerId
            }
        );

    });


    socket.on("webrtcOffer", async (rawData) => {

        const data = readPayload(rawData);

        const offer = readText(
            data.offer,
            MAX_SDP_LENGTH
        );

        if (!offer) {
            return emitError(
                socket,
                "Invalid WebRTC offer"
            );
        }

        const guard = await resolveCallPeer(
            data.callId,
            currentUserId
        );

        if (!guard.ok) {
            return emitError(
                socket,
                "Not allowed to send offer on this call"
            );
        }

        io.to(guard.peerId).emit(
            "webrtcOffer",
            {
                callId: data.callId,
                caller: currentUserId,
                receiver: guard.peerId,
                offer: offer
            }
        );

    });


    socket.on("webrtcAnswer", async (rawData) => {

        const data = readPayload(rawData);

        const answer = readText(
            data.answer,
            MAX_SDP_LENGTH
        );

        if (!answer) {
            return emitError(
                socket,
                "Invalid WebRTC answer"
            );
        }

        const guard = await resolveCallPeer(
            data.callId,
            currentUserId
        );

        if (!guard.ok) {
            return emitError(
                socket,
                "Not allowed to send answer on this call"
            );
        }

        io.to(guard.peerId).emit(
            "webrtcAnswer",
            {
                callId: data.callId,
                receiver: currentUserId,
                answer: answer
            }
        );

    });


    socket.on("iceCandidate", async (rawData) => {

        const data = readPayload(rawData);

        const candidate = readText(
            data.candidate,
            MAX_ICE_CANDIDATE_LENGTH
        );

        if (!candidate) {
            return emitError(
                socket,
                "Invalid ICE candidate"
            );
        }

        const guard = await resolveCallPeer(
            data.callId,
            currentUserId
        );

        if (!guard.ok) {
            return emitError(
                socket,
                "Not allowed to send ICE on this call"
            );
        }

        io.to(guard.peerId).emit(
            "iceCandidate",
            {
                callId: data.callId,
                caller: currentUserId,
                receiver: guard.peerId,
                candidate: candidate
            }
        );

    });


    socket.on("endCall", async (rawData) => {

        const data = readPayload(rawData);

        const guard = await resolveCallPeer(
            data.callId,
            currentUserId
        );

        if (!guard.ok) {
            return emitError(
                socket,
                "Not allowed to end this call"
            );
        }

        io.to(guard.peerId).emit(
            "callEnded",
            {
                callId: data.callId
            }
        );

    });


    socket.on("typing", (rawData) => {

        const data = readPayload(rawData);

        const receiver = readUserId(data.receiver);

        if (!receiver || receiver === currentUserId) {
            return;
        }

        io.to(receiver).emit(
            "userTyping",
            {
                sender: currentUserId,
                receiver: receiver
            }
        );

    });


    socket.on("stopTyping", (rawData) => {

        const data = readPayload(rawData);

        const receiver = readUserId(data.receiver);

        if (!receiver || receiver === currentUserId) {
            return;
        }

        io.to(receiver).emit(
            "userStoppedTyping",
            {
                sender: currentUserId,
                receiver: receiver
            }
        );

    });


    socket.on("sendMessage", async (rawData) => {

        try {

            const data = readPayload(rawData);

            const receiver = readUserId(data.receiver);

            if (!receiver || receiver === currentUserId) {
                return emitError(
                    socket,
                    "Invalid message receiver"
                );
            }

            const message = readText(
                data.message,
                MAX_MESSAGE_LENGTH
            );

            if (!message) {
                return emitError(
                    socket,
                    "Message cannot be empty"
                );
            }

            const receiverExists = await User.exists({
                _id: receiver
            });

            if (!receiverExists) {
                return emitError(
                    socket,
                    "Message receiver not found"
                );
            }

            const newMessage = await Message.create({
                sender: currentUserId,
                receiver: receiver,
                messageType: "text",
                message: message
            });

            const populatedMessage = await Message.findById(newMessage._id)
                .populate("sender", "name")
                .populate("receiver", "name")
                .lean();

            io.to(receiver).emit(
                "newMessage",
                populatedMessage
            );

        } catch (error) {

            console.log(
                "Error sending message:",
                error.message
            );

            emitError(
                socket,
                "Failed to send message"
            );

        }

    });


    socket.on("disconnect", () => {

        const wentOffline = removeOnlineSocket(
            currentUserId,
            socket.id
        );

        if (wentOffline) {
            io.emit(
                "userOffline",
                {
                    userId: currentUserId
                }
            );
        }

        console.log(
            "User disconnected:",
            currentUserId,
            `(${socket.id})`
        );

    });

});


const startServer = async () => {

    try {
        await connectDatabase();
    } catch (error) {
        console.error("Startup aborted:", error.message);
        process.exit(1);
    }

    server.listen(PORT, HOST, () => {

        console.log(
            `NEXUS server running on port ${PORT} (${HOST})`
        );

        /*
            Mail is easy to misread as working. With no SMTP settings the server
            logs each message and hands the token back to the browser, so
            "forgot password" appears to succeed while nothing is ever sent.
            Stating the mode on boot makes that visible without having to
            trigger a reset and go looking in the console.

            The mode is reported by asking the server, not by reading the env
            block. A block can be complete and still be wrong: a revoked key, a
            typo in the host, a provider that rejects the login. The previous
            version only checked that the variables were present and announced
            "password resets will be emailed" over a configuration that could
            not send anything -- the exact lie this line exists to prevent, and
            worse than saying nothing, because it is believed.

            verify() is a handshake and an AUTH, then a clean disconnect. Nothing
            is sent to anyone. Bounded so a provider that accepts the connection
            and then stalls cannot hold up startup, which on a free host means a
            service that never becomes healthy.
        */
        if (!emailService.isConfigured()) {
            console.log(
                "Mail: NOT CONFIGURED - reset tokens are logged here and returned to the browser. Set SMTP_HOST and SMTP_PORT in backend/.env to send real email."
            );

            return;
        }

        emailService.verifyTransport()
            .then(() => {
                console.log(
                    `Mail: SMTP via ${process.env.SMTP_HOST} verified, password resets will be emailed`
                );
            })
            .catch((error) => {
                console.warn(
                    `Mail: SMTP via ${process.env.SMTP_HOST} REJECTED (${error.code || error.message}) - password resets will NOT be sent, and the token is returned to the browser. The credentials are wrong, not merely missing.`
                );
            });

    });

};


startServer();
