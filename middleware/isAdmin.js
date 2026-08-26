const jwt = require("jsonwebtoken");

module.exports = function (req, res, next) {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({ success: false, message: "Access Denied. No token provided." });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "aarohan_secret_key");
    if (decoded.role !== "admin" && !decoded.isAdmin) {
      return res.status(403).json({ success: false, message: "Forbidden. Admin access required." });
    }

    req.user = decoded;
    next();
  } catch (err) {
    return res.status(400).json({ success: false, message: "Invalid or expired token." });
  }
};
