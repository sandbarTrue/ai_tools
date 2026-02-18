// src/middleware/auth.js — 认证 & 权限中间件

/**
 * 基础认证中间件
 * 检查请求头中的 API Key 或 session
 */
function requireAuth(req, res, next) {
  // 方式 1: Bearer token
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    // TODO: 接入实际的 token 验证（JWT / session store）
    req.userId = token; // placeholder
    return next();
  }

  // 方式 2: x-api-key header
  const apiKey = req.headers['x-api-key'];
  if (apiKey) {
    req.userId = apiKey;
    return next();
  }

  // 方式 3: session（如果集成了 express-session）
  if (req.session && req.session.userId) {
    req.userId = req.session.userId;
    return next();
  }

  return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
}

/**
 * Premium 权限检查中间件
 * 需要先通过 requireAuth，然后检查用户是否为 premium
 */
function requirePremium(db) {
  return async (req, res, next) => {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      if (!db) {
        // 数据库未连接时放行（开发模式）
        return next();
      }

      const [rows] = await db.execute(
        'SELECT is_premium FROM users WHERE id = ? LIMIT 1',
        [req.userId]
      );

      if (rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (!rows[0].is_premium) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Premium subscription required',
        });
      }

      next();
    } catch (err) {
      console.error('Premium check error:', err.message);
      // 数据库异常时放行，避免阻塞
      next();
    }
  };
}

module.exports = { requireAuth, requirePremium };
