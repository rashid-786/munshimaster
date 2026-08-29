const legalService = require('../services/legalDocument.service');

// =============================================
// SUPER ADMIN — manage documents
// =============================================

exports.listDocuments = async (req, res) => {
  try {
    const result = await legalService.listAll();
    res.json(result);
  } catch (error) {
    console.error('listDocuments error:', error);
    res.status(500).json({ error: 'Failed to list legal documents.' });
  }
};

exports.getDocument = async (req, res) => {
  try {
    const result = await legalService.getDocument(req.params.id);
    res.json(result);
  } catch (error) {
    const status = error.message === 'Document not found.' ? 404 : 400;
    res.status(status).json({ error: error.message });
  }
};

exports.createDocument = async (req, res) => {
  try {
    const result = await legalService.createDocument(req.body, req.user?.name || req.user?.id);
    res.status(201).json({ message: 'Document created.', ...result });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to create document.' });
  }
};

exports.updateDocument = async (req, res) => {
  try {
    const doc = await legalService.updateDocument(req.params.id, req.body, req.user?.name || req.user?.id);
    res.json({ message: 'Document updated.', document: doc });
  } catch (error) {
    const status = error.message === 'Document not found.' ? 404 : 400;
    res.status(status).json({ error: error.message });
  }
};

exports.createVersion = async (req, res) => {
  try {
    const result = await legalService.createVersion(req.params.id, req.body, req.user?.name || req.user?.id);
    res.status(201).json({ message: 'Draft version created.', ...result });
  } catch (error) {
    const status = error.message === 'Document not found.' ? 404 : 400;
    res.status(status).json({ error: error.message });
  }
};

exports.updateDraftVersion = async (req, res) => {
  try {
    const version = await legalService.updateDraftVersion(
      req.params.id, req.params.versionId, req.body, req.user?.name || req.user?.id
    );
    res.json({ message: 'Draft version updated.', version });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.publishVersion = async (req, res) => {
  try {
    const doc = await legalService.publishVersion(
      req.params.id, req.params.versionId, req.user?.name || req.user?.id
    );
    res.json({ message: 'Version published.', document: doc });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.archiveDocument = async (req, res) => {
  try {
    const doc = await legalService.archiveDocument(req.params.id, req.user?.name || req.user?.id);
    res.json({ message: 'Document archived.', document: doc });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.deleteDocument = async (req, res) => {
  try {
    const result = await legalService.deleteDocument(req.params.id);
    res.json({ message: 'Document deleted along with all versions and acceptance records.', ...result });
  } catch (error) {
    const status = error.message === 'Document not found.' ? 404 : 400;
    res.status(status).json({ error: error.message });
  }
};

exports.listAcceptances = async (req, res) => {
  try {
    const result = await legalService.listAcceptances(req.params.id, parseInt(req.query.limit) || 100);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// =============================================
// TENANT — read + accept
// =============================================

exports.listTenantDocuments = async (req, res) => {
  try {
    const result = await legalService.listPublishedForTenant(req.tenantId, req.user.id);
    res.json(result);
  } catch (error) {
    console.error('listTenantDocuments error:', error);
    res.status(500).json({ error: 'Failed to fetch legal documents.' });
  }
};

exports.getTenantDocument = async (req, res) => {
  try {
    const result = await legalService.getPublishedForTenant(req.params.slug, req.tenantId, req.user.id);
    res.json(result);
  } catch (error) {
    const status = error.message === 'Document not found.' ? 404 : 400;
    res.status(status).json({ error: error.message });
  }
};

exports.acceptDocument = async (req, res) => {
  const { id } = req.params;
  const { versionId } = req.body;

  if (!versionId) return res.status(400).json({ error: 'versionId is required.' });

  try {
    const result = await legalService.recordAcceptance({
      tenantId: req.tenantId,
      userId: req.user.id,
      documentId: id,
      versionId,
      platform: req.body.platform || req.headers['x-platform'] || null,
      deviceInfo: req.body.deviceInfo || req.headers['x-device-info'] || null,
      appVersion: req.body.appVersion || req.headers['x-app-version'] || null,
      ipAddress: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || null,
    });
    res.json({ message: result.alreadyAccepted ? 'Already accepted.' : 'Accepted.', ...result });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// =============================================
// PUBLIC — unauthenticated compliance URLs
// =============================================

exports.getPublicDocument = async (req, res) => {
  try {
    const doc = await legalService.getLatestPublishedBySlug(req.params.slug);
    if (!doc) return res.status(404).json({ error: 'Document not found.' });
    res.json({ document: doc });
  } catch (error) {
    console.error('getPublicDocument error:', error);
    res.status(500).json({ error: 'Failed to fetch document.' });
  }
};

// Render an HTML view for store-compliance links (rendered directly in browsers).
exports.getPublicDocumentHtml = async (req, res) => {
  try {
    const doc = await legalService.getLatestPublishedBySlug(req.params.slug);
    if (!doc) return res.status(404).send('<h1>Document not found</h1>');

    const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${doc.title} - Bahi360</title>
<style>
  body { font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; max-width: 760px; margin: 0 auto; padding: 32px 20px 64px; color: #1f2937; line-height: 1.6; }
  h1 { color: #0B3C5D; font-size: 26px; margin-bottom: 24px; }
  .body h2 { font-size: 19px; color: #111827; margin-top: 24px; }
  .body h3 { font-size: 16px; color: #111827; margin-top: 18px; }
  .body a { color: #0B3C5D; }
  .body ul, .body ol { padding-left: 22px; }
  .body p { margin: 8px 0; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 12px; }
</style></head><body>
  <div class="body">${doc.body}</div>
  <div class="footer">&copy; ${new Date().getFullYear()} Bahi360. All rights reserved.</div>
</body></html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    console.error('getPublicDocumentHtml error:', error);
    res.status(500).send('<h1>Something went wrong</h1>');
  }
};