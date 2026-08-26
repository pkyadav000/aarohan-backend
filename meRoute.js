const User = require("./models/User");

async function getMe(req, res) {
    try {
        const user =
            await User.findOne({
                userId: req.auth.userId
            }).select("-password");

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        return res.json({
            success: true,
            user: {
                userId: user.userId,
                name: user.name,
                mobile: user.mobile,
                sponsorId: user.sponsorId,
                status: user.status,
                package: user.package,
                walletBal: user.walletBal,
                totalEarned: user.totalEarned,
                roiEarned: user.roiEarned,
                teamEarned: user.teamEarned,
                referrals: user.referrals
            }
        });

    } catch (error) {
        console.error("ME ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to load user."
        });
    }
}

module.exports = getMe;
