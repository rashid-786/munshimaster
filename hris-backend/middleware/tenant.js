const tenantResolver = (req, res, next) => {
  // Skip tenant check for Razorpay webhook
  if (req.originalUrl === '/api/v1/core/subscription/webhook') return next();

  const tenantId = req.headers['x-tenant-id'] || req.query.tenantId;

  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant identification context (X-Tenant-ID) is missing.' });
  }

  // Attach tenant context to the request object for global access down the line
  req.tenantId = tenantId;
  next();
};

module.exports = tenantResolver;
