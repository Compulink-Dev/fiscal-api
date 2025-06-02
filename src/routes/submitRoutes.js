const connectDB = require("../config/db");

// routes/submit.js
async function submitHandler(req, res) {
  try {
    await connectDB();

    const { deviceID, receipt } = req.body;

    console.log("Received payload in /api/submit:", { deviceID, receipt });

    if (!deviceID || !receipt || Object.keys(receipt).length === 0) {
      console.error(
        "Error: DeviceID or receipt data is missing in the request body."
      );
      return res.status(400).json({
        success: false,
        error: "DeviceID or receipt data is missing in the request body.",
      });
    }

    // Fix: Use the destructured variables or req.body instead of undefined 'body'
    console.log(
      "Outgoing Payload to MongoDB:",
      JSON.stringify({ deviceID, receipt }, null, 2)
    );

    // Just return the data, no database operations
    res.json({
      success: true,
      data: {
        deviceID,
        receipt,
      },
    });
  } catch (error) {
    const errorMessage = error.response?.data || error.message;
    console.error("Error saving receipt:", errorMessage);
    res.status(500).json({
      success: false,
      error: errorMessage,
    });
  }
}

module.exports = submitHandler;
