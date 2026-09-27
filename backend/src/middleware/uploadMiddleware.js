const multer = require("multer");
const path = require("path");

const {
    UPLOAD_ROOT,
    ensureDirectory
} = require("../config/storage");

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const storage = multer.diskStorage({

    destination: (req, file, cb) => {
        cb(null, ensureDirectory(UPLOAD_ROOT));
    },

    filename: (req, file, cb) => {

        const safeFileName = file.originalname
            .replace(/[^a-zA-Z0-9._-]/g, "_");

        const uniqueName =
            Date.now() +
            "-" +
            Math.round(Math.random() * 1000000000) +
            "-" +
            safeFileName;

        cb(null, uniqueName);

    }

});

const allowedTypes = new Map([

    [".jpg", ["image/jpeg"]],
    [".jpeg", ["image/jpeg"]],
    [".png", ["image/png"]],
    [".webp", ["image/webp"]],
    [".pdf", ["application/pdf"]],
    [".doc", ["application/msword"]],
    [".docx", ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"]],
    [".xls", ["application/vnd.ms-excel"]],
    [".xlsx", ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]],
    [".zip", ["application/zip", "application/x-zip-compressed"]],
    [".txt", ["text/plain"]]

]);

const allowedExtensions = [...allowedTypes.keys()];

const allowedMimeTypes = [
    ...new Set(
        [...allowedTypes.values()].flat()
    )
];

const isAllowedType = (fileName, mimeType) => {
    const extension = path
        .extname(fileName)
        .toLowerCase();

    const expectedMimeTypes = allowedTypes.get(extension);

    if (!expectedMimeTypes) {
        return false;
    }

    return expectedMimeTypes.includes(
        String(mimeType).toLowerCase()
    );

};

const fileFilter = (req, file, cb) => {

    if (isAllowedType(file.originalname, file.mimetype)) {
        cb(null, true);
        return;
    }

    cb(
        new Error("File type is not allowed"),
        false
    );

};


const upload = multer({

    storage: storage,

    fileFilter: fileFilter,

    limits: {
        fileSize: MAX_FILE_SIZE,
        files: 1
    }

});

module.exports = upload;
module.exports.MAX_FILE_SIZE = MAX_FILE_SIZE;
module.exports.allowedMimeTypes = allowedMimeTypes;
module.exports.allowedExtensions = allowedExtensions;
module.exports.isAllowedType = isAllowedType;
