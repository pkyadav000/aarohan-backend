const Withdrawal = require("./models/Withdrawal");

async function getAdminWithdrawals(req, res) {
    try {
        const page = Math.max(
            parseInt(req.query.page, 10) || 1,
            1
        );

        const limit = Math.min(
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
            const escaped = search.replace(
                /[.*+?^${}()|[\]\\]/g,
                "\\$&"
            );

            const regex = new RegExp(escaped, "i");

            query.$or = [
                { withdrawalId: regex },
                { userId: regex },
                { upiId: regex }
            ];
        }

        if (
            status === "PENDING" ||
            status === "APPROVED" ||
            status === "REJECTED"
        ) {
            query.status = status;
        }

        const [withdrawals, total] =
            await Promise.all([
                Withdrawal.find(query)
                    .select(
                        "withdrawalId userId amount upiId status rejectionReason approvedBy approvedAt createdAt"
                    )
                    .sort({
                        createdAt: -1
                    })
                    .skip(skip)
                    .limit(limit)
                    .lean(),

                Withdrawal.countDocuments(query)
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
            count: withdrawals.length,
            withdrawals
        });

    } catch (error) {
        console.error(
            "ADMIN WITHDRAWALS ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to fetch withdrawals."
        });
    }
}

module.exports = getAdminWithdrawals;
