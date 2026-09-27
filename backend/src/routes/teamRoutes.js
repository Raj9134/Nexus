const express = require("express");

const authMiddleware = require("../middleware/authMiddleware");

const { getTeam } = require("../controllers/teamController");

const router = express.Router();

router.get(
    "/",
    authMiddleware,
    getTeam
);

module.exports = router;
