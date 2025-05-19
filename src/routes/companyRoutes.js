const express = require('express');
const router = express.Router();
const {
  getCompanies,
  getCompany,
  createCompany,
  updateCompany,
  deleteCompany,
  getZimraStatus,
  registerWithZimra
} = require('../controllers/companyController');
const { protect, authorize } = require('../middleware/auth');
const advancedResults = require('../middleware/advancedResults');
const Company = require('../models/Company');

// Include other resource routers
const userRouter = require('./userRoutes');
const deviceRouter = require('./deviceRoutes');

// Re-route into other resource routers
router.use('/:companyId/users', userRouter);
router.use('/:companyId/devices', deviceRouter);

router
  .route('/')
  .get(
    protect,
    authorize('admin'),
    advancedResults(Company),
    getCompanies
  )
  .post(protect, authorize('admin'), createCompany);

router
  .route('/:id')
  .get(protect, authorize('admin'), getCompany)
  .put(protect, authorize('admin'), updateCompany)
  .delete(protect, authorize('admin'), deleteCompany);

router
  .route('/:id/zimra-status')
  .get(protect, authorize('admin', 'company_admin'), getZimraStatus);

router
  .route('/:id/register-zimra')
  .post(protect, authorize('admin', 'company_admin'), registerWithZimra);

module.exports = router;