const mongoose = require("mongoose");

const Organization = require("../models/Organization");
const Project = require("../models/Project");
const Task = require("../models/Task");
const Message = require("../models/Message");
const Channel = require("../models/Channel");

const { DEFAULT_CHANNELS } = require("../constants/nexus");

const DENY_NOT_FOUND = { status: 404, allowed: false };
const DENY_FORBIDDEN = { status: 403, allowed: false };
const ALLOW = { status: 200, allowed: true };

const toId = (value) => String(value);

const isValidObjectId = (value) => {
    return mongoose.isValidObjectId(value);
};

const containsUser = (collection, userId) => {
    if (!Array.isArray(collection)) {
        return false;
    }

    return collection.some((entry) => toId(entry) === toId(userId));
};

const isOrganizationOwner = (organization, userId) => {
    if (!organization) {
        return false;
    }

    return toId(organization.createdBy) === toId(userId);
};

const isOrganizationMember = (organization, userId) => {
    if (!organization) {
        return false;
    }

    if (isOrganizationOwner(organization, userId)) {
        return true;
    }

    return containsUser(organization.members, userId);
};

const isProjectOwner = (project, userId) => {
    if (!project) {
        return false;
    }

    return toId(project.createdBy) === toId(userId);
};

const isProjectMember = (project, userId) => {
    if (!project) {
        return false;
    }

    if (isProjectOwner(project, userId)) {
        return true;
    }

    return containsUser(project.members, userId);
};

const findOrganization = (organizationId) => {
    if (!isValidObjectId(organizationId)) {
        return Promise.resolve(null);
    }

    return Organization.findById(organizationId);
};

const findProject = (projectId) => {
    if (!isValidObjectId(projectId)) {
        return Promise.resolve(null);
    }

    return Project.findById(projectId);
};

const findTask = (taskId) => {
    if (!isValidObjectId(taskId)) {
        return Promise.resolve(null);
    }

    return Task.findById(taskId);
};

const checkOrganizationAccess = async (organizationId, userId) => {
    if (!isValidObjectId(organizationId)) {
        return { ...DENY_NOT_FOUND, organization: null };
    }

    const organization = await findOrganization(organizationId);

    if (!organization) {
        return { ...DENY_NOT_FOUND, organization: null };
    }

    if (!isOrganizationMember(organization, userId)) {
        return { ...DENY_FORBIDDEN, organization };
    }

    return { ...ALLOW, organization };
};

const checkOrganizationManagement = async (organizationId, userId) => {
    if (!isValidObjectId(organizationId)) {
        return { ...DENY_NOT_FOUND, organization: null };
    }

    const organization = await findOrganization(organizationId);

    if (!organization) {
        return { ...DENY_NOT_FOUND, organization: null };
    }

    if (!isOrganizationOwner(organization, userId)) {
        return { ...DENY_FORBIDDEN, organization };
    }

    return { ...ALLOW, organization };
};

const checkProjectAccess = async (projectId, userId) => {
    if (!isValidObjectId(projectId)) {
        return { ...DENY_NOT_FOUND, project: null };
    }

    const project = await findProject(projectId);

    if (!project) {
        return { ...DENY_NOT_FOUND, project: null };
    }

    if (!isProjectMember(project, userId)) {
        return { ...DENY_FORBIDDEN, project };
    }

    return { ...ALLOW, project };
};

const checkProjectManagement = async (projectId, userId) => {
    if (!isValidObjectId(projectId)) {
        return { ...DENY_NOT_FOUND, project: null };
    }

    const project = await findProject(projectId);

    if (!project) {
        return { ...DENY_NOT_FOUND, project: null };
    }

    if (!isProjectOwner(project, userId)) {
        return { ...DENY_FORBIDDEN, project };
    }

    return { ...ALLOW, project };
};

const checkTaskAccess = async (taskId, userId) => {
    if (!isValidObjectId(taskId)) {
        return { ...DENY_NOT_FOUND, task: null, project: null };
    }

    const task = await findTask(taskId);

    if (!task) {
        return { ...DENY_NOT_FOUND, task: null, project: null };
    }

    const project = await findProject(task.project);

    if (!project) {
        return { ...DENY_NOT_FOUND, task, project: null };
    }

    if (!isProjectMember(project, userId)) {
        return { ...DENY_FORBIDDEN, task, project };
    }

    return { ...ALLOW, task, project };
};

const checkTaskManagement = async (taskId, userId) => {
    const access = await checkTaskAccess(taskId, userId);

    if (!access.allowed) {
        return access;
    }

    const isOwner = toId(access.project.createdBy) === toId(userId);
    const isTaskCreator = toId(access.task.createdBy) === toId(userId);

    if (!isOwner && !isTaskCreator) {
        return { ...access, status: 403, allowed: false };
    }

    return { ...access, status: 200, allowed: true };
};

const checkFileAccess = async (file, userId) => {
    if (!file) {
        return { allowed: false, status: 404, reason: "not_found" };
    }

    if (toId(file.uploadedBy) === toId(userId)) {
        return { allowed: true, status: 200, reason: "uploader" };
    }

    const relatedMessage = await Message.findOne({
        file: file._id
    }).select("sender receiver");

    if (
        relatedMessage &&
        (
            toId(relatedMessage.sender) === toId(userId) ||
            toId(relatedMessage.receiver) === toId(userId)
        )
    ) {
        return { allowed: true, status: 200, reason: "message" };
    }

    if (file.project) {

        const project = await findProject(file.project);

        if (project && isProjectMember(project, userId)) {
            return { allowed: true, status: 200, reason: "project" };
        }

    }

    if (file.task) {

        const task = await findTask(file.task);

        if (task) {

            const project = await findProject(task.project);

            if (project && isProjectMember(project, userId)) {
                return { allowed: true, status: 200, reason: "task" };
            }

        }

    }

    return { allowed: false, status: 403, reason: "forbidden" };
};

const checkFileManagement = async (file, userId) => {
    if (!file) {
        return { allowed: false, status: 404, reason: "not_found" };
    }

    if (toId(file.uploadedBy) !== toId(userId)) {
        return { allowed: false, status: 403, reason: "not_uploader" };
    }

    return { allowed: true, status: 200, reason: "uploader" };
};

const isProjectMemberForUser = async (projectId, userId) => {
    const project = await findProject(projectId);

    return isProjectMember(project, userId);
};

const isUserInProject = (project, userId) => {
    if (!project) {
        return false;
    }

    if (isProjectOwner(project, userId)) {
        return true;
    }

    return containsUser(project.members, userId);
};

const isUserInOrganization = (organization, userId) => {
    return isOrganizationMember(organization, userId);
};

/**
 * A channel is reachable when it belongs to an organization the user is in.
 * Private channels additionally require explicit membership.
 * When an organization has no channel documents yet, the shared default
 * channel names are accepted so a fresh workspace is still usable.
 */
const checkChannelAccess = async (channelName, user) => {
    const name = String(channelName || "").trim().toLowerCase();

    if (!name) {
        return { allowed: false, status: 400, channel: null };
    }

    const userId = typeof user === "object" ? user._id : user;
    const organizationIds = await Organization.distinct("_id", {
        $or: [{ members: userId }, { createdBy: userId }]
    });

    if (!organizationIds.length) {
        return { allowed: false, status: 403, channel: null };
    }

    const channel = await Channel.findOne({
        organization: { $in: organizationIds },
        name
    });

    if (!channel) {
        const total = await Channel.countDocuments({
            organization: { $in: organizationIds }
        });

        if (total === 0) {
            return DEFAULT_CHANNELS.includes(name)
                ? { allowed: true, status: 200, channel: null, implicit: true }
                : { allowed: false, status: 404, channel: null };
        }

        return { allowed: false, status: 404, channel: null };
    }

    if (channel.isPrivate && !containsUser(channel.members, userId)) {
        return { allowed: false, status: 403, channel };
    }

    return { allowed: true, status: 200, channel };
};

module.exports = {
    isValidObjectId,
    isOrganizationOwner,
    isOrganizationMember,
    isProjectOwner,
    isProjectMember,
    findOrganization,
    findProject,
    findTask,
    checkOrganizationAccess,
    checkOrganizationManagement,
    checkProjectAccess,
    checkProjectManagement,
    checkTaskAccess,
    checkTaskManagement,
    checkFileAccess,
    checkFileManagement,
    isProjectMemberForUser,
    isUserInProject,
    isUserInOrganization,
    checkChannelAccess
};
