const mongoose = require("mongoose");

const ATTEMPTS = 5;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 15000;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Resolves only on a successful connection.
 *
 * Retries with backoff before giving up. Atlas resolves its hosts through a
 * DNS SRV lookup, and a single timed-out lookup or reset connection would
 * otherwise take the whole API down: the caller aborts startup, so a blip
 * that lasts two seconds looks the same as a misconfigured MONGO_URI.
 */
const connectDatabase = async () => {
    if (!process.env.MONGO_URI) {
        throw new Error("MONGO_URI is not defined");
    }

    let lastError = null;

    for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
        try {
            await mongoose.connect(process.env.MONGO_URI, {
                // Fail fast inside one attempt instead of hanging on a dead
                // socket; the loop below is what provides the patience.
                serverSelectionTimeoutMS: 10000
            });

            console.log(`MongoDB connected successfully (attempt ${attempt})`);

            return mongoose.connection;
        } catch (error) {
            lastError = error;

            if (attempt === ATTEMPTS) {
                break;
            }

            const delay = Math.min(BASE_DELAY_MS * 2 ** (attempt - 1), MAX_DELAY_MS);

            console.error(
                `MongoDB connection attempt ${attempt}/${ATTEMPTS} failed: ${error.message}. Retrying in ${delay}ms`
            );

            await wait(delay);
        }
    }

    console.error("MongoDB connection failed:", lastError && lastError.message);

    throw lastError;
};

module.exports = connectDatabase;
