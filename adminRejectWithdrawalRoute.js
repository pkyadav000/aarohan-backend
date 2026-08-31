const Withdrawal = require("./models/Withdrawal");

async function rejectWithdrawal(req, res) {
    try {
        const { withdrawalId } = req.params;

        const reason =
            String(req.body?.reason || "").trim();

        if (!withdrawalId) {
            return res.status(400).json({
                success: false,
                message: "Withdrawal ID is required."
            });
        }

        const withdrawal =
            await Withdrawal.findOne({
                withdrawalId
            });

        if (!withdrawal) {
            return res.status(404).json({
                success: false,
                message: "Withdrawal not found."
            });
        }

        if (withdrawal.status !== "PENDING") {
            return res.status(409).json({
                success: false,
                message:
                    `Withdrawal is already ${withdrawal.status.toLowerCase()}.`
            });
        }

        // ---------------------------------------------------------
        // REJECT WITHDRAWAL
        // ---------------------------------------------------------

        withdrawal.status = "REJECTED";

        withdrawal.rejectionReason =
            reason;

        withdrawal.rejectedBy =
            req.auth.userId;

        withdrawal.rejectedAt =
            new Date();

        await withdrawal.save();

        return res.json({
            success: true,

            message:
                "Withdrawal rejected.",

            withdrawal: {
                withdrawalId:
                    withdrawal.withdrawalId,

                status:
                    withdrawal.status,

                rejectionReason:
                    withdrawal.rejectionReason,

                rejectedBy:
                    withdrawal.rejectedBy,

                rejectedAt:
                    withdrawal.rejectedAt
            }
        });

    } catch (error) {

        console.error(
            "REJECT WITHDRAWAL ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Withdrawal rejection failed."
        });
    }
}

module.exports = rejectWithdrawal;
