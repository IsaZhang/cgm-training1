# 语音考核功能配置说明

## 需要的环境变量

在 `/Users/zyf/cgm-training/server/.env` 文件中添加以下配置：

```env
# 阿里云AccessKey（用于语音服务）
ALIYUN_ACCESS_KEY_ID=your_access_key_id
ALIYUN_ACCESS_KEY_SECRET=your_access_key_secret

# 阿里云智能语音服务AppKey
ALIYUN_NLS_APP_KEY=your_nls_app_key
```

## 获取配置步骤

1. **登录阿里云控制台**：https://www.aliyun.com
2. **开通智能语音交互服务**：搜索"智能语音交互"并开通
3. **创建项目获取AppKey**：
   - 进入智能语音交互控制台
   - 创建项目
   - 获取AppKey
4. **创建AccessKey**：
   - 进入AccessKey管理页面
   - 创建AccessKey
   - 记录AccessKeyId和AccessKeySecret

## 安装依赖

```bash
cd /Users/zyf/cgm-training/server
npm install
```

## 成本预估

- 语音识别（STT）：约 ¥0.003/次（15秒内）
- 语音合成（TTS）：约 ¥0.02/千字符
- 每次考核预计成本：¥0.1-0.3元
