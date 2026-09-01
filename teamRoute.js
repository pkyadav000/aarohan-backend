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

        // Get all users once.
        const allUsers = await User.find({})
            .select(
                "userId name mobile status package sponsorId createdAt"
            )
            .sort({ createdAt: -1 })
            .lean();

        // Normalize IDs for reliable comparison.
        const normalizedUsers = allUsers.map(user => ({
            ...user,
            userId: String(user.userId || "").trim().toUpperCase(),
            sponsorId: String(user.sponsorId || "").trim().toUpperCase()
        }));

        // Direct referrals.
        const directUsers = normalizedUsers.filter(
            user => user.sponsorId === sponsorId
        );

        // Build complete downline recursively.
        const downline = [];
        const visited = new Set();

        function collectChildren(parentId) {
            const children = normalizedUsers.filter(
                user =>
                    user.sponsorId === parentId &&
                    !visited.has(user.userId)
            );

            for (const child of children) {
                visited.add(child.userId);
                downline.push(child);
                collectChildren(child.userId);
            }
        }

        collectChildren(sponsorId);

        return res.json({
            success: true,

            // Backward-compatible fields
            count: directUsers.length,
            users: directUsers,

            // New team fields
            directCount: directUsers.length,
            directUsers,

            totalDownline: downline.length,
            downline
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
