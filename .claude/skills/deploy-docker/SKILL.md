---
name: deploy-docker
description: 快速部署 CGM Training 到新服务器的 Docker 容器：更新 web + 同步代码到容器 + 重启容器，不执行 npm install。在需要部署、发版、上线、发布到生产时使用。
---

# 快速部署（Docker 容器版）

本 skill 是**当前生产环境**的部署说明。项目已从老服务器（pm2，8.131.113.38）迁移到新服务器（Docker，120.46.213.63），运行在容器 `cgm-training` 中。对应脚本：项目根目录的 `deploy-quick-docker.sh`。

## 生产环境现状

| 项 | 值 |
|------|------|
| 服务器 | `deployer@120.46.213.63`（已配置 SSH 免密） |
| 容器名 | `cgm-training` |
| 镜像 | `cgm-training:latest` |
| 容器内工作目录 | `/app` |
| 启动命令 | `node app.js` |
| 容器内端口 | 3000/tcp（无主机端口绑定，走 Traefik 反向代理） |
| bind-mount（主机 → 容器） | `/opt/openclaw-docker/cgm-training/server/data` → `/app/data`<br>`/opt/openclaw-docker/cgm-training/server/store` → `/app/store` |
| RestartPolicy | `unless-stopped` |

## 入口脚本

| 场景 | 脚本 | 说明 |
|------|------|------|
| **快速部署（推荐）** | `./deploy-quick-docker.sh` | tar → docker cp → docker restart，不装依赖 |
| （历史参考）pm2 快速部署 | `./deploy-quick-with-web.sh` | 指向**已废弃**的老服务器 8.131.113.38，不要再跑 |
| （历史参考）pm2 完整部署 | `./deploy-with-web.sh` | 同上，老服务器方案 |

## 快速部署步骤

在**项目根目录**执行：

```bash
./deploy-quick-docker.sh
```

脚本会依次：

1. **复制 web → server/public**：清空 `server/public`，把 `web/*` 拷进去
2. **打 tar 上传到服务器临时目录**：排除 `node_modules / .env / .git / deploy.conf / *.log / store / data`，传到远程 `/tmp/cgm-training-deploy-<pid>`
3. **docker cp 到容器内 `/app/`**：把临时目录内容写进容器的可写层
4. **`docker restart cgm-training`**：容器按原 CMD `node app.js` 重新启动
5. **健康检查**：在容器内 `wget http://127.0.0.1:3000/health`，应返回 `{"status":"ok"}`

## 排除项说明（为什么不同步）

- `node_modules` — 已在镜像里装好；重装会触发 npm install，不符合"快速部署"语义
- `.env / deploy.conf` — 线上敏感配置，不应被本地覆盖
- `store/` — 运行时数据（users.json、exam_records.json、请求日志），是 bind-mount，覆盖会丢线上数据
- `data/` — 知识库内容（patients.json、knowledge.md、flashcards.json），是 bind-mount。管理员可通过 admin-exam 后台上传覆盖，本地同步会抹掉线上编辑
- `.git / *.log` — 部署产物无关

如果确实需要同步某份 data（例如本地改了闪卡、线上还没有管理员覆盖过），可单独手动 `docker cp`，不要改脚本默认排除。

## 前置条件

1. **SSH 免密**：本机 `ssh deployer@120.46.213.63` 能直接登录（deployer 需在 docker 组或具备 sudo，才能执行 docker cp/restart/exec；容器 id 03737b878893）
2. **目标主机已有 Docker 及容器** `cgm-training`（`docker ps` 可见）
3. **容器可接受 docker cp**（目标是运行中的 `cgm-training`，非 stop 状态）

## 部署后验证

```bash
# 容器状态
ssh deployer@120.46.213.63 'docker ps | grep cgm-training'

# 容器内健康检查
ssh deployer@120.46.213.63 'docker exec cgm-training wget -qO- http://127.0.0.1:3000/health'

# 实时日志
ssh deployer@120.46.213.63 'docker logs -f --tail 100 cgm-training'

# 对外域名（如经 Traefik 暴露）
curl https://ai-cgm.ihealthcn.com/health
```

## 持久性注意（重要）

`docker cp` 改动**只存在于容器的可写层**。以下操作会让改动全部回退到镜像版本：

- `docker rm cgm-training`
- `docker compose down && up`（若用 compose 管理）
- 镜像重建并替换容器

所以**快速部署适合日常热更新**，但**长期正确做法仍是更新 Dockerfile、重建 `cgm-training:latest` 镜像**。如果需要把变更落到镜像层，请单独提出。

## 常见问题

- **tar 报 `LIBARCHIVE.xattr.com.apple.provenance` 警告** — macOS 扩展属性在 Linux 端被忽略，纯噪音，不影响文件内容
- **Traefik 在 `docker restart` 期间短暂 503** — 秒级影响，容器起来后自动恢复
- **其他容器不会被影响** — 脚本只对 `cgm-training` 调 docker cp/restart
