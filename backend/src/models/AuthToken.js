const crypto = require("crypto");

const mongoose = require("mongoose");

const PURPOSES = ["password_reset", "email_verification"];

const RESET_TTL_MINUTES = 30;
const VERIFICATION_TTL_HOURS = 48;

/**
 * Single-use tokens for password reset and email verification.
 * Only the SHA-256 hash is stored, so a database leak cannot be replayed.
 */
const authTokenSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },

        purpose: {
            type: String,
            enum: PURPOSES,
            required: true
        },

        tokenHash: {
            type: String,
            required: true,
            index: true
        },

        expiresAt: {
            type: Date,
            required: true
        },

        usedAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true
    }
);

// Mongo reaps expired tokens on its own; no cleanup job required.
authTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const AuthToken = mongoose.model("AuthToken", authTokenSchema);

const hashToken = (token) => crypto.createHash("sha256").update(String(token)).digest("hex");

const generateToken = () => crypto.randomBytes(32).toString("hex");

const expiresInMs = (purpose) => {
    if (purpose === "password_reset") {
        return RESET_TTL_MINUTES * 60 * 1000;
    }

    return VERIFICATION_TTL_HOURS * 60 * 60 * 1000;
};

/** Issues a token and returns the plaintext value (the only time it exists in plaintext). */
const issue = async (userId, purpose) => {
    if (!PURPOSES.includes(purpose)) {
        throw new Error(`Unsupported auth token purpose: ${purpose}`);
    }

    // One live token per purpose per user keeps the newest link authoritative.
    await AuthToken.deleteMany({ user: userId, purpose: purpose, usedAt: null });

    const token = generateToken();

    await AuthToken.create({
        user: userId,
        purpose: purpose,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + expiresInMs(purpose))
    });

    return token;
};

/**
 * Atomically claims a live token and marks it used in one operation.
 *
 * findOne + save would let two concurrent requests both read the same unused
 * document and both succeed. findOneAndUpdate with `usedAt: null` in the filter
 * means only the first request matches, so a token is genuinely single-use even
 * under a race.
 *
 * @returns {Promise<object|null>} the claimed document, or null if it was
 *   already used, expired, or unknown.
 */
const consume = async (token, purpose) => {
    if (!token || typeof token !== "string") {
        return null;
    }

    const now = new Date();

    const claimed = await AuthToken.findOneAndUpdate(
        {
            tokenHash: hashToken(token.trim()),
            purpose: purpose,
            usedAt: null,
            expiresAt: { $gt: now }
        },
        { $set: { usedAt: now } },
        { new: true, returnDocument: "after" }
    );

    return claimed || null;
};

/** Kept for callers that need to inspect a token without consuming it. */
const consumeCandidate = async (token, purpose) => {
    if (!token || typeof token !== "string") {
        return null;
    }

    const found = await AuthToken.findOne({
        tokenHash: hashToken(token.trim()),
        purpose: purpose,
        usedAt: null,
        expiresAt: { $gt: new Date() }
    });

    return found || null;
};

const markUsed = async (doc) => {
    doc.usedAt = new Date();

    await doc.save();
};

module.exports = {
    AuthToken,
    PURPOSES,
    RESET_TTL_MINUTES,
    VERIFICATION_TTL_HOURS,
    hashToken,
    generateToken,
    issue,
    consume,
    consumeCandidate,
    markUsed
};
