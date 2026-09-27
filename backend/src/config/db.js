const mongoose = require("mongoose");

/**
 * Resolves only on a successful connection.
 * Rejects on failure so the caller can abort startup instead of
 * running an API that silently fails every database query.
 */
const connectDatabase = async () => {
    if (!process.env.MONGO_URI) {
        throw new Error("MONGO_URI is not defined");
    }

    try {
        await mongoose.connect(process.env.MONGO_URI);

        console.log("MongoDB connected successfully");

        return mongoose.connection;
    } catch (error) {
        console.error("MongoDB connection failed:", error.message);

        throw error;
    }
};

module.exports = connectDatabase;
