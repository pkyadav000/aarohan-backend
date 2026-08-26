const User = require("./models/User");

async function updateUserStatus(req, res) {
    try {
        const { userId } = req.params;
        const { action } = req.body;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: "User ID is required."
            });
        }

        if (
            action !== "BLOCK" &&
            action !== "UNBLOCK"
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Action must be BLOCK or UNBLOCK."
            });
        }

        if (userId === req.auth.userId) {
            return res.status(400).json({
                success: false,
                message:
                    "Admin cannot change their own status."
            });
        }

        const user =
            await User.findOne({ userId });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        if (user.role === "ADMIN") {
            return res.status(403).json({
                success: false,
                message:
                    "Admin accounts cannot be blocked here."
            });
        }

        user.active =
            action === "UNBLOCK";

        if (action === "BLOCK") {
            user.status = "SUSPENDED";
        } else if (
            user.status === "SUSPENDED"
        ) {
            user.status = "PACKAGE NOT ACTIVE";
        }

        await user.save();

        return res.json({
            success: true,
            message:
                action === "BLOCK"
                    ? "User blocked successfully."
                    : "User unblocked successfully.",
            user: {
                userId: user.userId,
                name: user.name,
                active: user.active,
                status: user.status
            }
        });

    } catch (error) {
        console.error(
            "USER STATUS ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to update user status."
        });
    }
}

module.exports =
    updateUserStatus;
