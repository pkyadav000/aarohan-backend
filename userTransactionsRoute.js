const Deposit = require("./models/Deposit");
const Withdrawal = require("./models/Withdrawal");

async function getUserTransactions(req, res) {
    try {
        const userId = req.auth.userId;

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

        const [deposits, withdrawals] =
            await Promise.all([
                Deposit.find({ userId })
                    .select(
                        "depositId amount status paymentReference rejectionReason approvedAt createdAt"
                    )
                    .sort({ createdAt: -1 })
                    .lean(),

                Withdrawal.find({ userId })
                    .select(
                        "withdrawalId amount upiId status rejectionReason approvedAt createdAt"
                    )
                    .sort({ createdAt: -1 })
                    .lean()
            ]);

        const transactions = [
            ...deposits.map(item => ({
                type: "DEPOSIT",
                transactionId: item.depositId,
                amount: item.amount,
                status: item.status,
                reference:
                    item.paymentReference || "",
                rejectionReason:
                    item.rejectionReason || "",
                processedAt:
                    item.approvedAt || null,
                createdAt: item.createdAt
            })),

            ...withdrawals.map(item => ({
                type: "WITHDRAWAL",
                transactionId:
                    item.withdrawalId,
                amount: item.amount,
                status: item.status,
                reference:
                    item.upiId || "",
                rejectionReason:
                    item.rejectionReason || "",
                processedAt:
                    item.approvedAt || null,
                createdAt: item.createdAt
            }))
        ];

        transactions.sort(
            (a, b) =>
                new Date(b.createdAt) -
                new Date(a.createdAt)
        );

        const total = transactions.length;

        const paginated =
            transactions.slice(
                skip,
                skip + limit
            );

        return res.json({
            success: true,
            pagination: {
                page,
                limit,
                total,
                totalPages:
                    Math.ceil(total / limit)
            },
            count: paginated.length,
            transactions: paginated
        });

    } catch (error) {
        console.error(
            "USER TRANSACTIONS ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to fetch transactions."
        });
    }
}

module.exports =
    getUserTransactions;
