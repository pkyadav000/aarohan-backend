
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
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const registerUser = require("./registerRoute");
const loginUser = require("./loginRoute");
const getMe = require("./meRoute");
const getTeam = require("./teamRoute");
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

// ---------------------------------------------------------
// SECURITY HARDENING
// ---------------------------------------------------------

// Render/proxy aware client IP handling
app.set("trust proxy", 1);

// Hide Express fingerprint
app.disable("x-powered-by");

// Secure HTTP headers
app.use(
  helmet({
    contentSecurityPolicy: false
  })
);

// Allow only known frontend origins
const allowedOrigins = new Set([
  "https://aarohan-frontend-mocha.vercel.app",
  "https://aarohan-global.vercel.app",
    "https://www.aarohanglobal.in"
]);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow server-to-server requests without Origin
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.has(origin)) {
        return callback(null, true);
      }

      return callback(new Error("CORS origin not allowed."));
    },
    methods: ["GET", "POST", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false
  })
);

// Limit incoming JSON payload size
app.use(express.json({ limit: "100kb" }));

// ---------------------------------------------------------
// RATE LIMITING
// ---------------------------------------------------------

// General API protection
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please try again later."
  }
});

// Strict protection for login/register
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message: "Too many authentication attempts. Please try again later."
  }
});

app.use("/api/", apiLimiter);

app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Aarohan Global API is running"
  });
});

app.post("/api/auth/register", registerUser);
app.post("/api/auth/login", loginUser);
app.get("/api/auth/me", authenticate, getMe);
app.get("/api/team", authenticate, getTeam);
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



// ---------------------------------------------------------
// API 404 HANDLER
// ---------------------------------------------------------

app.use("/api", (req, res) => {
  return res.status(404).json({
    success: false,
    message: "API endpoint not found."
  });
});

// ---------------------------------------------------------
// GLOBAL ERROR HANDLER
// ---------------------------------------------------------

app.use((err, req, res, next) => {
  console.error("API ERROR:", err.message);

  if (err && err.type === "entity.parse.failed") {
    return res.status(400).json({
      success: false,
      message: "Invalid JSON payload."
    });
  }

  if (err && err.type === "entity.too.large") {
    return res.status(413).json({
      success: false,
      message: "Request payload is too large."
    });
  }

  if (err && err.message === "CORS origin not allowed.") {
    return res.status(403).json({
      success: false,
      message: "Origin not allowed."
    });
  }

  return res.status(500).json({
    success: false,
    message: "Internal server error."
  });
});

async function startServer() {

    try {

        await mongoose.connect(
            process.env.MONGO_URI
        );

        console.log(
            "MONGODB CONNECTION OK"
        );


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
