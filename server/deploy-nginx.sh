#!/bin/bash
# 部署 Nginx 配置到服务器，修复 macOS LibreSSL Connection reset by peer
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ -f deploy.conf ]; then
  source deploy.conf
else
  echo "错误: 未找到 deploy.conf"
  exit 1
fi

SSH_OPTS="-o StrictHostKeyChecking=no -o ConnectTimeout=10"
[ -n "$SSH_KEY" ] && SSH_OPTS="$SSH_OPTS -i $SSH_KEY"
[ -n "$SSH_PORT" ] && SSH_OPTS="$SSH_OPTS -p $SSH_PORT"
REMOTE="${SSH_USER}@${SSH_HOST}"

# scp 使用 -P 指定端口（与 ssh 的 -p 不同）
SCP_OPTS="-o StrictHostKeyChecking=no -o ConnectTimeout=10"
[ -n "$SSH_KEY" ] && SCP_OPTS="$SCP_OPTS -i $SSH_KEY"
[ -n "$SSH_PORT" ] && SCP_OPTS="$SCP_OPTS -P $SSH_PORT"

echo "部署 Nginx 配置到 $REMOTE ..."
scp $SCP_OPTS nginx-cgm-https.conf $REMOTE:/tmp/cgm.conf
ssh $SSH_OPTS $REMOTE "mv /tmp/cgm.conf /etc/nginx/conf.d/cgm.conf && nginx -t && systemctl reload nginx"
echo "✓ Nginx 配置已更新并重载"
echo ""
echo "请在本地测试:"
echo "  curl -X POST https://ai-cgm.phrones.com/api/auth/login -d 'name=测试员工&phone=13800000001'"
