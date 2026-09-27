const Organization = require("../models/Organization");
const User = require("../models/User");

const { serializeOrganization } = require("../utils/serialize");

const {
    isValidObjectId,
    checkOrganizationAccess,
    checkOrganizationManagement
} = require("../services/permissionService");

const NAME_MAX_LENGTH = 120;
const DESCRIPTION_MAX_LENGTH = 2000;

const cleanText = (value) => {
    return typeof value === "string" ? value.trim() : "";
};

const deniedMessage = (status, fallback) => {
    return status === 404 ? "Organization not found" : fallback;
};

const createOrganization = async (req, res) => {

    const name = cleanText(req.body.name);

    if (!name) {
        return res.status(400).json({
            message: "Organization name is required"
        });
    }

    if (name.length > NAME_MAX_LENGTH) {
        return res.status(400).json({
            message: `Organization name cannot exceed ${NAME_MAX_LENGTH} characters`
        });
    }

    const description = cleanText(req.body.description);

    if (description.length > DESCRIPTION_MAX_LENGTH) {
        return res.status(400).json({
            message: `Organization description cannot exceed ${DESCRIPTION_MAX_LENGTH} characters`
        });
    }

    const organization = await Organization.create({
        name: name,
        description: description,
        createdBy: req.userId
    });

    return res.status(201).json({
        message: "Organization created successfully",
        organization: serializeOrganization(organization)
    });

};

const getOrganization = async (req, res) => {

    const access = await checkOrganizationAccess(
        req.params.id,
        req.userId
    );

    if (!access.allowed) {
        return res.status(access.status).json({
            message: deniedMessage(
                access.status,
                "You are not a member of this organization"
            )
        });
    }

    return res.status(200).json({
        message: "Organization fetched successfully",
        organization: serializeOrganization(access.organization)
    });

};

const getMyOrganizations = async (req, res) => {

    const organizations = await Organization.find({
        $or: [
            { createdBy: req.userId },
            { members: req.userId }
        ]
    }).sort({ createdAt: -1 });

    return res.status(200).json({
        message: "Organizations fetched successfully",
        organizations: organizations.map(serializeOrganization)
    });

};

const updateOrganization = async (req, res) => {

    const access = await checkOrganizationManagement(
        req.params.id,
        req.userId
    );

    if (!access.allowed) {
        return res.status(access.status).json({
            message: deniedMessage(
                access.status,
                "You are not allowed to update this organization"
            )
        });
    }

    const organization = access.organization;

    if (req.body.name !== undefined) {

        const name = cleanText(req.body.name);

        if (!name) {
            return res.status(400).json({
                message: "Organization name cannot be empty"
            });
        }

        if (name.length > NAME_MAX_LENGTH) {
            return res.status(400).json({
                message: `Organization name cannot exceed ${NAME_MAX_LENGTH} characters`
            });
        }

        organization.name = name;

    }

    if (req.body.description !== undefined) {

        const description = cleanText(req.body.description);

        if (description.length > DESCRIPTION_MAX_LENGTH) {
            return res.status(400).json({
                message: `Organization description cannot exceed ${DESCRIPTION_MAX_LENGTH} characters`
            });
        }

        organization.description = description;

    }

    await organization.save();

    return res.status(200).json({
        message: "Organization updated successfully",
        organization: serializeOrganization(organization)
    });

};

const deleteOrganization = async (req, res) => {

    const access = await checkOrganizationManagement(
        req.params.id,
        req.userId
    );

    if (!access.allowed) {
        return res.status(access.status).json({
            message: deniedMessage(
                access.status,
                "You are not allowed to delete this organization"
            )
        });
    }

    await Organization.findByIdAndDelete(access.organization._id);

    return res.status(200).json({
        message: "Organization deleted successfully"
    });

};

const addMember = async (req, res) => {

    const access = await checkOrganizationManagement(
        req.params.id,
        req.userId
    );

    if (!access.allowed) {
        return res.status(access.status).json({
            message: deniedMessage(
                access.status,
                "You are not allowed to add members"
            )
        });
    }

    const organization = access.organization;
    const userId = req.body.userId;

    if (!isValidObjectId(userId)) {
        return res.status(400).json({
            message: "A valid user ID is required"
        });
    }

    if (organization.createdBy.toString() === userId) {
        return res.status(409).json({
            message: "The organization creator is already a member"
        });
    }

    const alreadyMember = organization.members.some(
        (member) => member.toString() === userId
    );

    if (alreadyMember) {
        return res.status(409).json({
            message: "User is already a member of this organization"
        });
    }

    const user = await User.findById(userId).select("-password");

    if (!user) {
        return res.status(404).json({
            message: "User not found"
        });
    }

    organization.members.push(user._id);

    await organization.save();

    return res.status(200).json({
        message: "Member added successfully",
        organization: serializeOrganization(organization)
    });

};

const removeMember = async (req, res) => {

    const access = await checkOrganizationManagement(
        req.params.id,
        req.userId
    );

    if (!access.allowed) {
        return res.status(access.status).json({
            message: deniedMessage(
                access.status,
                "You are not allowed to remove members"
            )
        });
    }

    const organization = access.organization;
    const userId = req.params.userId;

    if (!isValidObjectId(userId)) {
        return res.status(400).json({
            message: "A valid user ID is required"
        });
    }

    if (organization.createdBy.toString() === userId) {
        return res.status(400).json({
            message: "The organization creator cannot be removed"
        });
    }

    const memberIndex = organization.members.findIndex(
        (member) => member.toString() === userId
    );

    if (memberIndex === -1) {
        return res.status(404).json({
            message: "User is not a member of this organization"
        });
    }

    organization.members.splice(memberIndex, 1);

    await organization.save();

    return res.status(200).json({
        message: "Member removed successfully",
        organization: serializeOrganization(organization)
    });

};

module.exports = {
    createOrganization,
    getOrganization,
    getMyOrganizations,
    updateOrganization,
    deleteOrganization,
    addMember,
    removeMember
};
