/*
    One allow-list, read once, shared by the HTTP layer, the Socket.IO
    handshake and the boot log.

    This existed twice, differently. app.js read CORS_ORIGINS and otherwise fell
    back to a hardcoded localhost list; server.js read CLIENT_ORIGIN and allowed
    any localhost port outside production. Neither read the other, so setting
    CLIENT_ORIGIN -- the variable DEPLOY.md tells people to set, the one Render
    asks for -- had no effect on ordinary HTTP requests at all. The socket
    handshake was correctly configured while every fetch the browser made was
    refused, which presents as a form stuck on "Please wait..." with nothing in
    the console and a healthy /health.

    Both variables are still honoured, CLIENT_ORIGIN first, because the two
    names are in wide circulation and silently ignoring either would strand
    somebody. CORS_ORIGINS keeps its meaning of a comma-separated list, so a
    second frontend can be added without changing code.
*/

const localPattern = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

const isLocalOrigin = (origin) => {
    if (typeof origin !== "string" || !origin.trim()) {
        return false;
    }

    return localPattern.test(origin.trim());
};

const readList = (value) =>
    String(value || "")
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);

/*
    The deploy-ready list, and the only one used in production. Localhost is
    never appended there: a production API answering same-origin requests from
    a developer's machine is not a convenience, it is an open door, and the
    entire reason the two lists drifted is that the fallback was unconditional.
*/
const getAllowedOrigins = () => {
    const configured = readList(process.env.CLIENT_ORIGIN || process.env.CORS_ORIGINS);

    if (configured.includes("*")) {
        return configured;
    }

    if (process.env.NODE_ENV === "production") {
        return configured;
    }

    const defaults = [
        "http://localhost:5173",
        "http://localhost:8080",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:8080",
        "http://127.0.0.1:3000"
    ];

    return Array.from(new Set([...configured, ...defaults]));
};

/*
    The predicate both layers hand to their own middleware, so the HTTP response
    header and the socket handshake can never disagree about who is allowed.
*/
const isOriginAllowed = (origin) => {
    if (!origin) {
        return true;
    }

    const allowed = getAllowedOrigins();

    if (allowed.includes("*") || allowed.includes(origin.trim())) {
        return true;
    }

    if (process.env.NODE_ENV !== "production" && isLocalOrigin(origin)) {
        return true;
    }

    return false;
};

module.exports = {
    getAllowedOrigins,
    isOriginAllowed,
    isLocalOrigin,
    readList
};
