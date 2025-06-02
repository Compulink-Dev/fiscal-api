// routes/client-key.js
const Client = require("../models/Client");

async function getClientKey(req, res) {
  try {
    const { clientId } = req.query;
    const client = await Client.findById(clientId).select("privateKey");
    
    if (!client) return res.status(404).json({ error: "Client not found" });
    
    res.json({ privateKey: client.privateKey });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

module.exports = getClientKey;