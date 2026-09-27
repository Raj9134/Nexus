const express = require("express");
const router = express.Router();

const upload = require("../middleware/uploadMiddleware");
const authMiddleware = require("../middleware/authMiddleware");

const {
    uploadFile,
    sendFileMessage,
    attachFile,
    getProjectFiles,
    getTaskFiles,
    getFile,
    getFiles,
    getFolders,
    downloadFile,
    deleteFile
} = require("../controllers/fileController");


router.get(
    "/",
    authMiddleware,
    getFiles
);


router.get(
    "/folders",
    authMiddleware,
    getFolders
);


router.post(
    "/upload",
    authMiddleware,
    upload.single("file"),
    uploadFile
);


router.post(
    "/message",
    authMiddleware,
    upload.single("file"),
    sendFileMessage
);


router.post(
    "/attach",
    authMiddleware,
    upload.single("file"),
    attachFile
);


router.get(
    "/project/:projectId",
    authMiddleware,
    getProjectFiles
);


router.get(
    "/task/:taskId",
    authMiddleware,
    getTaskFiles
);


router.get(
    "/download/:fileId",
    authMiddleware,
    downloadFile
);


router.get(
    "/:fileId",
    authMiddleware,
    getFile
);


router.delete(
    "/:fileId",
    authMiddleware,
    deleteFile
);


module.exports = router;