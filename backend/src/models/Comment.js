const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema({

    task: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Task",
        required: true
    },

    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    text: {
        type: String,
        required: true,
        trim: true,
        maxlength: 5000
    },

    mentions: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        }
    ],

}, {
    timestamps: true
});

const Comment = mongoose.model("Comment", commentSchema);

module.exports = Comment;
