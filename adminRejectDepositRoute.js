const Deposit = require("./models/Deposit");

async function rejectDeposit(req, res) {
    try {
        const { depositId } = req.params;
        const reason =
            String(req.body?.reason || "").trim();

        if (!depositId) {
            return res.status(400).json({
                success: false,
                message: "Deposit ID is required."
            });
        }

        const deposit = await Deposit.findOne({
            depositId
        });

        if (!deposit) {
            return res.status(404).json({
                success: false,
                message: "Deposit not found."
            });
        }

        if (deposit.status !== "PENDING") {
            return res.status(409).json({
                success: false,
                message:
                    `Deposit is already ${deposit.status.toLowerCase()}.`
            });
        }

        deposit.status = "REJECTED";
        deposit.rejectionReason = reason;
        deposit.approvedBy = req.auth.userId;
        deposit.approvedAt = new Date();

        await deposit.save();

        return res.json({
            success: true,
            message: "Deposit rejected.",
            deposit: {
                depositId: deposit.depositId,
                status: deposit.status,
                rejectionReason:
                    deposit.rejectionReason,
                rejectedBy:
                    deposit.approvedBy,
                rejectedAt:
                    deposit.approvedAt
            }
        });

    } catch (error) {
        console.error(
            "REJECT DEPOSIT ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Deposit rejection failed."
        });
    }
}

module.exports = rejectDeposit;
