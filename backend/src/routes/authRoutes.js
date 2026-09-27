const express = require("express");

const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const {
    registerUser,
    loginUser,
    getProfile,
    getMe,
    refreshSession,
    logoutUser,
    getAllUsers,
    updateMyProfile,
    forgotPassword,
    resetPassword,
    requestEmailVerification,
    verifyEmail
} = require("../controllers/authController");

const router = express.Router();

router.post("/register", registerUser);

router.post("/login", loginUser);

router.post("/refresh", refreshSession);

router.post("/forgot-password", forgotPassword);

router.post("/reset-password", resetPassword);

router.post("/request-email-verification", requestEmailVerification);

router.post("/verify-email", verifyEmail);

router.get("/profile", authMiddleware, getProfile);

router.get("/me", authMiddleware, getMe);

router.post("/logout", authMiddleware, logoutUser);

router.patch("/me", authMiddleware, updateMyProfile);

router.put("/me", authMiddleware, updateMyProfile);

router.get(
    "/users",
    authMiddleware,
    roleMiddleware("admin"),
    getAllUsers
);

module.exports = router;
