const mongoose = require("mongoose");

const withdrawalSchema = new mongoose.Schema(
    {
        withdrawalId: {
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

        amount: {
            type: Number,
            required: true,
            min: 1
        },

        upiId: {
            type: String,
            required: true,
            trim: true
        },

        status: {
            type: String,
            enum: [
                "PENDING",
                "APPROVED",
                "REJECTED"
            ],
            default: "PENDING",
            index: true
        },

        approvedBy: {
            type: String,
            default: null
        },

        approvedAt: {
            type: Date,
            default: null
        },

        rejectionReason: {
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
        "Withdrawal",
        withdrawalSchema
    );
