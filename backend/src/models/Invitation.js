const crypto = require("crypto");

const mongoose = require("mongoose");

const INVITE_TTL_DAYS = 14;

const ROLES = ["admin", "member"];

/**
 * Workspace invitations.
 *
 * An invite is addressed to an email address and holds a single-use token, so
 * the same mechanism covers both cases:
 *  - the invited person already has an account: they sign in, then accept
 *  - they do not: the link sends them to signup and the token survives, because
 *    acceptance only requires the authenticated user's email to match
 *
 * Only the SHA-256 hash of the token is stored, so a database leak cannot be
 * replayed into someone's workspace.
 */
const invitationSchema = new mongoose.Schema(
    {
        organization: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Organization",
            required: true,
            index: true
        },

        email: {
            type: String,
            required: true,
            lowercase: true,
            trim: true
        },

        role: {
            type: String,
            enum: ROLES,
            default: "member"
        },

        tokenHash: {
            type: String,
            required: true,
            index: true
        },

        invitedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        expiresAt: {
            type: Date,
            required: true
        },

        acceptedAt: {
            type: Date,
            default: null
        },

        acceptedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        }
    },
    {
        timestamps: true
    }
);

// Mongo reaps expired invitations on its own.
invitationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Invitation = mongoose.model("Invitation", invitationSchema);

const hashToken = (token) => crypto.createHash("sha256").update(String(token)).digest("hex");

const generateToken = () => crypto.randomBytes(32).toString("hex");

/**
 * Issues one live invitation per (organization, email) and returns the list with
 * plaintext tokens, which is the only time they exist in plaintext.
 *
 * @returns {Promise<Array<{ email: string, token: string, expiresAt: Date }>>}
 */
const issue = async (organizationId, emails, { invitedBy, role = "member" } = {}) => {
    const validRole = ROLES.includes(role) ? role : "member";
    const issued = [];

    for (const email of emails) {
        // Reissuing replaces the old link instead of accumulating dead ones.
        await Invitation.deleteMany({
            organization: organizationId,
            email,
            acceptedAt: null
        });

        const token = generateToken();
        const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

        await Invitation.create({
            organization: organizationId,
            email,
            role: validRole,
            tokenHash: hashToken(token),
            invitedBy,
            expiresAt
        });

        issued.push({ email, token, expiresAt });
    }

    return issued;
};

/** Atomically claims a live invitation so one link can only be spent once. */
const consume = async (token) => {
    if (!token || typeof token !== "string") {
        return null;
    }

    return (
        (await Invitation.findOneAndUpdate(
            {
                tokenHash: hashToken(token.trim()),
                acceptedAt: null,
                expiresAt: { $gt: new Date() }
            },
            { $set: { acceptedAt: new Date() } },
            { new: true, returnDocument: "after" }
        )) || null
    );
};

/** Looks up a live invitation without spending it, so a page can preview it. */
const peek = async (token) => {
    if (!token || typeof token !== "string") {
        return null;
    }

    return (
        (await Invitation.findOne({
            tokenHash: hashToken(token.trim()),
            acceptedAt: null,
            expiresAt: { $gt: new Date() }
        })) || null
    );
};

module.exports = {
    Invitation,
    ROLES,
    INVITE_TTL_DAYS,
    hashToken,
    generateToken,
    issue,
    consume,
    peek
};
