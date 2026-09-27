const express = require("express");

const authMiddleware = require("../middleware/authMiddleware");

const {
    createSupportRequest,
    listMyRequests
} = require("../controllers/supportController");

const router = express.Router();

router.post(
    "/",
    authMiddleware,
    createSupportRequest
);

router.get(
    "/mine",
    authMiddleware,
    listMyRequests
);

module.exports = router;
