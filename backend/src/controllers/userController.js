const User = require("../models/User");

const { serializeUser } = require("../utils/serialize");

const searchUsers = async (req, res) => {

    try {

        const search = req.query.q?.trim();

        if (!search) {
            return res.status(400).json({
                message: "Search query is required"
            });
        }

        const escapedSearch = search.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
        );

        const users = await User.find({
            $or: [
                {
                    name: {
                        $regex: escapedSearch,
                        $options: "i"
                    }
                },
                {
                    email: {
                        $regex: escapedSearch,
                        $options: "i"
                    }
                }
            ]
        })
        .select("-password")
        .limit(20);

        return res.status(200).json({
            count: users.length,
            users: users.map((user) => serializeUser(user))
        });

    } catch (error) {

        return res.status(500).json({
            message: "Server error",
            error: error.message
        });

    }
};

module.exports = {
    searchUsers
};