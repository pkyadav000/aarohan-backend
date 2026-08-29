const Deposit = require("./models/Deposit");

async function rejectDeposit(req, res) {
    try {
        const { depositId } = req.params;

        const reason =
            String(req.body?.rejectionReason || "").trim();

        if (!depositId) {
            return res.status(400).json({
                success: false,
                message: "Deposit ID is required."
            });
        }

        const deposit =
            await Deposit.findOne({
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

        // ---------------------------------------------------------
        // REJECT DEPOSIT
        // ---------------------------------------------------------

        deposit.status = "REJECTED";

        deposit.rejectionReason =
            reason;

        deposit.rejectedBy =
            req.auth.userId;

        deposit.rejectedAt =
            new Date();

        await deposit.save();

        return res.json({
            success: true,

            message:
                "Deposit rejected.",

            deposit: {
                depositId:
                    deposit.depositId,

                status:
                    deposit.status,

                rejectionReason:
                    deposit.rejectionReason,

                rejectedBy:
                    deposit.rejectedBy,

                rejectedAt:
                    deposit.rejectedAt
            }
        });

    } catch (error) {

        console.error(
            "REJECT DEPOSIT ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Deposit rejection failed."
        });
    }
}

module.exports =
    rejectDeposit;
