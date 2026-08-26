const Withdrawal = require("./models/Withdrawal");
const User = require("./models/User");

async function createWithdrawal(req, res) {
    try {
        const { amount, upiId } = req.body;

        const numericAmount = Number(amount);
        const cleanUpiId =
            String(upiId || "").trim();

        if (
            !Number.isFinite(numericAmount) ||
            numericAmount <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Enter a valid withdrawal amount."
            });
        }

        if (numericAmount > 10000000) {
            return res.status(400).json({
                success: false,
                message: "Withdrawal amount is too large."
            });
        }

        if (!cleanUpiId) {
            return res.status(400).json({
                success: false,
                message: "UPI ID is required."
            });
        }

        const user =
            await User.findOne({
                userId: req.auth.userId
            }).select(
                "userId status walletBal upiId"
            );

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        if (user.status === "SUSPENDED") {
            return res.status(403).json({
                success: false,
                message: "Your account is suspended."
            });
        }

        if (numericAmount > user.walletBal) {
            return res.status(400).json({
                success: false,
                message: "Insufficient wallet balance."
            });
        }

        const lastWithdrawal =
            await Withdrawal.findOne({
                withdrawalId: /^WDR[0-9]+$/
            })
            .sort({ withdrawalId: -1 })
            .select("withdrawalId");

        let nextNumber = 1001;

        if (
            lastWithdrawal &&
            /^WDR[0-9]+$/.test(
                lastWithdrawal.withdrawalId
            )
        ) {
            nextNumber =
                Number(
                    lastWithdrawal.withdrawalId
                        .substring(3)
                ) + 1;
        }

        const withdrawalId =
            "WDR" + nextNumber;

        const withdrawal =
            await Withdrawal.create({
                withdrawalId,
                userId: user.userId,
                amount: numericAmount,
                upiId: cleanUpiId,
                status: "PENDING"
            });

        return res.status(201).json({
            success: true,
            message:
                "Withdrawal submitted for admin approval.",
            withdrawal: {
                withdrawalId:
                    withdrawal.withdrawalId,
                userId:
                    withdrawal.userId,
                amount:
                    withdrawal.amount,
                upiId:
                    withdrawal.upiId,
                status:
                    withdrawal.status
            }
        });

    } catch (error) {

        console.error(
            "WITHDRAWAL ERROR:",
            error
        );

        if (
            error &&
            error.code === 11000
        ) {
            return res.status(409).json({
                success: false,
                message:
                    "Unable to create unique withdrawal ID."
            });
        }

        return res.status(500).json({
            success: false,
            message:
                "Withdrawal submission failed."
        });
    }
}

module.exports =
    createWithdrawal;
