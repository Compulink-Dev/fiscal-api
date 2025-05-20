const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const xss = require('xss-clean');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const dotenv = require('dotenv');
const morgan = require('morgan');
const colors = require('colors');
const fileupload = require('express-fileupload');
const errorHandler = require('./middleware/errorHandler');
const connectDB = require('./config/db');

// Load env vars
dotenv.config({ path: '.env' });

// Connect to database
connectDB();

// Route files
const auth = require('./routes/authRoutes');
const companies = require('./routes/companyRoutes');
const devices = require('./routes/deviceRoutes');
const receipts = require('./routes/receiptRoutes');
const inventory = require('./routes/inventoryRoutes')
const hash = require('./routes/hashRoutes')
const test = require('./routes/test')

const app = express();

// Update your middleware stack to this order:

// 1. Security headers first
app.use(helmet());

// 2. CORS before other middleware
app.use(cors());

// 3. Request parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// 4. File upload (before sanitization)
app.use(fileupload({
  useTempFiles: true,
  tempFileDir: '/tmp/'
}));

// 5. Custom sanitization (modified version)
app.use((req, res, next) => {
  // Create sanitized copies instead of modifying directly
  if (req.body) {
    req.sanitizedBody = mongoSanitize.sanitize({ ...req.body });
  }
  if (req.params) {
    req.sanitizedParams = mongoSanitize.sanitize({ ...req.params });
  }
  next();
});

// 6. XSS protection (alternative approach)
app.use((req, res, next) => {
  // Custom XSS cleaning logic
  const clean = (obj) => {
    if (!obj) return;
    Object.keys(obj).forEach(key => {
      if (typeof obj[key] === 'string') {
        obj[key] = obj[key].replace(/</g, '&lt;').replace(/>/g, '&gt;');
      } else if (typeof obj[key] === 'object') {
        clean(obj[key]);
      }
    });
  };
  
  if (req.body) clean(req.body);
  if (req.params) clean(req.params);
  next();
});

// 7. Other middleware
app.use(limiter);
app.use(hpp());
// Set static folder
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiting
const limiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 mins
  max: 100
});
// Mount routers
app.use('/api/auth', auth);
app.use('/api/companies', companies);
app.use('/api/devices', devices);
app.use('/api/receipts', receipts);
app.use('/api/hash', hash);
app.use('/api/inventory', inventory);
app.use('/test', test)

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const server = app.listen(
  PORT,
  console.log(
    `Server running in ${process.env.NODE_ENV} mode on port ${PORT}`.yellow.bold
  )
);

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log(`Error: ${err.message}`.red);
  // Close server & exit process
  server.close(() => process.exit(1));
});