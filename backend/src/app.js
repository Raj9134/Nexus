
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/authRoutes");
const organizationRoutes = require("./routes/organizationRoutes");
const projectRoutes = require("./routes/project.routes");
const taskRoutes = require("./routes/task.routes");
const commentRoutes = require("./routes/comment.routes");
const activityRoutes = require("./routes/activity.routes");
const messageRoutes = require("./routes/messageRoutes");
const callRoutes = require("./routes/callRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const searchRoutes = require("./routes/searchRoutes");
const fileRoutes = require("./routes/fileRoutes");
const channelRoutes = require("./routes/channelRoutes");
const calendarRoutes = require("./routes/calendarRoutes");
const auditRoutes = require("./routes/auditRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");
const teamRoutes = require("./routes/teamRoutes");
const onboardingRoutes = require("./routes/onboardingRoutes");
const supportRoutes = require("./routes/supportRoutes");

const app = express();

const DEFAULT_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:8080",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:8080",
    "http://127.0.0.1:3000"
];

const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean)
    : DEFAULT_ORIGINS;

app.use(cors({
    origin: allowedOrigins,
    credentials: true
}));

app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/organizations", organizationRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/activities", activityRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/calls", callRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/files", fileRoutes);
app.use("/api/channels", channelRoutes);
app.use("/api/calendar", calendarRoutes);
app.use("/api/audit-logs", auditRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/team", teamRoutes);
app.use("/api/onboarding", onboardingRoutes);
app.use("/api/support", supportRoutes);


app.get("/", (req, res) => {

    res.json({

        message: "NEXUS API is running"

    });

});


app.use((error, req, res, next) => {

    if (error.code === "LIMIT_FILE_SIZE") {

        return res.status(400).json({

            message: "File cannot exceed 10 MB"

        });

    }


    if (
        error.message ===
        "File type is not allowed"
    ) {

        return res.status(400).json({

            message: "File type is not allowed"

        });

    }


    if (
        error.message ===
        "Only supported audio files are allowed"
    ) {

        return res.status(400).json({

            message: "Only supported audio files are allowed"

        });

    }


    if (error.code === "LIMIT_UNEXPECTED_FILE") {

        return res.status(400).json({

            message: "Unexpected file field"

        });

    }


    console.log(
        "Global error:",
        error.message
    );


    return res.status(500).json({

        message: "Something went wrong"

    });

});


module.exports = app;

