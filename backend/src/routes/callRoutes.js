const express = require("express");

const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");

const {
    createCall,
    acceptCall,
    rejectCall,
    missCall,
    endCall,
    getMyCalls,
    getCallById
} = require("../controllers/callController");


router.post(
    "/",
    authMiddleware,
    createCall
);


router.put(
    "/:callId/accept",
    authMiddleware,
    acceptCall
);


router.put(
    "/:callId/reject",
    authMiddleware,
    rejectCall
);

router.put(
    "/:callId/end",
    authMiddleware,
    endCall
);

router.get(
    "/",
    authMiddleware,
    getMyCalls
);

router.get(
    "/:callId",
    authMiddleware,
    getCallById
);

router.put(
    "/:callId/miss",
    authMiddleware,
    missCall
);


module.exports = router;