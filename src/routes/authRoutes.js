const express = require('express');
const router = express.Router();

// Example route
router.post('/login', (req, res) => {
    const cleanData = req.sanitizedBody || req.body;
  res.send('Login endpoint');
});

router.post('/register', (req, res) => {
    const cleanData = req.sanitizedBody || req.body;
    res.send('Register endpoint');
  });

// Export the router
module.exports = router;
