const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '../store/voice_sessions.json');
const MAX_SESSIONS = Math.max(100, parseInt(process.env.VOICE_SESSION_MAX || '5000', 10) || 5000);

let chain = Promise.resolve();

function runExclusive(fn) {
  const p = chain.then(() => fn());
  chain = p.catch(() => {});
  return p;
}

/** @type {Map<string, object>} */
let map = new Map();

function loadFromDisk() {
  try {
    if (!fs.existsSync(FILE)) return;
    const j = JSON.parse(fs.readFileSync(FILE, 'utf-8'));
    const entries = j.entries && typeof j.entries === 'object' ? j.entries : {};
    map = new Map(Object.entries(entries));
  } catch (_) {
    map = new Map();
  }
}

function persist() {
  return runExclusive(async () => {
    const dir = path.dirname(FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const obj = Object.fromEntries(map);
    const tmp = `${FILE}.tmp.${process.pid}`;
    fs.writeFileSync(
      tmp,
      JSON.stringify({ savedAt: new Date().toISOString(), entries: obj }, null, 2),
      'utf-8'
    );
    fs.renameSync(tmp, FILE);
  });
}

function prune() {
  while (map.size > MAX_SESSIONS) {
    const first = map.keys().next().value;
    if (first === undefined) break;
    map.delete(first);
  }
}

function set(sessionId, value) {
  if (!sessionId) return Promise.resolve();
  map.set(sessionId, value);
  prune();
  return persist();
}

function get(sessionId) {
  return map.get(sessionId);
}

loadFromDisk();

module.exports = { set, get, persist, loadFromDisk };
