const jwt = require("jsonwebtoken");
const User = require("../models/User");

async function authenticate(req, res, next) {
    try {
        const header =
            req.headers.authorization || "";

        if (!header.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Authentication required."
            });
        }

        const token =
            header.substring(7).trim();

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Authentication required."
            });
        }

        const secret =
            process.env.JWT_SECRET;

        if (!secret) {
            console.error(
                "JWT_SECRET is not configured."
            );

            return res.status(500).json({
                success: false,
                message:
                    "Authentication service is not configured."
            });
        }

        const decoded =
            jwt.verify(token, secret);

        if (!decoded.userId) {
            return res.status(401).json({
                success: false,
                message:
                    "Invalid authentication token."
            });
        }

        // -------------------------------------------------
        // VERIFY USER STILL EXISTS AND CHECK CURRENT STATUS
        // -------------------------------------------------

        const user =
            await User.findOne({
                userId: decoded.userId
            })
                .select(
                    "userId role status"
                )
                .lean();

        if (!user) {
            return res.status(401).json({
                success: false,
                message:
                    "User account no longer exists."
            });
        }

        // -------------------------------------------------
        // BLOCK SUSPENDED USERS EVEN WITH OLD JWT
        // -------------------------------------------------

        if (user.status === "SUSPENDED") {
            return res.status(403).json({
                success: false,
                message:
                    "Your account is suspended."
            });
        }

        // -------------------------------------------------
        // USE CURRENT DATABASE ROLE
        // DO NOT TRUST OLD JWT ROLE
        // -------------------------------------------------

        req.auth = {
            userId: user.userId,
            role: user.role || "USER"
        };

        next();

    } catch (error) {

        return res.status(401).json({
            success: false,
            message:
                "Invalid or expired token."
        });
    }
}

function requireAdmin(req, res, next) {

    if (
        !req.auth ||
        req.auth.role !== "ADMIN"
    ) {
        return res.status(403).json({
            success: false,
            message:
                "Admin access required."
        });
    }

    next();
}

module.exports = {
    authenticate,
    requireAdmin
};
