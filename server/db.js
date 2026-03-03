const cloudbase = require('@cloudbase/node-sdk');

// 初始化云开发
const app = cloudbase.init({
  env: process.env.TCB_ENV || process.env.ENV_ID
});
const db = app.database();
const _ = db.command;

// 集合名映射
const COLLECTIONS = {
  users: 'users',
  employees: 'employees',
  flashcard_progress: 'flashcard_progress',
  exam_records: 'exam_records'
};

async function find(name, fn) {
  const collection = db.collection(COLLECTIONS[name] || name);
  const { data } = await collection.get();
  return data.find(fn);
}

async function filter(name, fn) {
  const collection = db.collection(COLLECTIONS[name] || name);
  const { data } = await collection.get();
  return data.filter(fn);
}

async function insert(name, record) {
  const collection = db.collection(COLLECTIONS[name] || name);
  await collection.add(record);
  return record;
}

async function update(name, fn, updater) {
  const collection = db.collection(COLLECTIONS[name] || name);
  const { data } = await collection.get();
  let updated = false;
  for (const item of data) {
    if (fn(item)) {
      await collection.doc(item._id).update(updater);
      updated = true;
    }
  }
  return updated;
}

async function upsert(name, fn, record) {
  const collection = db.collection(COLLECTIONS[name] || name);
  const { data } = await collection.get();
  const existing = data.find(fn);
  if (existing) {
    await collection.doc(existing._id).update(record);
  } else {
    await collection.add(record);
  }
}

module.exports = { find, filter, insert, update, upsert };
