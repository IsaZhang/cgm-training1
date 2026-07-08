---
name: deploy-web-legacy-pm2
description: 【已废弃 / 历史参考】老服务器（8.131.113.38，pm2）上的 web 端部署说明。当前生产已迁移到 Docker 容器，请勿使用本 skill。任何"部署/发版/上线/快速部署"请求都应改用 deploy-docker。
---

# ⚠️ 已废弃 — 老服务器 pm2 部署（历史参考）

**不要使用本 skill 执行部署。** 项目的生产环境已从老服务器（`8.131.113.38`，pm2 管理）迁移到新服务器（`120.46.213.63`，Docker 容器 `cgm-training`）。如果按下方流程跑 `./deploy-quick-with-web.sh`，代码会部署到**已不再承载生产流量的机器**，新服务器不会更新。

## 现在部署应该用什么

→ **`deploy-docker` skill**（对应脚本 `./deploy-quick-docker.sh`）

## 为什么保留本文件

仅作为老部署链路的历史备忘，方便排查老服务器上的遗留问题或做数据比对。**正常工作流程不涉及本文件**。

---

## 以下内容为老服务器方案存档（仅供参考）

老方案通过 `deploy-quick-with-web.sh` 执行：

1. 复制 `web/*` → `server/public/`
2. tar 打包 server（排除 `node_modules / .env / .git / deploy.conf / *.log / store`）→ scp → 解压到 `$REMOTE_PATH`
3. 远程 `pm2 restart cgm-training`

配置文件：`server/deploy.conf`（`SSH_HOST=8.131.113.38`、`SSH_USER=root`、`REMOTE_PATH=/root/apps/cgm-training/server`）。

完整部署 `deploy-with-web.sh` 额外包含 SSH 测试、端口检查、`npm install --production` 和 PM2 启动，也仅针对老服务器。

## 迁移关键差异(老 → 新)

| 维度 | 老(本文件) | 新(见 deploy-docker) |
|------|------|------|
| 主机 | 8.131.113.38 | 120.46.213.63 |
| 进程管理 | pm2 | Docker 容器 `cgm-training` |
| 代码落地 | 主机文件系统 `/root/apps/...` | 容器 `/app`(docker cp) |
| 数据目录 | 主机文件系统 | bind-mount(`/opt/openclaw-docker/cgm-training/server/{data,store}`) |
| 重启命令 | `pm2 restart cgm-training` | `docker restart cgm-training` |
| 流量入口 | 直接监听 | Traefik 反向代理 |
