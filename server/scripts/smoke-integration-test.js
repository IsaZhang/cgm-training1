#!/usr/bin/env node
/**
 * 本地联调冒烟测试：拉起 app（临时端口），串行请求关键 API。
 * 不调用 LLM 评分（/exam/submit、/chat/message 等），避免依赖外网与费用。
 *
 * 用法（在 server 目录）：
 *   ADMIN_TOKEN=你的管理员口令 node scripts/smoke-integration-test.js
 * 若未设置 ADMIN_TOKEN，脚本使用临时值并仅用于本次进程（需与 .env 中一致才能测管理端；未配置时管理端步骤会跳过并提示）。
 */

const http = require('http');

process.env.PORT = process.env.SMOKE_PORT || '34567';
if (!process.env.ADMIN_TOKEN) {
  process.env.ADMIN_TOKEN = '__smoke_test_admin_only__';
}

const app = require('../app');

const PORT = Number(process.env.PORT);
const BASE = `http://127.0.0.1:${PORT}`;

const TEST_EMPLOYEE = { name: '测试员工', phone: '13800000001' };
const SUB_UNIT = 'cgm-transform';

function httpRequest(method, path, headers = {}, bodyObj = null) {
  return new Promise((resolve, reject) => {
    const body = bodyObj ? JSON.stringify(bodyObj) : null;
    const url = new URL(path, BASE);
    const opts = {
      hostname: url.hostname,
      port: url.port || PORT,
      path: url.pathname + url.search,
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {}),
        ...headers
      }
    };
    const req = http.request(opts, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        let json = null;
        try {
          json = raw ? JSON.parse(raw) : null;
        } catch (e) {
          json = { _parseError: true, raw };
        }
        resolve({ status: res.statusCode, json, raw });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

const results = [];

function ok(name, cond, detail = '') {
  const pass = !!cond;
  results.push({ name, pass, detail });
  const tag = pass ? 'PASS' : 'FAIL';
  console.log(`[${tag}] ${name}${detail ? ` — ${detail}` : ''}`);
  return pass;
}

async function main() {
  console.log('=== cgm-training 联调冒烟测试 ===\n');
  console.log(`PORT=${PORT} ADMIN_TOKEN=${process.env.ADMIN_TOKEN ? '(已设置)' : '(未设置)'}\n`);

  const server = await new Promise((resolve, reject) => {
    const s = app.listen(PORT, '127.0.0.1', () => resolve(s));
    s.on('error', reject);
  });

  await new Promise(r => setTimeout(r, 400));

  let token = null;

  try {
    // 1) 健康检查
    let r = await httpRequest('GET', '/health');
    ok('GET /health', r.status === 200 && r.json && r.json.status === 'ok', `status=${r.status}`);

    // 2) 登录
    r = await httpRequest('POST', '/api/auth/login', {}, TEST_EMPLOYEE);
    ok(
      'POST /api/auth/login',
      r.status === 200 && r.json && r.json.token,
      r.json && r.json.token ? `token.len=${r.json.token.length}` : r.raw?.slice(0, 120)
    );
    token = r.json && r.json.token;

    const authH = { 'x-token': token || '' };
    const subH = { 'x-token': token || '', 'x-sub-unit-id': SUB_UNIT };

    // 3) 知识树
    r = await httpRequest('GET', '/api/knowledge/me', authH);
    const hasUnits = r.json && Array.isArray(r.json.units) && r.json.units.length > 0;
    ok('GET /api/knowledge/me', r.status === 200 && hasUnits, `units=${r.json?.units?.length}`);

    // 4) 闪卡列表（单元级）
    r = await httpRequest('GET', '/api/flashcard/list', subH);
    const cats = r.json && typeof r.json === 'object' ? Object.keys(r.json) : [];
    ok(
      'GET /api/flashcard/list (x-sub-unit-id)',
      r.status === 200 && cats.length > 0,
      `categories=${cats.slice(0, 6).join(',')}${cats.length > 6 ? '...' : ''}`
    );

    // 4b) 第二知识子单元：未授权时应 403（测试账号默认仅 cgm-transform）
    const subAgp = { 'x-token': token || '', 'x-sub-unit-id': 'cgm-agp-reading' };
    r = await httpRequest('GET', '/api/flashcard/list', subAgp);
    ok(
      'GET /api/flashcard/list (cgm-agp-reading 未授权→403)',
      r.status === 403,
      `status=${r.status}`
    );

    // 5) 闪卡进度
    r = await httpRequest('GET', '/api/flashcard/progress', subH);
    ok(
      'GET /api/flashcard/progress',
      r.status === 200 && r.json && typeof r.json.total === 'number',
      `total=${r.json?.total} scope=${r.json?.scope}`
    );

    // 6) 患者列表（子单元场景）
    r = await httpRequest('GET', '/api/chat/patients', subH);
    const pcount = Array.isArray(r.json) ? r.json.length : 0;
    ok('GET /api/chat/patients', r.status === 200 && pcount > 0, `patients=${pcount}`);

    // 7) 考试历史（空也可）
    r = await httpRequest('GET', '/api/exam/history', authH);
    ok('GET /api/exam/history', r.status === 200 && Array.isArray(r.json), `records=${r.json?.length}`);

    const adminTok = { 'x-admin-token': process.env.ADMIN_TOKEN };

    // 8) 管理员：catalog
    r = await httpRequest('GET', '/api/knowledge/catalog', adminTok);
    ok(
      'GET /api/knowledge/catalog (admin)',
      r.status === 200 && r.json && Array.isArray(r.json.subunits),
      r.status === 403 ? '若 403 请在运行前 export ADMIN_TOKEN=与 .env 一致' : `subunits=${r.json?.subunits?.length} (含图谱解读等)`
    );

    // 8b) 完整 catalog + 幂等写回（Phase D 在线编辑的基础）
    r = await httpRequest('GET', '/api/knowledge/catalog/raw', adminTok);
    const rawCatalog = r.json;
    const rawOk =
      r.status === 200 && rawCatalog && typeof rawCatalog.version === 'number' && Array.isArray(rawCatalog.subunits);
    ok(
      'GET /api/knowledge/catalog/raw (admin)',
      rawOk,
      r.status === 403 ? '若 403 请检查 ADMIN_TOKEN' : `version=${rawCatalog?.version}`
    );
    if (rawOk) {
      r = await httpRequest('PUT', '/api/knowledge/catalog', adminTok, rawCatalog);
      ok(
        'PUT /api/knowledge/catalog (幂等回写)',
        r.status === 200 && r.json && r.json.ok === true,
        `version=${r.json?.version}`
      );
    }

    r = await httpRequest('GET', '/api/knowledge/catalog/versions', adminTok);
    const verOk = r.status === 200 && r.json && Array.isArray(r.json.versions);
    ok(
      'GET /api/knowledge/catalog/versions (admin)',
      verOk,
      verOk ? `backups=${r.json.versions.length}` : `status=${r.status}`
    );

    // 9) 管理员：员工列表
    r = await httpRequest('GET', '/api/employees/admin/list', adminTok);
    ok(
      'GET /api/employees/admin/list',
      r.status === 200 && Array.isArray(r.json),
      `employees=${r.json?.length}`
    );

    // 10) 管理员：按子单元汇总
    r = await httpRequest('GET', '/api/exam/admin/summary-by-subunit', adminTok);
    ok(
      'GET /api/exam/admin/summary-by-subunit',
      r.status === 200 && Array.isArray(r.json),
      `rows=${r.json?.length}`
    );
  } catch (e) {
    console.error('测试异常:', e);
    results.push({ name: 'runner', pass: false, detail: String(e.message) });
  } finally {
    server.close();
  }

  const failed = results.filter(x => !x.pass);
  console.log('\n=== 汇总 ===');
  console.log(`通过: ${results.filter(x => x.pass).length} / ${results.length}`);
  if (failed.length) {
    console.log('失败项:', failed.map(f => f.name).join(', '));
    process.exitCode = 1;
  } else {
    console.log('全部通过（不含 LLM 的接口未测）。');
  }
}

main();
