const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("./models/User");

async function loginUser(req, res) {
    try {
        const {
            identifier,
            password
        } = req.body;

        const cleanIdentifier =
            String(identifier || "").trim();

        if (!cleanIdentifier) {
            return res.status(400).json({
                success: false,
                message: "Mobile number or email is required."
            });
        }

        if (
            typeof password !== "string" ||
            password.length === 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Password is required."
            });
        }

        const isEmail =
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/
                .test(cleanIdentifier);

        const query = isEmail
            ? {
                email:
                    cleanIdentifier.toLowerCase()
            }
            : {
                $or: [
                    {
                        mobile:
                            cleanIdentifier
                    },
                    {
                        userId:
                            cleanIdentifier.toUpperCase()
                    }
                ]
            };

        const user =
            await User.findOne(query)
                .select("+password");

        if (!user) {
            console.error("LOGIN DEBUG: USER NOT FOUND", {
                identifier: cleanIdentifier,
                lookupType: isEmail ? "email" : "mobile"
            });

            return res.status(401).json({
                success: false,
                message:
                    "Invalid login credentials."
            });
        }

        console.error("LOGIN DEBUG: USER FOUND", {
            userId: user.userId,
            role: user.role,
            passwordHashExists:
                typeof user.password === "string",
            passwordHashLength:
                typeof user.password === "string"
                    ? user.password.length
                    : 0
        });

        if (user.status === "SUSPENDED") {
            return res.status(403).json({
                success: false,
                message:
                    "Your account is suspended."
            });
        }

        if (
            typeof user.password !== "string" ||
            user.password.length === 0
        ) {
            return res.status(401).json({
                success: false,
                message:
                    "Login is not configured for this account."
            });
        }

        const passwordValid =
            await bcrypt.compare(
                password,
                user.password
            );

        if (!passwordValid) {
            console.error("LOGIN DEBUG: PASSWORD MISMATCH", {
                userId: user.userId,
                role: user.role
            });

            return res.status(401).json({
                success: false,
                message:
                    "Invalid login credentials."
            });
        }

        console.error("LOGIN DEBUG: PASSWORD MATCHED", {
            userId: user.userId,
            role: user.role
        });

        const jwtSecret =
            process.env.JWT_SECRET;

        if (!jwtSecret) {
            console.error(
                "JWT_SECRET is not configured."
            );

            return res.status(500).json({
                success: false,
                message:
                    "Authentication service is not configured."
            });
        }

        const token =
            jwt.sign(
                {
                    userId:
                        user.userId,

                    role:
                        user.role || "USER"
                },
                jwtSecret,
                {
                    expiresIn: "7d"
                }
            );

        return res.json({
            success: true,
            message: "Login successful.",
            token,
            user: {
                userId:
                    user.userId,

                name:
                    user.name,

                mobile:
                    user.mobile || "",

                email:
                    user.email || "",

                sponsorId:
                    user.sponsorId,

                role:
                    user.role || "USER",

                status:
                    user.status
            }
        });

    } catch (error) {

        console.error(
            "LOGIN ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Login failed."
        });
    }
}

module.exports =
    loginUser;
