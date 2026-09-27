const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const User = require("../models/User");


const stripBearerPrefix = (value) => {

    return String(value).replace(
        /^Bearer\s+/i,
        ""
    ).trim();

};


const extractToken = (socket) => {

    const handshake = socket.handshake || {};

    const authToken = handshake.auth
        ? handshake.auth.token
        : null;

    if (typeof authToken === "string" && authToken.trim()) {
        return stripBearerPrefix(authToken);
    }

    const authHeader = handshake.headers
        ? handshake.headers.authorization
        : null;

    if (typeof authHeader === "string" && authHeader.trim()) {
        return stripBearerPrefix(authHeader);
    }

    return null;

};


/*
    Socket.IO handshake ke time pe chalata hai.
    Iske pass hone ke bina koi bhi socket event allowed nahi hota,
    isliye har handler ko socket.data.userId par bharosa kar sakte hain.
*/
const socketAuthMiddleware = async (socket, next) => {

    const token = extractToken(socket);

    if (!token) {
        return next(
            new Error("Authentication token is required")
        );
    }

    let decodedToken;

    try {

        decodedToken = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

    } catch (error) {

        return next(
            new Error("Invalid or expired token")
        );

    }

    const tokenUserId = decodedToken
        ? decodedToken.userId
        : null;

    if (
        !decodedToken ||
        decodedToken.type !== "access"
    ) {
        return next(
            new Error("An access token is required")
        );
    }

    if (
        !tokenUserId ||
        !mongoose.isValidObjectId(tokenUserId)
    ) {
        return next(
            new Error("Invalid token payload")
        );
    }

    const user = await User.findById(tokenUserId)
        .select("_id role tokenVersion")
        .lean();

    if (!user) {
        return next(
            new Error("User no longer exists")
        );
    }

    /*
        Password reset ya self-service password change tokenVersion bump karta
        hai, jisse yeh purana socket token retire ho jata hai. Warna socket
        reset ke baad bhi live rehta tha jab tak JWT expire nahi hota.
    */
    const tokenVersion = Number(decodedToken.tokenVersion) || 0;

    if (tokenVersion !== (Number(user.tokenVersion) || 0)) {
        return next(
            new Error("Session expired, please sign in again")
        );
    }

    socket.data.userId = user._id.toString();
    socket.data.userRole = user.role;

    return next();

};


module.exports = {
    socketAuthMiddleware,
    extractToken
};
