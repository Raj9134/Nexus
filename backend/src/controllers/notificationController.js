const mongoose = require("mongoose");
const Notification = require("../models/Notification");

const { listNotifications } = require("../services/workspaceService");
const { serializeNotification } = require("../utils/serialize");

const getMyNotifications = async (req, res) => {

    try {

        const notifications = await listNotifications(req.user);

        res.status(200).json({
            message: "Notifications fetched successfully",
            notifications
        });

    } catch (error) {

        res.status(500).json({
            message: "Error fetching notifications",
            error: error.message
        });

    }

};


const markNotificationAsRead = async (req, res) => {

    try {

        const { notificationId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(notificationId)) {

            return res.status(400).json({
                message: "Invalid notification ID"
            });

        }

        const notification =
            await Notification.findById(notificationId);

        if (!notification) {

            return res.status(404).json({
                message: "Notification not found"
            });

        }

        if (
            notification.user.toString() !==
            req.userId
        ) {

            return res.status(403).json({
                message: "You can only read your own notifications"
            });

        }

        notification.isRead = true;
        notification.readAt = new Date();

        await notification.save();

        res.status(200).json({
            message: "Notification marked as read",
            data: serializeNotification(notification),
            notification: serializeNotification(notification)
        });

    } catch (error) {

        res.status(500).json({
            message: "Error marking notification as read",
            error: error.message
        });

    }

};


const markAllNotificationsAsRead = async (req, res) => {

    try {

        await Notification.updateMany(
            {
                user: req.userId,
                isRead: false
            },
            {
                isRead: true,
                readAt: new Date()
            }
        );

        res.status(200).json({
            message: "All notifications marked as read"
        });

    } catch (error) {

        res.status(500).json({
            message: "Error marking notifications as read",
            error: error.message
        });

    }

};


const getUnreadNotificationCount = async (req, res) => {

    try {

        const count =
            await Notification.countDocuments({
                user: req.userId,
                isRead: false
            });

        res.status(200).json({
            unreadCount: count
        });

    } catch (error) {

        res.status(500).json({
            message: "Error fetching unread notification count",
            error: error.message
        });

    }

};


module.exports = {
    getMyNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    getUnreadNotificationCount
};