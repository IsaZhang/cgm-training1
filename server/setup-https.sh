#!/bin/bash
# 在服务器上配置 HTTPS - ai-cgm.phrones.com
# 使用方式: 将此脚本上传到服务器后执行，或通过 ssh 远程执行

set -e
DOMAIN="ai-cgm.phrones.com"
WEBROOT="/var/www/html"

echo "=== 配置 HTTPS  for $DOMAIN ==="

# 1. 创建 webroot 目录（用于 ACME 验证）
mkdir -p $WEBROOT
chown -R nginx:nginx $WEBROOT 2>/dev/null || chown -R www-data:www-data $WEBROOT 2>/dev/null || true

# 2. 先配置 HTTP 的 Nginx（用于申请证书）
cat > /etc/nginx/conf.d/cgm.conf << 'NGINX_HTTP'
server {
    listen 80;
    server_name ai-cgm.phrones.com;
    root /var/www/html;
    location /.well-known/acme-challenge/ {
        default_type "text/plain";
    }
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINX_HTTP

nginx -t && systemctl reload nginx
echo "Nginx HTTP 配置已加载"

# 3. 申请 SSL 证书（需确保域名已解析到本机，且安全组开放 80 端口）
export LE_WORKING_DIR="/root/.acme.sh"
/root/.acme.sh/acme.sh --issue -d $DOMAIN -w $WEBROOT --force

# 4. 更新为 HTTPS 配置
cat > /etc/nginx/conf.d/cgm.conf << NGINX_HTTPS
server {
    listen 80;
    server_name $DOMAIN;
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN;

    ssl_certificate /root/.acme.sh/${DOMAIN}_ecc/fullchain.cer;
    ssl_certificate_key /root/.acme.sh/${DOMAIN}_ecc/${DOMAIN}.key;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINX_HTTPS

nginx -t && systemctl reload nginx
echo "=== HTTPS 配置完成 ==="
echo "访问: https://$DOMAIN"
