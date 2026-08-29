const jwt = require("jsonwebtoken");

function authenticate(req, res, next) {
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

        req.auth = decoded;

        console.log("AUTH DEBUG:", {
            userId: decoded.userId,
            role: decoded.role
        });

        next();

    } catch (error) {

        return res.status(401).json({
            success: false,
            message: "Invalid or expired token."
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
            message: "Admin access required."
        });
    }

    next();
}

module.exports = {
    authenticate,
    requireAdmin
};
