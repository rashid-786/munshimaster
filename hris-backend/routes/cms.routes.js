const express = require('express');
const publicRouter = express.Router();
const cmsController = require('../controllers/cms.controller');

// Public CMS config + published pages (no auth, used by the website).
publicRouter.get('/', cmsController.getPublicConfig);
publicRouter.get('/help', cmsController.getPublicHelp);
publicRouter.get('/pages/:slug', cmsController.getPublicPage);

module.exports = publicRouter;