const PACKAGE_RULES = {
    999: {
        dailyRoiRate: 0.05,
        maxCapMultiplier: 3
    },

    1999: {
        dailyRoiRate: 0.05,
        maxCapMultiplier: 3
    },

    4999: {
        dailyRoiRate: 0.05,
        maxCapMultiplier: 3
    },

    9999: {
        dailyRoiRate: 0.05,
        maxCapMultiplier: 3
    }
};

const COMMISSION_RATES = {
    1: 0.10,
    2: 0.05,
    3: 0.03
};

const DIRECT_BONUS_RATE = 0.05;


// =========================================================
// PACKAGE HELPERS
// =========================================================

function getPackageRule(amount) {
    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount)) {
        return null;
    }

    return PACKAGE_RULES[numericAmount] || null;
}


function isAllowedPackage(amount) {
    return Boolean(getPackageRule(amount));
}


function getDailyROI(amount) {
    const rule = getPackageRule(amount);

    if (!rule) {
        return 0;
    }

    return Number(amount) * rule.dailyRoiRate;
}


function getMaxCap(amount) {
    const rule = getPackageRule(amount);

    if (!rule) {
        return 0;
    }

    return Number(amount) * rule.maxCapMultiplier;
}


// =========================================================
// COMBINED USER EARNING CAP
//
// ROI + DIRECT BONUS + TEAM ROI
// sab isi total earning cap ke andar count honge.
//
// Example:
// ₹999 package  -> ₹2,997 total cap
// ₹1,999        -> ₹5,997
// ₹4,999        -> ₹14,997
// ₹9,999        -> ₹29,997
//
// Multiple packages = combined cap
// =========================================================

function getUserMaxEarningCap(user) {
    if (!user || !Array.isArray(user.packages)) {
        return 0;
    }

    return user.packages.reduce((total, pkg) => {
        if (!pkg) {
            return total;
        }

        const amount = Number(pkg.amount || 0);

        if (!Number.isFinite(amount) || amount <= 0) {
            return total;
        }

        // Existing package maxCap ko respect karo.
        // Agar old package me maxCap missing hai,
        // to package amount × 3 use hoga.
        const packageCap =
            Number(pkg.maxCap) > 0
                ? Number(pkg.maxCap)
                : getMaxCap(amount);

        return total + packageCap;
    }, 0);
}


function getUserEarned(user) {
    return Number(user?.totalEarned || 0);
}


function getUserRemainingEarningCap(user) {
    const maxCap = getUserMaxEarningCap(user);
    const earned = getUserEarned(user);

    return Math.max(0, maxCap - earned);
}


function limitToUserEarningCap(user, requestedAmount) {
    const requested = Number(requestedAmount);

    if (!Number.isFinite(requested) || requested <= 0) {
        return 0;
    }

    return Math.min(
        requested,
        getUserRemainingEarningCap(user)
    );
}


module.exports = {
    PACKAGE_RULES,

    COMMISSION_RATES,

    DIRECT_BONUS_RATE,

    getPackageRule,
    isAllowedPackage,
    getDailyROI,
    getMaxCap,

    // Combined earning-cap helpers
    getUserMaxEarningCap,
    getUserEarned,
    getUserRemainingEarningCap,
    limitToUserEarningCap
};
