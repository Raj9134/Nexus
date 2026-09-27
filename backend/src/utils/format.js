const MONTHS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

const FILE_CATEGORIES = {
    pdf: "PDF",
    png: "Image",
    jpg: "Image",
    jpeg: "Image",
    gif: "Image",
    webp: "Image",
    svg: "Image",
    doc: "Document",
    docx: "Document",
    txt: "Document",
    md: "Document",
    xls: "Sheet",
    xlsx: "Sheet",
    csv: "Sheet",
    ppt: "Slide",
    pptx: "Slide",
    zip: "Archive",
    rar: "Archive",
    "7z": "Archive"
};

function toDate(value) {
    if (!value) {
        return null;
    }

    const date = value instanceof Date ? value : new Date(value);

    return Number.isNaN(date.getTime()) ? null : date;
}

function pad(value) {
    return String(value).padStart(2, "0");
}

function shortDate(value) {
    const date = toDate(value);

    if (!date) {
        return "";
    }

    return `${MONTHS[date.getMonth()]} ${pad(date.getDate())}`;
}

function clockTime(value) {
    const date = toDate(value);

    if (!date) {
        return "";
    }

    return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function time12(value) {
    const date = toDate(value);

    if (!date) {
        return "";
    }

    const hours = date.getHours();
    const suffix = hours >= 12 ? "PM" : "AM";
    const display = hours % 12 === 0 ? 12 : hours % 12;

    return `${display}:${pad(date.getMinutes())} ${suffix}`;
}

function auditTimestamp(value) {
    const date = toDate(value);

    if (!date) {
        return "";
    }

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function relativeTime(value) {
    const date = toDate(value);

    if (!date) {
        return "";
    }

    const diffMs = Date.now() - date.getTime();
    const minutes = Math.round(diffMs / 60000);

    if (minutes < 1) {
        return "Just now";
    }

    if (minutes < 60) {
        return `${minutes} min ago`;
    }

    const hours = Math.round(minutes / 60);

    if (hours < 24) {
        return `${hours} hr ago`;
    }

    const days = Math.round(hours / 24);

    if (days === 1) {
        return "Yesterday";
    }

    if (days < 7) {
        return `${days} days ago`;
    }

    return shortDate(date);
}

function formatBytes(bytes) {
    const value = Number(bytes);

    if (!Number.isFinite(value) || value <= 0) {
        return "0 KB";
    }

    if (value < 1024) {
        return `${value} B`;
    }

    const units = ["KB", "MB", "GB", "TB"];
    let size = value / 1024;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex += 1;
    }

    const rounded = size >= 10 ? Math.round(size) : Math.round(size * 10) / 10;

    return `${rounded} ${units[unitIndex]}`;
}

function initials(name) {
    if (!name) {
        return "?";
    }

    const parts = String(name).trim().split(/\s+/).filter(Boolean);

    if (!parts.length) {
        return "?";
    }

    if (parts.length === 1) {
        return parts[0].slice(0, 2).toUpperCase();
    }

    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function fileCategory(name) {
    const raw = String(name || "");
    const match = /\.([a-z0-9]+)$/i.exec(raw);

    if (!match) {
        return "File";
    }

    return FILE_CATEGORIES[match[1].toLowerCase()] || "File";
}

function clampPercent(value) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
        return 0;
    }

    return Math.min(100, Math.max(0, Math.round(number)));
}

function workloadLevel(activeCount, completedCount) {
    const active = Number(activeCount) || 0;
    const done = Number(completedCount) || 0;

    if (active === 0) {
        return "Low";
    }

    if (active <= 4) {
        return done >= active * 2 ? "Low" : "Balanced";
    }

    if (active <= 7) {
        return "Balanced";
    }

    return "High";
}

module.exports = {
    shortDate,
    clockTime,
    time12,
    auditTimestamp,
    relativeTime,
    formatBytes,
    initials,
    fileCategory,
    clampPercent,
    workloadLevel
};
