const db = require('../db');
const kc = require('../services/knowledgeCatalog');

/**
 * 必须在 auth 之后使用。从 Header x-sub-unit-id 读取子单元并校验员工权限。
 */
async function requireSubUnit(req, res, next) {
  try {
    const subUnitId = req.headers['x-sub-unit-id'] || req.body?.sub_unit_id || req.query?.sub_unit_id;
    if (!subUnitId) {
      return res.status(400).json({ error: '缺少知识子单元 x-sub-unit-id' });
    }
    const employee = await db.find('employees', e => e.phone === req.user.phone && e.active !== false);
    if (!employee) {
      return res.status(403).json({ error: '员工信息异常' });
    }
    kc.assertEmployeeCanAccess(employee, subUnitId);
    const su = kc.getSubUnit(subUnitId);
    if (!su) {
      return res.status(400).json({ error: '无效的知识子单元' });
    }
    req.subUnitId = subUnitId;
    req.unitId = su.unitId;
    req.employee = employee;
    next();
  } catch (e) {
    if (e.status === 403) return res.status(403).json({ error: e.message });
    next(e);
  }
}

module.exports = { requireSubUnit };
