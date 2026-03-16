#!/usr/bin/env node
/**
 * 从 Excel 导入员工数据到 employees.json 或调用导入 API
 * 
 * 用法:
 *   node import-from-excel.js [excel路径] [选项]
 *   node import-from-excel.js                    # 使用默认路径
 *   node import-from-excel.js ./data.xlsx        # 指定 Excel 文件
 *   node import-from-excel.js --write            # 直接写入 store/employees.json
 *   node import-from-excel.js --api              # 调用导入 API（需服务运行）
 *   API_BASE=https://ai-cgm.phrones.com node import-from-excel.js --api  # 导入到线上
 * 
 * Excel 列映射: 姓名 -> name, 城市 -> city, 所属部门 -> department, 电话号码 -> phone
 */

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const DEFAULT_EXCEL = path.join(__dirname, '..', '共同照护事业部入职人员信息_人员在职表 3.16.xlsx');
const EMPLOYEES_JSON = path.join(__dirname, 'store', 'employees.json');

// 列名映射（支持多种表头写法）
const NAME_KEYS = ['姓名', '姓名-总', 'name'];
const CITY_KEYS = ['城市', 'city'];
const DEPT_KEYS = ['所属部门', '部门', 'department'];
const PHONE_KEYS = ['电话号码', '手机号', 'phone'];

function parseExcel(filePath) {
  const wb = XLSX.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  if (rows.length < 2) {
    throw new Error('Excel 无数据或仅有表头');
  }

  const header = rows[0];
  const headerMap = {};
  header.forEach((h, i) => { headerMap[i] = String(h || '').trim(); });

  const nameCol = NAME_KEYS.map(k => header.findIndex(h => String(h || '').includes(k) || String(h || '') === k)).find(i => i >= 0);
  const cityCol = CITY_KEYS.map(k => header.findIndex(h => String(h || '').includes(k) || String(h || '') === k)).find(i => i >= 0);
  const deptCol = DEPT_KEYS.map(k => header.findIndex(h => String(h || '').includes(k) || String(h || '') === k)).find(i => i >= 0);
  const phoneCol = PHONE_KEYS.map(k => header.findIndex(h => String(h || '').includes(k) || String(h || '') === k)).find(i => i >= 0);

  if (nameCol < 0 || phoneCol < 0) {
    throw new Error('未找到姓名或电话号码列，表头: ' + JSON.stringify(header));
  }

  const employees = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const name = String(row[nameCol] || '').trim();
    const phone = String(row[phoneCol] || '').replace(/\D/g, '');
    if (!name || !phone) continue;

    employees.push({
      name,
      phone,
      city: (cityCol >= 0 ? String(row[cityCol] || '').trim() : '') || '-',
      department: (deptCol >= 0 ? String(row[deptCol] || '').trim() : '') || '-',
      active: true
    });
  }
  return employees;
}

function writeToJson(employees) {
  const existing = [];
  if (fs.existsSync(EMPLOYEES_JSON)) {
    const raw = fs.readFileSync(EMPLOYEES_JSON, 'utf-8');
    try {
      existing.push(...JSON.parse(raw));
    } catch (_) {}
  }
  const phoneSet = new Set(existing.map(e => e.phone));
  let added = 0;
  for (const e of employees) {
    if (!phoneSet.has(e.phone)) {
      existing.push(e);
      phoneSet.add(e.phone);
      added++;
    }
  }
  fs.writeFileSync(EMPLOYEES_JSON, JSON.stringify(existing, null, 2), 'utf-8');
  return { total: employees.length, added, totalCount: existing.length };
}

async function callImportApi(employees) {
  const apiBase = process.env.API_BASE || 'http://localhost:3000';
  const token = process.env.ADMIN_TOKEN;
  if (!token) throw new Error('请设置 ADMIN_TOKEN 环境变量');

  const res = await fetch(apiBase + '/api/auth/employees/import', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-token': token
    },
    body: JSON.stringify({ employees })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '请求失败');
  return data;
}

async function main() {
  const args = process.argv.slice(2);
  const excelPath = args.find(a => !a.startsWith('-')) || DEFAULT_EXCEL;
  const doWrite = args.includes('--write');
  const doApi = args.includes('--api');

  if (!fs.existsSync(excelPath)) {
    console.error('Excel 文件不存在:', excelPath);
    process.exit(1);
  }

  const employees = parseExcel(excelPath);
  console.log(`解析到 ${employees.length} 条员工`);

  if (doWrite) {
    const { added, totalCount } = writeToJson(employees);
    console.log(`已写入 store/employees.json: 新增 ${added} 条，共 ${totalCount} 条`);
  } else if (doApi) {
    const result = await callImportApi(employees);
    console.log(`API 导入完成: ${result.imported}/${result.total} 新员工`);
  } else {
    console.log('请指定 --write（写入 store/employees.json）或 --api（调用导入接口）');
    console.log('示例:');
    console.log('  node import-from-excel.js --write');
    console.log('  node import-from-excel.js --api');
    console.log('  API_BASE=https://ai-cgm.phrones.com ADMIN_TOKEN=xxx node import-from-excel.js --api');
  }
}

main().catch(err => {
  console.error(err.message || err);
  process.exit(1);
});
