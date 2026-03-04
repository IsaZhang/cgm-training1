require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { router: authRoutes, auth } = require('./routes/auth');
const flashcardRoutes = require('./routes/flashcard');
const chatRoutes = require('./routes/chat');
const examRoutes = require('./routes/exam');
const statsRoutes = require('./routes/stats');

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// 健康检查
app.get('/', (req, res) => res.json({ status: 'ok' }));
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// 公开接口
app.use('/api/auth', authRoutes);

// 需要登录的接口
app.use('/api/flashcard', auth, flashcardRoutes);
app.use('/api/chat', auth, chatRoutes);
app.use('/api/exam', auth, examRoutes);

// 统计接口（公开，方便管理员查看）
app.use('/api/stats', statsRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
