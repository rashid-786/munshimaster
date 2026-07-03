const express = require('express');
const router = express.Router();
const multer = require('multer');
const brandingController = require('../controllers/branding.controller');
const { authenticateToken } = require('../middleware/auth');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed: PNG, JPEG, SVG, ICO'), false);
    }
  },
});

router.get('/', authenticateToken, brandingController.getBranding);
router.put('/', authenticateToken, brandingController.updateBranding);
router.post('/upload', authenticateToken, upload.single('image'), brandingController.uploadBrandingImage);
router.post('/verify-domain', authenticateToken, brandingController.verifyDomain);

module.exports = router;
