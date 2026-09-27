const User = require("../models/User");
const Organization = require("../models/Organization");
const Project = require("../models/Project");
const Task = require("../models/Task");
const Message = require("../models/Message");

const {
    accessibleOrganizationIds,
    accessibleProjectIds,
    listMessages,
    projectView,
    taskView,
    uniqueIds
} = require("../services/workspaceService");

const {
    serializeUser,
    serializeOrganization
} = require("../utils/serialize");

const MAX_QUERY_LENGTH = 100;
const RESULT_LIMIT = 20;


const readSearchQuery = (rawQuery) => {

    const search = typeof rawQuery === "string"
        ? rawQuery.trim()
        : "";

    if (!search) {
        return {
            ok: false,
            message: "Search query is required"
        };
    }

    if (search.length > MAX_QUERY_LENGTH) {
        return {
            ok: false,
            message: `Search query cannot exceed ${MAX_QUERY_LENGTH} characters`
        };
    }

    return {
        ok: true,
        search: search
    };

};


/*
    User ka raw input seedha $regex me jaata hai,
    isliye regex metacharacters escape karna zaroori hai.
*/
const escapeRegex = (value) => value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
);

const buildTextFilter = (search, fields) => {

    const pattern = escapeRegex(search);

    return {
        $or: fields.map((field) => ({
            [field]: {
                $regex: pattern,
                $options: "i"
            }
        }))
    };

};

const mergeFilters = (...filters) => {

    const usable = filters.filter(
        (filter) => filter && Object.keys(filter).length > 0
    );

    if (usable.length === 0) {
        return {};
    }

    if (usable.length === 1) {
        return usable[0];
    }

    return {
        $and: usable
    };

};


/*
    Membership Organization par stored hai, User par nahi,
    isliye pehle accessible orgs ke members resolve karte hain.
*/
const accessibleUserIds = async (user) => {

    const organizationIds = await accessibleOrganizationIds(user);

    if (!organizationIds.length) {
        return [user._id];
    }

    const organizations = await Organization.find({
        _id: { $in: organizationIds }
    }).select("members createdBy");

    const memberIds = [];

    for (const organization of organizations) {
        memberIds.push(...(organization.members || []), organization.createdBy);
    }

    return uniqueIds(memberIds.length ? memberIds : [user._id]);

};


const workloadFor = (active, completed) => {
    if (active > 6) {
        return "High";
    }

    if (active >= 3) {
        return "Balanced";
    }

    return "Low";
};


/*
    Search results bhi wahi shape return karte hain jo
    @/types/nexus declare karta hai, warna dropdown
    list endpoint se alag dikhega.
*/
const userStatsFor = async (userIds) => {

    if (!userIds.length) {
        return new Map();
    }

    const [assignments, memberships] = await Promise.all([
        Task.aggregate([
            { $match: { assignedTo: { $in: userIds } } },
            {
                $group: {
                    _id: "$assignedTo",
                    active: {
                        $sum: {
                            $cond: [{ $eq: ["$status", "Done"] }, 0, 1]
                        }
                    },
                    completed: {
                        $sum: {
                            $cond: [{ $eq: ["$status", "Done"] }, 1, 0]
                        }
                    }
                }
            }
        ]),
        Project.aggregate([
            { $match: { members: { $in: userIds } } },
            { $unwind: "$members" },
            { $group: { _id: "$members", projects: { $sum: 1 } } }
        ])
    ]);

    const stats = new Map();

    for (const entry of assignments) {
        stats.set(String(entry._id), {
            activeTasks: entry.active || 0,
            completed: entry.completed || 0,
            projects: 0,
            completionRate: 0
        });
    }

    for (const entry of memberships) {
        const key = String(entry._id);
        const current = stats.get(key) || {
            activeTasks: 0,
            completed: 0,
            projects: 0,
            completionRate: 0
        };

        current.projects = entry.projects || 0;
        stats.set(key, current);
    }

    for (const value of stats.values()) {
        const total = value.activeTasks + value.completed;

        value.workload = workloadFor(value.activeTasks, value.completed);
        value.completionRate = total ? Math.round((value.completed / total) * 100) : 0;
    }

    return stats;

};


const searchUsers = async (req, res) => {

    const query = readSearchQuery(req.query.q);

    if (!query.ok) {
        return res.status(400).json({
            message: query.message
        });
    }

    const userIds = await accessibleUserIds(req.user);

    const found = await User.find(
        mergeFilters(
            {
                _id: { $in: userIds }
            },
            buildTextFilter(
                query.search,
                ["name", "email"]
            )
        )
    )
    .select("-password")
    .limit(RESULT_LIMIT)
    .lean();

    const stats = await userStatsFor(found.map((entry) => entry._id));

    const users = found.map((entry) => serializeUser(
        entry,
        stats.get(String(entry._id)) || {}
    ));

    return res.status(200).json({
        count: users.length,
        users: users
    });

};


const searchOrganizations = async (req, res) => {

    const query = readSearchQuery(req.query.q);

    if (!query.ok) {
        return res.status(400).json({
            message: query.message
        });
    }

    const organizationIds = await accessibleOrganizationIds(req.user);

    const found = await Organization.find(
        mergeFilters(
            {
                _id: { $in: organizationIds }
            },
            buildTextFilter(
                query.search,
                ["name", "description"]
            )
        )
    )
    .limit(RESULT_LIMIT)
    .lean();

    const organizations = found.map(serializeOrganization);

    return res.status(200).json({
        count: organizations.length,
        organizations: organizations
    });

};


const searchProjects = async (req, res) => {

    const query = readSearchQuery(req.query.q);

    if (!query.ok) {
        return res.status(400).json({
            message: query.message
        });
    }

    const projectIds = await accessibleProjectIds(req.user);

    if (!projectIds.length) {
        return res.status(200).json({
            count: 0,
            projects: []
        });
    }

    const found = await Project.find(
        mergeFilters(
            {
                _id: { $in: projectIds }
            },
            buildTextFilter(
                query.search,
                ["name", "description"]
            )
        )
    )
    .limit(RESULT_LIMIT);

    const projects = [];

    for (const project of found) {
        projects.push(await projectView(project));
    }

    return res.status(200).json({
        count: projects.length,
        projects: projects
    });

};


const searchTasks = async (req, res) => {

    const query = readSearchQuery(req.query.q);

    if (!query.ok) {
        return res.status(400).json({
            message: query.message
        });
    }

    const projectIds = await accessibleProjectIds(req.user);

    if (!projectIds.length) {
        return res.status(200).json({
            count: 0,
            tasks: []
        });
    }

    const found = await Task.find(
        mergeFilters(
            {
                project: { $in: projectIds }
            },
            buildTextFilter(
                query.search,
                ["title", "description"]
            )
        )
    )
    .limit(RESULT_LIMIT);

    const tasks = [];

    for (const task of found) {
        tasks.push(await taskView(task));
    }

    return res.status(200).json({
        count: tasks.length,
        tasks: tasks
    });

};


/*
    Sabse sensitive endpoint: sirf wahi messages jisme user
    sender ya receiver hai, aur sirf wahi channels jiska
    access user ke paas hai.
*/
const searchMessages = async (req, res) => {

    const query = readSearchQuery(req.query.q);

    if (!query.ok) {
        return res.status(400).json({
            message: query.message
        });
    }

    const scope = await listMessages(req.user, { limit: RESULT_LIMIT * 5 });

    if (!scope.allowed || !scope.messages.length) {
        return res.status(200).json({
            count: 0,
            messages: []
        });
    }

    const pattern = escapeRegex(query.search);

    const messages = scope.messages
        .filter((message) => new RegExp(pattern, "i").test(message.body))
        .slice(0, RESULT_LIMIT);

    return res.status(200).json({
        count: messages.length,
        messages: messages
    });

};


module.exports = {
    searchUsers,
    searchOrganizations,
    searchProjects,
    searchTasks,
    searchMessages
};
