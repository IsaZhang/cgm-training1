#!/bin/bash
# 从 Excel 导入员工数据到 employees.json，并推送到服务器
# 用法: ./import-and-push-employees.sh [Excel路径]
set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$PROJECT_ROOT/server"
EXCEL_FILE="${1:-$PROJECT_ROOT/人员在职表.xlsx}"
EMPLOYEES_JSON="$SERVER_DIR/store/employees.json"

cd "$PROJECT_ROOT"

# 1. 加载部署配置
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

echo "=========================================="
echo "  导入员工并推送到 $REMOTE"
echo "=========================================="

# 2. 执行 Excel 导入
echo ""
echo "[1/3] 从 Excel 导入到 employees.json..."
if [ ! -f "$EXCEL_FILE" ]; then
  echo "错误: Excel 文件不存在: $EXCEL_FILE"
  exit 1
fi

cd "$SERVER_DIR"
node import-from-excel.js "$EXCEL_FILE" --write
echo "✓ 导入完成"

# 3. 推送到服务器
echo ""
echo "[2/3] 推送 employees.json 到服务器..."
if [ ! -f "$EMPLOYEES_JSON" ]; then
  echo "错误: employees.json 不存在"
  exit 1
fi

ssh $SSH_OPTS $REMOTE "mkdir -p $REMOTE_PATH/store"
cat "$EMPLOYEES_JSON" | ssh $SSH_OPTS $REMOTE "cat > $REMOTE_PATH/store/employees.json"
echo "✓ 推送完成"

# 4. 确认（无需重启服务，静态数据即时生效）
echo ""
echo "[3/3] 完成"
echo ""
echo "=========================================="
echo "  员工数据已更新到线上"
echo "=========================================="
echo "管理后台 city/department 将显示最新数据"
