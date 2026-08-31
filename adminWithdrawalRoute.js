const mongoose = require("mongoose");

const Withdrawal = require("./models/Withdrawal");
const User = require("./models/User");
const Transaction = require("./models/Transaction");

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

        // ---------------------------------------------------------
        // FIND PENDING WITHDRAWAL
        // ---------------------------------------------------------

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

        // ---------------------------------------------------------
        // FIND USER
        // ---------------------------------------------------------

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

        // ---------------------------------------------------------
        // ATOMIC WALLET DEBIT
        // ---------------------------------------------------------
        // Prevents negative balance and protects against
        // concurrent approval requests.
        // ---------------------------------------------------------

        const updatedUser =
            await User.findOneAndUpdate(
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

        // ---------------------------------------------------------
        // NORMALIZE WALLET BALANCE TO 2 DECIMAL PLACES
        // ---------------------------------------------------------

        updatedUser.walletBal =
            Math.round(
                (Number(updatedUser.walletBal) + Number.EPSILON) * 100
            ) / 100;

        await updatedUser.save({ session });

        // ---------------------------------------------------------
        // ATOMIC WITHDRAWAL APPROVAL CLAIM
        // ---------------------------------------------------------

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

        // ---------------------------------------------------------
        // WITHDRAWAL TRANSACTION LEDGER
        // ---------------------------------------------------------
        // transactionId = withdrawalId
        //
        // This gives us an exact 1:1 relationship:
        //
        // Withdrawal WDR1001
        //        ↓
        // Transaction WDR1001
        //
        // Unique transactionId prevents duplicate ledger entries.
        // ---------------------------------------------------------

        await Transaction.create(
            [
                {
                    transactionId:
                        updatedWithdrawal.withdrawalId,

                    userId:
                        updatedWithdrawal.userId,

                    type:
                        "WITHDRAWAL",

                    amount:
                        updatedWithdrawal.amount,

                    status:
                        "APPROVED",

                    reference:
                        updatedWithdrawal.withdrawalId,

                    packageId:
                        "",

                    fromUser:
                        "",

                    level:
                        0,

                    date:
                        new Date().toISOString()
                }
            ],
            {
                session
            }
        );

        // ---------------------------------------------------------
        // COMMIT EVERYTHING
        // ---------------------------------------------------------

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

        // Duplicate transaction protection
        if (error && error.code === 11000) {
            return res.status(409).json({
                success: false,
                message:
                    "Withdrawal transaction already exists."
            });
        }

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
