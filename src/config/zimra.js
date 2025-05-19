module.exports = {
    ZIMRA_API_URL: process.env.ZIMRA_API_URL || 'https://fdmsapitest.zimra.co.zw',
    ZIMRA_API_KEY: process.env.ZIMRA_API_KEY,
    ZIMRA_QR_URL: process.env.ZIMRA_QR_URL || 'https://receipt.zimra.org',
    ZIMRA_CERTIFICATE: process.env.ZIMRA_CERTIFICATE,
    ZIMRA_CA_CERTIFICATE: process.env.ZIMRA_CA_CERTIFICATE,
    
    // Default timeout for API calls (in milliseconds)
    API_TIMEOUT: 30000,
    
    // Maximum file size for offline submissions (3MB)
    MAX_FILE_SIZE: 3 * 1024 * 1024,
    
    // Supported tax rates
    TAX_RATES: {
      1: { name: 'VAT', rate: 15 },
      2: { name: 'Zero Rated', rate: 0 },
      3: { name: 'Exempt', rate: null }
    },
    
    // Supported money types
    MONEY_TYPES: [
      { code: 'Cash', name: 'Cash' },
      { code: 'Card', name: 'Card' },
      { code: 'MobileWallet', name: 'Mobile Wallet' },
      { code: 'Coupon', name: 'Coupon' },
      { code: 'Credit', name: 'Credit' },
      { code: 'BankTransfer', name: 'Bank Transfer' },
      { code: 'Other', name: 'Other' }
    ]
  };