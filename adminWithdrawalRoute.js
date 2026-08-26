const mongoose = require("mongoose");
const Withdrawal = require("./models/Withdrawal");
const User = require("./models/User");

async function approveWithdrawal(req, res) {
    const session = await mongoose.startSession();

    try {
        const { withdrawalId } = req.params;

        if (!withdrawalId) {
            return res.status(400).json({
                success: false,
                message: "Withdrawal ID is required."
            });
        }

        session.startTransaction();

        const withdrawal = await Withdrawal.findOne({
            withdrawalId
        }).session(session);

        if (!withdrawal) {
            await session.abortTransaction();

            return res.status(404).json({
                success: false,
                message: "Withdrawal not found."
            });
        }

        if (withdrawal.status !== "PENDING") {
            await session.abortTransaction();

            return res.status(409).json({
                success: false,
                message:
                    `Withdrawal is already ${withdrawal.status.toLowerCase()}.`
            });
        }

        const user = await User.findOne({
            userId: withdrawal.userId
        }).session(session);

        if (!user) {
            await session.abortTransaction();

            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        /*
         * Atomic balance check + debit.
         * This prevents negative balance and double-debit
         * when approval requests race each other.
         */
        const updatedUser = await User.findOneAndUpdate(
            {
                _id: user._id,
                walletBal: {
                    $gte: withdrawal.amount
                }
            },
            {
                $inc: {
                    walletBal: -withdrawal.amount
                }
            },
            {
                new: true,
                session
            }
        );

        if (!updatedUser) {
            await session.abortTransaction();

            return res.status(400).json({
                success: false,
                message: "Insufficient wallet balance."
            });
        }

        const updatedWithdrawal =
            await Withdrawal.findOneAndUpdate(
                {
                    _id: withdrawal._id,
                    status: "PENDING"
                },
                {
                    $set: {
                        status: "APPROVED",
                        approvedBy: req.auth.userId,
                        approvedAt: new Date()
                    }
                },
                {
                    new: true,
                    session
                }
            );

        if (!updatedWithdrawal) {
            throw new Error(
                "Withdrawal status update failed."
            );
        }

        await session.commitTransaction();

        return res.json({
            success: true,
            message:
                "Withdrawal approved and wallet debited.",
            withdrawal: {
                withdrawalId:
                    updatedWithdrawal.withdrawalId,
                status:
                    updatedWithdrawal.status,
                amount:
                    updatedWithdrawal.amount,
                approvedBy:
                    updatedWithdrawal.approvedBy,
                approvedAt:
                    updatedWithdrawal.approvedAt
            },
            walletBalance:
                updatedUser.walletBal
        });

    } catch (error) {
        try {
            await session.abortTransaction();
        } catch (_) {}

        console.error(
            "APPROVE WITHDRAWAL ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Withdrawal approval failed."
        });

    } finally {
        await session.endSession();
    }
}

module.exports = approveWithdrawal;
