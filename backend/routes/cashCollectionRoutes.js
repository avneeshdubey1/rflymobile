const express = require('express');
const controller = require('../controllers/cashCollectionController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticate, authorize('ADMIN'), controller.list);

module.exports = router;
