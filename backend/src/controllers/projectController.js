const Project = require("../models/Project");
const User = require("../models/User");

const {
    isValidObjectId,
    findOrganization,
    checkOrganizationAccess,
    checkProjectAccess,
    checkProjectManagement,
    isUserInOrganization,
    isUserInProject
} = require("../services/permissionService");

const auditService = require("../services/auditService");
const { listProjects, projectView } = require("../services/workspaceService");

const { isProjectStatus, normalizeProjectStatus, PROJECT_STATUSES } = require("../constants/nexus");

const { initials } = require("../utils/format");

const NAME_MAX_LENGTH = 120;
const DESCRIPTION_MAX_LENGTH = 2000;
const KEY_MAX_LENGTH = 10;
const ICON_MAX_LENGTH = 4;

const cleanText = (value) => {
    return typeof value === "string" ? value.trim() : "";
};

const accessDeniedMessage = (status, fallback) => {
    return status === 404 ? "Project not found" : fallback;
};

const deriveKey = (name) => {
    const words = String(name || "")
        .split(/[^A-Za-z0-9]+/)
        .filter(Boolean);

    if (!words.length) {
        return "PRJ";
    }

    if (words.length === 1) {
        return words[0].slice(0, KEY_MAX_LENGTH).toUpperCase();
    }

    return words
        .map((word) => word[0])
        .join("")
        .slice(0, KEY_MAX_LENGTH)
        .toUpperCase();
};

const parseDue = (value) => {
    if (value === undefined || value === null || value === "") {
        return { ok: true, value: null };
    }

    const due = new Date(value);

    if (Number.isNaN(due.getTime())) {
        return { ok: false, value: null };
    }

    return { ok: true, value: due };
};

const createProject = async (req, res) => {
    const name = cleanText(req.body.name);

    if (!name) {
        return res.status(400).json({ message: "Project name is required" });
    }

    if (name.length > NAME_MAX_LENGTH) {
        return res.status(400).json({
            message: `Project name cannot exceed ${NAME_MAX_LENGTH} characters`
        });
    }

    const description = cleanText(req.body.description);

    if (description.length > DESCRIPTION_MAX_LENGTH) {
        return res.status(400).json({
            message: `Project description cannot exceed ${DESCRIPTION_MAX_LENGTH} characters`
        });
    }

    const access = await checkOrganizationAccess(req.body.organizationId, req.userId);

    if (!access.allowed) {
        return res.status(access.status).json({
            message: accessDeniedMessage(
                access.status,
                "You are not a member of this organization"
            )
        });
    }

    const status = req.body.status === undefined ? "Active" : req.body.status;

    if (!isProjectStatus(status)) {
        return res.status(400).json({
            message: `Status must be one of: ${PROJECT_STATUSES.join(", ")}`
        });
    }

    const key = cleanText(req.body.key).toUpperCase().slice(0, KEY_MAX_LENGTH)
        || deriveKey(name);

    const icon = cleanText(req.body.icon).slice(0, ICON_MAX_LENGTH)
        || initials(key);

    const progress = req.body.progress === undefined ? 0 : Number(req.body.progress);

    if (!Number.isFinite(progress) || progress < 0 || progress > 100) {
        return res.status(400).json({ message: "progress must be between 0 and 100" });
    }

    const due = parseDue(req.body.due);

    if (!due.ok) {
        return res.status(400).json({ message: "due must be a valid date" });
    }

    const project = await Project.create({
        name,
        key,
        icon,
        description,
        organization: access.organization._id,
        createdBy: req.userId,
        members: [req.userId],
        status: normalizeProjectStatus(status),
        progress: Math.round(progress),
        due: due.value
    });

    await auditService.record({
        req,
        organization: access.organization._id,
        action: "Created project",
        resource: project.name,
        resourceId: project.key,
        status: "Success",
        detail: `${project.name} (${project.key}) created`
    });

    return res.status(201).json({
        message: "Project created successfully",
        project: await projectView(project)
    });
};

const getAllProjects = async (req, res) => {
    const projects = await listProjects(req.user, {
        status: req.query.status,
        search: req.query.search
    });

    return res.status(200).json({ message: "Projects fetched successfully", projects });
};

const getProjects = async (req, res) => {
    const access = await checkOrganizationAccess(req.params.organizationId, req.userId);

    if (!access.allowed) {
        return res.status(access.status).json({
            message: accessDeniedMessage(
                access.status,
                "Organization not found",
                "You are not a member of this organization"
            )
        });
    }

    const projects = await listProjects(req.user, {
        organizationId: access.organization._id
    });

    return res.status(200).json({
        message: "Projects fetched successfully",
        projects
    });
};

const getProject = async (req, res) => {
    const access = await checkProjectAccess(req.params.id, req.userId);

    if (!access.allowed) {
        return res.status(access.status).json({
            message: accessDeniedMessage(
                access.status,
                "You are not a member of this project"
            )
        });
    }

    return res.status(200).json({
        message: "Project fetched successfully",
        project: await projectView(access.project)
    });
};

const updateProject = async (req, res) => {
    const access = await checkProjectManagement(req.params.id, req.userId);

    if (!access.allowed) {
        return res.status(access.status).json({
            message: accessDeniedMessage(
                access.status,
                "You are not allowed to update this project"
            )
        });
    }

    const project = access.project;
    const changes = [];

    if (req.body.name !== undefined) {
        const name = cleanText(req.body.name);

        if (!name) {
            return res.status(400).json({ message: "Project name cannot be empty" });
        }

        if (name.length > NAME_MAX_LENGTH) {
            return res.status(400).json({
                message: `Project name cannot exceed ${NAME_MAX_LENGTH} characters`
            });
        }

        changes.push("name");
        project.name = name;
    }

    if (req.body.key !== undefined) {
        const key = cleanText(req.body.key).toUpperCase().slice(0, KEY_MAX_LENGTH);

        if (!key) {
            return res.status(400).json({ message: "key cannot be empty" });
        }

        changes.push("key");
        project.key = key;
    }

    if (req.body.icon !== undefined) {
        changes.push("icon");
        project.icon = cleanText(req.body.icon).slice(0, ICON_MAX_LENGTH);
    }

    if (req.body.description !== undefined) {
        const description = cleanText(req.body.description);

        if (description.length > DESCRIPTION_MAX_LENGTH) {
            return res.status(400).json({
                message: `Project description cannot exceed ${DESCRIPTION_MAX_LENGTH} characters`
            });
        }

        project.description = description;
    }

    if (req.body.status !== undefined) {
        if (!isProjectStatus(req.body.status)) {
            return res.status(400).json({
                message: `Status must be one of: ${PROJECT_STATUSES.join(", ")}`
            });
        }

        changes.push("status");
        project.status = normalizeProjectStatus(req.body.status);
    }

    if (req.body.progress !== undefined) {
        const progress = Number(req.body.progress);

        if (!Number.isFinite(progress) || progress < 0 || progress > 100) {
            return res.status(400).json({ message: "progress must be between 0 and 100" });
        }

        changes.push("progress");
        project.progress = Math.round(progress);
    }

    if (req.body.due !== undefined) {
        const due = parseDue(req.body.due);

        if (!due.ok) {
            return res.status(400).json({ message: "due must be a valid date" });
        }

        changes.push("due");
        project.due = due.value;
    }

    await project.save();

    if (changes.length) {
        await auditService.record({
            req,
            organization: project.organization,
            action: "Updated project",
            resource: project.name,
            resourceId: project.key,
            status: "Success",
            detail: changes.join(", ")
        });
    }

    return res.status(200).json({
        message: "Project updated successfully",
        project: await projectView(project)
    });
};

const deleteProject = async (req, res) => {
    const access = await checkProjectManagement(req.params.id, req.userId);

    if (!access.allowed) {
        return res.status(access.status).json({
            message: accessDeniedMessage(
                access.status,
                "You are not allowed to delete this project"
            )
        });
    }

    await Project.findByIdAndDelete(access.project._id);

    await auditService.record({
        req,
        organization: access.project.organization,
        action: "Deleted project",
        resource: access.project.name,
        resourceId: access.project.key,
        status: "Warning",
        detail: `${access.project.name} deleted`
    });

    return res.status(200).json({ message: "Project deleted successfully" });
};

const assignMember = async (req, res) => {
    const access = await checkProjectManagement(req.params.id, req.userId);

    if (!access.allowed) {
        return res.status(access.status).json({
            message: accessDeniedMessage(
                access.status,
                "You are not allowed to assign members"
            )
        });
    }

    const project = access.project;
    const userId = req.body.userId;

    if (!isValidObjectId(userId)) {
        return res.status(400).json({ message: "A valid user ID is required" });
    }

    if (isUserInProject(project, userId)) {
        return res.status(409).json({ message: "User is already a member of this project" });
    }

    const organization = await findOrganization(project.organization);

    if (!organization) {
        return res.status(404).json({ message: "Organization not found" });
    }

    if (!isUserInOrganization(organization, userId)) {
        return res.status(400).json({ message: "User is not a member of this organization" });
    }

    const user = await User.findById(userId).select("-password");

    if (!user) {
        return res.status(404).json({ message: "User not found" });
    }

    project.members.push(user._id);

    await project.save();

    await auditService.record({
        req,
        organization: project.organization,
        action: "Added member",
        resource: project.name,
        resourceId: project.key,
        status: "Success",
        detail: `${user.name} joined ${project.name}`
    });

    return res.status(200).json({
        message: "Member assigned to project successfully",
        project: await projectView(project)
    });
};

const removeMember = async (req, res) => {
    const access = await checkProjectManagement(req.params.id, req.userId);

    if (!access.allowed) {
        return res.status(access.status).json({
            message: accessDeniedMessage(
                access.status,
                "You are not allowed to remove members"
            )
        });
    }

    const project = access.project;
    const userId = req.params.userId;

    if (!isValidObjectId(userId)) {
        return res.status(400).json({ message: "A valid user ID is required" });
    }

    if (String(project.createdBy) === userId) {
        return res.status(400).json({ message: "The project creator cannot be removed" });
    }

    const memberIndex = project.members.findIndex(
        (member) => String(member) === userId
    );

    if (memberIndex === -1) {
        return res.status(404).json({ message: "User is not a member of this project" });
    }

    project.members.splice(memberIndex, 1);

    await project.save();

    await auditService.record({
        req,
        organization: project.organization,
        action: "Removed member",
        resource: project.name,
        resourceId: project.key,
        status: "Warning",
        detail: `Member removed from ${project.name}`
    });

    return res.status(200).json({
        message: "Member removed from project successfully",
        project: await projectView(project)
    });
};

module.exports = {
    createProject,
    getAllProjects,
    getProjects,
    getProject,
    updateProject,
    deleteProject,
    assignMember,
    removeMember,
    deriveKey
};
