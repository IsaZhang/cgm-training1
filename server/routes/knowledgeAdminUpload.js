const path = require('path');
const fs = require('fs');
const kc = require('../services/knowledgeCatalog');

const SERVER_ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(SERVER_ROOT, 'data');

function assertUnderData(absPath) {
  const rel = path.relative(DATA_DIR, absPath);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('仅允许写入 server/data/ 下路径');
  }
}

function safeDataPath(relativePath) {
  if (typeof relativePath !== 'string' || !relativePath.length) {
    throw new Error('路径无效');
  }
  const full = path.resolve(SERVER_ROOT, relativePath);
  assertUnderData(full);
  return full;
}

function backupFile(fullPath) {
  if (!fs.existsSync(fullPath)) return;
  const backupRoot = path.join(DATA_DIR, '_content_backups', String(Date.now()));
  fs.mkdirSync(backupRoot, { recursive: true });
  const dest = path.join(backupRoot, path.basename(fullPath));
  fs.copyFileSync(fullPath, dest);
}

function getCatalogVersions(req, res) {
  try {
    res.json({ versions: kc.listCatalogVersions() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

function postCatalogRestore(req, res) {
  try {
    const { filename } = req.body || {};
    if (!filename) return res.status(400).json({ error: '缺少 filename' });
    kc.restoreCatalogFromArchive(filename);
    res.json({ ok: true, version: kc.loadCatalog().version });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
}

/**
 * JSON 体上传子单元内容包（避免 multipart 依赖）。
 * body: { subUnitId, patientsJson?: string, knowledgeMarkdown?: string }
 */
function postUploadSubunitJson(req, res) {
  try {
    const { subUnitId, patientsJson, knowledgeMarkdown } = req.body || {};
    if (!subUnitId) return res.status(400).json({ error: '缺少 subUnitId' });
    if (patientsJson == null && knowledgeMarkdown == null) {
      return res.status(400).json({ error: '请提供 patientsJson 或 knowledgeMarkdown' });
    }
    kc.reloadCatalog();
    const su = kc.getSubUnit(subUnitId);
    if (!su) return res.status(404).json({ error: '未知或未启用的知识子单元' });
    const cb = su.contentBundle;
    if (patientsJson != null) {
      JSON.parse(patientsJson);
      const dest = safeDataPath(cb.patientsFile);
      backupFile(dest);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, patientsJson, 'utf-8');
    }
    if (knowledgeMarkdown != null) {
      const dest = safeDataPath(cb.knowledgeFile);
      backupFile(dest);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, String(knowledgeMarkdown), 'utf-8');
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
}

/**
 * body: { unitId, flashcardsJson: string }
 */
function postUploadUnitJson(req, res) {
  try {
    const { unitId, flashcardsJson } = req.body || {};
    if (!unitId) return res.status(400).json({ error: '缺少 unitId' });
    if (flashcardsJson == null) return res.status(400).json({ error: '缺少 flashcardsJson' });
    JSON.parse(flashcardsJson);
    kc.reloadCatalog();
    const u = kc.getUnit(unitId);
    if (!u) return res.status(404).json({ error: '未知或未启用的知识单元' });
    const dest = safeDataPath(u.contentBundle.flashcardsFile);
    backupFile(dest);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, flashcardsJson, 'utf-8');
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
}

module.exports = {
  getCatalogVersions,
  postCatalogRestore,
  postUploadSubunitJson,
  postUploadUnitJson
};
