const express = require("express");

const app = express();

const PORT = process.env.PORT || 5000;

app.use(express.json());

app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        message: "Aarohan Global API is running"
    });
});

app.listen(PORT, () => {
    console.log(`Aarohan Global API running on port ${PORT}`);
});
