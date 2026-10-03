const {
  verifyToken,
} = require('../core/utils/jwt');

function auth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'Authorization header is required',
      });
    }

    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Invalid authorization format',
      });
    }

    const token = authHeader.substring(7);

    const decoded = verifyToken(token);

    req.user = decoded;

    next();

  } catch (err) {
    console.error(err.message);

    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
    });
  }
}

module.exports = auth;