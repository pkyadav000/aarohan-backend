
// Global Error & Exception Handler
process.on("unhandledRejection", (err) => {
  console.error("UNHANDLED REJECTION! 💥 Shutting down gracefully...", err);
});
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION! 💥", err);
});
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const registerUser = require("./registerRoute");
const loginUser = require("./loginRoute");
const getMe = require("./meRoute");
const { authenticate, requireAdmin } = require("./middleware/auth");
const createDeposit = require("./depositRoute");
const approveDeposit = require("./adminDepositRoute");
const rejectDeposit = require("./adminRejectDepositRoute");
const createWithdrawal = require("./withdrawalRoute");
const approveWithdrawal = require("./adminWithdrawalRoute");
const rejectWithdrawal = require("./adminRejectWithdrawalRoute");
const updateUserStatus = require("./adminUserStatusRoute");
const getAdminUsers = require("./adminUsersRoute");
const getAdminDeposits = require("./adminDepositsRoute");
const getAdminWithdrawals = require("./adminWithdrawalsRoute");
const getUserTransactions = require("./userTransactionsRoute");
const getWallet = require("./walletRoute");
const { processDailyROI } = require("./roiEngine");
const { startROIScheduler } = require("./roiScheduler");

const app = express();

const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
    console.error("REQUEST DEBUG:", {
        method: req.method,
        path: req.path,
        authorization:
            Boolean(req.headers.authorization),
        contentType:
            req.headers["content-type"]
    });

    next();
});

app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        message: "Aarohan Global API is running",
        database:
            mongoose.connection.readyState === 1
                ? "connected"
                : "disconnected"
    });
});

app.post("/api/auth/register", registerUser);
app.post("/api/auth/login", loginUser);
app.get("/api/auth/me", authenticate, getMe);
app.post("/api/deposits", authenticate, createDeposit);
app.post("/api/admin/deposits/:depositId/approve", authenticate, requireAdmin, approveDeposit);
app.post("/api/admin/deposits/:depositId/reject", authenticate, requireAdmin, rejectDeposit);
app.post("/api/withdrawals", authenticate, createWithdrawal);
app.post("/api/admin/withdrawals/:withdrawalId/approve", authenticate, requireAdmin, approveWithdrawal);
app.post("/api/admin/withdrawals/:withdrawalId/reject", authenticate, requireAdmin, rejectWithdrawal);
app.patch("/api/admin/users/:userId/status", authenticate, requireAdmin, updateUserStatus);
app.get("/api/admin/users", authenticate, requireAdmin, getAdminUsers);
app.get("/api/admin/deposits", authenticate, requireAdmin, getAdminDeposits);
app.get("/api/admin/withdrawals", authenticate, requireAdmin, getAdminWithdrawals);
app.get("/api/transactions", authenticate, getUserTransactions);
app.get("/api/wallet", authenticate, getWallet);


async function startServer() {

    try {

        await mongoose.connect(
            process.env.MONGO_URI
        );

        console.log(
            "MONGODB CONNECTION OK"
        );

        try {
            await processDailyROI();

            console.log(
                "ROI ENGINE INITIAL RUN COMPLETE"
            );

        } catch (roiError) {

            console.error(
                "ROI ENGINE START ERROR:",
                roiError
            );
        }

        startROIScheduler();
        app.listen(
            PORT,
            () => {
                console.log(
                    `Aarohan Global API running on port ${PORT}`
                );
            }
        );

    } catch (error) {

        console.error(
            "MONGODB CONNECTION FAILED:",
            error.message
        );

        process.exit(1);
    }
}

startServer();
