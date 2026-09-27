const express = require("express");

const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");

const {
    sendMessage,
    getWorkspaceMessages,
    getMessages,
    createVoiceMessage,
    updateMessage,
    deleteMessage,
    markMessageAsRead,
    streamVoiceMessage
} = require("../controllers/messageController");

const uploadAudio = require("../middleware/audioUpload");

router.post(
    "/",
    authMiddleware,
    sendMessage
);

router.get(
    "/",
    authMiddleware,
    getWorkspaceMessages
);

router.post(
    "/voice",
    authMiddleware,
    uploadAudio.single("audio"),
    createVoiceMessage
);

router.get(
    "/voice/:messageId",
    authMiddleware,
    streamVoiceMessage
);

router.get(
    "/:userId",
    authMiddleware,
    getMessages
);

router.put(
    "/:messageId",
    authMiddleware,
    updateMessage
);

router.patch(
    "/:messageId",
    authMiddleware,
    updateMessage
);

router.delete(
    "/:messageId",
    authMiddleware,
    deleteMessage
);

router.put(
    "/:messageId/read",
    authMiddleware,
    markMessageAsRead
);

router.patch(
    "/:messageId/read",
    authMiddleware,
    markMessageAsRead
);

module.exports = router;
