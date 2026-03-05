# CGM训练小程序 - 服务端部署指南

## 1. 环境要求
- Node.js 18+
- npm 或 yarn

## 2. 部署步骤

### 2.1 安装依赖
```bash
npm install
```

### 2.2 配置环境变量
创建 `.env` 文件：
```bash
LLM_PROVIDER=qwen
LLM_API_KEY=你的通义千问API密钥
PORT=3000
```

### 2.3 启动服务
```bash
# 开发环境
npm run dev

# 生产环境
npm start
```

服务将在 http://localhost:3000 启动

## 3. 导入员工数据

服务启动后，导入437个员工数据：

```bash
curl -X POST http://localhost:3000/api/auth/employees/import \
  -H "Content-Type: application/json" \
  -d @employees-data.json
```

或使用提供的导入脚本：
```bash
node import-all-employees.js
```

## 4. 验证部署

访问健康检查：
```bash
curl http://localhost:3000/
# 应返回: {"status":"ok"}
```

## 5. 小程序配置

部署成功后，修改小程序代码：
- 文件：miniprogram/app.js
- 修改第3行的baseUrl为你的服务器地址

## 6. 数据存储

数据存储在 `store/` 目录：
- employees.json - 员工数据
- users.json - 用户数据
- flashcard_progress.json - 学习进度
- exam_records.json - 考核记录

**重要**：定期备份store目录！
