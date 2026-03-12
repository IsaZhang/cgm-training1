# 服务端部署与发布指南

## 一、发布到服务器的步骤

### 方式 1：完整部署（推荐首次部署或依赖变更时）

```bash
cd server
./deploy.sh
```

会执行：同步代码 → `npm install` → 重启 PM2

### 方式 2：快速部署（仅代码变更时）

```bash
cd server
./deploy-quick.sh
```

会执行：同步代码 → 重启 PM2（不执行 npm install，更快）

---

## 二、是否需要重启服务？

| 变更类型 | 需要重启？ | 说明 |
|---------|-----------|------|
| **JS 代码**（app.js、routes、services 等） | ✅ 是 | Node 进程需重新加载 |
| **package.json / 新增依赖** | ✅ 是 | 需 `npm install`，用 `deploy.sh` |
| **store/*.json**（员工、用户等数据） | ❌ 否 | 运行时读取，无需重启 |
| **.env** | ✅ 是 | 启动时加载，改后需重启 |
| **Nginx 配置** | ❌ 否 | 用 `nginx -s reload`，不用重启 Node |
| **静态文件、文档** | ❌ 否 | 若不参与运行，可不重启 |

**简单判断**：改了 `.js`、`.json`（package.json）、`.env` → 需要重启。

---

## 三、如何重启服务

### 在服务器上重启

```bash
ssh root@8.131.113.38 "export PATH=/root/.nvm/versions/node/v20.20.1/bin:\$PATH && pm2 restart cgm-training"
```

### 仅改了 .env 或 store 数据时

```bash
# 1. 如需更新 .env，先上传
scp .env root@8.131.113.38:/root/apps/cgm-training/server/

# 2. 如需更新 store 数据，先上传
scp store/employees.json root@8.131.113.38:/root/apps/cgm-training/server/store/

# 3. 重启
ssh root@8.131.113.38 "export PATH=/root/.nvm/versions/node/v20.20.1/bin:\$PATH && pm2 restart cgm-training"
```

---

## 四、部署流程速查

```
本地修改完成
    ↓
cd server
    ↓
┌─────────────────────────────────────┐
│ 改了 package.json 或新增依赖？        │
│  是 → ./deploy.sh（完整部署）         │
│  否 → ./deploy-quick.sh（快速部署）   │
└─────────────────────────────────────┘
    ↓
验证：curl https://ai-cgm.phrones.com/health
```

---

## 五、注意事项

1. **deploy.sh 不会覆盖**：`.env`、`node_modules`、`deploy.conf`、`store/`
2. **store 数据**：deploy 不会同步 `store/`，服务器上的用户数据、学习进度等会保留
3. **Nginx 配置**：改 Nginx 用 `./deploy-nginx.sh`，与 Node 部署分开
4. **更新员工数据**：需单独上传 `store/employees.json`，如：`scp store/employees.json root@8.131.113.38:/root/apps/cgm-training/server/store/`
