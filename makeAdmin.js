require("dotenv").config();

const mongoose = require("mongoose");
const User = require("./models/User");

async function makeAdmin() {
    try {
        await mongoose.connect(process.env.MONGO_URI);

        const user = await User.findOneAndUpdate(
            { userId: "AG1001" },
            { $set: { role: "ADMIN" } },
            { new: true }
        ).select("userId name role");

        if (!user) {
            console.log("AG1001 USER NOT FOUND");
        } else {
            console.log(
                `ADMIN ROLE SET: ${user.userId} (${user.role})`
            );
        }

    } catch (error) {
        console.error(
            "MAKE ADMIN ERROR:",
            error.message
        );
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
}

makeAdmin();
