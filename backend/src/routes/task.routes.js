const express = require("express");

const authMiddleware = require("../middleware/authMiddleware");

const {
    createTask,
    getAllTasks,
    getTasks,
    getTask,
    updateTask,
    toggleChecklist,
    deleteTask,
    assignTask
} = require("../controllers/taskController");

const router = express.Router();

router.post(
    "/",
    authMiddleware,
    createTask
);

router.get(
    "/",
    authMiddleware,
    getAllTasks
);

router.get(
    "/project/:projectId",
    authMiddleware,
    getTasks
);

router.get(
    "/:id",
    authMiddleware,
    getTask
);

router.put(
    "/:id",
    authMiddleware,
    updateTask
);

router.patch(
    "/:id",
    authMiddleware,
    updateTask
);

router.patch(
    "/:id/checklist",
    authMiddleware,
    toggleChecklist
);

router.put(
    "/:id/checklist",
    authMiddleware,
    toggleChecklist
);

router.delete(
    "/:id",
    authMiddleware,
    deleteTask
);

router.post(
    "/:id/assign",
    authMiddleware,
    assignTask
);

module.exports = router;
