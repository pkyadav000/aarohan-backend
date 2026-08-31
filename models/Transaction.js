const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
    {
        transactionId: {
            type: String,
            required: true,
            unique: true,
            index: true
        },

        userId: {
            type: String,
            required: true,
            index: true
        },

        type: {
            type: String,
            enum: [
                "DEPOSIT",
                "WITHDRAWAL",
                "ROI",
                "DIRECT_BONUS",
                "TEAM_ROI",
                "WALLET_CREDIT"
            ],
            required: true,
            index: true
        },

        amount: {
            type: Number,
            required: true,
            min: 0,

            set: function(value) {
                const amount = Number(value);

                if (!Number.isFinite(amount)) {
                    return 0;
                }

                return Math.round(
                    (amount + Number.EPSILON) * 100
                ) / 100;
            }
        },

        status: {
            type: String,
            default: "CREDITED",
            index: true
        },

        reference: {
            type: String,
            default: "",
            trim: true
        },

        packageId: {
            type: String,
            default: ""
        },

        fromUser: {
            type: String,
            default: ""
        },

        level: {
            type: Number,
            default: 0
        },

        date: {
            type: String,
            default: ""
        }
    },
    {
        timestamps: true
    }
);

module.exports =
    mongoose.model(
        "Transaction",
        transactionSchema
    );
