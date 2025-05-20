const connectDB = require("../config/db");

// routes/submit.js
async function submitHandler(req, res) {
    try {
        await connectDB()

        const { deviceID, receipt } = req.body;

        console.log('Received payload in /api/submit:', { deviceID, receipt });

        if (!deviceID || !receipt || Object.keys(receipt).length === 0) {
            console.error("Error: DeviceID or receipt data is missing in the request body.");
            return res.status(400).json({
                success: false,
                error: "DeviceID or receipt data is missing in the request body."
            });
        }

        const body = {
            deviceID,
            receipt,
        };

        console.log("Outgoing Payload to MongoDB:", JSON.stringify(body, null, 2));

        const savedReceipt = await Receipt.create(receipt);

        res.json({
            success: true,
            savedReceipt,
        });
    } catch (error) {
        const errorMessage = error.response?.data || error.message;
        console.error('Error saving receipt:', errorMessage);
        res.status(500).json({
            success: false,
            error: errorMessage
        });
    }
}

module.exports = submitHandler;