const jwt = require('jsonwebtoken');

const authenticateSuperAdmin = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access token missing' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });

    if (user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Unauthorized: Super admin access required.' });
    }

    req.user = user;
    next();
  });
};

module.exports = { authenticateSuperAdmin };
