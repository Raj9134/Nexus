const express = require("express");

const authMiddleware = require("../middleware/authMiddleware");

const { completeOnboarding } = require("../controllers/onboardingController");

const router = express.Router();

router.post(
    "/",
    authMiddleware,
    completeOnboarding
);

module.exports = router;
