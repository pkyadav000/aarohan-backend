require("dotenv").config();

const mongoose = require("mongoose");
const User = require("./models/User");

async function checkAdminPassword() {
    try {
        await mongoose.connect(process.env.MONGO_URI);

        const user = await User.findOne({
            userId: "AG1001"
        }).select("+password");

        if (!user) {
            console.log("AG1001 NOT FOUND");
            return;
        }

        console.log({
            userId: user.userId,
            hasPassword:
                typeof user.password === "string" &&
                user.password.length > 0,
            passwordLength:
                typeof user.password === "string"
                    ? user.password.length
                    : 0
        });

    } catch (error) {
        console.error(
            "CHECK ERROR:",
            error.message
        );
    } finally {
        await mongoose.disconnect();
    }
}

checkAdminPassword();
