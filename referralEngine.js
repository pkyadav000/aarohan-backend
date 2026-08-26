const mongoose = require("mongoose");

const LEVEL_COMMISSION = {
  1: 0.10,
  2: 0.05,
  3: 0.02
};

async function processTeamCommission(fromUserId, baseAmount, dateStr) {
  try {
    const User = mongoose.model("User");
    const Transaction = mongoose.model("Transaction");

    let currentUser = await User.findOne({ userId: fromUserId });
    if (!currentUser || !currentUser.referredBy) return;

    let currentUplineId = currentUser.referredBy;

    for (let level = 1; level <= 3; level++) {
      if (!currentUplineId) break;

      const uplineUser = await User.findOne({ userId: currentUplineId });
      if (!uplineUser) break;

      const commissionRate = LEVEL_COMMISSION[level] || 0;
      const commissionAmount = baseAmount * commissionRate;

      if (commissionAmount > 0) {
        const txId = `TEAM_${dateStr}_L${level}_${fromUserId}_${uplineUser.userId}`;

        const existingTx = await Transaction.findOne({ transactionId: txId });
        if (!existingTx) {
          await Transaction.create({
            transactionId: txId,
            userId: uplineUser.userId,
            fromUser: fromUserId,
            type: "TEAM_ROI",
            amount: commissionAmount,
            status: "CREDITED",
            level: level,
            reference: dateStr,
            date: dateStr
          });

          // Upline Balance Increment (Atomic Update)
          await User.updateOne(
            { userId: uplineUser.userId },
            { 
              $inc: { 
                walletBalance: commissionAmount, 
                totalTeamIncome: commissionAmount 
              } 
            }
          );
          console.log(`[TEAM ROI] Level ${level}: ${commissionAmount} credited to ${uplineUser.userId}`);
        }
      }

      currentUplineId = uplineUser.referredBy;
    }
  } catch (err) {
    console.error("Referral Processing Error:", err);
  }
}

module.exports = { processTeamCommission };
