/**
 * 与 db-json 相同 API：每「表」存为一行 JSON 数组（payload），便于无模式迁移。
 * 启用：环境变量 USE_SQLITE=1，且已安装依赖：`npm install better-sqlite3`（原生模块）。
 * 数据文件：store/app.sqlite。首次启动若库为空，会从 store/*.json 导入（跳过 voice_sessions）。
 * 若 require 失败，db.js 会回退到 db-json。
 */
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const STORE_DIR = path.join(__dirname, 'store');
if (!fs.existsSync(STORE_DIR)) fs.mkdirSync(STORE_DIR);

const SQL_PATH = path.join(STORE_DIR, 'app.sqlite');
const SKIP_IMPORT = new Set(['voice_sessions']);

const writeChains = new Map();

function runWrite(name, fn) {
  const prev = writeChains.get(name) || Promise.resolve();
  const task = prev.then(() => fn());
  writeChains.set(name, task.catch(() => {}));
  return task;
}

let _db;

function getDb() {
  if (!_db) {
    _db = new Database(SQL_PATH);
    _db.pragma('journal_mode = WAL');
    _db.exec(
      'CREATE TABLE IF NOT EXISTS json_stores (name TEXT PRIMARY KEY NOT NULL, payload TEXT NOT NULL);'
    );
    migrateFromJsonFilesIfEmpty(_db);
  }
  return _db;
}

function migrateFromJsonFilesIfEmpty(db) {
  const n = db.prepare('SELECT COUNT(*) AS c FROM json_stores').get().c;
  if (n > 0) return;
  if (!fs.existsSync(STORE_DIR)) return;
  const ins = db.prepare('INSERT OR REPLACE INTO json_stores (name, payload) VALUES (?, ?)');
  for (const f of fs.readdirSync(STORE_DIR)) {
    if (!f.endsWith('.json')) continue;
    const name = f.replace(/\.json$/i, '');
    if (SKIP_IMPORT.has(name)) continue;
    const full = path.join(STORE_DIR, f);
    const raw = fs.readFileSync(full, 'utf-8');
    JSON.parse(raw);
    ins.run(name, raw);
  }
}

function readAll(name) {
  const row = getDb().prepare('SELECT payload FROM json_stores WHERE name = ?').get(name);
  if (!row) return [];
  return JSON.parse(row.payload);
}

function writeAll(name, data) {
  const payload = JSON.stringify(data);
  getDb().prepare('INSERT OR REPLACE INTO json_stores (name, payload) VALUES (?, ?)').run(name, payload);
}

async function find(name, fn) {
  return readAll(name).find(fn);
}

async function filter(name, fn) {
  return readAll(name).filter(fn);
}

async function insert(name, record) {
  return runWrite(name, async () => {
    const data = readAll(name);
    data.push(record);
    writeAll(name, data);
    return record;
  });
}

async function update(name, fn, updater) {
  return runWrite(name, async () => {
    const data = readAll(name);
    let updated = false;
    data.forEach((item, i) => {
      if (fn(item)) {
        Object.assign(data[i], updater);
        updated = true;
      }
    });
    if (updated) writeAll(name, data);
    return updated;
  });
}

async function upsert(name, fn, record) {
  return runWrite(name, async () => {
    const data = readAll(name);
    const idx = data.findIndex(fn);
    if (idx >= 0) {
      Object.assign(data[idx], record);
    } else {
      data.push(record);
    }
    writeAll(name, data);
  });
}

module.exports = { find, filter, insert, update, upsert };
