const Channel = require("../models/Channel");
const Organization = require("../models/Organization");

const { checkOrganizationAccess } = require("../services/permissionService");
const { listChannels, listChannelRecords, accessibleOrganizationIds } = require("../services/workspaceService");
const auditService = require("../services/auditService");

const NAME_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$|^[a-z0-9]$/;
const DESCRIPTION_MAX = 500;

const cleanText = (value) => {
    return typeof value === "string" ? value.trim() : "";
};

const getChannels = async (req, res) => {
    const channels = await listChannels(req.user);

    return res.status(200).json({ message: "Channels fetched successfully", channels });
};

const getChannelRecords = async (req, res) => {
    const channels = await listChannelRecords(req.user);

    return res.status(200).json({
        message: "Channels fetched successfully",
        channels
    });
};

const createChannel = async (req, res) => {
    const name = cleanText(req.body.name).toLowerCase();

    if (!NAME_PATTERN.test(name)) {
        return res.status(400).json({
            message: "Channel name must be lowercase alphanumeric with hyphens (max 64)"
        });
    }

    const description = cleanText(req.body.description);

    if (description.length > DESCRIPTION_MAX) {
        return res.status(400).json({
            message: `Channel description cannot exceed ${DESCRIPTION_MAX} characters`
        });
    }

    const access = await checkOrganizationAccess(req.body.organizationId, req.userId);

    if (!access.allowed) {
        return res.status(access.status).json({
            message: access.status === 404
                ? "Organization not found"
                : "You are not a member of this organization"
        });
    }

    const existing = await Channel.findOne({
        organization: access.organization._id,
        name
    });

    if (existing) {
        return res.status(409).json({ message: "Channel already exists" });
    }

    const channel = await Channel.create({
        name,
        description,
        organization: access.organization._id,
        createdBy: req.userId,
        members: [req.userId],
        isPrivate: Boolean(req.body.isPrivate)
    });

    await auditService.record({
        req,
        organization: access.organization._id,
        action: "Created channel",
        resource: name,
        resourceId: String(channel._id),
        status: "Success",
        detail: `#${name} created`
    });

    return res.status(201).json({
        message: "Channel created successfully",
        channel: {
            id: String(channel._id),
            name: channel.name,
            description: channel.description,
            isPrivate: channel.isPrivate,
            members: channel.members.map(String)
        }
    });
};

const deleteChannel = async (req, res) => {
    const name = cleanText(req.params.name).toLowerCase();
    const organizationIds = await accessibleOrganizationIds(req.user);
    const organizations = await Organization.find({
        _id: { $in: organizationIds }
    }).select("_id createdBy");

    const organization = organizations.find(
        (entry) => String(entry.createdBy) === req.userId
    ) || organizations[0];

    if (!organization) {
        return res.status(404).json({ message: "Organization not found" });
    }

    const channel = await Channel.findOne({
        organization: organization._id,
        name
    });

    if (!channel) {
        return res.status(404).json({ message: "Channel not found" });
    }

    if (String(channel.createdBy) !== req.userId) {
        return res.status(403).json({
            message: "You are not allowed to delete this channel"
        });
    }

    await Channel.findByIdAndDelete(channel._id);

    await auditService.record({
        req,
        organization: organization._id,
        action: "Deleted channel",
        resource: name,
        resourceId: String(channel._id),
        status: "Warning",
        detail: `#${name} deleted`
    });

    return res.status(200).json({ message: "Channel deleted successfully" });
};

module.exports = {
    getChannels,
    getChannelRecords,
    createChannel,
    deleteChannel
};
