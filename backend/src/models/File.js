const mongoose = require("mongoose");

const fileSchema = new mongoose.Schema(
    {
        originalName: {
            type: String,
            required: true,
            maxlength: 255
        },

        fileName: {
            type: String,
            required: true,
            maxlength: 255
        },

        fileUrl: {
            type: String,
            required: true
        },

        mimeType: {
            type: String,
            required: true
        },

        size: {
            type: Number,
            required: true
        },

        uploadedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        project: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Project",
            default: null
        },

        task: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Task",
            default: null
        },

        folder: {
            type: String,
            trim: true,
            maxlength: 80,
            default: "General"
        }
    },
    {
        timestamps: true
    }
);

fileSchema.pre("validate", function () {

    if (!this.fileUrl && this._id) {
        this.fileUrl = `/api/files/download/${this._id}`;
    }

});

module.exports = mongoose.model("File", fileSchema);