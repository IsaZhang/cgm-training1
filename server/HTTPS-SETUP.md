# 服务器 HTTPS SSL 证书配置指南

适用于 `ai-cgm.phrones.com` (8.131.113.38)

---

## 方案一：Let's Encrypt 免费证书（推荐，需 DNS 验证）

### 1. 在服务器执行，获取 TXT 记录

```bash
ssh root@8.131.113.38
/root/.acme.sh/acme.sh --issue -d ai-cgm.phrones.com --dns dns_manual --server letsencrypt --force
```

### 2. 在域名 DNS 添加 TXT 记录

在 phonres.com 的 DNS 管理中添加：

| 记录类型 | 主机记录 | 记录值 |
|---------|----------|--------|
| TXT | _acme-challenge.ai-cgm | （脚本输出的 TXT 值） |

### 3. 等待 1–5 分钟，验证解析

```bash
dig TXT _acme-challenge.ai-cgm.phrones.com +short
# 应返回记录值
```

### 4. 完成证书申请

```bash
/root/.acme.sh/acme.sh --renew -d ai-cgm.phrones.com --server letsencrypt --force
```

### 5. 配置 Nginx 使用新证书

```bash
cat > /etc/nginx/conf.d/cgm.conf << 'EOF'
server {
    listen 80;
    server_name ai-cgm.phrones.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    http2 on;
    server_name ai-cgm.phrones.com;

    ssl_certificate /root/.acme.sh/ai-cgm.phrones.com_ecc/fullchain.cer;
    ssl_certificate_key /root/.acme.sh/ai-cgm.phrones.com_ecc/ai-cgm.phrones.com.key;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

nginx -t && systemctl reload nginx
```

### 6. 设置自动续期

```bash
# acme.sh 已自动添加 crontab，可用以下命令查看
crontab -l
```

---

## 方案二：阿里云免费 SSL 证书

### 1. 申请证书

1. 登录 [阿里云 SSL 证书控制台](https://yundun.console.aliyun.com/?p=cas)
2. 选择 **免费证书** → **立即购买**（0 元）
3. 证书申请 → 填写域名 `ai-cgm.phrones.com`
4. 按提示完成 DNS 验证
5. 审核通过后下载证书（选择 **Nginx** 格式）

### 2. 上传证书到服务器

```bash
# 将下载的 .pem 和 .key 上传到服务器
scp xxx.pem root@8.131.113.38:/etc/nginx/ssl/ai-cgm.pem
scp xxx.key root@8.131.113.38:/etc/nginx/ssl/ai-cgm.key
```

### 3. 配置 Nginx

```nginx
ssl_certificate /etc/nginx/ssl/ai-cgm.pem;
ssl_certificate_key /etc/nginx/ssl/ai-cgm.key;
```

---

## 方案三：自签名证书（仅测试用，小程序不可用）

```bash
mkdir -p /etc/nginx/ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/nginx/ssl/ai-cgm.key \
  -out /etc/nginx/ssl/ai-cgm.crt \
  -subj "/CN=ai-cgm.phrones.com"
```

---

## 安全组检查

确保阿里云安全组已放行：

- **80**：HTTP
- **443**：HTTPS

---

## 小程序配置

证书配置完成后：

1. `miniprogram/app.js`：`baseUrl: 'https://ai-cgm.phrones.com/api'`
2. 微信小程序后台 → 开发管理 → 开发设置 → **request 合法域名**：添加 `https://ai-cgm.phrones.com`
