const express = require("express");

const authMiddleware = require("../middleware/authMiddleware");

const {
    createComment,
    getComments,
    updateComment,
    deleteComment
} = require("../controllers/commentController");

const router = express.Router();

router.post(
    "/",
    authMiddleware,
    createComment
);

router.get(
    "/task/:taskId",
    authMiddleware,
    getComments
);

router.put(
    "/:id",
    authMiddleware,
    updateComment
);

router.delete(
    "/:id",
    authMiddleware,
    deleteComment
);

module.exports = router;