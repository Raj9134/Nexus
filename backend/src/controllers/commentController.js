const Comment = require("../models/Comment");
const User = require("../models/User");

const { serializeComment } = require("../utils/serialize");

const {
    isValidObjectId,
    checkTaskAccess,
    isUserInProject
} = require("../services/permissionService");

const TEXT_MAX_LENGTH = 5000;
const MAX_MENTIONS = 20;

const cleanText = (value) => {
    return typeof value === "string" ? value.trim() : "";
};

const deniedMessage = (status, notFound, forbidden) => {
    return status === 404 ? notFound : forbidden;
};

const loadOwnedComment = async (commentId, userId) => {
    if (!isValidObjectId(commentId)) {
        return { allowed: false, status: 404, comment: null, project: null };
    }

    const comment = await Comment.findById(commentId);

    if (!comment) {
        return { allowed: false, status: 404, comment: null, project: null };
    }

    const access = await checkTaskAccess(comment.task, userId);

    if (!access.allowed) {
        return {
            allowed: false,
            status: access.status,
            comment: comment,
            project: access.project
        };
    }

    if (comment.user.toString() !== userId) {
        return {
            allowed: false,
            status: 403,
            comment: comment,
            project: access.project
        };
    }

    return {
        allowed: true,
        status: 200,
        comment: comment,
        project: access.project
    };
};

const resolveMentions = (mentions, project) => {
    if (!Array.isArray(mentions)) {
        return null;
    }

    if (mentions.length > MAX_MENTIONS) {
        return null;
    }

    const unique = [...new Set(mentions)];

    for (const userId of unique) {
        if (!isValidObjectId(userId)) {
            return null;
        }

        if (!isUserInProject(project, userId)) {
            return null;
        }
    }

    return unique;
};

const createComment = async (req, res) => {

    const text = cleanText(req.body.text);

    if (!text) {
        return res.status(400).json({
            message: "Comment text is required"
        });
    }

    if (text.length > TEXT_MAX_LENGTH) {
        return res.status(400).json({
            message: `Comment text cannot exceed ${TEXT_MAX_LENGTH} characters`
        });
    }

    const access = await checkTaskAccess(
        req.body.taskId,
        req.userId
    );

    if (!access.allowed) {
        return res.status(access.status).json({
            message: deniedMessage(
                access.status,
                "Task not found",
                "You are not a member of this project"
            )
        });
    }

    const mentions = resolveMentions(
        req.body.mentions || [],
        access.project
    );

    if (mentions === null) {
        return res.status(400).json({
            message: "Mentions must be a list of project member IDs"
        });
    }

    const comment = await Comment.create({
        task: access.task._id,
        user: req.userId,
        text: text,
        mentions: mentions
    });

    const author = await User.findById(req.userId).select("name");

    return res.status(201).json({
        message: "Comment created successfully",
        comment: serializeComment(comment, author && author.name)
    });

};

const getComments = async (req, res) => {

    const access = await checkTaskAccess(
        req.params.taskId,
        req.userId
    );

    if (!access.allowed) {
        return res.status(access.status).json({
            message: deniedMessage(
                access.status,
                "Task not found",
                "You are not a member of this project"
            )
        });
    }

    const comments = await Comment.find({
        task: access.task._id
    }).sort({ createdAt: 1 });

    const authorIds = [...new Set(
        comments
            .map((comment) => (comment.user ? comment.user.toString() : null))
            .filter(Boolean)
    )];

    const authors = await User.find({ _id: { $in: authorIds } }).select("name");
    const authorNames = new Map(authors.map((author) => [author._id.toString(), author.name]));

    return res.status(200).json({
        message: "Comments fetched successfully",
        comments: comments.map((comment) => serializeComment(
            comment,
            authorNames.get(comment.user ? comment.user.toString() : "")
        ))
    });

};

const updateComment = async (req, res) => {

    const access = await loadOwnedComment(req.params.id, req.userId);

    if (!access.allowed) {
        return res.status(access.status).json({
            message: deniedMessage(
                access.status,
                "Comment not found",
                "You cannot modify this comment"
            )
        });
    }

    const text = cleanText(req.body.text);

    if (!text) {
        return res.status(400).json({
            message: "Comment text is required"
        });
    }

    if (text.length > TEXT_MAX_LENGTH) {
        return res.status(400).json({
            message: `Comment text cannot exceed ${TEXT_MAX_LENGTH} characters`
        });
    }

    const comment = access.comment;

    comment.text = text;

    if (req.body.mentions !== undefined) {

        const mentions = resolveMentions(
            req.body.mentions,
            access.project
        );

        if (mentions === null) {
            return res.status(400).json({
                message: "Mentions must be a list of project member IDs"
            });
        }

        comment.mentions = mentions;

    }

    await comment.save();

    const author = await User.findById(comment.user).select("name");

    return res.status(200).json({
        message: "Comment updated successfully",
        comment: serializeComment(comment, author && author.name)
    });

};

const deleteComment = async (req, res) => {

    const access = await loadOwnedComment(req.params.id, req.userId);

    if (!access.allowed) {
        return res.status(access.status).json({
            message: deniedMessage(
                access.status,
                "Comment not found",
                "You cannot modify this comment"
            )
        });
    }

    await Comment.findByIdAndDelete(access.comment._id);

    return res.status(200).json({
        message: "Comment deleted successfully"
    });

};

module.exports = {
    createComment,
    getComments,
    updateComment,
    deleteComment
};
