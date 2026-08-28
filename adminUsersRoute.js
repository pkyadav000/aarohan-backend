const User = require("./models/User");

async function getAdminUsers(req, res) {
    try {
        const page =
            Math.max(
                parseInt(req.query.page, 10) || 1,
                1
            );

        const limit =
            Math.min(
                Math.max(
                    parseInt(req.query.limit, 10) || 20,
                    1
                ),
                100
            );

        const skip = (page - 1) * limit;

        const search =
            String(req.query.search || "").trim();

        const status =
            String(req.query.status || "")
                .trim()
                .toUpperCase();

        const query = {};

        if (search) {
            const escaped =
                search.replace(
                    /[.*+?^${}()|[\]\\]/g,
                    "\\$&"
                );

            const regex =
                new RegExp(escaped, "i");

                       query.$or = [
                { userId: regex },
                { name: regex },
                { email: regex },
                { mobile: regex }
            ];
        }

        if (status === "ACTIVE") {
    query.status = "ACTIVE";
}

if (status === "BLOCKED") {
    query.status = "SUSPENDED";
}

        const [users, total] =
            await Promise.all([
                User.find(query)
                    .select(
    "userId name email mobile role status package walletBal totalEarned roiEarned teamEarned referrals sponsorId createdAt"
                    )
                    .sort({
                        createdAt: -1
                    })
                    .skip(skip)
                    .limit(limit)
                    .lean(),

                User.countDocuments(query)
            ]);

        return res.json({
            success: true,
            pagination: {
                page,
                limit,
                total,
                totalPages:
                    Math.ceil(total / limit)
            },
            count: users.length,
            users
        });

    } catch (error) {
        console.error(
            "ADMIN USERS ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to fetch users."
        });
    }
}

module.exports =
    getAdminUsers;
