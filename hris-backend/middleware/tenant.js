const tenantResolver = (req, res, next) => {
  const tenantId = req.headers['x-tenant-id'];

  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant identification context (X-Tenant-ID) is missing.' });
  }

  // Attach tenant context to the request object for global access down the line
  req.tenantId = tenantId;
  next();
};

module.exports = tenantResolver;
