const express = require("express");
const router = express.Router();

const {
    searchUsers,
    searchOrganizations,
    searchProjects,
    searchTasks,
    searchMessages
} = require("../controllers/searchController");

const authMiddleware = require("../middleware/authMiddleware");

router.get(
    "/users",
    authMiddleware,
    searchUsers
);

router.get(
    "/organizations",
    authMiddleware,
    searchOrganizations
);

router.get(
    "/projects",
    authMiddleware,
    searchProjects
);

router.get(
    "/tasks",
    authMiddleware,
    searchTasks
);

router.get(
    "/messages",
    authMiddleware,
    searchMessages
);

module.exports = router;