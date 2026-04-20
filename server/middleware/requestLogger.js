const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '..', 'store');
const SKIP_EXACT = new Set(['/', '/health']);

function todayLogFile() {
  const date = new Date().toISOString().slice(0, 10);
  return path.join(LOG_DIR, `request_logs_${date}.jsonl`);
}

function shouldLog(method, pathOnly) {
  if (method === 'OPTIONS') return false;
  if (SKIP_EXACT.has(pathOnly)) return false;
  return pathOnly.startsWith('/api/') || pathOnly === '/test-db';
}

function requestLogger(req, res, next) {
  const start = Date.now();
  const method = req.method;
  const pathOnly = (req.originalUrl || req.url || '').split('?')[0];
  const loginPhone = pathOnly === '/api/auth/login' ? req.body?.phone : null;
  res.on('finish', () => {
    if (!shouldLog(method, pathOnly)) return;
    const entry = {
      ts: new Date().toISOString(),
      method,
      path: pathOnly,
      status: res.statusCode,
      duration_ms: Date.now() - start,
      user_id: req.user?.id || null,
      phone: req.user?.phone || loginPhone || null,
      name: req.user?.name || null,
      sub_unit_id: req.subUnitId || req.headers['x-sub-unit-id'] || null,
      ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || null,
      ua: req.headers['user-agent'] || null,
    };
    fs.appendFile(todayLogFile(), JSON.stringify(entry) + '\n', err => {
      if (err) console.error('[requestLogger] write failed:', err.message);
    });
  });
  next();
}

module.exports = { requestLogger };