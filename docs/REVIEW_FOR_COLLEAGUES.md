# 给同事的 Code Review 说明（cgm-training）

本文供 **main 分支近期合并** 的交叉评审使用：说明改动意图、建议核对点与本地验证方式。若发现与实现不一致，以仓库内代码与 `COLLABORATION_LOG.md` 为准。

---

## 1. 背景与目标

在单一 CGM 试验田基础上，抽象为 **知识单元 / 知识子单元**：学员端按 **角色** 与 **`allowed_subunit_ids`** 进入不同应用场景；管理端支持 **按单元与子单元筛选统计**、**员工角色与授权**；配置以 **`server/data/catalog.json`** 为中心，并补充 **在线编辑、版本备份、内容包上传** 与 **工程化（写入串行化、语音会话落盘、可选 SQLite）**。

---

## 2. 变更范围（按目录速览）

| 区域 | 路径/说明 |
|------|-----------|
| 服务端 | `server/app.js`、`server/routes/*`、`server/middleware/subUnit.js`、`server/services/knowledgeCatalog.js`、`server/services/scoring.js`、`server/services/voiceSessionStore.js`、`server/db.js`（转发至 `db-json` / 可选 `db-sqlite`） |
| 配置与内容 | `server/data/catalog.json`、`server/data/subunits/cgm-agp-reading/*` |
| 小程序 | `miniprogram/pages/catalog/*`、`utils/api.js`（`x-sub-unit-id`）、各业务页与 `history` |
| 管理端 | `web/admin-exam.html`、`web/admin-exam.js` |
| 自动化 | `server/scripts/smoke-integration-test.js`（`npm run smoke`） |
| 协作留痕 | `COLLABORATION_LOG.md` |

---

## 3. 建议 Review 重点

### 3.1 鉴权与数据隔离

- 需带 **`x-sub-unit-id`** 的接口是否都经过 **`requireSubUnit`** / 员工授权校验。
- **`allowed_subunit_ids`** 与 **`catalog.roles`（如内训师 `grantAllSubunits`）** 行为是否符合预期。
- 管理端接口是否均要求 **`x-admin-token`**，且敏感路径无越权。

### 3.2 配置与持久化

- **`catalog.json`** 结构、`saveCatalog` 校验、**`catalog-archive`** 备份与还原流程是否合理。
- **内容包上传**（JSON 体写 `server/data/`）路径是否限制在 **`data/`** 下，覆盖前是否有 **`_content_backups`**。
- **`db` 层**：JSON 写入串行化是否覆盖并发写场景；若启用 **`USE_SQLITE=1`**，是否理解 **需本机安装 `better-sqlite3`** 及失败回退 JSON。
- **语音会话**：`voiceSessionStore` 落盘 **`store/voice_sessions.json`**，注意备份与容量（`VOICE_SESSION_MAX`）。

### 3.3 小程序与管理端

- 选课 → 全局子单元上下文 → 各页请求头是否一致。
- 管理端「知识目录」：JSON 编辑、版本列表、文本上传是否与后端接口一致（`/api/knowledge/*`）。

### 3.4 测试边界

- **`npm run smoke`** 覆盖健康检查、登录、闪卡、患者列表、考试历史、管理端 catalog/员工/汇总等；**不调用依赖 LLM 的评分与对话**。
- 建议人工点测：**留言考核 / 语音考核提交与评分**（依赖外网与费用）。

---

## 4. 本地验证命令

```bash
cd server
npm install          # 若需可选 SQLite：npm install better-sqlite3
npm run smoke        # 建议 ADMIN_TOKEN 与 .env 一致以测管理端
```

小程序与管理端需在各自环境配置 **baseUrl / API 根路径**（见 `server/DEPLOY_README.md`）。

---

## 5. 安全与合规

- **勿将** `.env`、`private.key`、**SSH 私钥** 提交仓库（见 `.gitignore`）。
- 员工与考试数据在 **`server/store/`**（默认忽略提交）；部署环境请单独备份。

---

## 6. Git 远程与 SSH 推送

- 本仓库 **`origin`** 已配置为 **SSH**：

  ```text
  git@github.com:IsaZhang/cgm-training.git
  ```

- 推送示例：

  ```bash
  git push origin main
  ```

- **私钥必须只保存在本机**（如 `~/.ssh/id_ed25519`），**切勿**写入仓库或聊天明文传播。
- 你在 GitHub 上看到的本密钥 **SHA256 指纹**（用于与本地 `ssh-keygen -lf` / `ssh-add -L` 对照）：

  ```text
  SHA256:ssNDLneA5p4Jdb3+3OJpmBJzit27N4dObUobAxqYOvg
  ```

  首次连接 **`github.com`** 时，终端提示的 **主机** host key 请以 GitHub 官方文档为准核对：  
  https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/githubs-ssh-key-fingerprints  

  （主机指纹与「账户 SSH 公钥」指纹含义不同，请勿混用。）

---

## 7. 环境与产品侧待办（非代码阻塞）

- 预发/生产：**选课、闪卡、留言、语音、管理端** 全链路验收；**`web/` 同步至 `server/public/`** 并重启（见部署技能/文档）。
- 是否在生产启用 **SQLite**、备份策略与监控，由运维与产品共同决定。

---

如有疑问，可在 Issue 或 PR 中 `@` 负责人，并附上 **复现步骤** 与 **`npm run smoke` 结果**（若相关）。
