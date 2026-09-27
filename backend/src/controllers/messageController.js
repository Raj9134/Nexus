const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const Message = require("../models/Message");
const User = require("../models/User");
const File = require("../models/File");

const { createNotification } = require("../services/notificationService");
const auditService = require("../services/auditService");
const { checkChannelAccess } = require("../services/permissionService");
const { listMessages } = require("../services/workspaceService");
const { resolveAudioPath, removeAudio, removeUpload, removeTemporaryUpload } = require("../config/storage");
const { serializeMessage, idOf } = require("../utils/serialize");

const MESSAGE_MAX = 4000;
const MAX_AUDIO_SECONDS = 300;

const CONTENT_TYPES = {
    ".webm": "audio/webm",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
    ".m4a": "audio/mp4",
    ".aac": "audio/aac",
    ".mp4": "audio/mp4"
};

const cleanText = (value) => {
    return typeof value === "string" ? value.trim() : "";
};

const isValidId = (value) => {
    return mongoose.Types.ObjectId.isValid(value);
};

const emitToParticipant = (io, message, event, payload) => {
    if (!io) {
        return;
    }

    if (message.channel) {
        io.to(`channel:${message.channel}`).emit(event, payload);
        return;
    }

    if (message.receiver) {
        io.to(idOf(message.receiver)).emit(event, payload);
    }
};

const sendMessage = async (req, res) => {
    try {
        const text = cleanText(req.body.message !== undefined ? req.body.message : req.body.body);
        const channel = cleanText(req.body.channel).toLowerCase();
        const receiver = req.body.receiver;

        if (!text) {
            return res.status(400).json({
                message: "Message text is required"
            });
        }

        if (text.length > MESSAGE_MAX) {
            return res.status(400).json({
                message: `Message cannot exceed ${MESSAGE_MAX} characters`
            });
        }

        const io = req.app.get("io");

        if (channel) {
            const access = await checkChannelAccess(channel, req.user);

            if (!access.allowed) {
                return res.status(access.status).json({
                    message: access.status === 404
                        ? "Channel not found"
                        : "You are not allowed to post in this channel"
                });
            }

            const created = await Message.create({
                sender: req.userId,
                channel: access.channel ? access.channel.name : channel,
                messageType: "text",
                message: text
            });

            const populated = await Message.findById(created._id)
                .populate("sender", "name avatar");

            const payload = serializeMessage(populated, populated.sender ? populated.sender.name : "");

            if (io) {
                io.to(`channel:${payload.channel}`).emit("newChannelMessage", payload);
            }

            return res.status(201).json({
                message: "Message sent successfully",
                data: payload
            });
        }

        if (!receiver) {
            return res.status(400).json({
                message: "A channel or a receiver is required"
            });
        }

        if (!isValidId(receiver)) {
            return res.status(400).json({ message: "Invalid receiver ID" });
        }

        if (String(receiver) === req.userId) {
            return res.status(400).json({
                message: "You cannot send a message to yourself"
            });
        }

        const receiverUser = await User.findById(receiver);

        if (!receiverUser) {
            return res.status(404).json({ message: "Receiver user not found" });
        }

        const newMessage = await Message.create({
            sender: req.userId,
            receiver,
            messageType: "text",
            message: text
        });

        await createNotification({
            user: receiver,
            type: "message",
            title: "New message",
            message: text,
            relatedId: newMessage._id,
            io
        });

        const populated = await Message.findById(newMessage._id)
            .populate("sender", "name avatar");

        const payload = serializeMessage(populated, populated.sender ? populated.sender.name : "");

        if (io) {
            io.to(String(receiver)).emit("newMessage", payload);
        }

        return res.status(201).json({
            message: "Message sent successfully",
            data: payload
        });
    } catch (error) {
        return res.status(500).json({
            message: "Error sending message",
            error: error.message
        });
    }
};

const getWorkspaceMessages = async (req, res) => {
    const result = await listMessages(req.user, {
        channel: req.query.channel,
        limit: req.query.limit
    });

    if (!result.allowed) {
        return res.status(result.status).json({
            message: "You are not allowed to read this channel"
        });
    }

    return res.status(200).json({
        message: "Messages fetched successfully",
        messages: result.messages
    });
};

const getMessages = async (req, res) => {
    try {
        const { userId } = req.params;

        if (!isValidId(userId)) {
            return res.status(400).json({ message: "Invalid user ID" });
        }

        const messages = await Message.find({
            isDeleted: false,
            $or: [
                { sender: req.userId, receiver: userId },
                { sender: userId, receiver: req.userId }
            ]
        })
            .populate("sender", "name avatar")
            .sort({ createdAt: 1 });

        return res.status(200).json({
            message: "Messages fetched successfully",
            messages: messages.map((message) => serializeMessage(
                message,
                message.sender ? message.sender.name : ""
            ))
        });
    } catch (error) {
        return res.status(500).json({
            message: "Error fetching messages",
            error: error.message
        });
    }
};

const createVoiceMessage = async (req, res) => {
    try {
        const sender = req.userId;
        const receiver = req.body.receiver;
        const channel = cleanText(req.body.channel).toLowerCase();
        const duration = Number(req.body.duration);

        if (!channel && !receiver) {
            return res.status(400).json({
                message: "A channel or a receiver is required"
            });
        }

        if (!channel && String(receiver) === sender) {
            return res.status(400).json({
                message: "You cannot send a voice message to yourself"
            });
        }

        if (!duration || Number.isNaN(duration) || duration <= 0) {
            return res.status(400).json({ message: "Valid audio duration is required" });
        }

        if (duration > MAX_AUDIO_SECONDS) {
            return res.status(400).json({
                message: "Audio duration cannot exceed 5 minutes"
            });
        }

        let channelName = null;

        if (channel) {
            const access = await checkChannelAccess(channel, req.user);

            if (!access.allowed) {
                return res.status(access.status).json({
                    message: access.status === 404
                        ? "Channel not found"
                        : "You are not allowed to post in this channel"
                });
            }

            channelName = access.channel ? access.channel.name : channel;
        } else {
            if (!isValidId(receiver)) {
                return res.status(400).json({ message: "Invalid receiver ID" });
            }

            const receiverUser = await User.findById(receiver);

            if (!receiverUser) {
                return res.status(404).json({ message: "Receiver user not found" });
            }
        }

        if (!req.file) {
            return res.status(400).json({ message: "Audio file is required" });
        }

        const voiceMessage = await Message.create({
            sender,
            receiver: channelName ? null : receiver,
            channel: channelName,
            messageType: "voice",
            audioUrl: "",
            audioFileName: req.file.filename,
            duration
        });

        voiceMessage.audioUrl = `/api/messages/voice/${voiceMessage._id}`;

        await voiceMessage.save();

        const io = req.app.get("io");
        const populated = await Message.findById(voiceMessage._id)
            .populate("sender", "name avatar");

        const payload = serializeMessage(populated, populated.sender ? populated.sender.name : "");

        emitToParticipant(io, voiceMessage, "newVoiceMessage", payload);

        if (!channelName) {
            await createNotification({
                user: receiver,
                type: "message",
                title: "New voice message",
                message: "You received a voice message",
                relatedId: voiceMessage._id,
                io
            });
        }

        return res.status(201).json({
            message: "Voice message sent successfully",
            voiceMessage: payload
        });
    } catch (error) {
        removeTemporaryUpload(req.file);

        console.log("Error creating voice message:", error.message);

        return res.status(500).json({ message: "Server error" });
    }
};

const updateMessage = async (req, res) => {
    try {
        const { messageId } = req.params;
        const text = cleanText(req.body.message !== undefined ? req.body.message : req.body.body);

        if (!isValidId(messageId)) {
            return res.status(400).json({ message: "Invalid message ID" });
        }

        if (!text) {
            return res.status(400).json({ message: "Message cannot be empty" });
        }

        if (text.length > MESSAGE_MAX) {
            return res.status(400).json({
                message: `Message cannot exceed ${MESSAGE_MAX} characters`
            });
        }

        const existingMessage = await Message.findById(messageId);

        if (!existingMessage) {
            return res.status(404).json({ message: "Message not found" });
        }

        if (idOf(existingMessage.sender) !== req.userId) {
            return res.status(403).json({ message: "You can only edit your own message" });
        }

        if (existingMessage.isDeleted) {
            return res.status(400).json({ message: "Deleted message cannot be edited" });
        }

        if (existingMessage.messageType !== "text") {
            return res.status(400).json({ message: "Only text messages can be edited" });
        }

        existingMessage.message = text;
        existingMessage.isEdited = true;
        existingMessage.editedAt = new Date();

        await existingMessage.save();

        const io = req.app.get("io");
        const populated = await Message.findById(existingMessage._id)
            .populate("sender", "name avatar");

        const payload = serializeMessage(populated, populated.sender ? populated.sender.name : "");

        emitToParticipant(io, existingMessage, "messageUpdated", payload);

        return res.status(200).json({
            message: "Message updated successfully",
            data: payload
        });
    } catch (error) {
        return res.status(500).json({
            message: "Error updating message",
            error: error.message
        });
    }
};

const deleteMessage = async (req, res) => {
    try {
        const { messageId } = req.params;

        if (!isValidId(messageId)) {
            return res.status(400).json({ message: "Invalid message ID" });
        }

        const existingMessage = await Message.findById(messageId);

        if (!existingMessage) {
            return res.status(404).json({ message: "Message not found" });
        }

        if (idOf(existingMessage.sender) !== req.userId) {
            return res.status(403).json({ message: "You can only delete your own message" });
        }

        if (existingMessage.isDeleted) {
            return res.status(400).json({ message: "Message is already deleted" });
        }

        if (existingMessage.file) {
            const file = await File.findById(existingMessage.file);

            if (file) {
                removeUpload(file.fileName);
                await File.findByIdAndDelete(file._id);
            }

            existingMessage.file = null;
        }

        if (existingMessage.messageType === "voice" && existingMessage.audioFileName) {
            removeAudio(existingMessage.audioFileName);

            existingMessage.audioFileName = null;
            existingMessage.audioUrl = null;
            existingMessage.duration = null;
        }

        existingMessage.isDeleted = true;
        existingMessage.deletedAt = new Date();
        existingMessage.message = "";

        await existingMessage.save();

        const io = req.app.get("io");

        emitToParticipant(io, existingMessage, "messageDeleted", { messageId });

        await auditService.record({
            req,
            action: "Deleted message",
            resource: existingMessage.channel ? `#${existingMessage.channel}` : "direct message",
            resourceId: String(existingMessage._id),
            status: "Warning",
            detail: "Message deleted"
        });

        return res.status(200).json({
            message: "Message deleted successfully",
            data: { id: messageId }
        });
    } catch (error) {
        return res.status(500).json({
            message: "Error deleting message",
            error: error.message
        });
    }
};

const markMessageAsRead = async (req, res) => {
    try {
        const { messageId } = req.params;

        if (!isValidId(messageId)) {
            return res.status(400).json({ message: "Invalid message ID" });
        }

        const existingMessage = await Message.findById(messageId);

        if (!existingMessage) {
            return res.status(404).json({ message: "Message not found" });
        }

        if (!existingMessage.receiver) {
            return res.status(400).json({ message: "Channel messages are not tracked per user" });
        }

        if (idOf(existingMessage.receiver) !== req.userId) {
            return res.status(403).json({ message: "You can only read messages sent to you" });
        }

        if (existingMessage.isDeleted) {
            return res.status(400).json({ message: "Deleted message cannot be marked as read" });
        }

        if (existingMessage.isRead) {
            return res.status(200).json({
                message: "Message is already read",
                data: { id: messageId }
            });
        }

        existingMessage.isRead = true;
        existingMessage.readAt = new Date();

        await existingMessage.save();

        const io = req.app.get("io");

        if (io) {
            io.to(idOf(existingMessage.sender)).emit("messageRead", {
                messageId: existingMessage._id,
                readAt: existingMessage.readAt
            });
        }

        return res.status(200).json({
            message: "Message marked as read",
            data: { id: messageId }
        });
    } catch (error) {
        return res.status(500).json({
            message: "Error marking message as read",
            error: error.message
        });
    }
};

const streamVoiceMessage = async (req, res) => {
    try {
        const { messageId } = req.params;

        if (!isValidId(messageId)) {
            return res.status(400).json({ message: "Invalid message ID" });
        }

        const voiceMessage = await Message.findById(messageId);

        if (!voiceMessage) {
            return res.status(404).json({ message: "Message not found" });
        }

        if (voiceMessage.messageType !== "voice") {
            return res.status(400).json({ message: "This message is not a voice message" });
        }

        if (voiceMessage.isDeleted) {
            return res.status(404).json({ message: "Voice message has been deleted" });
        }

        const isSender = idOf(voiceMessage.sender) === req.userId;
        const isReceiver = voiceMessage.receiver
            ? idOf(voiceMessage.receiver) === req.userId
            : false;

        if (voiceMessage.channel) {
            const access = await checkChannelAccess(voiceMessage.channel, req.user);

            if (!access.allowed) {
                return res.status(access.status).json({
                    message: "You are not allowed to access this voice message"
                });
            }
        } else if (!isSender && !isReceiver) {
            return res.status(403).json({
                message: "You are not allowed to access this voice message"
            });
        }

        if (!voiceMessage.audioFileName) {
            return res.status(404).json({ message: "Audio file not found" });
        }

        const audioFilePath = resolveAudioPath(voiceMessage.audioFileName);

        if (!audioFilePath || !fs.existsSync(audioFilePath)) {
            return res.status(404).json({ message: "Audio file not found" });
        }

        const extension = path.extname(voiceMessage.audioFileName).toLowerCase();
        const contentType = CONTENT_TYPES[extension] || "application/octet-stream";

        res.setHeader("Content-Type", contentType);
        res.setHeader("Content-Disposition", "inline");

        const audioStream = fs.createReadStream(audioFilePath);

        audioStream.on("error", () => {
            if (!res.headersSent) {
                res.status(500).json({ message: "Error streaming audio" });
            } else {
                res.end();
            }
        });

        audioStream.pipe(res);
    } catch (error) {
        console.log("Error streaming voice message:", error.message);

        if (!res.headersSent) {
            res.status(500).json({ message: "Error streaming voice message" });
        }
    }
};

module.exports = {
    sendMessage,
    getWorkspaceMessages,
    getMessages,
    createVoiceMessage,
    updateMessage,
    deleteMessage,
    markMessageAsRead,
    streamVoiceMessage
};
