const AuditLog = require("../models/AuditLog");

const { AUDIT_STATUSES } = require("../constants/nexus");

const MAX_ACTION = 120;
const MAX_RESOURCE = 200;
const MAX_RESOURCE_ID = 120;
const MAX_DETAIL = 1000;
const MAX_IP = 64;

const clientIp = (req) => {
    if (!req) {
        return "";
    }

    const forwarded = req.headers && req.headers["x-forwarded-for"];

    if (typeof forwarded === "string" && forwarded.trim()) {
        return forwarded.split(",")[0].trim().slice(0, MAX_IP);
    }

    return String((req.ip || (req.socket && req.socket.remoteAddress) || "")).slice(0, MAX_IP);
};

const clip = (value, max) => {
    return String(value === undefined || value === null ? "" : value).slice(0, max);
};

/**
 * Fire-and-forget audit writer.
 * Audit logging must never break the business operation, so every failure is swallowed and logged.
 */
const record = async ({
    req,
    user,
    userName,
    organization,
    action,
    resource,
    resourceId,
    status,
    detail
} = {}) => {
    try {
        await AuditLog.create({
            user: user || (req && req.userId) || null,
            userName: clip(userName, 120),
            organization: organization || null,
            action: clip(action, MAX_ACTION) || "Unknown action",
            resource: clip(resource, MAX_RESOURCE),
            resourceId: clip(resourceId, MAX_RESOURCE_ID),
            ip: clientIp(req),
            status: AUDIT_STATUSES.includes(status) ? status : "Success",
            detail: clip(detail, MAX_DETAIL)
        });
    } catch (error) {
        console.error("AuditLog write failed:", error.message);
    }
};

module.exports = {
    record,
    clientIp
};
