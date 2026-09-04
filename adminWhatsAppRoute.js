const Setting = require("./models/Setting");

const DEFAULT_WHATSAPP = "9569196691";

// GET - Admin WhatsApp number
async function getAdminWhatsApp(req, res) {
  try {
    let setting = await Setting.findOne({
      key: "admin_whatsapp"
    });

    // First time: create default number
    if (!setting) {
      setting = await Setting.create({
        key: "admin_whatsapp",
        value: DEFAULT_WHATSAPP
      });
    }

    return res.json({
      success: true,
      whatsapp: setting.value
    });

  } catch (error) {
    console.error("GET ADMIN WHATSAPP ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load Admin WhatsApp number."
    });
  }
}

// PATCH - Admin WhatsApp number update
async function updateAdminWhatsApp(req, res) {
  try {
    let { whatsapp } = req.body;

    if (!whatsapp) {
      return res.status(400).json({
        success: false,
        message: "WhatsApp number is required."
      });
    }

    // Remove spaces, +, -, brackets etc.
    whatsapp = String(whatsapp).replace(/\D/g, "");

    // Allow Indian 10-digit number
    if (whatsapp.length === 10) {
      // Keep as 10 digit number in database
    } else if (whatsapp.length === 12 && whatsapp.startsWith("91")) {
      whatsapp = whatsapp.substring(2);
    } else {
      return res.status(400).json({
        success: false,
        message: "Enter a valid 10-digit WhatsApp number."
      });
    }

    const setting = await Setting.findOneAndUpdate(
      { key: "admin_whatsapp" },
      {
        key: "admin_whatsapp",
        value: whatsapp
      },
      {
        new: true,
        upsert: true,
        runValidators: true
      }
    );

    return res.json({
      success: true,
      message: "Admin WhatsApp number updated successfully.",
      whatsapp: setting.value
    });

  } catch (error) {
    console.error("UPDATE ADMIN WHATSAPP ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to update Admin WhatsApp number."
    });
  }
}

module.exports = {
  getAdminWhatsApp,
  updateAdminWhatsApp
};
