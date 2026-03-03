const express = require('express');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const db = require('../db');
const router = express.Router();

router.post('/login', async (req, res) => {
  const { name, phone } = req.body;
  if (!name || !phone) return res.status(400).json({ error: '请输入姓名和手机号' });

  const employee = await db.find('employees', e => e.phone === phone && e.name === name && e.active !== false);
  if (!employee) return res.status(401).json({ error: '未找到该员工信息，请联系管理员' });

  let user = await db.find('users', u => u.phone === phone);
  const token = crypto.randomBytes(32).toString('hex');

  if (!user) {
    user = { id: uuidv4(), name, phone, token, created_at: new Date().toISOString() };
    await db.insert('users', user);
  } else {
    await db.update('users', u => u.phone === phone, { token, last_login: new Date().toISOString() });
    user.token = token;
  }

  res.json({ id: user.id, name: user.name, token });
});

async function auth(req, res, next) {
  const token = req.headers['x-token'];
  if (!token) return res.status(401).json({ error: '请先登录' });
  const user = await db.find('users', u => u.token === token);
  if (!user) return res.status(401).json({ error: '登录已过期' });
  req.user = user;
  next();
}

router.post('/employees/import', async (req, res) => {
  const { employees } = req.body;
  let count = 0;
  for (const e of employees) {
    const exists = await db.find('employees', x => x.phone === e.phone);
    if (!exists) {
      await db.insert('employees', {
        name: e.name,
        phone: e.phone,
        city: e.city,
        department: e.department,
        active: e.active !== undefined ? e.active : true
      });
      count++;
    }
  }
  res.json({ imported: count, total: employees.length });
});

module.exports = { router, auth };
