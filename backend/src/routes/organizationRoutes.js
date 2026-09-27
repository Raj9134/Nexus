const express = require("express");

const authMiddleware = require("../middleware/authMiddleware");

const {
    createOrganization,
    getOrganization,
    getMyOrganizations,
    updateOrganization,
    deleteOrganization,
    addMember,
    removeMember
} = require("../controllers/organizationController");

const {
    createInvites,
    listInvites,
    previewInvite,
    acceptInvite
} = require("../controllers/invitationController");

const router = express.Router();

// Preview stays public: a signed-out invitee has to see it before signing up.
// It is declared before "/:id" so "preview" is not read as an organization id.
router.get(
    "/invitations/preview/:token",
    previewInvite
);

router.post(
    "/invitations/accept",
    authMiddleware,
    acceptInvite
);

router.post(
    "/",
    authMiddleware,
    createOrganization
);

router.get(
    "/mine",
    authMiddleware,
    getMyOrganizations
);

router.get(
    "/:id",
    authMiddleware,
    getOrganization
);

router.put(
    "/:id",
    authMiddleware,
    updateOrganization
);

router.delete(
    "/:id",
    authMiddleware,
    deleteOrganization
);

router.post(
    "/:id/members",
    authMiddleware,
    addMember
);

router.delete(
    "/:id/members/:userId",
    authMiddleware,
    removeMember
);

router.get(
    "/:id/invitations",
    authMiddleware,
    listInvites
);

router.post(
    "/:id/invitations",
    authMiddleware,
    createInvites
);

module.exports = router;
