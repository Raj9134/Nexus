const express = require("express");

const authMiddleware = require("../middleware/authMiddleware");

const {
    createProject,
    getAllProjects,
    getProjects,
    getProject,
    updateProject,
    deleteProject,
    assignMember,
    removeMember
} = require("../controllers/projectController");

const router = express.Router();

router.post(
    "/",
    authMiddleware,
    createProject
);

router.get(
    "/",
    authMiddleware,
    getAllProjects
);

router.get(
    "/organization/:organizationId",
    authMiddleware,
    getProjects
);

router.get(
    "/:id",
    authMiddleware,
    getProject
);

router.put(
    "/:id",
    authMiddleware,
    updateProject
);

router.patch(
    "/:id",
    authMiddleware,
    updateProject
);

router.delete(
    "/:id",
    authMiddleware,
    deleteProject
);

router.post(
    "/:id/members",
    authMiddleware,
    assignMember
);

router.delete(
    "/:id/members/:userId",
    authMiddleware,
    removeMember
);

module.exports = router;
