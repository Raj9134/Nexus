const fs = require("fs");
const path = require("path");

/*
    Uploads live on the local disk by default. On a hosted platform the container
    filesystem is usually ephemeral, so every attachment and voice note would
    vanish on the next deploy or restart. UPLOAD_DIR points the whole tree at a
    mounted volume instead, which is what makes the file and voice features
    survive a restart.

    But UPLOAD_DIR can name a path the process cannot create -- on a host where
    the root filesystem is read-only, /var/data does not exist until a disk is
    mounted and mkdirSync throws EACCES or ENOENT. That throw happened inside
    multer's destination callback, which Express never sees, so the process died
    outright: every file and voice upload returned an empty reply and a 502, and
    a single misconfigured variable took down sign-in-adjacent features rather
    than failing them. The path is probed once here, and an unusable one falls
    back to the directory that is known to be writable, so the worst outcome is
    files not surviving a redeploy rather than the service not running.
*/
const defaultUploadRoot = path.resolve(__dirname, "..", "..", "uploads");

const canCreate = (directory) => {
    try {
        fs.mkdirSync(directory, { recursive: true });
        fs.accessSync(directory, fs.constants.W_OK);
        return true;
    } catch (error) {
        return false;
    }
};

const resolveUploadRoot = () => {
    if (!process.env.UPLOAD_DIR) {
        return defaultUploadRoot;
    }

    const configured = path.resolve(process.env.UPLOAD_DIR);

    if (canCreate(configured)) {
        return configured;
    }

    if (canCreate(defaultUploadRoot)) {
        console.warn(
            `[storage] UPLOAD_DIR "${process.env.UPLOAD_DIR}" is not writable here, ` +
            `falling back to ${defaultUploadRoot}. Files will not survive a restart ` +
            `until the path is corrected or a disk is mounted.`
        );

        return defaultUploadRoot;
    }

    throw new Error(
        "No writable upload directory: UPLOAD_DIR and the project default are both unwritable"
    );
};

const UPLOAD_ROOT = resolveUploadRoot();

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
