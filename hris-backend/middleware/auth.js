const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access token missing' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });

    // CROSS-TENANCY GUARD CHECK
    // Verify that the user token matches the context of the tenant header provided
    if (user.tenantId !== req.tenantId) {
      return res.status(403).json({ error: 'Unauthorized: Cross-tenant data access denied.' });
    }

    req.user = user;
    next();
  });
};

module.exports = { authenticateToken };
