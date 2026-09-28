const fs = require("fs");
const path = require("path");

/*
    Uploads live on the local disk by default. On a hosted platform the container
    filesystem is usually ephemeral, so every attachment and voice note would
    vanish on the next deploy or restart. UPLOAD_DIR points the whole tree at a
    mounted volume instead, which is what makes the file and voice features
    survive a restart.
*/
const UPLOAD_ROOT = process.env.UPLOAD_DIR
    ? path.resolve(process.env.UPLOAD_DIR)
    : path.resolve(__dirname, "..", "..", "uploads");

const AUDIO_ROOT = path.join(UPLOAD_ROOT, "audio");

const ensureDirectory = (directory) => {
    fs.mkdirSync(directory, { recursive: true });
    return directory;
};

const isInside = (root, target) => {
    const relative = path.relative(root, target);
    return Boolean(relative)
        && !relative.startsWith("..")
        && !path.isAbsolute(relative);
};

const resolveStoredPath = (root, fileName) => {
    if (typeof fileName !== "string" || !fileName.trim()) {
        return null;
    }

    const safeName = path.basename(fileName);

    if (!safeName || safeName === "." || safeName === "..") {
        return null;
    }

    const resolved = path.resolve(root, safeName);

    if (!isInside(root, resolved)) {
        return null;
    }

    return resolved;
};

const resolveUploadPath = (fileName) => {
    return resolveStoredPath(UPLOAD_ROOT, fileName);
};

const resolveAudioPath = (fileName) => {
    return resolveStoredPath(AUDIO_ROOT, fileName);
};

const removeStoredFile = (filePath) => {
    if (!filePath) {
        return false;
    }

    try {
        if (!fs.existsSync(filePath)) {
            return false;
        }

        fs.unlinkSync(filePath);
        return true;

    } catch (error) {
        return false;
    }
};

const removeUpload = (fileName) => {
    return removeStoredFile(resolveUploadPath(fileName));
};

const removeAudio = (fileName) => {
    return removeStoredFile(resolveAudioPath(fileName));
};

const removeTemporaryUpload = (multerFile) => {
    if (!multerFile) {
        return false;
    }

    return removeUpload(multerFile.filename);
};

module.exports = {
    UPLOAD_ROOT,
    AUDIO_ROOT,
    ensureDirectory,
    resolveUploadPath,
    resolveAudioPath,
    removeUpload,
    removeAudio,
    removeTemporaryUpload
};
