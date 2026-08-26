require("dotenv").config();

const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const User = require("./models/User");

async function resetAdminPassword() {
    try {
        await mongoose.connect(process.env.MONGO_URI);

        const newPassword =
            process.env.NEW_ADMIN_PASSWORD;

        if (
            typeof newPassword !== "string" ||
            newPassword.length < 8
        ) {
            throw new Error(
                "Set NEW_ADMIN_PASSWORD to a password of at least 8 characters."
            );
        }

        const hashedPassword =
            await bcrypt.hash(newPassword, 12);

        const user =
            await User.findOneAndUpdate(
                { userId: "AG1001" },
                {
                    $set: {
                        password: hashedPassword,
                        role: "ADMIN"
                    }
                },
                {
                    returnDocument: "after"
                }
            ).select("userId role");

        if (!user) {
            throw new Error("AG1001 not found.");
        }

        console.log(
            `ADMIN PASSWORD RESET: ${user.userId} (${user.role})`
        );

    } catch (error) {
        console.error(
            "RESET ERROR:",
            error.message
        );
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
}

resetAdminPassword();
