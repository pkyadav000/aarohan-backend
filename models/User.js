const mongoose = require("mongoose");

const packageSchema = new mongoose.Schema(
    {
        id: {
            type: String,
            required: true
        },

        amount: {
            type: Number,
            required: true,
            min: 0
        },

        status: {
            type: String,
            enum: ["ACTIVE", "COMPLETED"],
            default: "ACTIVE"
        },

        dailyROI: {
            type: Number,
            default: 0,
            min: 0
        },

        totalEarned: {
            type: Number,
            default: 0,
            min: 0
        },

        maxCap: {
            type: Number,
            default: 0,
            min: 0
        },

        approvalDate: {
            type: String,
            default: null
        },

        lastRoiDate: {
            type: String,
            default: null
        }
    },
    {
        _id: false
    }
);

const commissionSchema = new mongoose.Schema(
    {
        id: String,
        type: String,
        level: {
            type: Number,
            default: 0
        },
        fromUser: String,
        downlineROI: Number,
        rate: Number,
        packageAmount: Number,
        amount: {
            type: Number,
            default: 0
        },
        date: String
    },
    {
        _id: false
    }
);

const userSchema = new mongoose.Schema(
    {
        role: {
            type: String,
            enum: ["USER", "ADMIN"],
            default: "USER",
            index: true
        },

        userId: {
            type: String,
            required: true,
            unique: true,
            index: true,
            trim: true
        },

        name: {
            type: String,
            required: true,
            trim: true
        },

        mobile: {
            type: String,
            required: true,
            unique: true,
            index: true,
            trim: true
        },
email: {
    type: String,
    default: undefined,
    unique: true,
    sparse: true,
    index: true,
    trim: true,
    lowercase: true
},
        password: {
            type: String,
            required: true,
            select: false
        },

        sponsorId: {
            type: String,
            default: "",
            trim: true,
            index: true
        },

        status: {
            type: String,
            enum: [
                "ACTIVE",
                "SUSPENDED",
                "PACKAGE NOT ACTIVE"
            ],
            default: "PACKAGE NOT ACTIVE"
        },

        packages: {
            type: [packageSchema],
            default: []
        },

        package: {
            type: Number,
            default: 0,
            min: 0
        },

        roiDaily: {
            type: Number,
            default: 0,
            min: 0
        },

        walletBal: {
            type: Number,
            default: 0,
            min: 0
        },

        totalEarned: {
            type: Number,
            default: 0,
            min: 0
        },

        roiEarned: {
            type: Number,
            default: 0,
            min: 0
        },

        teamEarned: {
            type: Number,
            default: 0,
            min: 0
        },

        referrals: {
            type: Number,
            default: 0,
            min: 0
        },

        upiId: {
            type: String,
            default: "",
            trim: true
        },

        commissionHistory: {
            type: [commissionSchema],
            default: []
        },

        lastRoiDate: {
            type: String,
            default: null
        }
    },
    {
        timestamps: true
    }
);

module.exports =
    mongoose.model("User", userSchema);
