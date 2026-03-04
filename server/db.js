const fs = require('fs');
const path = require('path');

const DB_DIR = path.join(__dirname, 'store');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR);

function getFile(name) {
  const file = path.join(DB_DIR, `${name}.json`);
  if (!fs.existsSync(file)) fs.writeFileSync(file, '[]');
  return file;
}

function readAll(name) {
  return JSON.parse(fs.readFileSync(getFile(name), 'utf-8'));
}

function writeAll(name, data) {
  fs.writeFileSync(getFile(name), JSON.stringify(data, null, 2));
}

async function find(name, fn) {
  return readAll(name).find(fn);
}

async function filter(name, fn) {
  return readAll(name).filter(fn);
}

async function insert(name, record) {
  const data = readAll(name);
  data.push(record);
  writeAll(name, data);
  return record;
}

async function update(name, fn, updater) {
  const data = readAll(name);
  let updated = false;
  data.forEach((item, i) => {
    if (fn(item)) { Object.assign(data[i], updater); updated = true; }
  });
  if (updated) writeAll(name, data);
  return updated;
}

async function upsert(name, fn, record) {
  const data = readAll(name);
  const idx = data.findIndex(fn);
  if (idx >= 0) { Object.assign(data[idx], record); }
  else { data.push(record); }
  writeAll(name, data);
}

module.exports = { find, filter, insert, update, upsert };
