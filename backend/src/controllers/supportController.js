const SupportRequest = require("../models/SupportRequest");
const Organization = require("../models/Organization");

const { serializeSupportRequest } = require("../utils/serialize");
const { isValidObjectId } = require("../services/permissionService");

const SUBJECT_MAX_LENGTH = 200;
const MESSAGE_MAX_LENGTH = 5000;
const MAX_REQUESTS_PER_USER = 50;

const cleanText = (value) => {
    return typeof value === "string" ? value.trim() : "";
};

/**
 * Records a support request and reports what was actually stored.
 *
 * The sidebar's "Help & Support" control used to show a "Support team has been
 * notified" toast and send nothing, so the message went nowhere. Nothing here
 * emails anyone: the request is persisted, so it can be read back through
 * listMyRequests rather than being lost.
 */
const createSupportRequest = async (req, res) => {
    try {
        const subject = cleanText(req.body?.subject);
        const message = cleanText(req.body?.message);
        const page = cleanText(req.body?.page).slice(0, 200);

        if (!subject) {
            return res.status(400).json({
                message: "A subject is required"
            });
        }

        if (subject.length > SUBJECT_MAX_LENGTH) {
            return res.status(400).json({
                message: `The subject cannot be longer than ${SUBJECT_MAX_LENGTH} characters`
            });
        }

        if (!message) {
            return res.status(400).json({
                message: "A message is required"
            });
        }

        if (message.length > MESSAGE_MAX_LENGTH) {
            return res.status(400).json({
                message: `The message cannot be longer than ${MESSAGE_MAX_LENGTH} characters`
            });
        }

        // The workspace is context for whoever reads the request, and is
        // optional: a user who has not finished onboarding has none.
        let organization = null;

        if (isValidObjectId(req.body?.organization)) {
            const candidate = await Organization.findById(req.body.organization)
                .select("createdBy members")
                .lean();

            const isMember =
                candidate &&
                (candidate.createdBy.toString() === req.userId.toString() ||
                    (candidate.members || []).some(
                        (member) => member.toString() === req.userId.toString()
                    ));

            if (isMember) {
                organization = candidate._id;
            }
        }

        const request = await SupportRequest.create({
            user: req.userId,
            organization,
            subject,
            message,
            page
        });

        return res.status(201).json({
            message: "Support request recorded",
            request: serializeSupportRequest(request)
        });
    } catch (error) {
        return res.status(500).json({
            message: "Error recording the support request",
            error: error.message
        });
    }
};

/** The caller's own requests, newest first. Never another user's. */
const listMyRequests = async (req, res) => {
    try {
        const requests = await SupportRequest.find({ user: req.userId })
            .sort({ createdAt: -1 })
            .limit(MAX_REQUESTS_PER_USER)
            .lean();

        return res.status(200).json({
            message: "Support requests fetched successfully",
            requests: requests.map(serializeSupportRequest)
        });
    } catch (error) {
        return res.status(500).json({
            message: "Error fetching support requests",
            error: error.message
        });
    }
};

module.exports = {
    createSupportRequest,
    listMyRequests
};
