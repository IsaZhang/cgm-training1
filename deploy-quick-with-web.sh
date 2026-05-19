#!/bin/bash
# 快速部署 web 端：更新 web + 同步代码 + 重启，不执行 npm install
set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$PROJECT_ROOT/server"
WEB_DIR="$PROJECT_ROOT/web"
PUBLIC_DIR="$SERVER_DIR/public"

cd "$PROJECT_ROOT"

# 1. 复制 web 到 server/public
echo "[1/3] 复制 web 到 server/public..."
rm -rf "$PUBLIC_DIR"
mkdir -p "$PUBLIC_DIR"
cp -r "$WEB_DIR"/* "$PUBLIC_DIR/"
echo "✓ web 文件已复制"

# 2. 加载部署配置
if [ -f "$SERVER_DIR/deploy.conf" ]; then
  source "$SERVER_DIR/deploy.conf"
else
  echo "错误: 未找到 deploy.conf"
  exit 1
fi

SSH_OPTS="-o StrictHostKeyChecking=no -o ConnectTimeout=10"
[ -n "$SSH_KEY" ] && SSH_OPTS="$SSH_OPTS -i $SSH_KEY"
[ -n "$SSH_PORT" ] && SSH_OPTS="$SSH_OPTS -p $SSH_PORT"
REMOTE="${SSH_USER}@${SSH_HOST}"

echo ""
echo "=========================================="
echo "  快速部署 web 端到 $REMOTE"
echo "  域名: https://ai-cgm.ihealthcn.com"
echo "=========================================="

# 3. 同步代码
echo ""
echo "[2/3] 同步代码 (server + public)..."
ssh $SSH_OPTS $REMOTE "mkdir -p $REMOTE_PATH"
cd "$SERVER_DIR"
tar --exclude='node_modules' --exclude='.env' --exclude='.git' --exclude='deploy.conf' --exclude='*.log' --exclude='store' -cf - . | ssh $SSH_OPTS $REMOTE "cd $REMOTE_PATH && tar -xf -"
echo "✓ 代码同步完成"

# 4. 重启服务
echo ""
echo "[3/3] 重启服务..."
NVM_LOAD='export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"'
ssh $SSH_OPTS $REMOTE "$NVM_LOAD && cd $REMOTE_PATH && pm2 restart cgm-training"
echo "✓ 服务已重启"

echo ""
echo "=========================================="
echo "  快速部署完成！"
echo "=========================================="
echo "API 健康检查: curl https://ai-cgm.ihealthcn.com/health"
echo "管理后台:     https://ai-cgm.ihealthcn.com/admin-exam.html"
echo ""
