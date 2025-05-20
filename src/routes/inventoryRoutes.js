// routes/inventory.js
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function inventoryHandler(req, res) {
    const body = ["", "", "", "", "2024-01-01", 0, false, 25, 1, ""];

    try {
        const response = await fetch('https://hosted3.palladium.co.za/api/InventoryPicker/GetInventoryItemsWebStore', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Auth-database': 'paldbPRODCompulinkSystemsDBLive',
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('API Error:', errorText);
            return res.status(response.status).json({ 
                error: 'Failed to fetch inventory', 
                details: errorText 
            });
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Request Failed:', error);
        res.status(500).json({ 
            error: 'Request failed', 
            details: error.message 
        });
    }
}

module.exports = inventoryHandler;