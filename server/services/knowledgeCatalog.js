const fs = require('fs');
const path = require('path');

const CATALOG_PATH = path.join(__dirname, '../data/catalog.json');
const CATALOG_ARCHIVE_DIR = path.join(__dirname, '../data/catalog-archive');
const MAX_CATALOG_ARCHIVES = Math.min(100, parseInt(process.env.CATALOG_ARCHIVE_MAX || '30', 10) || 30);
const DEFAULT_SUB_UNIT_ID = 'cgm-transform';
const DEFAULT_UNIT_ID = 'cgm';

let catalogCache = null;

function loadCatalog() {
  if (!catalogCache) {
    const raw = fs.readFileSync(CATALOG_PATH, 'utf-8');
    catalogCache = JSON.parse(raw);
  }
  return catalogCache;
}

function reloadCatalog() {
  catalogCache = null;
  return loadCatalog();
}

/**
 * 校验待写入的 catalog 结构（用于在线保存）
 * @returns {string|null} 错误信息或 null
 */
function validateCatalogStructure(cat) {
  if (!cat || typeof cat !== 'object') return 'catalog 必须为对象';
  if (typeof cat.version !== 'number' || !Number.isFinite(cat.version)) return 'version 必须为数字';
  if (!Array.isArray(cat.units) || cat.units.length === 0) return 'units 必须为非空数组';
  if (!Array.isArray(cat.subunits) || cat.subunits.length === 0) return 'subunits 必须为非空数组';
  if (!Array.isArray(cat.roles) || cat.roles.length === 0) return 'roles 必须为非空数组';

  const unitIds = new Set();
  for (let i = 0; i < cat.units.length; i++) {
    const u = cat.units[i];
    if (!u || typeof u.id !== 'string' || !u.id.length) return `units[${i}] 缺少有效 id`;
    unitIds.add(u.id);
    if (typeof u.name !== 'string') return `知识单元 ${u.id} 缺少 name`;
    if (u.enabled === false) continue;
    const cb = u.contentBundle;
    if (!cb || typeof cb.flashcardsFile !== 'string' || !cb.flashcardsFile.length) {
      return `知识单元 ${u.id} 需配置 contentBundle.flashcardsFile`;
    }
  }

  const subIds = new Set();
  for (let i = 0; i < cat.subunits.length; i++) {
    const s = cat.subunits[i];
    if (!s || typeof s.id !== 'string') return `subunits[${i}] 缺少 id`;
    if (subIds.has(s.id)) return `子单元 id 重复: ${s.id}`;
    subIds.add(s.id);
    if (typeof s.unitId !== 'string' || !unitIds.has(s.unitId)) {
      return `子单元 ${s.id} 的 unitId 必须对应已有知识单元`;
    }
    if (typeof s.name !== 'string' || typeof s.slug !== 'string') {
      return `子单元 ${s.id} 缺少 name 或 slug`;
    }
    if (s.enabled === false) continue;
    const cb = s.contentBundle;
    if (!cb || typeof cb.patientsFile !== 'string' || typeof cb.knowledgeFile !== 'string') {
      return `子单元 ${s.id} 需配置 contentBundle.patientsFile 与 knowledgeFile`;
    }
    if (!cb.scoring || typeof cb.scoring.promptProfile !== 'string') {
      return `子单元 ${s.id} 需配置 scoring.promptProfile`;
    }
  }

  for (let i = 0; i < cat.roles.length; i++) {
    const r = cat.roles[i];
    if (!r || typeof r.id !== 'string' || typeof r.name !== 'string') {
      return `roles[${i}] 需包含 id 与 name`;
    }
  }
  return null;
}

/**
 * 已启用条目引用的数据文件须存在于 server 根目录下
 * @returns {string|null}
 */
function assertCatalogFilesExist(cat) {
  const base = path.join(__dirname, '..');
  for (const u of cat.units) {
    if (u.enabled === false) continue;
    const rel = u.contentBundle && u.contentBundle.flashcardsFile;
    if (typeof rel !== 'string' || !rel.length) continue;
    const full = path.join(base, rel);
    if (!fs.existsSync(full)) return `文件不存在: ${rel}`;
  }
  for (const s of cat.subunits) {
    if (s.enabled === false) continue;
    const cb = s.contentBundle;
    if (!cb) continue;
    for (const key of ['patientsFile', 'knowledgeFile']) {
      const rel = cb[key];
      if (typeof rel !== 'string') continue;
      const full = path.join(base, rel);
      if (!fs.existsSync(full)) return `文件不存在: ${rel}`;
    }
  }
  return null;
}

function archiveCurrentCatalogBeforeSave() {
  if (!fs.existsSync(CATALOG_PATH)) return;
  if (!fs.existsSync(CATALOG_ARCHIVE_DIR)) {
    fs.mkdirSync(CATALOG_ARCHIVE_DIR, { recursive: true });
  }
  let cat;
  try {
    cat = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf-8'));
  } catch (_) {
    return;
  }
  const ver = typeof cat.version === 'number' ? cat.version : 0;
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const name = `catalog-v${ver}-${ts}.json`;
  fs.copyFileSync(CATALOG_PATH, path.join(CATALOG_ARCHIVE_DIR, name));
  pruneCatalogArchives();
}

function pruneCatalogArchives() {
  if (!fs.existsSync(CATALOG_ARCHIVE_DIR)) return;
  const files = fs
    .readdirSync(CATALOG_ARCHIVE_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => ({
      name: f,
      mtime: fs.statSync(path.join(CATALOG_ARCHIVE_DIR, f)).mtimeMs
    }))
    .sort((a, b) => b.mtime - a.mtime);
  for (let i = MAX_CATALOG_ARCHIVES; i < files.length; i++) {
    fs.unlinkSync(path.join(CATALOG_ARCHIVE_DIR, files[i].name));
  }
}

function listCatalogVersions() {
  if (!fs.existsSync(CATALOG_ARCHIVE_DIR)) return [];
  return fs
    .readdirSync(CATALOG_ARCHIVE_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      const full = path.join(CATALOG_ARCHIVE_DIR, f);
      const st = fs.statSync(full);
      return { filename: f, size: st.size, mtime: st.mtime.toISOString() };
    })
    .sort((a, b) => (a.mtime < b.mtime ? 1 : -1));
}

function restoreCatalogFromArchive(filename) {
  const safe = path.basename(filename);
  if (!safe.endsWith('.json') || /[\\/]/.test(safe) || safe.includes('..')) {
    const err = new Error('非法文件名');
    err.status = 400;
    throw err;
  }
  const full = path.join(CATALOG_ARCHIVE_DIR, safe);
  if (!fs.existsSync(full)) {
    const err = new Error('备份不存在');
    err.status = 404;
    throw err;
  }
  const next = JSON.parse(fs.readFileSync(full, 'utf-8'));
  saveCatalog(next);
}

/**
 * 写入 catalog.json 并刷新内存缓存（管理员在线编辑）
 */
function saveCatalog(next) {
  const v = validateCatalogStructure(next);
  if (v) {
    const err = new Error(v);
    err.status = 400;
    throw err;
  }
  const f = assertCatalogFilesExist(next);
  if (f) {
    const err = new Error(f);
    err.status = 400;
    throw err;
  }
  archiveCurrentCatalogBeforeSave();
  const tmp = `${CATALOG_PATH}.tmp.${process.pid}.${Date.now()}`;
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2), 'utf-8');
  fs.renameSync(tmp, CATALOG_PATH);
  reloadCatalog();
}

function getAllEnabledSubunits() {
  const cat = loadCatalog();
  return cat.subunits.filter(s => s.enabled !== false);
}

function getSubUnit(subUnitId) {
  const cat = loadCatalog();
  return cat.subunits.find(s => s.id === subUnitId && s.enabled !== false) || null;
}

function getUnit(unitId) {
  const cat = loadCatalog();
  return cat.units.find(u => u.id === unitId && u.enabled !== false) || null;
}

function getRole(roleId) {
  const cat = loadCatalog();
  return (cat.roles || []).find(r => r.id === roleId) || null;
}

function resolveServerPath(relativePath) {
  return path.join(__dirname, '..', relativePath);
}

/**
 * 闪卡归属「知识单元」：从 unit.contentBundle.flashcardsFile 读取。
 */
function loadFlashcardsForUnit(unitId) {
  const unit = getUnit(unitId);
  if (!unit) throw new Error('未知知识单元');
  if (!unit.contentBundle || !unit.contentBundle.flashcardsFile) {
    throw new Error(`知识单元 ${unitId} 未配置 flashcardsFile`);
  }
  const full = resolveServerPath(unit.contentBundle.flashcardsFile);
  return JSON.parse(fs.readFileSync(full, 'utf-8'));
}

/** 从某子单元进入闪卡时，加载其父知识单元的全量闪卡（与「仅子单元内的对话/语音」不同） */
function loadFlashcardsForSubUnit(subUnitId) {
  const su = getSubUnit(subUnitId);
  if (!su) throw new Error('未知知识子单元');
  return loadFlashcardsForUnit(su.unitId);
}

function loadPatientsForSubUnit(subUnitId) {
  const su = getSubUnit(subUnitId);
  if (!su) throw new Error('未知知识子单元');
  const rel = su.contentBundle.patientsFile;
  const full = resolveServerPath(rel);
  return JSON.parse(fs.readFileSync(full, 'utf-8'));
}

function loadKnowledgeTextForSubUnit(subUnitId) {
  const su = getSubUnit(subUnitId);
  if (!su) throw new Error('未知知识子单元');
  const rel = su.contentBundle.knowledgeFile;
  const full = resolveServerPath(rel);
  return fs.readFileSync(full, 'utf-8');
}

function getScoringMeta(subUnitId) {
  const su = getSubUnit(subUnitId);
  if (!su) throw new Error('未知知识子单元');
  return su.contentBundle.scoring;
}

function getUiConfig(subUnitId) {
  const su = getSubUnit(subUnitId);
  if (!su) return {};
  return su.contentBundle.ui || {};
}

/**
 * 校验并规范化单个 role_id（对应 catalog.roles）
 * @returns {{ role_id: string } | { error: string }}
 */
function normalizeRoleIdOnly(raw) {
  const role_id =
    raw != null && String(raw).trim() !== '' ? String(raw).trim() : 'learner';
  if (!getRole(role_id)) {
    return { error: `无效角色: ${role_id}` };
  }
  return { role_id };
}

/**
 * 将导入/表单中的子单元字段规范为已启用子单元 id 数组。
 * raw 可省略、逗号分隔字符串或 string[]。
 * @returns {{ allowed_subunit_ids: string[] } | { error: string }}
 */
function normalizeAllowedSubunitIdsOnly(raw) {
  let ids;
  if (raw == null || raw === '') {
    return { allowed_subunit_ids: [DEFAULT_SUB_UNIT_ID] };
  }
  if (typeof raw === 'string') {
    ids = raw.split(/[,，;；\s]+/).map(s => s.trim()).filter(Boolean);
    if (ids.length === 0) return { allowed_subunit_ids: [DEFAULT_SUB_UNIT_ID] };
  } else if (Array.isArray(raw)) {
    ids = raw.map(x => String(x).trim()).filter(Boolean);
    if (ids.length === 0) return { allowed_subunit_ids: [DEFAULT_SUB_UNIT_ID] };
  } else {
    return { error: 'allowed_subunit_ids 格式无效' };
  }
  const enabled = getAllEnabledSubunits().map(s => s.id);
  const invalid = ids.filter(id => !enabled.includes(id));
  if (invalid.length) {
    return { error: `无效子单元: ${invalid.join(',')}` };
  }
  return { allowed_subunit_ids: ids };
}

/**
 * 同时校验 role_id 与 allowed_subunit_ids（批量导入 JSON 体）
 * @returns {{ role_id: string, allowed_subunit_ids: string[] } | { error: string }}
 */
function normalizeEmployeeAuthFields(input) {
  const r = normalizeRoleIdOnly(input && input.role_id);
  if (r.error) return r;
  const a = normalizeAllowedSubunitIdsOnly(input && input.allowed_subunit_ids);
  if (a.error) return a;
  return { role_id: r.role_id, allowed_subunit_ids: a.allowed_subunit_ids };
}

/**
 * 计算某员工可访问的子单元 id 列表（与 catalog.roles、allowed_subunit_ids 合并）
 */
function getAllowedSubUnitIdsForEmployee(employee) {
  const enabled = getAllEnabledSubunits().map(s => s.id);
  if (!employee) return [];

  const roleId = employee.role_id || 'learner';
  const role = getRole(roleId);
  if (role && role.grantAllSubunits) {
    return [...enabled];
  }

  let allowed = Array.isArray(employee.allowed_subunit_ids) ? employee.allowed_subunit_ids : [];
  if (!allowed.length) {
    allowed = [DEFAULT_SUB_UNIT_ID];
  }
  return enabled.filter(id => allowed.includes(id));
}

function assertEmployeeCanAccess(employee, subUnitId) {
  const ok = getAllowedSubUnitIdsForEmployee(employee).includes(subUnitId);
  if (!ok) {
    const err = new Error('无权访问该知识子单元');
    err.status = 403;
    throw err;
  }
}

/**
 * 给登录用户返回树形结构（仅允许的子单元）
 */
function buildKnowledgeTreeForPhone(phone, db) {
  return (async () => {
    const employee = await db.find('employees', e => e.phone === phone && e.active !== false);
    if (!employee) return { units: [], allowedSubUnitIds: [] };

    const allowedIds = getAllowedSubUnitIdsForEmployee(employee);
    const cat = loadCatalog();
    const unitsOut = [];

    for (const u of cat.units.filter(x => x.enabled !== false)) {
      const subs = cat.subunits
        .filter(s => s.unitId === u.id && s.enabled !== false && allowedIds.includes(s.id))
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map(s => ({
          id: s.id,
          unitId: s.unitId,
          name: s.name,
          slug: s.slug,
          ui: getUiConfig(s.id)
        }));
      if (subs.length) {
        unitsOut.push({
          id: u.id,
          name: u.name,
          description: u.description || '',
          subunits: subs
        });
      }
    }

    return {
      units: unitsOut,
      allowedSubUnitIds: allowedIds,
      roleId: employee.role_id || 'learner',
      employee: {
        name: employee.name,
        phone: employee.phone,
        city: employee.city,
        department: employee.department
      }
    };
  })();
}

async function runStartupMigrations(db) {
  const dimsDefault = getUiConfig(DEFAULT_SUB_UNIT_ID).historyDetailDimensions || [];

  const migrateExam = async () => {
    const rows = await db.filter('exam_records', () => true);
    for (const r of rows) {
      const patch = {};
      if (!r.sub_unit_id) {
        patch.sub_unit_id = DEFAULT_SUB_UNIT_ID;
        patch.unit_id = r.unit_id || DEFAULT_UNIT_ID;
      }
      if (r.dimensions == null && dimsDefault.length) {
        patch.dimensions = dimsDefault;
      }
      if (Object.keys(patch).length) {
        await db.update('exam_records', x => x.id === r.id, patch);
      }
    }
  };

  const migrateProgress = async () => {
    const fsSync = require('fs');
    const pathStore = require('path');
    const file = pathStore.join(__dirname, '../store/flashcard_progress.json');
    if (!fsSync.existsSync(file)) return;

    let rows = await db.filter('flashcard_progress', () => true);
    rows = rows.map(r => {
      const unitId = r.unit_id
        || (r.sub_unit_id && getSubUnit(r.sub_unit_id) ? getSubUnit(r.sub_unit_id).unitId : null)
        || DEFAULT_UNIT_ID;
      return { ...r, unit_id: unitId };
    });

    const byKey = new Map();
    for (const r of rows) {
      const key = `${r.user_id}|${r.card_id}|${r.unit_id}`;
      const prev = byKey.get(key);
      if (!prev || String(r.last_review || '') > String(prev.last_review || '')) {
        byKey.set(key, {
          user_id: r.user_id,
          card_id: r.card_id,
          unit_id: r.unit_id,
          mastered: r.mastered,
          last_review: r.last_review
        });
      }
    }
    const next = [...byKey.values()];
    fsSync.writeFileSync(file, JSON.stringify(next, null, 2));
  };

  const migrateEmployees = async () => {
    const rows = await db.filter('employees', () => true);
    for (const e of rows) {
      const patch = {};
      if (!e.role_id) patch.role_id = 'learner';
      if (!Array.isArray(e.allowed_subunit_ids) || e.allowed_subunit_ids.length === 0) {
        patch.allowed_subunit_ids = [DEFAULT_SUB_UNIT_ID];
      }
      if (Object.keys(patch).length) {
        await db.update('employees', x => x.phone === e.phone, patch);
      }
    }
  };

  await migrateExam();
  await migrateProgress();
  await migrateEmployees();
}

module.exports = {
  loadCatalog,
  reloadCatalog,
  getSubUnit,
  getUnit,
  getRole,
  getAllEnabledSubunits,
  loadFlashcardsForUnit,
  loadFlashcardsForSubUnit,
  loadPatientsForSubUnit,
  loadKnowledgeTextForSubUnit,
  getScoringMeta,
  getUiConfig,
  normalizeRoleIdOnly,
  normalizeAllowedSubunitIdsOnly,
  normalizeEmployeeAuthFields,
  getAllowedSubUnitIdsForEmployee,
  assertEmployeeCanAccess,
  buildKnowledgeTreeForPhone,
  runStartupMigrations,
  saveCatalog,
  validateCatalogStructure,
  listCatalogVersions,
  restoreCatalogFromArchive,
  DEFAULT_SUB_UNIT_ID,
  DEFAULT_UNIT_ID
};
