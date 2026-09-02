const User = require("./models/User");

async function getWallet(req, res) {
    try {
        const userId = req.auth.userId;

        const user = await User.findOne({ userId })
            .select(
                "userId walletBal totalEarned roiEarned teamEarned directEarned package status"
            )
            .lean();

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        return res.json({
            success: true,
            wallet: {
                userId: user.userId,
                balance: Number(user.walletBal || 0),
                totalEarned: Number(user.totalEarned || 0),
                roiEarned: Number(user.roiEarned || 0),
                teamEarned: Number(user.teamEarned || 0),
                  directEarned: Number(user.directEarned || 0),
                package: Number(user.package || 0),
                status: user.status
            }
        });

    } catch (error) {
        console.error("WALLET ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to fetch wallet."
        });
    }
}

module.exports = getWallet;
