const path = require("path");
const multer = require("multer");

const { AUDIO_ROOT, ensureDirectory } = require("../config/storage");

const ALLOWED_AUDIO = {
    ".webm": ["audio/webm"],
    ".mp3": ["audio/mpeg"],
    ".wav": ["audio/wav", "audio/x-wav"],
    ".ogg": ["audio/ogg"],
    ".m4a": ["audio/mp4", "audio/x-m4a"],
    ".aac": ["audio/aac"],
    ".mp4": ["audio/mp4", "audio/webm"]
};

const isAllowedAudio = (file) => {
    const extension = path.extname(file.originalname || "").toLowerCase();
    const allowed = ALLOWED_AUDIO[extension];

    if (!allowed) {
        return false;
    }

    return allowed.includes(String(file.mimetype || "").toLowerCase());
};

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, ensureDirectory(AUDIO_ROOT));
    },

    filename: function (req, file, cb) {
        const extension = path.extname(file.originalname || "").toLowerCase() || ".webm";
        const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${extension}`;

        cb(null, unique);
    }
});

const uploadAudio = multer({
    storage: storage,

    limits: {
        fileSize: 10 * 1024 * 1024,
        files: 1
    },

    fileFilter: function (req, file, cb) {
        if (isAllowedAudio(file)) {
            cb(null, true);
        } else {
            cb(new Error("Only supported audio files are allowed"));
        }
    }
});

uploadAudio.ALLOWED_AUDIO = ALLOWED_AUDIO;
uploadAudio.isAllowedAudio = isAllowedAudio;

module.exports = uploadAudio;
