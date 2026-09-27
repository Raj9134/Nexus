const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Organization = require("../models/Organization");

const auditService = require("../services/auditService");
const authTokens = require("../models/AuthToken");
const emailService = require("../services/emailService");
const { listUsers, userStats, accessibleOrganizationIds } = require("../services/workspaceService");
const { serializeUser } = require("../utils/serialize");
const { USER_STATUSES } = require("../constants/nexus");

const ACCESS_TOKEN_TTL = "1d";
const REFRESH_TOKEN_TTL = "7d";
const NAME_MAX = 120;

const cleanText = (value) => {
    return typeof value === "string" ? value.trim() : "";
};

// tokenVersion is embedded in every token, so bumping it on the user
// invalidates everything that was signed before the change.
const signAccessToken = (user) => {
    return jwt.sign(
        {
            userId: String(user._id),
            type: "access",
            tokenVersion: Number(user.tokenVersion) || 0
        },
        process.env.JWT_SECRET,
        { expiresIn: ACCESS_TOKEN_TTL }
    );
};

const signRefreshToken = (user) => {
    return jwt.sign(
        {
            userId: String(user._id),
            type: "refresh",
            tokenVersion: Number(user.tokenVersion) || 0
        },
        process.env.JWT_SECRET,
        { expiresIn: REFRESH_TOKEN_TTL }
    );
};

const buildSession = async (user) => {
    return {
        token: signAccessToken(user),
        refreshToken: signRefreshToken(user),
        user: serializeUser(user, await userStats(user._id))
    };
};

const registerUser = async (req, res) => {
    try {
        if (!req.body.name || !req.body.email || !req.body.password) {
            return res.status(400).json({
                message: "Name, email and password are required"
            });
        }

        if (req.body.password.length < 8) {
            return res.status(400).json({
                message: "Password must be at least 8 characters long"
            });
        }

        const email = cleanText(req.body.email).toLowerCase();
        const name = cleanText(req.body.name);

        if (!name) {
            return res.status(400).json({ message: "Name cannot be empty" });
        }

        if (name.length > NAME_MAX) {
            return res.status(400).json({
                message: `Name cannot exceed ${NAME_MAX} characters`
            });
        }

        if (!email.includes("@") || !email.includes(".")) {
            return res.status(400).json({ message: "Please enter a valid email" });
        }

        const existingUser = await User.findOne({ email });

        if (existingUser) {
            return res.status(409).json({ message: "Email already registered" });
        }

        const hashedPassword = await bcrypt.hash(req.body.password, 10);
        const status = USER_STATUSES.includes(req.body.status)
            ? req.body.status
            : "Offline";

        const user = await User.create({
            name,
            email,
            password: hashedPassword,
            title: cleanText(req.body.title).slice(0, 80),
            department: cleanText(req.body.department).slice(0, 80),
            avatar: cleanText(req.body.avatar).slice(0, 4),
            status
        });

        await auditService.record({
            req,
            user: user._id,
            userName: user.name,
            action: "Registered",
            resource: user.email,
            resourceId: String(user._id),
            status: "Success",
            detail: "Account created"
        });

        // Send the verification link straight away so a new account does not
        // have to ask for one. Delivery is best-effort and never blocks signup.
        let verificationToken = null;

        try {
            verificationToken = await authTokens.issue(user._id, "email_verification");

            await emailService.send("email_verification", {
                to: user.email,
                token: verificationToken,
                name: user.name
            });
        } catch (error) {
            console.error(`[auth] could not issue verification for ${user.email}: ${error.message}`);
        }

        return res.status(201).json({
            message: "User registered successfully",
            ...(await buildSession(user)),
            ...(verificationToken && process.env.NODE_ENV !== "production"
                ? { verificationToken }
                : {})
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ message: "Email already registered" });
        }

        return res.status(500).json({
            message: "User registration failed",
            error: error.message
        });
    }
};

const loginUser = async (req, res) => {
    try {
        if (!req.body.email || !req.body.password) {
            return res.status(400).json({
                message: "Email and password are required"
            });
        }

        const email = cleanText(req.body.email).toLowerCase();
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        const isPasswordCorrect = await bcrypt.compare(req.body.password, user.password);

        if (!isPasswordCorrect) {
            await auditService.record({
                req,
                action: "Blocked login",
                resource: email,
                status: "Blocked",
                detail: "Invalid credentials"
            });

            return res.status(401).json({ message: "Invalid email or password" });
        }

        user.status = "Online";

        await user.save();

        await auditService.record({
            req,
            user: user._id,
            userName: user.name,
            action: "Logged in",
            resource: user.email,
            resourceId: String(user._id),
            status: "Success",
            detail: "Session started"
        });

        return res.status(200).json({
            message: "Login successful",
            ...(await buildSession(user))
        });
    } catch (error) {
        return res.status(500).json({
            message: "Login failed",
            error: error.message
        });
    }
};

const getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.userId).select("-password");

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        return res.status(200).json({
            name: user.name,
            email: user.email,
            user: serializeUser(user, await userStats(user._id))
        });
    } catch (error) {
        return res.status(500).json({
            message: "Failed to get profile",
            error: error.message
        });
    }
};

const getMe = async (req, res) => {
    const user = await User.findById(req.userId).select("-password");

    if (!user) {
        return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
        user: serializeUser(user, await userStats(user._id))
    });
};

const refreshSession = async (req, res) => {
    const token = req.body.refreshToken
        || (req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();

    if (!token) {
        return res.status(400).json({ message: "refreshToken is required" });
    }

    let payload;

    try {
        payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
        return res.status(401).json({ message: "Invalid or expired refresh token" });
    }

    if (payload.type !== "refresh") {
        return res.status(401).json({ message: "A refresh token is required" });
    }

    const user = await User.findById(payload.userId).select("-password");

    if (!user) {
        return res.status(401).json({ message: "User no longer exists" });
    }

    // Same retirement rule as the access token: a refresh issued before a
    // password reset must not be able to mint a new session afterwards.
    if ((Number(payload.tokenVersion) || 0) !== (Number(user.tokenVersion) || 0)) {
        return res.status(401).json({
            message: "Session expired, please sign in again"
        });
    }

    return res.status(200).json({
        message: "Session refreshed",
        ...(await buildSession(user))
    });
};

const logoutUser = async (req, res) => {
    const user = await User.findById(req.userId).select("-password");

    if (user && user.status === "Online") {
        user.status = "Offline";

        await user.save();
    }

    await auditService.record({
        req,
        user: user ? user._id : null,
        userName: user ? user.name : "",
        action: "Logged out",
        resource: user ? user.email : "",
        status: "Success",
        detail: "Session ended"
    });

    return res.status(200).json({ message: "Logged out successfully" });
};

/**
 * Admin-only. Scoped to the organizations the admin actually belongs to,
 * so one admin cannot enumerate every account in the deployment.
 */
const getAllUsers = async (req, res) => {
    try {
        /*
            The gate used to be a global user.role that nothing ever set, so
            this answered 403 for every account including workspace owners.
            Owning at least one workspace is the admin concept the rest of the
            permission service already uses.
        */
        const owned = await Organization.exists({
            _id: { $in: await accessibleOrganizationIds(req.user) },
            createdBy: req.user._id
        });

        if (!owned) {
            return res.status(403).json({
                message: "Administrator access required"
            });
        }

        const users = await listUsers(req.user);

        return res.status(200).json({
            message: "Users fetched successfully",
            count: users.length,
            users
        });
    } catch (error) {
        return res.status(500).json({
            message: "Failed to get users",
            error: error.message
        });
    }
};

const updateMyProfile = async (req, res) => {
    const user = await User.findById(req.userId).select("-password");

    if (!user) {
        return res.status(404).json({ message: "User not found" });
    }

    if (req.body.name !== undefined) {
        const name = cleanText(req.body.name);

        if (!name) {
            return res.status(400).json({ message: "Name cannot be empty" });
        }

        user.name = name.slice(0, NAME_MAX);
    }

    if (req.body.title !== undefined) {
        user.title = cleanText(req.body.title).slice(0, 80);
    }

    if (req.body.department !== undefined) {
        user.department = cleanText(req.body.department).slice(0, 80);
    }

    if (req.body.avatar !== undefined) {
        user.avatar = cleanText(req.body.avatar).slice(0, 4);
    }

    if (req.body.status !== undefined) {
        if (!USER_STATUSES.includes(req.body.status)) {
            return res.status(400).json({
                message: `Status must be one of: ${USER_STATUSES.join(", ")}`
            });
        }

        user.status = req.body.status;
    }

    if (req.body.password !== undefined) {
        if (req.body.password.length < 8) {
            return res.status(400).json({
                message: "Password must be at least 8 characters long"
            });
        }

        user.password = await bcrypt.hash(req.body.password, 10);
        // A self-service password change also ends every other session.
        user.tokenVersion = (Number(user.tokenVersion) || 0) + 1;
    }

    await user.save();

    await auditService.record({
        req,
        user: user._id,
        userName: user.name,
        action: "Updated profile",
        resource: user.email,
        resourceId: String(user._id),
        status: "Success",
        detail: "Profile updated"
    });

    return res.status(200).json({
        message: "Profile updated successfully",
        user: serializeUser(user, await userStats(user._id))
    });
};

/**
 * Always answers 200 so the endpoint cannot be used to enumerate accounts.
 * The reset link is emailed. When no mail provider is configured the token is
 * also returned to the caller, and in production it is only logged, so the
 * account can still be recovered without leaking it over the wire.
 */
const forgotPassword = async (req, res) => {
    const email = cleanText(req.body.email).toLowerCase();
    const response = {
        message: "If an account exists for that email, a reset link has been sent."
    };

    if (!email) {
        return res.status(200).json(response);
    }

    const user = await User.findOne({ email: email });

    if (!user) {
        return res.status(200).json(response);
    }

    const token = await authTokens.issue(user._id, "password_reset");
    const delivery = await emailService.send("password_reset", {
        to: user.email,
        token,
        name: user.name
    });

    if (!delivery.delivered) {
        console.log(`[auth] password reset token for ${email}: ${token}`);
    }

    // The dev shortcut is only safe while there is no real mail provider.
    if (process.env.NODE_ENV !== "production" && !emailService.isConfigured()) {
        response.devToken = token;
    }

    return res.status(200).json(response);
};

const resetPassword = async (req, res) => {
    const token = typeof req.body.token === "string" ? req.body.token.trim() : "";
    const password = typeof req.body.password === "string" ? req.body.password : "";
    const invalid = {
        message: "This reset link is invalid or has expired. Please request a new one."
    };

    if (!token) {
        return res.status(400).json(invalid);
    }

    if (password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters long" });
    }

    // Claimed atomically, so a token cannot be spent twice by a race.
    const doc = await authTokens.consume(token, "password_reset");

    if (!doc) {
        return res.status(400).json(invalid);
    }

    const user = await User.findById(doc.user);

    if (!user) {
        return res.status(400).json(invalid);
    }

    user.password = await bcrypt.hash(password, 10);
    // Kills every session issued with the old password.
    user.tokenVersion = (Number(user.tokenVersion) || 0) + 1;

    await user.save();

    // Every other outstanding reset link dies with this one.
    await authTokens.AuthToken.deleteMany({
        user: user._id,
        purpose: "password_reset",
        usedAt: null
    });

    await auditService.record({
        req,
        user: user._id,
        userName: user.name,
        action: "Reset password",
        resource: user.email,
        resourceId: String(user._id),
        status: "Success",
        detail: "Password reset completed"
    });

    return res.status(200).json({ message: "Password updated successfully" });
};

const requestEmailVerification = async (req, res) => {
    const email = cleanText(req.body.email).toLowerCase();
    const response = {
        message: "If an account exists for that email, a verification link has been sent."
    };

    if (!email) {
        return res.status(200).json(response);
    }

    const user = await User.findOne({ email: email });

    if (!user) {
        return res.status(200).json(response);
    }

    const token = await authTokens.issue(user._id, "email_verification");
    const delivery = await emailService.send("email_verification", {
        to: user.email,
        token,
        name: user.name
    });

    if (!delivery.delivered) {
        console.log(`[auth] email verification token for ${email}: ${token}`);
    }

    if (process.env.NODE_ENV !== "production" && !emailService.isConfigured()) {
        response.devToken = token;
    }

    return res.status(200).json(response);
};

const verifyEmail = async (req, res) => {
    const token = typeof req.body.token === "string" ? req.body.token.trim() : "";

    if (!token) {
        return res.status(400).json({ message: "A verification token is required" });
    }

    const doc = await authTokens.consume(token, "email_verification");

    if (!doc) {
        return res.status(400).json({
            message: "This verification link is invalid or has expired."
        });
    }

    const user = await User.findById(doc.user);

    if (!user) {
        return res.status(400).json({
            message: "This verification link is invalid or has expired."
        });
    }

    user.emailVerified = true;
    user.emailVerifiedAt = new Date();

    await user.save();

    await auditService.record({
        req,
        user: user._id,
        userName: user.name,
        action: "Verified email",
        resource: user.email,
        resourceId: String(user._id),
        status: "Success",
        detail: "Email address verified"
    });

    return res.status(200).json({ message: "Email verified successfully" });
};

module.exports = {
    registerUser,
    loginUser,
    getProfile,
    getMe,
    refreshSession,
    logoutUser,
    getAllUsers,
    updateMyProfile,
    forgotPassword,
    resetPassword,
    requestEmailVerification,
    verifyEmail
};
