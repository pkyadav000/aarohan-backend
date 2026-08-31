const mongoose = require("mongoose");
const Deposit = require("./models/Deposit");

async function rejectDeposit(req, res) {
    const session = await mongoose.startSession();

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

        session.startTransaction();

        // ---------------------------------------------------------
        // ATOMIC REJECTION CLAIM
        // ---------------------------------------------------------
        // Only a PENDING deposit can be changed to REJECTED.
        // Prevents duplicate/concurrent rejection.
        // ---------------------------------------------------------

        const deposit =
            await Deposit.findOneAndUpdate(
                {
                    depositId,
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

        if (!deposit) {
            const existing =
                await Deposit.findOne({ depositId })
                    .select("status")
                    .session(session)
                    .lean();

            await session.abortTransaction();

            if (!existing) {
                return res.status(404).json({
                    success: false,
                    message: "Deposit not found."
                });
            }

            return res.status(409).json({
                success: false,
                message:
                    `Deposit is already ${existing.status.toLowerCase()}.`
            });
        }

        await session.commitTransaction();

        return res.json({
            success: true,
            message: "Deposit rejected.",
            deposit: {
                depositId: deposit.depositId,
                status: deposit.status,
                rejectionReason: deposit.rejectionReason,
                rejectedBy: deposit.rejectedBy,
                rejectedAt: deposit.rejectedAt
            }
        });

    } catch (error) {
        try {
            await session.abortTransaction();
        } catch (_) {}

        console.error(
            "REJECT DEPOSIT ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Deposit rejection failed."
        });

    } finally {
        await session.endSession();
    }
}

module.exports = rejectDeposit;
