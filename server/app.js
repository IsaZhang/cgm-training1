require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const { router: authRoutes, auth, adminAuth } = require('./routes/auth');
const flashcardRoutes = require('./routes/flashcard');
const chatRoutes = require('./routes/chat');
const { router: examRoutes, adminRouter: examAdminRoutes } = require('./routes/exam');
const voiceRoutes = require('./routes/voice');
const statsRoutes = require('./routes/stats');
const knowledgeRoutes = require('./routes/knowledge');
const employeesAdminRoutes = require('./routes/employeesAdmin');
const knowledgeAdminUpload = require('./routes/knowledgeAdminUpload');
const db = require('./db');
const kc = require('./services/knowledgeCatalog');

(async () => {
  try {
    await kc.runStartupMigrations(db);
    console.log('[cgm-training] knowledge migrations applied');
  } catch (e) {
    console.error('[cgm-training] knowledge migrations failed', e);
  }
})();

const app = express();
const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    // 小程序/服务端调用可能没有 Origin；开发期允许全部
    if (!origin) return cb(null, true);
    if (allowedOrigins.length === 0) return cb(null, true);
    return cb(null, allowedOrigins.includes(origin));
  }
}));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true })); // 支持 form-urlencoded（curl -d）

// Web 管理后台静态文件（admin-exam.html 等）
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));

// 健康检查
app.get('/', (req, res) => res.json({ status: 'ok' }));
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// 测试数据库连接
app.get('/test-db', adminAuth, async (req, res) => {
  try {
    console.log('Testing database connection...');
    const db = require('./db');
    const employees = await db.filter('employees', () => true);
    console.log('Database test successful, found', employees.length, 'employees');
    res.json({ success: true, count: employees.length });
  } catch (error) {
    console.error('Database test failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 公开接口
app.use('/api/auth', authRoutes);

// 管理员可读：知识目录配置（用于 admin-exam 下拉框）
app.get('/api/knowledge/catalog', adminAuth, (req, res) => {
  try {
    const cat = kc.loadCatalog();
    res.json({
      version: cat.version,
      units: (cat.units || []).filter(u => u.enabled !== false),
      subunits: (cat.subunits || []).filter(s => s.enabled !== false),
      roles: cat.roles || []
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** 完整 catalog（含 disabled），供管理端在线编辑 */
app.get('/api/knowledge/catalog/raw', adminAuth, (req, res) => {
  try {
    res.json(kc.loadCatalog());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/knowledge/catalog', adminAuth, (req, res) => {
  try {
    kc.saveCatalog(req.body);
    res.json({ ok: true, version: kc.loadCatalog().version });
  } catch (e) {
    const status = e.status === 400 ? 400 : 500;
    res.status(status).json({ error: e.message });
  }
});

app.get('/api/knowledge/catalog/versions', adminAuth, knowledgeAdminUpload.getCatalogVersions);
app.post('/api/knowledge/catalog/restore', adminAuth, express.json(), knowledgeAdminUpload.postCatalogRestore);
app.post('/api/knowledge/upload/subunit', adminAuth, express.json({ limit: '20mb' }), knowledgeAdminUpload.postUploadSubunitJson);
app.post('/api/knowledge/upload/unit', adminAuth, express.json({ limit: '20mb' }), knowledgeAdminUpload.postUploadUnitJson);

// 需要登录的接口
app.use('/api/knowledge', auth, knowledgeRoutes);
app.use('/api/employees/admin', employeesAdminRoutes);
app.use('/api/flashcard', auth, flashcardRoutes);
app.use('/api/chat', auth, chatRoutes);
app.use('/api/exam/admin', examAdminRoutes);  // 管理员接口，不经过 auth
app.use('/api/exam', auth, examRoutes);
app.use('/api/voice', auth, voiceRoutes);

// 统计接口（管理员）
app.use('/api/stats', adminAuth, statsRoutes);

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log('ENV_ID:', process.env.ENV_ID);
    console.log('TCB_ENV:', process.env.TCB_ENV);
    console.log('SECRETID:', process.env.TENCENTCLOUD_SECRETID ? 'configured' : 'missing');
    console.log('SECRETKEY:', process.env.TENCENTCLOUD_SECRETKEY ? 'configured' : 'missing');
  });
}

module.exports = app;
