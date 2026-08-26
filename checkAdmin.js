require("dotenv").config();

const mongoose = require("mongoose");
const User = require("./models/User");

async function checkAdmin() {
    try {
        await mongoose.connect(process.env.MONGO_URI);

        const user = await User.findOne({
            userId: "AG1001"
        }).select("userId name mobile role status");

        if (!user) {
            console.log("AG1001 NOT FOUND");
        } else {
            console.log({
                userId: user.userId,
                name: user.name,
                mobile: user.mobile,
                role: user.role,
                status: user.status
            });
        }

    } catch (error) {
        console.error("CHECK ERROR:", error.message);
    } finally {
        await mongoose.disconnect();
    }
}

checkAdmin();
