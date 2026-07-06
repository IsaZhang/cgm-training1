const express = require('express');
const db = require('../db');
const { adminAuth } = require('./auth');
const kc = require('../services/knowledgeCatalog');

const router = express.Router();
router.use(adminAuth);

router.get('/list', async (req, res) => {
  try {
    const rows = await db.filter('employees', () => true);
    const cat = kc.loadCatalog();
    const roles = cat.roles || [];
    const list = rows.map(e => ({
      name: e.name,
      phone: e.phone,
      city: e.city || '',
      department: e.department || '',
      active: e.active !== false,
      role_id: e.role_id || 'learner',
      role_name: (roles.find(r => r.id === (e.role_id || 'learner')) || {}).name || '',
      allowed_subunit_ids: Array.isArray(e.allowed_subunit_ids) ? e.allowed_subunit_ids : [kc.DEFAULT_SUB_UNIT_ID],
      cde_id: e.cde_id || '',
      job_level: e.job_level || ''
    }));
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/:phone', async (req, res) => {
  try {
    const phone = decodeURIComponent(req.params.phone);
    const { name, city, department, active, role_id, allowed_subunit_ids, cde_id, job_level } = req.body;
    const exists = await db.find('employees', e => e.phone === phone);
    if (!exists) return res.status(404).json({ error: '员工不存在' });

    const patch = {};
    if (name !== undefined) patch.name = name;
    if (city !== undefined) patch.city = city;
    if (department !== undefined) patch.department = department;
    if (active !== undefined) patch.active = active;
    if (cde_id !== undefined) patch.cde_id = cde_id;       // rcpd 对接预留：稳定外键
    if (job_level !== undefined) patch.job_level = job_level; // rcpd 对接预留：职级
    if (role_id !== undefined) {
      const nr = kc.normalizeRoleIdOnly(role_id);
      if (nr.error) return res.status(400).json({ error: nr.error });
      patch.role_id = nr.role_id;
    }
    if (allowed_subunit_ids !== undefined) {
      const na = kc.normalizeAllowedSubunitIdsOnly(allowed_subunit_ids);
      if (na.error) return res.status(400).json({ error: na.error });
      patch.allowed_subunit_ids = na.allowed_subunit_ids;
    }

    await db.update('employees', e => e.phone === phone, patch);
    const updated = await db.find('employees', e => e.phone === phone);
    res.json({ ok: true, employee: updated });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
