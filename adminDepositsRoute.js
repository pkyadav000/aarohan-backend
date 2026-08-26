const Deposit = require("./models/Deposit");

async function getAdminDeposits(req, res) {
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
                { depositId: regex },
                { userId: regex },
                { paymentReference: regex }
            ];
        }

        if (
            status === "PENDING" ||
            status === "APPROVED" ||
            status === "REJECTED"
        ) {
            query.status = status;
        }

        const [deposits, total] =
            await Promise.all([
                Deposit.find(query)
                    .select(
                        "depositId userId amount paymentReference status rejectionReason approvedBy approvedAt createdAt"
                    )
                    .sort({
                        createdAt: -1
                    })
                    .skip(skip)
                    .limit(limit)
                    .lean(),

                Deposit.countDocuments(query)
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
            count: deposits.length,
            deposits
        });

    } catch (error) {
        console.error(
            "ADMIN DEPOSITS ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to fetch deposits."
        });
    }
}

module.exports = getAdminDeposits;
