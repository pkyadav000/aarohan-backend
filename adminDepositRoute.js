const mongoose = require("mongoose");

const Deposit = require("./models/Deposit");
const User = require("./models/User");
const Transaction = require("./models/Transaction");

const {
    isAllowedPackage,
    getDailyROI,
    getMaxCap,
    DIRECT_BONUS_RATE,
    getUserRemainingEarningCap,
    limitToUserEarningCap
} = require("./packageConfig");

function getIndiaDate() {
    return new Intl.DateTimeFormat(
        "en-CA",
        {
            timeZone: "Asia/Kolkata",
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        }
    ).format(new Date());
}

async function approveDeposit(req, res) {
    const session = await mongoose.startSession();

    try {
        const { depositId } = req.params;

        console.error("APPROVE ROUTE HIT:", {
            depositId,
            auth: req.auth
        });

        if (!depositId) {
            return res.status(400).json({
                success: false,
                message: "Deposit ID is required."
            });
        }

        session.startTransaction();

        const deposit = await Deposit.findOne({
            depositId
        }).session(session);

        if (!deposit) {
            await session.abortTransaction();

            return res.status(404).json({
                success: false,
                message: "Deposit not found."
            });
        }

        if (deposit.status !== "PENDING") {
            await session.abortTransaction();

            return res.status(409).json({
                success: false,
                message:
                    `Deposit is already ${deposit.status.toLowerCase()}.`
            });
        }

        const amount = Number(deposit.amount);

        console.error("APPROVAL PACKAGE DEBUG:", {
            depositId,
            rawAmount: deposit.amount,
            rawAmountType: typeof deposit.amount,
            amount,
            amountType: typeof amount,
            allowed: isAllowedPackage(amount),
            status: deposit.status
        });

        if (!isAllowedPackage(amount)) {
            await session.abortTransaction();

            return res.status(400).json({
                success: false,
                message:
                    "Invalid package amount. Allowed packages are ₹999, ₹1,999, ₹4,999 and ₹9,999."
            });
        }


        // ---------------------------------------------------------
        // ATOMIC APPROVAL CLAIM
        // ---------------------------------------------------------
        // Claim the PENDING deposit before creating the package
        // or crediting any Direct Bonus.
        const updatedDeposit =
            await Deposit.findOneAndUpdate(
                {
                    _id: deposit._id,
                    status: "PENDING"
                },
                {
                    $set: {
                        status: "APPROVED",
                        approvedBy:
                            req.auth.userId,
                        approvedAt:
                            new Date()
                    }
                },
                {
                    new: true,
                    session
                }
            );

        if (!updatedDeposit) {
            await session.abortTransaction();

            return res.status(409).json({
                success: false,
                message:
                    "Deposit was already processed."
            });
        }

        // ---------------------------------------------------------
        // ATOMIC APPROVAL CLAIM
        // ---------------------------------------------------------
        // Claim the PENDING deposit before creating the package
        // or crediting any Direct Bonus.
        const user = await User.findOne({
            userId: deposit.userId
        }).session(session);

        if (!user) {
            await session.abortTransaction();

            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        if (user.status === "SUSPENDED") {
            await session.abortTransaction();

            return res.status(403).json({
                success: false,
                message: "User account is suspended."
            });
        }

        if (!Array.isArray(user.packages)) {
            user.packages = [];
        }

        /*
         * IMPORTANT:
         * Always use India local calendar date.
         * This prevents UTC date from making NEXT_DAY ROI incorrect.
         */
        const approvalDate = getIndiaDate();

        const packageId =
            "PKG" +
            Date.now() +
            Math.random()
                .toString(36)
                .slice(2, 8)
                .toUpperCase();

        const dailyROI =
            getDailyROI(amount);

        const maxCap =
            getMaxCap(amount);

        user.packages.push({
            id: packageId,
            amount,
            status: "ACTIVE",
            dailyROI,
            totalEarned: 0,
            maxCap,
            approvalDate,
            lastRoiDate: null
        });

        // ---------------------------------------------------------
        // LINK APPROVED DEPOSIT TO CREATED PACKAGE
        // ---------------------------------------------------------
        // Use the atomically approved document itself.
        // This creates an exact 1:1 relationship:
        // Deposit -> Package
        updatedDeposit.packageId = packageId;

        // Persist Deposit -> Package mapping
        await updatedDeposit.save({
            session
        });

        user.package =
            user.packages
                .filter(pkg =>
                    pkg &&
                    pkg.status === "ACTIVE"
                )
                .reduce(
                    (total, pkg) =>
                        total +
                        Number(pkg.amount || 0),
                    0
                );

        user.roiDaily =
            user.packages
                .filter(pkg =>
                    pkg &&
                    pkg.status === "ACTIVE"
                )
                .reduce(
                    (total, pkg) =>
                        total +
                        Number(pkg.dailyROI || 0),
                    0
                );

        user.status = "ACTIVE";

        /*
         * DIRECT BONUS
         *
         * Sponsor must:
         * 1. exist
         * 2. be a USER
         * 3. be ACTIVE
         * 4. have at least one ACTIVE package
         */
        const sponsorId =
            String(user.sponsorId || "")
                .trim()
                .toUpperCase();

        let directBonus = 0;
        let bonusSponsor = null;

        if (
            sponsorId &&
            sponsorId !== "AG1001"
        ) {
            bonusSponsor =
                await User.findOne({
                    userId: sponsorId,
                    role: "USER",
                    status: "ACTIVE"
                }).session(session);

            const sponsorHasActivePackage =
                bonusSponsor &&
                Array.isArray(bonusSponsor.packages) &&
                bonusSponsor.packages.some(
                    pkg =>
                        pkg &&
                        pkg.status === "ACTIVE"
                );

            if (
                bonusSponsor &&
                sponsorHasActivePackage
            ) {
                // =====================================================
                // DIRECT BONUS — COMBINED 3X EARNING CAP
                // ROI + DIRECT BONUS + TEAM ROI
                // =====================================================

                const requestedDirectBonus =
                    Number(
                        (
                            amount *
                            DIRECT_BONUS_RATE
                        ).toFixed(2)
                    );

                const remainingSponsorCap =
                    getUserRemainingEarningCap(
                        bonusSponsor
                    );

                directBonus =
                    Number(
                        Math.min(
                            requestedDirectBonus,
                            remainingSponsorCap
                        ).toFixed(2)
                    );

                if (directBonus > 0) {
                    bonusSponsor.walletBal =
                        Number(
                            bonusSponsor.walletBal || 0
                        ) + directBonus;

                    bonusSponsor.totalEarned =
                        Number(
                            bonusSponsor.totalEarned || 0
                        ) + directBonus;

                    bonusSponsor.directEarned =
                        Number(
                            bonusSponsor.directEarned || 0
                        ) + directBonus;
                    if (
                        !Array.isArray(
                            bonusSponsor.commissionHistory
                        )
                    ) {
                        bonusSponsor.commissionHistory = [];
                    }

                    const commissionId =
                        "COM_" +
                        Date.now() +
                        "_" +
                        user.userId;

                    bonusSponsor.commissionHistory.push({
                        id:
                            commissionId,

                        type:
                            "DIRECT_BONUS",

                        level:
                            1,

                        fromUser:
                            user.userId,

                        packageAmount:
                            amount,

                        amount:
                            directBonus,

                        date:
                            approvalDate
                    });

                    await bonusSponsor.save({
                        session
                    });

                    /*
                     * Keep Transaction ledger in sync
                     * with wallet/commissionHistory.
                     */
                    await Transaction.create(
                        [{
                            transactionId:
                                commissionId,

                            userId:
                                bonusSponsor.userId,

                            type:
                                "DIRECT_BONUS",

                            amount:
                                directBonus,

                            status:
                                "CREDITED",

                            reference:
                                approvalDate,

                            packageId:
                                packageId,

                            fromUser:
                                user.userId,

                            level:
                                1,

                            date:
                                approvalDate
                        }],
                        { session }
                    );
                }
            }
        }

        await user.save({
            session
        });

        await session.commitTransaction();

        return res.json({
            success: true,

            message:
                "Deposit approved and package activated.",

            deposit: {
                depositId:
                    updatedDeposit.depositId,

                status:
                    updatedDeposit.status,

                amount:
                    updatedDeposit.amount,

                approvedBy:
                    updatedDeposit.approvedBy,

                approvedAt:
                    updatedDeposit.approvedAt
            },

            package: {
                id:
                    packageId,

                amount,

                status:
                    "ACTIVE",

                dailyROI,

                maxCap,

                approvalDate,

                roiStarts:
                    "NEXT_DAY"
            },

            directBonus: {
                sponsorId:
                    sponsorId || null,

                eligible:
                    Boolean(directBonus > 0),

                amount:
                    directBonus
            },

            walletBalance:
                user.walletBal
        });

    } catch (error) {

        try {
            await session.abortTransaction();
        } catch (_) {}

        console.error(
            "APPROVE DEPOSIT ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Deposit approval failed."
        });

    } finally {
        await session.endSession();
    }
}

module.exports = approveDeposit;
