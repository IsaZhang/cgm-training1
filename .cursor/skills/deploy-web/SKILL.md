---
name: deploy-web
description: 快速部署 web 端：更新 web + 同步代码 + 重启，不执行 npm install。将 CGM Training 的 server 与 web 管理后台部署到远程。在需要部署 web 端、快速部署、部署前端管理后台时使用。
---

# 快速部署 web 端

本 skill 即**部署 web 端**的说明：通过根目录的 `deploy-quick-with-web.sh`，**更新 web + 同步代码 + 重启**，**不执行 npm install**，速度更快。

## Web 端部署设置在哪里

| 用途 | 位置 |
|------|------|
| **快速部署 web 端**（推荐） | 项目根目录 `deploy-quick-with-web.sh` |
| **完整部署**（含 npm install） | 项目根目录 `deploy-with-web.sh` |
| **Web 前端源码/构建产物** | 项目根目录 `web/` |
| **部署后静态文件所在目录** | `server/public/`（脚本会把 `web/*` 复制到这里再一起同步到服务器） |
| **SSH/远程路径等配置** | `server/deploy.conf` |

## 两种部署方式

| 方式 | 脚本 | 步骤 | 说明 |
|------|------|------|------|
| **快速部署 web 端** | `./deploy-quick-with-web.sh` | 复制 web → 同步代码 → 重启 | 不执行 npm install，更快，适合日常 |
| **完整部署** | `./deploy-with-web.sh` | 复制 web → SSH 测试 → 端口检查 → 同步代码 → npm install → PM2 启动 | 含 npm install，首次或依赖变更时用 |

## 快速部署 web 端（推荐）

在**项目根目录**执行：

```bash
./deploy-quick-with-web.sh
```

脚本会依次：

1. **复制 web → server/public**：清空 `server/public`，将 `web/*` 拷贝进去
2. **同步代码**：在 `server/` 下打 tar（排除 node_modules、.env、.git、deploy.conf、*.log、store），通过 SSH 传到 `$REMOTE_PATH` 并解压
3. **重启服务**：远程 `pm2 restart cgm-training`（不执行 npm install）

## 完整部署（何时用）

当 **package.json 或依赖有变更** 时，用 `./deploy-with-web.sh`，会执行 `npm install --production` 并重启。

## 前置条件

1. **部署配置**：`server/deploy.conf` 存在且包含 `SSH_HOST`、`SSH_USER`、`REMOTE_PATH`
2. **SSH 免密**：已配置好到目标机的 SSH 公钥
3. **目录结构**：项目根目录下有 `server/` 和 `web/`

## 部署后验证

- **API 健康检查**：`curl https://ai-cgm.ihealthcn.com/health`
- **管理后台**：浏览器打开 `https://ai-cgm.ihealthcn.com/admin-exam.html`

## 注意事项

- 脚本不会同步：`node_modules`、`.env`、`deploy.conf`、`store`
- 若仅改 server 代码且不改 web，可用 `server/deploy-quick.sh`，不必跑 web 拷贝
