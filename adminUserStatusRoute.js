const User = require("./models/User");

async function updateUserStatus(req, res) {
    try {
        const { userId } = req.params;
        const { action } = req.body;

        const cleanUserId =
            String(userId || "")
                .trim()
                .toUpperCase();

        if (!cleanUserId) {
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

        if (
            cleanUserId ===
            String(req.auth.userId || "")
                .trim()
                .toUpperCase()
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Admin cannot change their own status."
            });
        }

        const user =
            await User.findOne({
                userId: cleanUserId
            });

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

        // =====================================================
        // BLOCK USER
        // =====================================================
        if (action === "BLOCK") {

            if (user.status === "SUSPENDED") {
                return res.status(409).json({
                    success: false,
                    message: "User is already suspended."
                });
            }

            // Only ACTIVE / PACKAGE NOT ACTIVE are valid
            // pre-suspension states.
            if (
                user.status !== "ACTIVE" &&
                user.status !== "PACKAGE NOT ACTIVE"
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "User has an invalid account status."
                });
            }

            user.statusBeforeSuspend =
                user.status;

            user.status = "SUSPENDED";

            await user.save();

            return res.json({
                success: true,
                message:
                    "User blocked successfully.",
                user: {
                    userId: user.userId,
                    name: user.name,
                    status: user.status,
                    statusBeforeSuspend:
                        user.statusBeforeSuspend
                }
            });
        }

        // =====================================================
        // UNBLOCK USER
        // =====================================================
        if (action === "UNBLOCK") {

            if (user.status !== "SUSPENDED") {
                return res.status(409).json({
                    success: false,
                    message:
                        "Only suspended users can be unblocked."
                });
            }

            const previousStatus =
                user.statusBeforeSuspend === "ACTIVE" ||
                user.statusBeforeSuspend ===
                    "PACKAGE NOT ACTIVE"
                    ? user.statusBeforeSuspend
                    : "PACKAGE NOT ACTIVE";

            user.status = previousStatus;

            user.statusBeforeSuspend = null;

            await user.save();

            return res.json({
                success: true,
                message:
                    "User unblocked successfully.",
                user: {
                    userId: user.userId,
                    name: user.name,
                    status: user.status,
                    statusBeforeSuspend:
                        user.statusBeforeSuspend
                }
            });
        }

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
