const mongoose = require("mongoose");
const User = require("./models/User");
const Transaction = require("./models/Transaction");
const { COMMISSION_RATES } = require("./packageConfig");

async function processTeamCommission(
    fromUserId,
    baseAmount,
    dateStr,
    session = null
) {
    const queryOptions = session ? { session } : {};

    try {
        const currentUser = await User.findOne({
            userId: fromUserId,
            role: "USER"
        }).session(session || null);

        if (!currentUser) {
            return;
        }

        let sponsorId = String(
            currentUser.sponsorId || ""
        )
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

            const sponsor = await User.findOne({
                userId: sponsorId,
                role: "USER",
                status: "ACTIVE"
            }).session(session || null);

            if (!sponsor) {
                break;
            }

            const rate = Number(
                COMMISSION_RATES[level] || 0
            );

            const requested =
                Number(baseAmount || 0) * rate;

            if (!Number.isFinite(requested) || requested <= 0) {
                break;
            }

            const sponsorCap =
                Array.isArray(sponsor.packages)
                    ? sponsor.packages.reduce(
                        (total, pkg) =>
                            total +
                            Number(
                                pkg.maxCap ||
                                Number(pkg.amount || 0) * 3
                            ),
                        0
                    )
                    : 0;

            const sponsorEarned =
                Number(sponsor.totalEarned || 0);

            const remaining = Math.max(
                0,
                sponsorCap - sponsorEarned
            );

            const commission = Math.min(
                requested,
                remaining
            );

            const transactionId =
                `TEAM_${dateStr}_L${level}_${fromUserId}_${sponsor.userId}`;

            const existingTransaction =
                await Transaction.findOne({
                    transactionId
                }).session(session || null);

            if (!existingTransaction && commission > 0) {

                sponsor.walletBal =
                    Number(sponsor.walletBal || 0) +
                    commission;

                sponsor.totalEarned =
                    Number(sponsor.totalEarned || 0) +
                    commission;

                sponsor.teamEarned =
                    Number(sponsor.teamEarned || 0) +
                    commission;

                await Transaction.create(
                    [{
                        transactionId,
                        userId: sponsor.userId,
                        type: "TEAM_ROI",
                        amount: commission,
                        status: "CREDITED",
                        reference: dateStr,
                        fromUser: fromUserId,
                        level,
                        date: dateStr
                    }],
                    queryOptions
                );

                await sponsor.save(queryOptions);

                console.log(
                    `[TEAM ROI] L${level} | ${fromUserId} -> ${sponsor.userId} | ₹${commission}`
                );
            }

            sponsorId = String(
                sponsor.sponsorId || ""
            )
                .trim()
                .toUpperCase();
        }

    } catch (error) {
        console.error(
            "TEAM COMMISSION ERROR:",
            error
        );

        throw error;
    }
}

module.exports = {
    processTeamCommission
};
