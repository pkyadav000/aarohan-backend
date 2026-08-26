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

module.exports = {
    PACKAGE_RULES,
    COMMISSION_RATES,
    DIRECT_BONUS_RATE,
    getPackageRule,
    isAllowedPackage,
    getDailyROI,
    getMaxCap
};
