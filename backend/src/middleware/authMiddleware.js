const jwt = require("jsonwebtoken");
const User = require("../models/User");

const authMiddleware = async (req, res, next) => {

    try {

        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                message: "Access token is required"
            });
        }

        const token = authHeader.split(" ")[1];

        const decodedToken = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        if (decodedToken.type !== "access") {
            return res.status(401).json({
                message: "Access token is required"
            });
        }

        const user = await User.findById(decodedToken.userId)
            .select("-password");

        if (!user) {
            return res.status(401).json({
                message: "User not found"
            });
        }

        // A password reset or a self-service password change bumps tokenVersion,
        // which retires every token signed before that moment. Without this the
        // old session would stay valid until it expired on its own.
        const tokenVersion = Number(decodedToken.tokenVersion) || 0;

        if (tokenVersion !== (Number(user.tokenVersion) || 0)) {
            return res.status(401).json({
                message: "Session expired, please sign in again"
            });
        }

        req.userId = user._id.toString();
        req.userRole = user.role;
        req.user = user;

        next();

    } catch (error) {

        return res.status(401).json({
            message: "Invalid or expired token"
        });

    }
};

module.exports = authMiddleware;
