const User = require("./models/User");

async function getTeam(req, res) {
    try {
        const sponsorId = String(req.auth.userId || "")
            .trim()
            .toUpperCase();

        if (!sponsorId) {
            return res.status(401).json({
                success: false,
                message: "Authentication required."
            });
        }

        const users = await User.find({
            sponsorId: sponsorId
        })
        .select(
            "userId name mobile status package sponsorId createdAt"
        )
        .sort({ createdAt: -1 })
        .lean();

        return res.json({
            success: true,
            count: users.length,
            users
        });

    } catch (error) {
        console.error("TEAM ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to load team."
        });
    }
}

module.exports = getTeam;
