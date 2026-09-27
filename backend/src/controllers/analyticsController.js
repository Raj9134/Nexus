const { computeAnalytics } = require("../services/workspaceService");

const getAnalytics = async (req, res) => {
    const analytics = await computeAnalytics(req.user);

    return res.status(200).json({
        message: "Analytics fetched successfully",
        analytics
    });
};

module.exports = {
    getAnalytics
};
