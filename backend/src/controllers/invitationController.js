const Organization = require("../models/Organization");
const User = require("../models/User");

const emailService = require("../services/emailService");
const invitations = require("../models/Invitation");
const auditService = require("../services/auditService");

const { serializeOrganization } = require("../utils/serialize");

const {
    checkOrganizationManagement
} = require("../services/permissionService");

const MAX_INVITES = 50;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const deniedMessage = (status, fallback) => {
    return status === 404 ? "Organization not found" : fallback;
};

const cleanText = (value) => {
    return typeof value === "string" ? value.trim() : "";
};

/** Accepts a list or a comma/space separated string, mirroring onboarding. */
const parseEmails = (value) => {
    const source = Array.isArray(value)
        ? value
        : cleanText(value).split(/[\s,;]+/);

    const unique = [];

    for (const entry of source) {
        const email = cleanText(entry).toLowerCase();

        if (email.length <= 254 && EMAIL_PATTERN.test(email) && !unique.includes(email)) {
            unique.push(email);
        }
    }

    return unique.slice(0, MAX_INVITES);
};

/** The inviter's display name is embedded in the email body. */
const getInviterName = async (userId) => {
    const inviter = await User.findById(userId).select("name");

    return inviter ? inviter.name : "A teammate";
};

const dispatchInvites = async (organization, emails, inviterId) => {
    const issued = await invitations.issue(organization._id, emails, { invitedBy: inviterId });
    const inviterName = await getInviterName(inviterId);

    // Delivery is best effort, so one bad address cannot abort the batch.
    for (const invite of issued) {
        await emailService.send("workspace_invite", {
            to: invite.email,
            token: invite.token,
            organization: organization.name,
            inviter: inviterName
        });
    }

    return issued;
};

/**
 * Issues (or reissues) invitations for an organization.
 * The plaintext token is echoed back only when there is no mail provider, which
 * is what the local dev UI uses to test the accept flow without a mailbox.
 */
const createInvites = async (req, res) => {
    const access = await checkOrganizationManagement(
        req.params.id,
        req.userId
    );

    if (!access.allowed) {
        return res.status(access.status).json({
            message: deniedMessage(
                access.status,
                "You are not allowed to invite members"
            )
        });
    }

    const emails = parseEmails(
        req.body.emails !== undefined ? req.body.emails : req.body.email
    );

    if (!emails.length) {
        return res.status(400).json({
            message: "Provide at least one valid email address"
        });
    }

    const organization = access.organization;
    const members = await User.find({ _id: { $in: organization.members } }).select("email");
    const memberEmails = new Set(members.map((user) => user.email.toLowerCase()));

    // An address that already has access does not need an invitation.
    const targets = emails.filter((email) => {
        if (memberEmails.has(email)) {
            return false;
        }

        memberEmails.add(email);

        return true;
    });

    if (!targets.length) {
        return res.status(200).json({
            message: "Everyone listed is already a member",
            invited: [],
            skipped: emails
        });
    }

    const issued = await dispatchInvites(organization, targets, req.userId);
    const inviterName = await getInviterName(req.userId);

    organization.pendingInvites = [
        ...new Set([...(organization.pendingInvites || []), ...targets])
    ].slice(0, MAX_INVITES);

    await organization.save();

    await auditService.record({
        req,
        user: req.userId,
        userName: inviterName,
        action: "Invited members",
        resource: organization.name,
        resourceId: String(organization._id),
        status: "Success",
        detail: `${issued.length} invitation(s) sent`
    });

    return res.status(201).json({
        message: "Invitations sent",
        organization: serializeOrganization(organization),
        invited: issued.map((invite) => invite.email),
        skipped: emails.filter((email) => !targets.includes(email)),
        // Dev-only convenience: the local UI needs the link to test acceptance.
        ...(emailService.isConfigured()
            ? {}
            : {
                invitations: issued.map((invite) => ({
                    email: invite.email,
                    token: invite.token,
                    expiresAt: invite.expiresAt
                }))
            })
    });
};

/** Live invitations for an organization, so the UI can show what is pending. */
const listInvites = async (req, res) => {
    const access = await checkOrganizationManagement(
        req.params.id,
        req.userId
    );

    if (!access.allowed) {
        return res.status(access.status).json({
            message: deniedMessage(
                access.status,
                "You are not allowed to view invitations"
            )
        });
    }

    const rows = await invitations.Invitation.find({
        organization: access.organization._id,
        acceptedAt: null,
        expiresAt: { $gt: new Date() }
    })
        .select("email role expiresAt createdAt")
        .sort({ createdAt: -1 })
        .lean();

    return res.status(200).json({
        invitations: rows.map((row) => ({
            email: row.email,
            role: row.role,
            expiresAt: row.expiresAt,
            createdAt: row.createdAt
        }))
    });
};

/**
 * Public preview of an invitation. No auth, because this is exactly what a
 * signed-out recipient needs to see before deciding to sign up. Only the
 * organization name and the role are exposed, never the member list.
 */
const previewInvite = async (req, res) => {
    const token = cleanText(req.params.token);
    const invite = await invitations.peek(token);

    if (!invite) {
        return res.status(404).json({
            message: "This invitation is invalid or has expired"
        });
    }

    const organization = await Organization.findById(invite.organization)
        .select("name workspaceType")
        .lean();

    const inviter = await User.findById(invite.invitedBy).select("name");

    return res.status(200).json({
        organization: organization ? organization.name : "a NEXUS workspace",
        workspaceType: organization ? organization.workspaceType : "",
        role: invite.role,
        inviter: inviter ? inviter.name : "A teammate",
        email: invite.email,
        expiresAt: invite.expiresAt
    });
};

/**
 * Accepts an invitation for the signed-in user.
 *
 * The claim is atomic, so a link cannot be redeemed twice. The email check is
 * deliberate: an invitation is addressed to a specific address, and letting
 * anyone who holds the link attach their own account would defeat the point.
 */
const acceptInvite = async (req, res) => {
    const token = cleanText(req.body.token);
    const user = await User.findById(req.userId);

    if (!token) {
        return res.status(400).json({ message: "An invitation token is required" });
    }

    const invite = await invitations.consume(token);

    if (!invite) {
        return res.status(400).json({
            message: "This invitation is invalid or has already been used"
        });
    }

    if (invite.email !== user.email.toLowerCase()) {
        // Not for this account: give the link back so the owner can still use it.
        await invitations.Invitation.updateOne(
            { _id: invite._id },
            { $set: { acceptedAt: null }, $unset: { acceptedBy: 1 } }
        );

        return res.status(403).json({
            message: `This invitation was sent to ${invite.email}. Sign in with that address to accept it.`
        });
    }

    const organization = await Organization.findById(invite.organization);

    if (!organization) {
        return res.status(404).json({ message: "The workspace no longer exists" });
    }

    if (invite.role === "admin" && !organization.admins.includes(user._id)) {
        organization.admins.push(user._id);
    }

    const isMember = (organization.members || []).some(
        (member) => member.toString() === user._id.toString()
    );

    if (!isMember) {
        organization.members.push(user._id);
    }

    organization.pendingInvites = (organization.pendingInvites || []).filter(
        (email) => email !== invite.email
    );

    await organization.save();

    await invitations.Invitation.updateOne(
        { _id: invite._id },
        { $set: { acceptedBy: user._id } }
    );

    await auditService.record({
        req,
        user: user._id,
        userName: user.name,
        action: "Accepted invitation",
        resource: organization.name,
        resourceId: String(organization._id),
        status: "Success",
        detail: `Joined as ${invite.role}`
    });

    return res.status(200).json({
        message: "Invitation accepted",
        organization: serializeOrganization(organization),
        role: invite.role
    });
};

module.exports = {
    createInvites,
    listInvites,
    previewInvite,
    acceptInvite,
    parseEmails,
    dispatchInvites
};
