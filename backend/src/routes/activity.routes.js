const express = require("express");

const authMiddleware = require("../middleware/authMiddleware");

const {
    createActivity,
    getActivities
} = require("../controllers/activityController");

const router = express.Router();

router.post(
    "/",
    authMiddleware,
    createActivity
);

router.get(
    "/project/:projectId",
    authMiddleware,
    getActivities
);

module.exports = router;