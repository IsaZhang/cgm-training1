#!/bin/bash
# 快速部署：仅同步代码 + 重启，不执行 npm install
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
SCP_OPTS="-o StrictHostKeyChecking=no -o ConnectTimeout=10"
[ -n "$SSH_KEY" ] && SCP_OPTS="$SCP_OPTS -i $SSH_KEY"
[ -n "$SSH_PORT" ] && SCP_OPTS="$SCP_OPTS -P $SSH_PORT"
REMOTE="${SSH_USER}@${SSH_HOST}"

echo "=========================================="
echo "  快速部署到 $REMOTE"
echo "=========================================="

echo ""
echo "[1/2] 同步代码..."
ssh $SSH_OPTS $REMOTE "mkdir -p $REMOTE_PATH"
tar --exclude='node_modules' --exclude='.env' --exclude='.git' --exclude='deploy.conf' --exclude='*.log' --exclude='store' -cf - . | ssh $SSH_OPTS $REMOTE "cd $REMOTE_PATH && tar -xf -"
echo "✓ 代码同步完成"

echo ""
echo "[2/2] 重启服务..."
ssh $SSH_OPTS $REMOTE "export PATH=/root/.nvm/versions/node/v20.20.1/bin:\$PATH && cd $REMOTE_PATH && pm2 restart cgm-training"
echo "✓ 服务已重启"

echo ""
echo "=========================================="
echo "  部署完成！"
echo "=========================================="
echo "验证: curl https://ai-cgm.phrones.com/health"
echo ""
