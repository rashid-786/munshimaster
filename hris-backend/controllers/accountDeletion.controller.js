const deletionService = require('../services/accountDeletion.service');

// =============================================
// TENANT — request / view / cancel
// =============================================

exports.requestDeletion = async (req, res) => {
  const { reason } = req.body;

  try {
    const result = await deletionService.requestDeletion({
      tenantId: req.tenantId,
      userId: req.user.id,
      reason,
    });
    res.status(201).json({ message: 'Account deletion request submitted for review.', ...result });
  } catch (error) {
    const status = error.code === 'DELETION_REQUEST_PENDING' ? 409 : 400;
    res.status(status).json({ error: error.message, code: error.code || null });
  }
};

exports.getMyRequest = async (req, res) => {
  try {
    const request = await deletionService.getRequestForTenant(req.tenantId);
    res.json({ request });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch deletion request.' });
  }
};

exports.cancelMyRequest = async (req, res) => {
  try {
    const result = await deletionService.cancelRequest(req.tenantId, req.user.id);
    res.json({ message: 'Deletion request cancelled.', ...result });
  } catch (error) {
    const status = error.code === 'NO_PENDING_REQUEST' ? 404 : 400;
    res.status(status).json({ error: error.message });
  }
};

// =============================================
// SUPER ADMIN — review / action
// =============================================

exports.listRequests = async (req, res) => {
  try {
    const result = await deletionService.listRequests({ status: req.query.status, limit: parseInt(req.query.limit) || 100 });
    res.json(result);
  } catch (error) {
    console.error('list deletion requests error:', error);
    res.status(500).json({ error: 'Failed to list deletion requests.' });
  }
};

exports.getRequest = async (req, res) => {
  try {
    const request = await deletionService.getRequest(req.params.id);
    if (!request) return res.status(404).json({ error: 'Deletion request not found.' });
    res.json({ request });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch deletion request.' });
  }
};

exports.approveRequest = async (req, res) => {
  try {
    const request = await deletionService.approveRequest(req.params.id, req.user?.name || req.user?.id, req.body.reviewNote);
    res.json({ message: 'Request approved. Tenant account and all data deleted permanently.', request });
  } catch (error) {
    const status = error.message === 'Deletion request not found.' ? 404 : 400;
    res.status(status).json({ error: error.message });
  }
};

exports.rejectRequest = async (req, res) => {
  try {
    const request = await deletionService.rejectRequest(req.params.id, req.user?.name || req.user?.id, req.body.reviewNote);
    res.json({ message: 'Request rejected. The tenant account remains active.', request });
  } catch (error) {
    const status = error.message === 'Deletion request not found.' ? 404 : 400;
    res.status(status).json({ error: error.message });
  }
};