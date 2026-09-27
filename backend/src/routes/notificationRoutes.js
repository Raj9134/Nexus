const express = require("express");

const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");

const {
    getMyNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    getUnreadNotificationCount
} = require("../controllers/notificationController");


router.get(
    "/",
    authMiddleware,
    getMyNotifications
);


router.get(
    "/unread-count",
    authMiddleware,
    getUnreadNotificationCount
);


router.put(
    "/read-all",
    authMiddleware,
    markAllNotificationsAsRead
);

router.patch(
    "/read-all",
    authMiddleware,
    markAllNotificationsAsRead
);

router.put(
    "/:notificationId/read",
    authMiddleware,
    markNotificationAsRead
);

router.patch(
    "/:notificationId/read",
    authMiddleware,
    markNotificationAsRead
);




module.exports = router;