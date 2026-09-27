const Organization = require("../models/Organization");
const Project = require("../models/Project");
const User = require("../models/User");

const {
    isValidObjectId,
    checkOrganizationManagement
} = require("../services/permissionService");

const { serializeOrganization, serializeProject } = require("../utils/serialize");

const emailService = require("../services/emailService");
const { dispatchInvites } = require("./invitationController");

const NAME_MAX = 120;
const MAX_INVITES = 50;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const cleanText = (value) => {
    return typeof value === "string" ? value.trim() : "";
};

const parseEmails = (value) => {
    const source = Array.isArray(value)
        ? value
        : typeof value === "string"
            ? value.split(/[\s,;]+/)
            : [];

    const unique = [];

    for (const entry of source) {
        const email = cleanText(entry).toLowerCase();

        if (email && EMAIL_PATTERN.test(email) && !unique.includes(email)) {
            unique.push(email);
        }
    }

    return unique.slice(0, MAX_INVITES);
};

/**
 * First-run workspace setup: creates the organization, applies the workspace
 * type, attaches teammates that already have accounts, remembers the rest as
 * pending invites, and creates the first project.
 */
const completeOnboarding = async (req, res) => {
    const organizationName = cleanText(req.body.organization).slice(0, NAME_MAX);
    const projectName = cleanText(req.body.project).slice(0, NAME_MAX);
    const workspaceType = cleanText(req.body.workspaceType).slice(0, 80);
    const emails = parseEmails(req.body.teammateEmails);

    if (!organizationName) {
        return res.status(400).json({ message: "Organization name is required" });
    }

    if (!projectName) {
        return res.status(400).json({ message: "Project name is required" });
    }

    const userId = req.userId;
    let organization;

    // Reuse an organization this user already owns instead of piling up
    // duplicates when onboarding is retried.
    const owned = await Organization.findOne({ createdBy: userId }).sort({ createdAt: 1 });

    if (owned) {
        const access = await checkOrganizationManagement(owned._id, userId);

        if (!access.allowed) {
            return res.status(403).json({ message: "You cannot configure this organization" });
        }

        organization = access.organization;
        organization.name = organizationName;

        if (workspaceType) {
            organization.workspaceType = workspaceType;
        }
    } else {
        organization = await Organization.create({
            name: organizationName,
            description: workspaceType ? `Workspace type: ${workspaceType}` : "",
            workspaceType: workspaceType,
            createdBy: userId
        });
    }

    const known = await User.find({ email: { $in: emails } }).select("_id email");
    // Keyed by email: these two lists are compared by email, not by id.
    const knownEmails = new Set(known.map((user) => user.email.toLowerCase()));
    const added = [];
    const alreadyMember = new Set(
        (organization.members || []).map((member) => member.toString())
    );

    for (const user of known) {
        const id = user._id.toString();

        if (id === userId || alreadyMember.has(id)) {
            continue;
        }

        organization.members.push(user._id);
        alreadyMember.add(id);
        added.push(user.email);
    }

    const pending = emails.filter((email) => !knownEmails.has(email));
    const existingPending = (organization.pendingInvites || []).filter(
        (email) => !knownEmails.has(email)
    );

    organization.pendingInvites = [...new Set([...existingPending, ...pending])].slice(0, MAX_INVITES);

    await organization.save();

    /*
        Addresses without an account get a real, claimable invitation instead of
        just sitting in pendingInvites forever. Tokens are emailed; with no mail
        provider they come back in the response so the dev UI can still finish
        the flow.
    */
    let issuedInvites = [];

    if (pending.length) {
        try {
            issuedInvites = await dispatchInvites(organization, pending, userId);
        } catch (error) {
            // A mail failure must not undo a completed workspace setup.
            console.error(`[onboarding] invite dispatch failed: ${error.message}`);
        }
    }

    let project = await Project.findOne({
        organization: organization._id,
        createdBy: userId,
        name: projectName
    });

    if (!project) {
        project = await Project.create({
            name: projectName,
            organization: organization._id,
            createdBy: userId,
            description: "",
            status: "Active"
        });
    }

    return res.status(200).json({
        message: "Workspace setup completed",
        organization: serializeOrganization(organization),
        project: serializeProject(project),
        membersAdded: added,
        invitesPending: organization.pendingInvites,
        // Dev-only: lets the local UI drive the accept flow without a mailbox.
        ...(emailService.isConfigured()
            ? {}
            : {
                invitations: issuedInvites.map((invite) => ({
                    email: invite.email,
                    token: invite.token,
                    expiresAt: invite.expiresAt
                }))
            })
    });
};

module.exports = {
    completeOnboarding,
    parseEmails
};
