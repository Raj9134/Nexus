const Organization = require("../models/Organization");

const { listAuditLogs, accessibleOrganizationIds } = require("../services/workspaceService");

const canViewAudit = async (user) => {
    if (user.role === "admin") {
        return true;
    }

    const organizationIds = await accessibleOrganizationIds(user);

    if (!organizationIds.length) {
        return false;
    }

    const owned = await Organization.findOne({
        _id: { $in: organizationIds },
        createdBy: user._id
    }).select("_id");

    return Boolean(owned);
};

const getAuditLogs = async (req, res) => {
    const allowed = await canViewAudit(req.user);

    if (!allowed) {
        return res.status(403).json({
            message: "Audit logs are restricted to organization admins"
        });
    }

    const logs = await listAuditLogs(req.user, { limit: req.query.limit });

    return res.status(200).json({ message: "Audit logs fetched successfully", logs });
};

module.exports = {
    getAuditLogs,
    canViewAudit
};
