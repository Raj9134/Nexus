const Notification = require("../models/Notification");

const { serializeNotification, idOf } = require("../utils/serialize");

/**
 * Creates a notification and pushes it over the socket when available.
 *
 * Notification delivery is a side effect: it must never fail the
 * request that triggered it (sending a message, assigning a task, ...).
 * Every failure is therefore logged and swallowed.
 */
const createNotification = async ({
    user,
    type,
    title,
    message,
    relatedId,
    actor,
    io
}) => {
    const recipientId = idOf(user);

    if (!recipientId) {
        console.log("Notification skipped: missing recipient");

        return null;
    }

    if (actor && idOf(actor) === recipientId) {
        return null;
    }

    let notification = null;

    try {
        notification = await Notification.create({
            user: recipientId,
            type,
            title,
            message,
            relatedId: relatedId || null
        });
    } catch (error) {
        console.log("Notification creation failed:", error.message);

        return null;
    }

    if (io) {
        try {
            io.to(recipientId).emit(
                "newNotification",
                serializeNotification(notification)
            );
        } catch (error) {
            console.log("Notification emit failed:", error.message);
        }
    }

    return notification;
};

module.exports = {
    createNotification
};
