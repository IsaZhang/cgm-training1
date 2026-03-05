#!/bin/bash

# CGM训练小程序 - GitHub自动更新脚本

# 颜色输出
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "🚀 开始更新到GitHub..."

# 检查是否有更改
if [[ -z $(git status -s) ]]; then
    echo -e "${GREEN}✓ 没有需要提交的更改${NC}"
    exit 0
fi

# 显示更改
echo "📝 以下文件将被提交:"
git status -s

# 添加所有更改
echo ""
echo "📦 添加文件..."
git add -A

# 获取提交信息（如果没有参数，使用默认信息）
if [ -z "$1" ]; then
    COMMIT_MSG="Update: $(date '+%Y-%m-%d %H:%M:%S')"
else
    COMMIT_MSG="$1"
fi

# 提交
echo ""
echo "💾 提交更改..."
git commit -m "$COMMIT_MSG

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"

if [ $? -ne 0 ]; then
    echo -e "${RED}✗ 提交失败${NC}"
    exit 1
fi

# 推送到GitHub
echo ""
echo "⬆️  推送到GitHub..."
git push origin main

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✓ 成功推送到GitHub!${NC}"
else
    echo ""
    echo -e "${RED}✗ 推送失败，请检查网络连接${NC}"
    exit 1
fi
