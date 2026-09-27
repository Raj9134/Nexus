const express = require("express");

const authMiddleware = require("../middleware/authMiddleware");

const {
    getEvents,
    getEvent,
    createEvent,
    updateEvent,
    deleteEvent
} = require("../controllers/calendarController");

const router = express.Router();

router.get(
    "/",
    authMiddleware,
    getEvents
);

router.get(
    "/:id",
    authMiddleware,
    getEvent
);

router.post(
    "/",
    authMiddleware,
    createEvent
);

router.patch(
    "/:id",
    authMiddleware,
    updateEvent
);

router.put(
    "/:id",
    authMiddleware,
    updateEvent
);

router.delete(
    "/:id",
    authMiddleware,
    deleteEvent
);

module.exports = router;
