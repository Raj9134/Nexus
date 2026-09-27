const CalendarEvent = require("../models/CalendarEvent");
const Organization = require("../models/Organization");
const User = require("../models/User");

const { checkOrganizationAccess, isValidObjectId } = require("../services/permissionService");
const { listEvents, accessibleOrganizationIds } = require("../services/workspaceService");
const auditService = require("../services/auditService");
const { serializeEvent, idOf } = require("../utils/serialize");
const { EVENT_TYPES } = require("../constants/nexus");

const TITLE_MAX = 200;
const NOTES_MAX = 2000;

const cleanText = (value) => {
    return typeof value === "string" ? value.trim() : "";
};

const resolveOrganization = async (req) => {
    if (req.body.organizationId) {
        const access = await checkOrganizationAccess(req.body.organizationId, req.userId);

        return access;
    }

    const organizationIds = await accessibleOrganizationIds(req.user);

    if (!organizationIds.length) {
        return { allowed: false, status: 404, organization: null };
    }

    const organization = await Organization.findById(organizationIds[0]);

    return { allowed: Boolean(organization), status: organization ? 200 : 404, organization };
};

const findOrg = async (organizationId) => {
    return Organization.findById(organizationId);
};

const parseAttendees = (value) => {
    if (!Array.isArray(value)) {
        return { ok: true, value: [] };
    }

    const ids = value
        .map((entry) => (typeof entry === "string" ? entry : idOf(entry)))
        .filter((entry) => isValidObjectId(entry));

    return { ok: true, value: [...new Set(ids)] };
};

const getEvents = async (req, res) => {
    const events = await listEvents(req.user);

    return res.status(200).json({ message: "Events fetched successfully", events });
};

const createEvent = async (req, res) => {
    const title = cleanText(req.body.title);

    if (!title) {
        return res.status(400).json({ message: "Event title is required" });
    }

    if (title.length > TITLE_MAX) {
        return res.status(400).json({
            message: `Event title cannot exceed ${TITLE_MAX} characters`
        });
    }

    const startAt = new Date(req.body.startAt);

    if (!req.body.startAt || Number.isNaN(startAt.getTime())) {
        return res.status(400).json({ message: "startAt must be a valid date" });
    }

    const type = req.body.type === undefined ? "Meeting" : req.body.type;

    if (!EVENT_TYPES.includes(type)) {
        return res.status(400).json({
            message: `Type must be one of: ${EVENT_TYPES.join(", ")}`
        });
    }

    const notes = cleanText(req.body.notes);

    if (notes.length > NOTES_MAX) {
        return res.status(400).json({
            message: `Event notes cannot exceed ${NOTES_MAX} characters`
        });
    }

    const attendees = parseAttendees(req.body.attendees);

    if (!attendees.ok) {
        return res.status(400).json({ message: "attendees must be an array of user IDs" });
    }

    const access = await resolveOrganization(req);

    if (!access.allowed || !access.organization) {
        return res.status(access.status || 404).json({
            message: access.status === 403
                ? "You are not a member of this organization"
                : "Organization not found"
        });
    }

    const event = await CalendarEvent.create({
        title,
        startAt,
        type,
        notes,
        attendees: attendees.value,
        organization: access.organization._id,
        createdBy: req.userId
    });

    const populated = await CalendarEvent.findById(event._id)
        .populate("attendees", "name avatar");

    await auditService.record({
        req,
        organization: access.organization._id,
        action: "Created event",
        resource: title,
        resourceId: String(event._id),
        status: "Success",
        detail: `${type} event created`
    });

    return res.status(201).json({
        message: "Event created successfully",
        event: serializeEvent(populated)
    });
};

const getEvent = async (req, res) => {
    if (!isValidObjectId(req.params.id)) {
        return res.status(404).json({ message: "Event not found" });
    }

    const event = await CalendarEvent.findById(req.params.id)
        .populate("attendees", "name avatar");

    if (!event) {
        return res.status(404).json({ message: "Event not found" });
    }

    // Same org scoping the list endpoint applies, so a member of another
    // organization cannot read this event by guessing its id.
    const organizationIds = await accessibleOrganizationIds(req.user);
    const owner = organizationIds
        .map((id) => id.toString())
        .includes(idOf(event.organization));

    if (!owner) {
        return res.status(404).json({ message: "Event not found" });
    }

    return res.status(200).json({
        message: "Event fetched successfully",
        event: serializeEvent(event)
    });
};

const updateEvent = async (req, res) => {
    if (!isValidObjectId(req.params.id)) {
        return res.status(400).json({ message: "Invalid event ID" });
    }

    const event = await CalendarEvent.findById(req.params.id);

    if (!event) {
        return res.status(404).json({ message: "Event not found" });
    }

    const organization = await findOrg(event.organization);

    if (!organization) {
        return res.status(404).json({ message: "Organization not found" });
    }

    const isCreator = String(event.createdBy) === req.userId;
    const isOwner = String(organization.createdBy) === req.userId;

    if (!isCreator && !isOwner && req.user.role !== "admin") {
        return res.status(403).json({
            message: "You are not allowed to update this event"
        });
    }

    if (req.body.title !== undefined) {
        const title = cleanText(req.body.title);

        if (!title) {
            return res.status(400).json({ message: "Event title cannot be empty" });
        }

        event.title = title.slice(0, TITLE_MAX);
    }

    if (req.body.startAt !== undefined) {
        const startAt = new Date(req.body.startAt);

        if (Number.isNaN(startAt.getTime())) {
            return res.status(400).json({ message: "startAt must be a valid date" });
        }

        event.startAt = startAt;
    }

    if (req.body.type !== undefined) {
        if (!EVENT_TYPES.includes(req.body.type)) {
            return res.status(400).json({
                message: `Type must be one of: ${EVENT_TYPES.join(", ")}`
            });
        }

        event.type = req.body.type;
    }

    if (req.body.notes !== undefined) {
        event.notes = cleanText(req.body.notes).slice(0, NOTES_MAX);
    }

    if (req.body.attendees !== undefined) {
        const attendees = parseAttendees(req.body.attendees);

        event.attendees = attendees.value;
    }

    await event.save();

    await auditService.record({
        req,
        organization: event.organization,
        action: "Updated event",
        resource: event.title,
        resourceId: String(event._id),
        status: "Success",
        detail: "Event updated"
    });

    const populated = await CalendarEvent.findById(event._id)
        .populate("attendees", "name avatar");

    return res.status(200).json({
        message: "Event updated successfully",
        event: serializeEvent(populated)
    });
};

const deleteEvent = async (req, res) => {
    if (!isValidObjectId(req.params.id)) {
        return res.status(400).json({ message: "Invalid event ID" });
    }

    const event = await CalendarEvent.findById(req.params.id);

    if (!event) {
        return res.status(404).json({ message: "Event not found" });
    }

    const organization = await findOrg(event.organization);

    if (!organization) {
        return res.status(404).json({ message: "Organization not found" });
    }

    const isCreator = String(event.createdBy) === req.userId;
    const isOwner = String(organization.createdBy) === req.userId;

    if (!isCreator && !isOwner && req.user.role !== "admin") {
        return res.status(403).json({
            message: "You are not allowed to delete this event"
        });
    }

    await CalendarEvent.findByIdAndDelete(event._id);

    await auditService.record({
        req,
        organization: event.organization,
        action: "Deleted event",
        resource: event.title,
        resourceId: String(event._id),
        status: "Warning",
        detail: "Event deleted"
    });

    return res.status(200).json({ message: "Event deleted successfully" });
};

module.exports = {
    getEvents,
    getEvent,
    createEvent,
    updateEvent,
    deleteEvent
};
