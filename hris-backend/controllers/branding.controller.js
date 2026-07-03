const whiteLabelService = require('../services/whiteLabel.service');
const audit = require('../services/audit.service');

exports.getBranding = async (req, res) => {
  try {
    const branding = await whiteLabelService.getBranding(req.tenantId);
    res.json({ branding });
  } catch (error) {
    console.error('getBranding error:', error);
    res.status(500).json({ error: 'Failed to get branding.' });
  }
};

exports.updateBranding = async (req, res) => {
  try {
    const branding = await whiteLabelService.upsertBranding(req.tenantId, req.body);
    await audit.log({
      tenantId: req.tenantId,
      action: audit.AUDIT_ACTIONS.UPDATE_BRANDING,
      performedBy: req.user?.id,
      metadata: { updatedFields: Object.keys(req.body) },
    });
    res.json({ message: 'Branding updated.', branding });
  } catch (error) {
    console.error('updateBranding error:', error);
    res.status(400).json({ error: error.message || 'Failed to update branding.' });
  }
};

exports.uploadBrandingImage = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
    const { imageType } = req.body;
    if (!imageType) return res.status(400).json({ error: 'imageType is required.' });
    const result = await whiteLabelService.saveBrandingImage(req.tenantId, req.file, imageType);
    await audit.log({
      tenantId: req.tenantId,
      action: audit.AUDIT_ACTIONS.UPLOAD_BRANDING_IMAGE,
      performedBy: req.user?.id,
      metadata: { imageType, url: result.url },
    });
    res.json({ message: 'Image uploaded.', url: result.url });
  } catch (error) {
    console.error('uploadBrandingImage error:', error);
    res.status(500).json({ error: 'Failed to upload image.' });
  }
};

exports.verifyDomain = async (req, res) => {
  try {
    const branding = await whiteLabelService.verifyDomain(req.tenantId);
    await audit.log({
      tenantId: req.tenantId,
      action: audit.AUDIT_ACTIONS.VERIFY_DOMAIN,
      performedBy: req.user?.id,
    });
    res.json({ message: 'Domain verified.', branding });
  } catch (error) {
    console.error('verifyDomain error:', error);
    res.status(500).json({ error: 'Failed to verify domain.' });
  }
};
