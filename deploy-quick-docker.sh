#!/bin/bash
# 快速部署 web 端到 Docker 容器：更新 web + 同步代码到容器 + 重启，不执行 npm install
# 适配服务器 120.46.213.63（deployer，已配 SSH 免密），容器名 cgm-training
set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$PROJECT_ROOT/server"
WEB_DIR="$PROJECT_ROOT/web"
PUBLIC_DIR="$SERVER_DIR/public"

SSH_HOST=120.46.213.63
SSH_USER=deployer
CONTAINER=cgm-training
REMOTE_TMP=/tmp/cgm-training-deploy-$$
SSH_OPTS="-o StrictHostKeyChecking=no -o ConnectTimeout=10"
REMOTE="${SSH_USER}@${SSH_HOST}"

cd "$PROJECT_ROOT"

# 1. 复制 web 到 server/public
echo "[1/4] 复制 web 到 server/public..."
rm -rf "$PUBLIC_DIR"
mkdir -p "$PUBLIC_DIR"
cp -r "$WEB_DIR"/* "$PUBLIC_DIR/"
echo "✓ web 文件已复制"

echo ""
echo "=========================================="
echo "  快速部署 Docker 容器 $CONTAINER @ $REMOTE"
echo "=========================================="

# 2. 打 tar 传到远程临时目录
echo ""
echo "[2/4] 同步代码到服务器临时目录 $REMOTE_TMP..."
ssh $SSH_OPTS $REMOTE "rm -rf $REMOTE_TMP && mkdir -p $REMOTE_TMP"
cd "$SERVER_DIR"
# 排除：node_modules / .env / .git / 部署配置 / 日志 / 运行时数据（store、data 都是 bind-mount，不覆盖线上内容）
tar --exclude='node_modules' --exclude='.env' --exclude='.git' --exclude='deploy.conf' --exclude='*.log' --exclude='store' --exclude='data' -cf - . | ssh $SSH_OPTS $REMOTE "cd $REMOTE_TMP && tar -xf -"
echo "✓ 代码已上传"

# 3. docker cp 到容器内 /app
echo ""
echo "[3/4] 同步到容器 $CONTAINER:/app..."
ssh $SSH_OPTS $REMOTE "docker cp $REMOTE_TMP/. $CONTAINER:/app/ && rm -rf $REMOTE_TMP"
echo "✓ 文件已复制到容器"

# 4. 重启容器
echo ""
echo "[4/4] 重启容器..."
ssh $SSH_OPTS $REMOTE "docker restart $CONTAINER"
echo "✓ 容器已重启"

# 健康检查（容器内）
echo ""
echo "等待服务启动..."
sleep 3
HEALTH=$(ssh $SSH_OPTS $REMOTE "docker exec $CONTAINER wget -qO- http://127.0.0.1:3000/health 2>/dev/null || docker exec $CONTAINER curl -s http://127.0.0.1:3000/health 2>/dev/null || echo FAIL")
echo "容器内健康检查: $HEALTH"

echo ""
echo "=========================================="
echo "  快速部署完成！"
echo "=========================================="
echo "容器状态: ssh $REMOTE 'docker ps | grep $CONTAINER'"
echo "容器日志: ssh $REMOTE 'docker logs -f --tail 100 $CONTAINER'"
