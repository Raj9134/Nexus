const { listUsers } = require("../services/workspaceService");

const getTeam = async (req, res) => {
    const team = await listUsers(req.user);

    return res.status(200).json({
        message: "Team fetched successfully",
        team,
        users: team
    });
};

module.exports = {
    getTeam
};
