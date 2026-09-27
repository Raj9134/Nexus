const express = require("express");

const authMiddleware = require("../middleware/authMiddleware");

const {
    getChannels,
    getChannelRecords,
    createChannel,
    deleteChannel
} = require("../controllers/channelController");

const router = express.Router();

router.get(
    "/",
    authMiddleware,
    getChannels
);

router.get(
    "/records",
    authMiddleware,
    getChannelRecords
);

router.post(
    "/",
    authMiddleware,
    createChannel
);

router.delete(
    "/:name",
    authMiddleware,
    deleteChannel
);

module.exports = router;
