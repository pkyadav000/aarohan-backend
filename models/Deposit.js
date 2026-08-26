const mongoose = require("mongoose");

const depositSchema = new mongoose.Schema(
    {
        depositId: {
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

        paymentReference: {
            type: String,
            default: "",
            trim: true
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
    mongoose.model("Deposit", depositSchema);
