require("dotenv").config();

const mongoose = require("mongoose");
const User = require("./models/User");

async function inspectAdmin() {
    try {
        await mongoose.connect(process.env.MONGO_URI);

        const user = await User.findOne({
            userId: "AG1001"
        }).select("+password");

        if (!user) {
            console.log("AG1001 NOT FOUND");
            return;
        }

        const data = user.toObject();

        delete data.password;

        console.log(data);

    } catch (error) {
        console.error(
            "INSPECT ERROR:",
            error.message
        );
    } finally {
        await mongoose.disconnect();
    }
}

inspectAdmin();
