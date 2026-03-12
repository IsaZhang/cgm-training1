require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { router: authRoutes, auth, adminAuth } = require('./routes/auth');
const flashcardRoutes = require('./routes/flashcard');
const chatRoutes = require('./routes/chat');
const examRoutes = require('./routes/exam');
const voiceRoutes = require('./routes/voice');
const statsRoutes = require('./routes/stats');

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
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true })); // 支持 form-urlencoded（curl -d）

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

// 需要登录的接口
app.use('/api/flashcard', auth, flashcardRoutes);
app.use('/api/chat', auth, chatRoutes);
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
