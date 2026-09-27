const File = require("../models/File");
const Message = require("../models/Message");
const User = require("../models/User");

const {
    isValidObjectId,
    checkProjectAccess,
    checkTaskAccess,
    checkFileAccess,
    checkFileManagement
} = require("../services/permissionService");

const {
    resolveUploadPath,
    removeUpload,
    removeTemporaryUpload
} = require("../config/storage");

const { createNotification } = require("../services/notificationService");

const { listFiles, listFileFolders } = require("../services/workspaceService");

const accessDeniedMessage = (status, notFound, forbidden) => {
    return status === 404 ? notFound : forbidden;
};

const createFileRecord = async (multerFile, extra = {}) => {
    return File.create({
        originalName: multerFile.originalname,
        fileName: multerFile.filename,
        mimeType: multerFile.mimetype,
        size: multerFile.size,
        uploadedBy: extra.uploadedBy,
        project: extra.project || null,
        task: extra.task || null
    });
};

const uploadFile = async (req, res) => {

    if (!req.file) {
        return res.status(400).json({
            message: "File is required"
        });
    }

    const file = await createFileRecord(req.file, {
        uploadedBy: req.userId
    });

    return res.status(201).json({
        message: "File uploaded successfully",
        file: file
    });

};

const sendFileMessage = async (req, res) => {

    if (!req.file) {
        return res.status(400).json({
            message: "File is required"
        });
    }

    const receiver = req.body.receiver;

    if (!isValidObjectId(receiver)) {
        removeTemporaryUpload(req.file);
        return res.status(400).json({
            message: "A valid receiver ID is required"
        });
    }

    if (receiver === req.userId) {
        removeTemporaryUpload(req.file);
        return res.status(400).json({
            message: "You cannot send a file message to yourself"
        });
    }

    const receiverUser = await User.findById(receiver)
        .select("-password");

    if (!receiverUser) {
        removeTemporaryUpload(req.file);
        return res.status(404).json({
            message: "Receiver user not found"
        });
    }

    let file = null;

    try {

        file = await createFileRecord(req.file, {
            uploadedBy: req.userId
        });

        const message = await Message.create({
            sender: req.userId,
            receiver: receiver,
            messageType: "file",
            message: "",
            file: file._id
        });

        const populatedMessage = await Message.findById(message._id)
            .populate("sender", "name email")
            .populate("receiver", "name email")
            .populate("file");

        const io = req.app.get("io");

        if (io) {
            io.to(receiver).emit("newMessage", populatedMessage);
        }

        await createNotification({
            user: receiver,
            type: "message",
            title: "New file message",
            message: `You received a file from ${populatedMessage.sender.name}`,
            relatedId: message._id,
            io: io
        });

        return res.status(201).json({
            message: "File message sent successfully",
            data: populatedMessage
        });

    } catch (error) {

        if (file) {
            await Message.updateMany(
                { file: file._id },
                { $set: { file: null } }
            );
            await File.findByIdAndDelete(file._id);
            removeUpload(file.fileName);
        } else {
            removeTemporaryUpload(req.file);
        }

        throw error;

    }

};

const attachFile = async (req, res) => {

    if (!req.file) {
        return res.status(400).json({
            message: "File is required"
        });
    }

    const projectId = req.body.projectId || null;
    const taskId = req.body.taskId || null;

    const reject = (status, message) => {
        removeTemporaryUpload(req.file);
        return res.status(status).json({ message: message });
    };

    if (projectId && taskId) {
        return reject(
            400,
            "File can be attached to a project or a task, not both"
        );
    }

    if (!projectId && !taskId) {
        return reject(400, "Project ID or Task ID is required");
    }

    let access = null;
    let resolvedProjectId = null;
    let resolvedTaskId = null;

    if (projectId) {

        if (!isValidObjectId(projectId)) {
            return reject(400, "Invalid project ID");
        }

        access = await checkProjectAccess(projectId, req.userId);

        if (!access.allowed) {
            return reject(
                access.status,
                accessDeniedMessage(
                    access.status,
                    "Project not found",
                    "You are not a member of this project"
                )
            );
        }

        resolvedProjectId = access.project._id;

    } else {

        if (!isValidObjectId(taskId)) {
            return reject(400, "Invalid task ID");
        }

        access = await checkTaskAccess(taskId, req.userId);

        if (!access.allowed) {
            return reject(
                access.status,
                accessDeniedMessage(
                    access.status,
                    "Task not found",
                    "You are not a member of this project"
                )
            );
        }

        resolvedProjectId = access.project._id;
        resolvedTaskId = access.task._id;

    }

    try {

        const file = await createFileRecord(req.file, {
            uploadedBy: req.userId,
            project: resolvedProjectId,
            task: resolvedTaskId
        });

        return res.status(201).json({
            message: "File attached successfully",
            file: file
        });

    } catch (error) {

        removeTemporaryUpload(req.file);
        throw error;

    }

};

const getProjectFiles = async (req, res) => {

    const access = await checkProjectAccess(
        req.params.projectId,
        req.userId
    );

    if (!access.allowed) {
        return res.status(access.status).json({
            message: accessDeniedMessage(
                access.status,
                "Project not found",
                "You are not a member of this project"
            )
        });
    }

    const files = await File.find({
        project: access.project._id
    })
        .populate("uploadedBy", "name email")
        .sort({ createdAt: -1 });

    return res.status(200).json({
        files: files
    });

};

const getTaskFiles = async (req, res) => {

    const access = await checkTaskAccess(
        req.params.taskId,
        req.userId
    );

    if (!access.allowed) {
        return res.status(access.status).json({
            message: accessDeniedMessage(
                access.status,
                "Task not found",
                "You are not a member of this project"
            )
        });
    }

    const files = await File.find({
        task: access.task._id
    })
        .populate("uploadedBy", "name email")
        .sort({ createdAt: -1 });

    return res.status(200).json({
        files: files
    });

};

const loadAccessibleFile = async (fileId, userId) => {
    if (!isValidObjectId(fileId)) {
        return { allowed: false, status: 404, file: null };
    }

    const file = await File.findById(fileId);

    if (!file) {
        return { allowed: false, status: 404, file: null };
    }

    const access = await checkFileAccess(file, userId);

    return { ...access, file: file };
};

const getFile = async (req, res) => {

    const access = await loadAccessibleFile(req.params.fileId, req.userId);

    if (!access.allowed) {
        return res.status(access.status).json({
            message: accessDeniedMessage(
                access.status,
                "File not found",
                "You do not have permission to access this file"
            )
        });
    }

    const file = await File.findById(access.file._id)
        .populate("uploadedBy", "name email");

    return res.status(200).json({
        file: file
    });

};

const downloadFile = async (req, res) => {

    const access = await loadAccessibleFile(req.params.fileId, req.userId);

    if (!access.allowed) {
        return res.status(access.status).json({
            message: accessDeniedMessage(
                access.status,
                "File not found",
                "You do not have permission to download this file"
            )
        });
    }

    const filePath = resolveUploadPath(access.file.fileName);

    if (!filePath) {
        return res.status(404).json({
            message: "Physical file not found"
        });
    }

    return res.download(
        filePath,
        access.file.originalName,
        (error) => {

            if (error && !res.headersSent) {
                console.log(
                    "File download failed:",
                    access.file._id,
                    error.code || error.message
                );

                return res.status(404).json({
                    message: "Physical file not found"
                });
            }

        }
    );

};

const deleteFile = async (req, res) => {

    if (!isValidObjectId(req.params.fileId)) {
        return res.status(404).json({
            message: "File not found"
        });
    }

    const file = await File.findById(req.params.fileId);

    const access = await checkFileManagement(file, req.userId);

    if (!access.allowed) {
        return res.status(access.status).json({
            message: accessDeniedMessage(
                access.status,
                "File not found",
                "You can only delete your own files"
            )
        });
    }

    await Message.updateMany(
        { file: file._id },
        { $set: { file: null } }
    );

    await File.findByIdAndDelete(file._id);

    removeUpload(file.fileName);

    return res.status(200).json({
        message: "File deleted successfully"
    });

};

const getFiles = async (req, res) => {
    const files = await listFiles(req.user);

    return res.status(200).json({
        message: "Files fetched successfully",
        files
    });
};

const getFolders = async (req, res) => {
    const folders = await listFileFolders(req.user);

    return res.status(200).json({
        message: "Folders fetched successfully",
        folders
    });
};

module.exports = {
    uploadFile,
    sendFileMessage,
    attachFile,
    getProjectFiles,
    getTaskFiles,
    getFile,
    downloadFile,
    deleteFile,
    getFiles,
    getFolders
};
