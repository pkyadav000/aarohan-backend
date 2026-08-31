const mongoose = require("mongoose");
const Withdrawal = require("./models/Withdrawal");

async function rejectWithdrawal(req, res) {
    const session = await mongoose.startSession();

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

        session.startTransaction();

        // ---------------------------------------------------------
        // ATOMIC REJECTION CLAIM
        // ---------------------------------------------------------
        // Only a PENDING withdrawal can be changed to REJECTED.
        // Prevents duplicate/concurrent rejection.
        // ---------------------------------------------------------

        const withdrawal =
            await Withdrawal.findOneAndUpdate(
                {
                    withdrawalId,
                    status: "PENDING"
                },
                {
                    $set: {
                        status: "REJECTED",
                        rejectionReason: reason,
                        rejectedBy: req.auth.userId,
                        rejectedAt: new Date()
                    }
                },
                {
                    new: true,
                    session
                }
            );

        if (!withdrawal) {
            const existing =
                await Withdrawal.findOne({ withdrawalId })
                    .select("status")
                    .session(session)
                    .lean();

            await session.abortTransaction();

            if (!existing) {
                return res.status(404).json({
                    success: false,
                    message: "Withdrawal not found."
                });
            }

            return res.status(409).json({
                success: false,
                message:
                    `Withdrawal is already ${existing.status.toLowerCase()}.`
            });
        }

        await session.commitTransaction();

        return res.json({
            success: true,
            message: "Withdrawal rejected.",
            withdrawal: {
                withdrawalId: withdrawal.withdrawalId,
                status: withdrawal.status,
                rejectionReason: withdrawal.rejectionReason,
                rejectedBy: withdrawal.rejectedBy,
                rejectedAt: withdrawal.rejectedAt
            }
        });

    } catch (error) {
        try {
            await session.abortTransaction();
        } catch (_) {}

        console.error(
            "REJECT WITHDRAWAL ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Withdrawal rejection failed."
        });

    } finally {
        await session.endSession();
    }
}

module.exports = rejectWithdrawal;
