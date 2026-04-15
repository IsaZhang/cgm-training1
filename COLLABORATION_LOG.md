# 协作与留痕日志（CLI / Agent 衔接）

本文件用于 **跨工具、跨会话** 的工作衔接：任何由人或自动化助手对仓库的 **实质性修改**，建议在此追加一条简短记录（日期、做了什么、涉及路径、未完成项），便于后续 CLI 或 Agent 接续上下文。

**与本项目相关的文档结构（速览）**

| 类型 | 路径 |
|------|------|
| 项目说明 | `README.md` |
| 部署 | `DEPLOY.md`、`server/DEPLOY_README.md`、`server/DEPLOY_GUIDE.md`、`server/HTTPS-SETUP.md` |
| 清单与检查 | `DEPLOYMENT_CHECKLIST.md`、`CHECKLIST.md`、`CHECK_REPORT.md` |
| 统计与测试 | `STATS.md`、`TEST_REPORT.md` |
| 语音配置 | `VOICE_CONFIG.md` |
| 技能（Cursor） | `.cursor/skills/deploy-web/SKILL.md` |
| 业务数据/知识片段 | `server/data/`（含 `catalog.json` 知识单元配置、`knowledge.md` 等） |
| 前端 | `miniprogram/` |
| 后端 | `server/`（`routes/`、`services/`、`app.js`） |

**说明**：运行时日志如 `server/server.log` 不用于人工协作留痕，请勿与本文混用。

---

## 2026-04-04

### Cursor Agent：初次浏览与后续参与声明

- **动作**：根据用户要求，浏览仓库文档结构（未改业务代码与配置）。
- **背景**：用户说明本项目此前主要由其他 CLI 完成；后续可能由本 Agent（Cursor）参与开发或维护。
- **衔接原则**（用户给定）：**任何修改动作都需要留痕**，确保切换其他 CLI 或 Agent 后能继续衔接；后续实质性变更请追加本节下方新日期条目，并尽量指向具体文件路径或 PR。

---

## 2026-04-14

### 知识单元体系与管理端改造（落地第一版）

- **目标**：将单一 CGM 试验田抽象为可扩展的「知识单元 / 知识子单元」；学员端按角色与 `allowed_subunit_ids` 控制可见子单元；管理端支持按单元筛选统计、按子单元汇总、员工角色与子单元授权；配置入口为 `server/data/catalog.json`（后续可演进为在线配置）。
- **主要改动路径**：
  - 服务端：`server/data/catalog.json`、`server/services/knowledgeCatalog.js`、`server/middleware/subUnit.js`、`server/routes/{knowledge,employeesAdmin,flashcard,chat,exam,voice}.js`、`server/services/scoring.js`、`server/app.js`、`server/routes/auth.js`（导入员工字段）。
  - 小程序：`miniprogram/pages/catalog/*`（选课）、`app.js` / `utils/api.js`（`x-sub-unit-id`）、`pages/index/*`、`flashcard`/`chat`/`voice-exam`/`history`。
  - 管理后台：`web/admin-exam.html`、`web/admin-exam.js`（API 基址可配置、单元筛选、员工管理 Tab、`/api/knowledge/catalog` 与 `/api/employees/admin/*`）。
- **数据迁移**：启动时 `runStartupMigrations` 为历史 `exam_records` / `flashcard_progress` 补默认 `sub_unit_id=cgm-transform`，为员工补 `role_id` 与 `allowed_subunit_ids`。
- **未完成 / 后续**：更多知识子单元的内容包与 `promptProfile`；在线编辑 catalog；统计与 JSON 存储的并发与性能优化。

---

## 2026-04-14（补充）

### 闪卡 vs 对话/语音 的架构区分

- **闪卡**：挂载在 **知识单元**（`units[].contentBundle.flashcardsFile`），表示该单元 **全量基础知识**（当前 CGM 单元对应整份 `flashcards.json`）。
- **留言/语音考核**：挂载在 **知识子单元**（如 `cgm-transform` 的 `patientsFile`、`knowledgeFile`、`scoring`），仅描述 **CGM转化** 场景。
- **学习进度**：`flashcard_progress` 以 **`unit_id`** 为维度（同一单元下多个子单元共用一套闪卡进度，避免重复计数）。
- 配置说明见 `server/data/catalog.json` 内 `documentation` 与 `version: 2`。

---

## 2026-04-15

### 领域术语共识（已与产品侧对齐，并写入 Cursor 计划文档）

以下作为后续需求与实现的统一用词（详见 `/Users/zyf/.cursor/plans/知识单元与后台改造_9a471ea0.plan.md` 内更新段落）。

| 概念 | 定义 |
|------|------|
| **知识单元（父单元）** | 独立业务知识域；闪卡大方向按此整理（如 CGM 知识单元、未来如门诊知识单元）。 |
| **知识子单元** | **知识单元在工作中的应用场景**（可演练、可考核的业务切片），如 CGM转化、CGM图谱解读；类比门诊单元下的「入组」等。 |
| **案例 / 场景** | 子单元内的具体实例（典型患者、典型流程对象）；与 `patients.json` 等条目对应；一个子单元可包含多条。 |
| **闪卡类别** | 同一知识单元内按知识点对闪卡分组（数据字段 `category`）；CGM 当前为 6 类（基础概念、核心指标、佩戴使用、适用人群、转化话术、AGP图谱等）。**不等于** catalog 中的「知识子单元」id。 |

**层级关系**：知识单元 →（闪卡全量 + 闪卡类别）；知识单元 → 知识子单元（应用场景）→ 多案例/场景 + 对话语音评分等。

### 可开工事项清单（按优先级/依赖排列，供排期）

1. **验收与部署**：在测试/预发环境跑通选课、闪卡、留言、语音、管理端筛选与员工授权；部署时同步 `web/` → `server/public/` 并重启（见既有部署脚本）。
2. **第二个知识子单元（如 CGM图谱解读）**：在 `catalog.json` 增加子单元与 `contentBundle`；准备该子单元的 `patients`/`knowledge`/评分配置；在 `scoring.js` 增加新 `promptProfile`（当前非 `cgm_v1` 会提示不支持）。
3. **批量导入员工扩展列**：`POST /api/auth/employees/import` 支持 `role_id`、`allowed_subunit_ids`（JSON 可为字符串用逗号/分号分隔，或与 catalog 对齐的数组）；`import-from-excel.js` 可选表头列「角色」「知识子单元」等；服务端与 `PUT /api/employees/admin/:phone` 均校验角色、子单元 id。**（2026-04-15 已落地）**
4. **Phase D（计划内）**：管理后台在线维护 catalog（单元/子单元/内容包上传与版本）；属独立迭代。**（2026-04-15 起：JSON 编辑 + 每次保存前自动备份至 `data/catalog-archive/` + 列表/还原接口；子单元与单元闪卡支持通过管理端以文本方式上传至 `data/` 并备份旧文件。）**
5. **工程化（按需）**：`server/db.js` JSON 全量读写在高并发下的锁或迁移数据库；语音会话内存 Map 持久化等。**（2026-04-15：写入串行化已落地；语音会话落盘 `store/voice_sessions.json`；可选 SQLite：`USE_SQLITE=1` 且本机 `npm install better-sqlite3` 后使用 `store/app.sqlite`，加载失败自动回退 JSON。）**

### 联调冒烟脚本（本地自动化）

- **路径**：[`server/scripts/smoke-integration-test.js`](server/scripts/smoke-integration-test.js)
- **命令**：在 `server/` 下执行 `npm run smoke` 或 `node scripts/smoke-integration-test.js`（可选 `ADMIN_TOKEN=...` 与生产管理口令一致以验证管理端）。
- **范围**：健康检查、登录、`/knowledge/me`、闪卡列表/进度、患者列表、考试历史、管理端 catalog/员工列表/按子单元汇总；**不调用**依赖 LLM 的提交与对话接口。
- **结果**（2026-04-15 本机跑通）：10/10 通过；后续增加未授权子单元断言后为 11/11；再增加 catalog raw/PUT 后为 13/13；再增加 catalog 版本列表后为 14/14。

### 员工批量导入：角色与子单元列（2026-04-15）

- **内容**：`server/services/knowledgeCatalog.js` 增加 `normalizeRoleIdOnly` / `normalizeAllowedSubunitIdsOnly` / `normalizeEmployeeAuthFields`；`server/routes/auth.js` 导入接口校验每行并返回 `skipped`/`errors`；`server/routes/employeesAdmin.js` 更新员工时支持字符串形式的 `allowed_subunit_ids` 并校验角色；`server/import-from-excel.js` 识别可选 Excel 列。
- **文档**：`server/DEPLOY_README.md` 补充说明。

### Phase D 切片：catalog 在线编辑（JSON）（2026-04-15）

- **服务端**：`validateCatalogStructure` / `assertCatalogFilesExist` / `saveCatalog`（原子写入）；`GET /api/knowledge/catalog/raw`、`PUT /api/knowledge/catalog`（`server/app.js`）。
- **管理端**：`web/admin-exam.html` / `web/admin-exam.js` 新增「知识目录」Tab。
- **冒烟**：`smoke-integration-test.js` 增加 raw 读取与幂等写回。

### JSON Store 写入串行化（2026-04-15）

- **内容**：`server/db.js` 与 `server/db-local.js` 对 `insert` / `update` / `upsert` 使用按 `name`（如 `employees`、`flashcard_progress`）链式 Promise 串行执行写路径；`find`/`filter` 仍为同步读文件（读与写并发时偶发读到上一版，属文件型存储固有限制）。

### Phase D 补充：版本归档与内容包文本上传（2026-04-15）

- **catalog**：`saveCatalog` 前将当前 `catalog.json` 复制到 `server/data/catalog-archive/` 并裁剪数量（`CATALOG_ARCHIVE_MAX`，默认 30）；`GET/POST /api/knowledge/catalog/versions|restore`；管理端列表与还原。
- **内容包**：`POST /api/knowledge/upload/subunit`、`/upload/unit`（JSON 体携带文件文本，避免 multipart 依赖）；写入前备份至 `data/_content_backups/<时间戳>/`。
- **路径**：`server/routes/knowledgeAdminUpload.js`、`server/services/knowledgeCatalog.js`（`listCatalogVersions`、`restoreCatalogFromArchive`）、`web/admin-exam.*`。

### 第 5 项补充：语音会话落盘与可选 SQLite（2026-04-15）

- **语音**：`server/services/voiceSessionStore.js` + `routes/voice.js` 使用 `store/voice_sessions.json`（`VOICE_SESSION_MAX` 限制条数）。
- **SQLite**：`server/db-sqlite.js`（`json_stores` 表）；`server/db.js` 在 `USE_SQLITE=1` 时尝试加载，失败回退 `db-json.js`。需自行执行 `npm install better-sqlite3`（原生模块）。
- **说明**：`db-local.js` 现为对 `db-json.js` 的转发，避免重复维护。

---
