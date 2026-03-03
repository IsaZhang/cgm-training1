# CGM 转化训练小程序 - 微信云托管部署指南

## 一、准备工作

### 1. 开通微信云托管
1. 登录[微信公众平台](https://mp.weixin.qq.com/)
2. 进入小程序管理后台
3. 左侧菜单：开发 → 云开发 → 开通云托管
4. 创建环境（推荐：生产环境）
5. 记录环境 ID（ENV_ID），后续配置需要

### 2. 安装微信开发者工具
- 下载地址：https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html
- 安装并登录

## 二、后端部署（云托管）

### 1. 初始化云开发数据库
在云开发控制台创建以下集合（Collection）：
- `users` - 用户表
- `employees` - 员工表
- `flashcard_progress` - 学习进度
- `exam_records` - 考核记录

### 2. 导入员工数据
使用 `/api/auth/employees/import` 接口导入员工名单：
```bash
curl -X POST https://你的云托管地址/api/auth/employees/import \
  -H "Content-Type: application/json" \
  -d '{
    "employees": [
      {"name": "张三", "phone": "13800000001"},
      {"name": "李四", "phone": "13800000002"}
    ]
  }'
```

### 3. 部署到云托管

#### 方式一：通过微信开发者工具（推荐）
1. 打开微信开发者工具
2. 导入项目，选择 `server` 目录
3. 点击右上角"云开发" → "云托管"
4. 新建服务：
   - 服务名称：cgm-training-api
   - 上传方式：本地代码
   - 选择 server 目录
5. 配置环境变量：
   - `TCB_ENV` = 你的环境ID
   - `LLM_PROVIDER` = qwen
   - `LLM_API_KEY` = 你的通义千问API Key
6. 点击"部署"

#### 方式二：通过命令行
```bash
cd server
# 安装 tcb CLI
npm install -g @cloudbase/cli
# 登录
tcb login
# 部署
tcb run deploy --name cgm-training-api
```

### 4. 获取服务访问地址
部署成功后，在云托管控制台可以看到服务的访问地址，格式类似：
```
https://cgm-training-api-xxx.ap-shanghai.run.tcb.qq.com
```

## 三、前端配置

### 1. 修改 API 地址
编辑 `miniprogram/app.js`，修改 `baseUrl`：
```js
globalData: {
  baseUrl: 'https://你的云托管地址/api',  // 替换为实际地址
  token: '',
  userInfo: null
}
```

### 2. 配置服务器域名白名单
1. 登录微信公众平台
2. 设置 → 开发设置 → 服务器域名
3. 在 "request合法域名" 中添加：
   ```
   https://你的云托管地址
   ```

### 3. 上传小程序代码
1. 在微信开发者工具中打开 `miniprogram` 目录
2. 点击右上角"上传"
3. 填写版本号和备注
4. 提交审核

## 四、测试验证

### 1. 测试登录接口
```bash
curl -X POST https://你的云托管地址/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"name":"测试员工","phone":"13800000001"}'
```

### 2. 测试 AI 对话
```bash
TOKEN="从登录接口获取的token"
curl -X POST https://你的云托管地址/api/chat/message \
  -H "Content-Type: application/json" \
  -H "x-token: $TOKEN" \
  -d '{
    "patient_id": "patient_01",
    "history": [],
    "message": "您好，我是照护师"
  }'
```

## 五、常见问题

### 1. 数据库连接失败
- 检查 `TCB_ENV` 环境变量是否正确
- 确认云开发数据库已开通
- 检查集合是否已创建

### 2. LLM 调用失败
- 检查 `LLM_API_KEY` 是否正确
- 确认通义千问账户余额充足
- 查看云托管日志排查错误

### 3. 小程序无法访问后端
- 检查服务器域名是否已配置
- 确认云托管服务已启动
- 检查 `baseUrl` 配置是否正确

## 六、监控与运维

### 查看日志
云托管控制台 → 服务详情 → 日志

### 查看监控
云托管控制台 → 服务详情 → 监控

### 扩缩容
云托管控制台 → 服务详情 → 版本管理 → 调整实例数

