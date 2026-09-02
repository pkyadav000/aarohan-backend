const mongoose = require("mongoose");

const User = require("./models/User");
const Transaction = require("./models/Transaction");

const {
    COMMISSION_RATES,
    getUserRemainingEarningCap,
    limitToUserEarningCap
} = require("./packageConfig");

function formatDateUTC(date) {
    return new Intl.DateTimeFormat(
        "en-CA",
        {
            timeZone: "Asia/Kolkata",
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        }
    ).format(date);
}

function addDays(dateString, days) {
    const date = new Date(`${dateString}T00:00:00Z`);

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    date.setUTCDate(
        date.getUTCDate() + days
    );

    return formatDateUTC(date);
}

function getToday() {
    return formatDateUTC(new Date());
}

async function processROIDate(processDate) {
    const session =
        await mongoose.startSession();

    let creditedCount = 0;
    let totalROICredited = 0;

    try {
        session.startTransaction();

        const users =
            await User.find({
                role: "USER",
                status: "ACTIVE"
            }).session(session);

        const todaysROI = {};

        for (const user of users) {

            if (!Array.isArray(user.packages)) {
                continue;
            }

            let userROITotal = 0;

            // =====================================================
            // COMBINED USER 3X CAP — LOCAL DAILY REMAINING CAP
            // =====================================================
            // user.totalEarned is persisted only after all packages
            // are processed. Therefore keep a local remaining cap
            // and reduce it after every package ROI credit.
            // This prevents multiple packages from reusing the
            // same stale user-level remaining cap.
            // =====================================================

            let remainingUserCap =
                getUserRemainingEarningCap(user);

            for (const pkg of user.packages) {

                if (!pkg) {
                    continue;
                }

                if (pkg.status !== "ACTIVE") {
                    continue;
                }

                const amount =
                    Number(pkg.amount || 0);

                const dailyROI =
                    Number(pkg.dailyROI || 0);

                const maxCap =
                    Number(
                        pkg.maxCap ||
                        amount * 3
                    );

                const earned =
                    Number(
                        pkg.totalEarned || 0
                    );

                if (
                    amount <= 0 ||
                    dailyROI <= 0 ||
                    maxCap <= 0
                ) {
                    continue;
                }

                // =====================================================
                // ROI SAFETY: Approval date se pehle/approval day par
                // kabhi bhi ROI credit nahi hona chahiye.
                // First eligible ROI date = approvalDate + 1 day.
                // =====================================================
                const approvalDate =
                    String(pkg.approvalDate || "").slice(0, 10);

                const roiProcessDate =
                    String(processDate || "").slice(0, 10);

                if (
                    !approvalDate ||
                    !roiProcessDate ||
                    roiProcessDate <= approvalDate
                ) {
                    continue;
                }

                // Same package/date dobara process nahi.
                if (
                    String(pkg.lastRoiDate || "") ===
                    String(processDate)
                ) {
                    continue;
                }

                if (earned >= maxCap) {
                    pkg.totalEarned = maxCap;
                    pkg.status = "COMPLETED";
                    continue;
                }

                const roiTransactionId =
                    `ROI_${processDate}_${user.userId}_${pkg.id}`;

                const existingROI =
                    await Transaction.findOne({
                        transactionId: roiTransactionId
                    }).session(session);

                if (existingROI) {
                    console.log(
                        "ROI ALREADY PROCESSED:",
                        roiTransactionId,
                        existingROI.status
                    );

                    continue;
                }

                // =====================================================
                // ROI — COMBINED USER 3X EARNING CAP
                // ROI + DIRECT BONUS + TEAM ROI
                // sab totalEarned ke same combined cap me count honge.
                // =====================================================

                const remainingPackageCap =
                    Math.max(
                        0,
                        maxCap - earned
                    );

                const roiToCredit =
                    Number(
                        Math.min(
                            dailyROI,
                            remainingPackageCap,
                            remainingUserCap
                        ).toFixed(2)
                    );

                if (
                    !Number.isFinite(
                        roiToCredit
                    ) ||
                    roiToCredit <= 0
                ) {
                    continue;
                }

                pkg.totalEarned =
                    earned + roiToCredit;

                // Reduce local combined user cap immediately so
                // the next package cannot reuse the same capacity.
                remainingUserCap =
                    Math.max(
                        0,
                        Number(
                            (
                                remainingUserCap -
                                roiToCredit
                            ).toFixed(2)
                        )
                    );

                pkg.lastRoiDate =
                    processDate;

                if (
                    pkg.totalEarned >=
                    maxCap
                ) {
                    pkg.totalEarned =
                        maxCap;

                    pkg.status =
                        "COMPLETED";
                }

                userROITotal +=
                    roiToCredit;

                creditedCount++;
                totalROICredited +=
                    roiToCredit;

                await Transaction.create(
                    [{
                        transactionId:
                            roiTransactionId,
                        userId:
                            user.userId,
                        type:
                            "ROI",
                        amount:
                            roiToCredit,
                        status:
                            "CREDITED",
                        reference:
                            processDate,
                        packageId:
                            pkg.id,
                        fromUser:
                            user.userId,
                        level:
                            0,
                        date:
                            processDate
                    }],
                    { session }
                );
            }

            if (userROITotal > 0) {

                user.walletBal =
                    Number(
                        user.walletBal || 0
                    ) + userROITotal;

                user.totalEarned =
                    Number(
                        user.totalEarned || 0
                    ) + userROITotal;

                user.roiEarned =
                    Number(
                        user.roiEarned || 0
                    ) + userROITotal;

                todaysROI[user.userId] =
                    userROITotal;

                await user.save({
                    session
                });
            }
        }

        // -----------------------------------------------------
        // TEAM COMMISSION
        // -----------------------------------------------------
        //
        // IMPORTANT:
        // todaysROI[user.userId] already contains the COMPLETE
        // daily ROI of that source user for processDate.
        //
        // L1 = 10%
        // L2 = 5%
        // L3 = 3%
        //
        // TEAM ROI IS CALCULATED ON DAILY TOTAL ROI,
        // NOT PACKAGE-WISE.
        //
        // Example:
        // AG1016 daily ROI = ₹1099.80
        // L1 = ₹1099.80 × 10% = ₹109.98
        //
        // Combined earning cap is applied after calculation.
        // -----------------------------------------------------

        for (const user of users) {

            const sourceUserId =
                String(user.userId || "")
                    .trim()
                    .toUpperCase();

            const downlineROI =
                Number(
                    Number(todaysROI[user.userId] || 0).toFixed(2)
                );

            if (!Number.isFinite(downlineROI) || downlineROI <= 0) {
                continue;
            }

            let sponsorId =
                String(user.sponsorId || "")
                    .trim()
                    .toUpperCase();

            for (let level = 1; level <= 3; level++) {

                if (!sponsorId) {
                    break;
                }

                // Master Admin ko Team ROI nahi dena.
                if (sponsorId === "AG1001") {
                    break;
                }

                const sponsor =
                    await User.findOne({
                        userId: sponsorId,
                        role: "USER",
                        status: "ACTIVE"
                    }).session(session);

                if (!sponsor) {
                    break;
                }

                const rate =
                    Number(COMMISSION_RATES[level] || 0);

                if (!Number.isFinite(rate) || rate <= 0) {
                    break;
                }

                // -------------------------------------------------
                // DAILY TOTAL ROI × LEVEL RATE
                // -------------------------------------------------

                const requested =
                    Number(
                        (downlineROI * rate).toFixed(2)
                    );

                if (!Number.isFinite(requested) || requested <= 0) {
                    break;
                }

                // -------------------------------------------------
                // DETERMINISTIC TRANSACTION ID
                //
                // Same source + same date + same level +
                // same sponsor = exactly one TEAM ROI.
                // -------------------------------------------------

                const teamTransactionId =
                    `TEAM_${processDate}_${level}_${sourceUserId}_${sponsor.userId}`;

                // -------------------------------------------------
                // DUPLICATE PROTECTION
                // -------------------------------------------------

                const existingTeamTransaction =
                    await Transaction.findOne({
                        transactionId: teamTransactionId
                    }).session(session);

                if (existingTeamTransaction) {

                    console.log(
                        "TEAM ROI ALREADY PROCESSED:",
                        teamTransactionId
                    );

                    sponsorId =
                        String(sponsor.sponsorId || "")
                            .trim()
                            .toUpperCase();

                    continue;
                }

                // -------------------------------------------------
                // COMBINED 3X EARNING CAP
                //
                // ROI + DIRECT BONUS + TEAM ROI
                // sab totalEarned mein count hote hain.
                // -------------------------------------------------

                const remainingSponsorCap =
                    Number(
                        getUserRemainingEarningCap(sponsor)
                    );

                if (
                    !Number.isFinite(remainingSponsorCap) ||
                    remainingSponsorCap <= 0
                ) {

                    console.log(
                        `[TEAM ROI] CAP REACHED | L${level} | ${sourceUserId} -> ${sponsor.userId}`
                    );

                    sponsorId =
                        String(sponsor.sponsorId || "")
                            .trim()
                            .toUpperCase();

                    continue;
                }

                const commission =
                    Number(
                        Math.min(
                            requested,
                            remainingSponsorCap
                        ).toFixed(2)
                    );

                if (!Number.isFinite(commission) || commission <= 0) {

                    sponsorId =
                        String(sponsor.sponsorId || "")
                            .trim()
                            .toUpperCase();

                    continue;
                }

                // -------------------------------------------------
                // CREDIT SPONSOR
                // -------------------------------------------------

                sponsor.walletBal =
                    Number(
                        (
                            Number(sponsor.walletBal || 0) +
                            commission
                        ).toFixed(2)
                    );

                sponsor.totalEarned =
                    Number(
                        (
                            Number(sponsor.totalEarned || 0) +
                            commission
                        ).toFixed(2)
                    );

                sponsor.teamEarned =
                    Number(
                        (
                            Number(sponsor.teamEarned || 0) +
                            commission
                        ).toFixed(2)
                    );

                // -------------------------------------------------
                // CREATE TEAM ROI TRANSACTION
                // -------------------------------------------------

                await Transaction.create(
                    [{
                        transactionId:
                            teamTransactionId,

                        userId:
                            sponsor.userId,

                        type:
                            "TEAM_ROI",

                        amount:
                            commission,

                        status:
                            "CREDITED",

                        reference:
                            processDate,

                        fromUser:
                            sourceUserId,

                        level:
                            level,

                        date:
                            processDate
                    }],
                    { session }
                );

                await sponsor.save({
                    session
                });

                console.log(
                    `[TEAM ROI] L${level} | ${sourceUserId} -> ${sponsor.userId} | ₹${commission}`
                );

                // -------------------------------------------------
                // MOVE TO NEXT UPLINE LEVEL
                // -------------------------------------------------

                sponsorId =
                    String(sponsor.sponsorId || "")
                        .trim()
                        .toUpperCase();
            }
        }

        await session.commitTransaction();

        return {
            processDate,
            creditedCount,
            totalROICredited
        };

    } catch (error) {

        try {
            await session.abortTransaction();
        } catch (_) {}

        throw error;

    } finally {
        await session.endSession();
    }
}

async function processDailyROI() {

    const today = getToday();

    console.log(
        "ROI ENGINE DATE:",
        today
    );

    // =========================================================
    // LOAD ALL USER PACKAGES
    // =========================================================

    const users = await User.find({
        role: "USER"
    }).select("packages");

    const dates = new Set();

    for (const user of users) {

        if (!Array.isArray(user.packages)) {
            continue;
        }

        for (const pkg of user.packages) {

            if (
                !pkg ||
                pkg.status !== "ACTIVE" ||
                !pkg.approvalDate
            ) {
                continue;
            }

            const approvalDate =
                String(pkg.approvalDate).slice(0, 10);

            // =====================================================
            // FIRST POSSIBLE ROI DATE
            // =====================================================

            const firstEligibleDate =
                addDays(
                    approvalDate,
                    1
                );

            if (
                !firstEligibleDate ||
                firstEligibleDate > today
            ) {
                continue;
            }

            // =====================================================
            // SMART START DATE
            //
            // If ROI was already processed:
            // start from lastRoiDate + 1
            //
            // Otherwise:
            // start from approvalDate + 1
            // =====================================================

            const lastRoiDate =
                String(pkg.lastRoiDate || "")
                    .slice(0, 10);

            let date = firstEligibleDate;

            if (lastRoiDate) {

                const nextDate =
                    addDays(
                        lastRoiDate,
                        1
                    );

                if (
                    nextDate &&
                    nextDate > date
                ) {
                    date = nextDate;
                }
            }

            // =====================================================
            // ADD ONLY PENDING / MISSED DATES
            // =====================================================

            while (
                date &&
                date <= today
            ) {

                dates.add(date);

                date =
                    addDays(
                        date,
                        1
                    );
            }
        }
    }

    const sortedDates =
        Array.from(dates).sort();

    console.log(
        "ROI DATES TO PROCESS:",
        sortedDates
    );

    // =========================================================
    // PROCESS EACH PENDING DATE
    // =========================================================

    for (const date of sortedDates) {

        await processROIDate(date);

        console.log(
            "ROI PROCESSED:",
            date
        );
    }

    return {
        success: true,
        today,
        processedDates: sortedDates
    };
}
module.exports = {
    processDailyROI,
    processROIDate,
    getToday
};
