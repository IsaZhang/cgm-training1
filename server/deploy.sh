#!/bin/bash
# CGM Training 服务端部署脚本 - 通过 SSH 免密登录
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 加载配置
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

echo "=========================================="
echo "  CGM Training 部署到 $REMOTE"
echo "=========================================="

# 1. 测试 SSH 连接
echo ""
echo "[1/4] 测试 SSH 连接..."
if ssh $SSH_OPTS $REMOTE "echo 'SSH 连接成功'"; then
  echo "✓ SSH 免密连接正常"
else
  echo "✗ SSH 连接失败，请先执行: ssh-copy-id root@8.131.113.38"
  exit 1
fi

# 2. 创建远程目录
echo ""
echo "[2/4] 创建远程目录..."
ssh $SSH_OPTS $REMOTE "mkdir -p $REMOTE_PATH"
echo "✓ 目录已就绪"

# 3. 同步代码（使用 tar，不依赖 rsync）
echo ""
echo "[3/4] 同步代码..."
tar --exclude='node_modules' --exclude='.env' --exclude='.git' --exclude='deploy.conf' --exclude='*.log' -cf - . | ssh $SSH_OPTS $REMOTE "mkdir -p $REMOTE_PATH && cd $REMOTE_PATH && tar -xf -"
echo "✓ 代码同步完成"

# 4. 远程安装依赖并启动（加载 nvm 以使用 Node.js）
echo ""
echo "[4/4] 安装依赖并启动服务..."
NVM_LOAD='export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"'
ssh $SSH_OPTS $REMOTE "$NVM_LOAD && cd $REMOTE_PATH && npm install --production"
ssh $SSH_OPTS $REMOTE "$NVM_LOAD && (command -v pm2 >/dev/null || npm install -g pm2) && cd $REMOTE_PATH && (pm2 delete cgm-training 2>/dev/null || true) && pm2 start app.js --name cgm-training && pm2 save && pm2 status"

echo ""
echo "=========================================="
echo "  部署完成！"
echo "=========================================="
echo "访问: http://8.131.113.38:3000/health"
echo ""
