const express = require('express');
const router = express.Router();
const { getAppVersion } = require('../controllers/app.controller');

// Public (no auth) — used by the mobile app to enforce force updates.
router.get('/version', getAppVersion);

module.exports = router;