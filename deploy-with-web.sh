#!/bin/bash
# 完整部署：server + web 管理后台到 8.131.113.38
# 域名: https://ai-cgm.phrones.com
set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$PROJECT_ROOT/server"
WEB_DIR="$PROJECT_ROOT/web"
PUBLIC_DIR="$SERVER_DIR/public"

cd "$PROJECT_ROOT"

# 1. 复制 web 到 server/public
echo "[1/5] 复制 web 到 server/public..."
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
echo "  CGM Training (server+web) 部署到 $REMOTE"
echo "  域名: https://ai-cgm.phrones.com"
echo "=========================================="

# 3. 测试 SSH 连接
echo ""
echo "[2/5] 测试 SSH 连接..."
if ssh $SSH_OPTS $REMOTE "echo 'SSH 连接成功'"; then
  echo "✓ SSH 连接正常"
else
  echo "✗ SSH 连接失败，请先执行: ssh-copy-id root@8.131.113.38"
  exit 1
fi

# 4. 检查端口冲突
echo ""
echo "[3/5] 检查服务器端口与进程..."
ssh $SSH_OPTS $REMOTE "
  echo '--- 端口 3000 占用情况 ---'
  (netstat -tlnp 2>/dev/null || ss -tlnp 2>/dev/null) | grep ':3000' || echo '端口 3000 未被占用'
  echo ''
  echo '--- Nginx 配置中的 server_name ---'
  grep -r 'server_name' /etc/nginx/ 2>/dev/null | grep -v '#' || true
  echo ''
  echo '--- PM2 进程列表 ---'
  (command -v pm2 >/dev/null && pm2 list 2>/dev/null) || echo 'PM2 未安装或无进程'
"

# 5. 同步代码
echo ""
echo "[4/5] 同步代码 (server + public)..."
ssh $SSH_OPTS $REMOTE "mkdir -p $REMOTE_PATH"
cd "$SERVER_DIR"
tar --exclude='node_modules' --exclude='.env' --exclude='.git' --exclude='deploy.conf' --exclude='*.log' --exclude='store' -cf - . | ssh $SSH_OPTS $REMOTE "cd $REMOTE_PATH && tar -xf -"
echo "✓ 代码同步完成"

# 6. 安装依赖并启动
echo ""
echo "[5/5] 安装依赖并启动服务..."
NVM_LOAD='export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"'
ssh $SSH_OPTS $REMOTE "$NVM_LOAD && cd $REMOTE_PATH && npm install --production"
ssh $SSH_OPTS $REMOTE "$NVM_LOAD && (command -v pm2 >/dev/null || npm install -g pm2) && cd $REMOTE_PATH && (pm2 delete cgm-training 2>/dev/null || true) && pm2 start app.js --name cgm-training && pm2 save && pm2 status"

echo ""
echo "=========================================="
echo "  部署完成！"
echo "=========================================="
echo "API 健康检查: curl https://ai-cgm.phrones.com/health"
echo "管理后台:     https://ai-cgm.phrones.com/admin-exam.html"
echo ""
