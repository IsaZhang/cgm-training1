/**
 * 数据访问层：默认 JSON 文件（db-json）。
 * 设置 USE_SQLITE=1 且已安装 optional 依赖 better-sqlite3 时使用 SQLite（store/app.sqlite）；加载失败则回退 JSON。
 */
if (process.env.USE_SQLITE === '1') {
  try {
    module.exports = require('./db-sqlite');
  } catch (e) {
    console.warn('[db] USE_SQLITE=1 但 SQLite 不可用，回退 JSON:', e.message);
    module.exports = require('./db-json');
  }
} else {
  module.exports = require('./db-json');
}
