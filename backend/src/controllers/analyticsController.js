const { computeAnalytics, ANALYTICS_RANGES } = require("../services/workspaceService");

const { isValidObjectId } = require("../services/permissionService");

/*
    The Analytics page had four filter dropdowns wired to `() => undefined`, so
    choosing a project, a teammate or a date range changed nothing on screen.
    The figures are computed on the server, so the filter has to be applied
    there too: filtering in the client would leave the totals disagreeing with
    the metrics row.

    A malformed value is refused rather than ignored. Silently dropping it would
    answer with unfiltered figures while the screen showed a filter as chosen,
    which is the exact failure this is fixing.
*/
const getAnalytics = async (req, res) => {
    const { projectId, assigneeId, range } = req.query || {};

    if (range !== undefined && !ANALYTICS_RANGES.includes(String(range))) {
        return res.status(400).json({
            message: `Range must be one of: ${ANALYTICS_RANGES.join(", ")}`
        });
    }

    for (const [key, value] of [
        ["projectId", projectId],
        ["assigneeId", assigneeId],
    ]) {
        if (value !== undefined && !isValidObjectId(value)) {
            return res.status(400).json({
                message: `${key} must be a valid id`
            });
        }
    }

    const analytics = await computeAnalytics(req.user, { projectId, assigneeId, range });

    return res.status(200).json({
        message: "Analytics fetched successfully",
        analytics
    });
};

module.exports = {
    getAnalytics
};
