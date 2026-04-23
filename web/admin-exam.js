/* global localStorage, fetch, alert, document, URL, Blob */

function getApiBase() {
  const saved = localStorage.getItem('adminApiBase');
  if (saved) return saved;
  if (typeof window !== 'undefined' && window.location && window.location.origin && window.location.origin !== 'null') {
    return `${window.location.origin}/api`;
  }
  return 'https://ai-cgm.phrones.com/api';
}

let adminToken = '';
let allStats = [];
let filteredStats = [];
let allRecords = [];
let filteredRecords = [];
let catalog = { units: [], subunits: [], roles: [] };
let allEmployees = [];
let editingPhone = null;

async function request(url, options = {}) {
  const API_BASE = getApiBase();
  const res = await fetch(API_BASE + url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-admin-token': adminToken,
      ...options.headers
    }
  });
  if (!res.ok) {
    let error = { error: '请求失败' };
    try {
      error = await res.json();
    } catch (e) { /* ignore */ }
    throw new Error(error.error || '请求失败');
  }
  return res.json();
}

function login() {
  const token = document.getElementById('adminToken').value.trim();
  const apiBaseInput = document.getElementById('adminApiBase');
  if (apiBaseInput && apiBaseInput.value.trim()) {
    localStorage.setItem('adminApiBase', apiBaseInput.value.trim().replace(/\/$/, ''));
  }
  if (!token) return alert('请输入管理员密码');

  adminToken = token;
  localStorage.setItem('adminToken', token);

  loadData();
}

async function loadData() {
  try {
    await loadCatalog();
    await loadStats();
    await loadSummaryBySubunit();
    document.getElementById('loginBox').classList.add('hidden');
    document.getElementById('mainContent').classList.remove('hidden');
  } catch (e) {
    alert('登录失败：' + e.message);
    adminToken = '';
    localStorage.removeItem('adminToken');
  }
}

async function loadCatalogRaw() {
  const ta = document.getElementById('catalogJsonEditor');
  if (!ta) return;
  try {
    const raw = await request('/knowledge/catalog/raw');
    ta.value = JSON.stringify(raw, null, 2);
  } catch (e) {
    alert('加载失败：' + e.message);
  }
}

async function saveCatalogJson() {
  const ta = document.getElementById('catalogJsonEditor');
  if (!ta) return;
  let obj;
  try {
    obj = JSON.parse(ta.value);
  } catch (e) {
    alert('JSON 无法解析：' + e.message);
    return;
  }
  try {
    const res = await request('/knowledge/catalog', {
      method: 'PUT',
      body: JSON.stringify(obj)
    });
    alert(`已保存，version=${res.version}`);
    await loadCatalog();
    await loadCatalogRaw();
  } catch (e) {
    alert(e.message || '保存失败');
  }
}

async function loadCatalog() {
  catalog = await request('/knowledge/catalog');
  const unitSel = document.getElementById('statsFilterUnit');
  const subSel = document.getElementById('statsFilterSubUnit');
  const recUnit = document.getElementById('recordsFilterUnit');
  const recSub = document.getElementById('recordsFilterSubUnit');
  if (unitSel) {
    unitSel.innerHTML = '<option value="">全部知识单元</option>' +
      catalog.units.map(u => `<option value="${u.id}">${u.name}</option>`).join('');
  }
  if (subSel) {
    subSel.innerHTML = '<option value="">全部知识子单元</option>' +
      catalog.subunits.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  }
  if (recUnit) {
    recUnit.innerHTML = '<option value="">全部知识单元</option>' +
      catalog.units.map(u => `<option value="${u.id}">${u.name}</option>`).join('');
  }
  if (recSub) {
    recSub.innerHTML = '<option value="">全部知识子单元</option>' +
      catalog.subunits.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  }
  renderEmployeeRoleOptions();
  renderEmployeeSubunitChecks();
  populateCatalogUploadSelectors();
}

function populateCatalogUploadSelectors() {
  const su = document.getElementById('catalogUploadSubUnitId');
  const uu = document.getElementById('catalogUploadUnitId');
  if (su && catalog.subunits && catalog.subunits.length) {
    su.innerHTML = catalog.subunits
      .map(s => `<option value="${s.id}">${s.name} (${s.id})</option>`)
      .join('');
  }
  if (uu && catalog.units && catalog.units.length) {
    uu.innerHTML = catalog.units.map(u => `<option value="${u.id}">${u.name}</option>`).join('');
  }
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error('读取文件失败'));
    r.readAsText(file, 'UTF-8');
  });
}

function openCatalogUsageModal() {
  const el = document.getElementById('catalogUsageModal');
  if (el) el.classList.remove('hidden');
}

function closeCatalogUsageModal() {
  const el = document.getElementById('catalogUsageModal');
  if (el) el.classList.add('hidden');
}

function triggerDownload(filename, text, mime) {
  const blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** RFC4180 风格，支持字段内换行与双引号转义 */
function parseCsv(text) {
  const rows = [];
  const s = String(text).replace(/^\uFEFF/, '');
  let row = [];
  let field = '';
  let inQuotes = false;
  const flushRow = () => {
    row.push(field);
    field = '';
    if (row.length && row.some(c => String(c).trim() !== '')) rows.push(row);
    row = [];
  };
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    const next = s[i + 1];
    if (inQuotes) {
      if (c === '"') {
        if (next === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      continue;
    }
    if (c === ',') {
      row.push(field);
      field = '';
      continue;
    }
    if (c === '\r' && next === '\n') {
      flushRow();
      i++;
      continue;
    }
    if (c === '\n' || c === '\r') {
      flushRow();
      continue;
    }
    field += c;
  }
  flushRow();
  return rows;
}

function escapeCsvField(val) {
  if (val == null || val === '') return '';
  const str = String(val);
  if (/[",\r\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function stringifyCsv(headers, dataRows) {
  const lines = [headers.map(escapeCsvField).join(',')];
  for (const obj of dataRows) {
    lines.push(headers.map(h => escapeCsvField(obj[h] != null ? obj[h] : '')).join(','));
  }
  return `\uFEFF${lines.join('\r\n')}`;
}

const PATIENT_CSV_HEADERS = [
  'id', 'name', 'age', 'gender', 'diagnosis', 'medication', 'personality',
  'pain_points', 'resistance', 'recommended_cgm_count', 'cgm_plan', 'conversion_keys', 'system_prompt'
];
const PATIENT_NUMERIC_FIELDS = new Set(['age', 'recommended_cgm_count']);
const PATIENT_ARRAY_FIELDS = new Set(['pain_points', 'resistance', 'conversion_keys']);

function parseListCell(raw) {
  if (raw == null) return [];
  const t = String(raw).trim();
  if (!t) return [];
  if (t.startsWith('[')) {
    try {
      const j = JSON.parse(t);
      return Array.isArray(j) ? j.map(x => String(x)) : [];
    } catch (_) { /* 按分隔符解析 */ }
  }
  return t.split(/[|｜;；]/).map(x => x.trim()).filter(Boolean);
}

function patientsCsvTextToJsonArray(text) {
  const rows = parseCsv(text);
  if (!rows.length) throw new Error('CSV 为空');
  const headers = rows[0].map(h => String(h).trim());
  if (!headers.length || !headers[0]) throw new Error('CSV 缺少表头');
  const patients = [];
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    if (!cells || !cells.some(c => String(c).trim())) continue;
    const obj = {};
    headers.forEach((h, idx) => {
      if (!h) return;
      const cell = cells[idx];
      if (cell === undefined || String(cell).trim() === '') return;
      const v = String(cell).trim();
      if (PATIENT_ARRAY_FIELDS.has(h)) {
        obj[h] = parseListCell(v);
      } else if (PATIENT_NUMERIC_FIELDS.has(h)) {
        const n = Number(v);
        if (!Number.isNaN(n)) obj[h] = n;
      } else {
        obj[h] = v;
      }
    });
    if (obj.id) patients.push(obj);
  }
  if (!patients.length) throw new Error('CSV 中未解析到任何含 id 的患者行');
  return patients;
}

const FLASHCARD_CSV_HEADERS = ['id', 'category', 'difficulty', 'front', 'back'];

function flashcardsCsvTextToJsonArray(text) {
  const rows = parseCsv(text);
  if (!rows.length) throw new Error('CSV 为空');
  const headers = rows[0].map(h => String(h).trim());
  const idx = name => headers.indexOf(name);
  const idIdx = idx('id');
  const frontIdx = idx('front');
  const backIdx = idx('back');
  if (idIdx < 0 || frontIdx < 0 || backIdx < 0) {
    throw new Error('闪卡 CSV 表头须包含 id、front、back（建议同时包含 category、difficulty）');
  }
  const catIdx = idx('category');
  const diffIdx = idx('difficulty');
  const list = [];
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    if (!cells || !cells.some(c => String(c).trim())) continue;
    const id = cells[idIdx];
    if (!String(id || '').trim()) continue;
    const card = {
      id: String(id).trim(),
      front: String(cells[frontIdx] != null ? cells[frontIdx] : '').trim(),
      back: String(cells[backIdx] != null ? cells[backIdx] : '').trim()
    };
    if (catIdx >= 0 && cells[catIdx] != null && String(cells[catIdx]).trim()) {
      card.category = String(cells[catIdx]).trim();
    }
    if (diffIdx >= 0 && cells[diffIdx] != null && String(cells[diffIdx]).trim()) {
      const d = parseInt(String(cells[diffIdx]).trim(), 10);
      if (!Number.isNaN(d)) card.difficulty = d;
    }
    list.push(card);
  }
  if (!list.length) throw new Error('CSV 中未解析到有效闪卡行');
  return list;
}

function downloadPatientsCsvTemplate() {
  const example = {
    id: 'example_patient_01',
    name: '示例患者',
    age: 45,
    gender: '女',
    diagnosis: '2型糖尿病',
    medication: '二甲双胍',
    personality: '对 CGM 不了解，担心费用',
    pain_points: '扎手指麻烦|不了解餐后波动',
    resistance: '觉得贵|怕麻烦',
    recommended_cgm_count: 4,
    cgm_plan: '第1台了解波动 → 第2台评估用药 → 第3台饮食谱 → 第4台自我管理',
    conversion_keys: '减少扎手指|看趋势',
    system_prompt: '你扮演一位45岁女性患者。每次口语回复1-2句。\n\n【要求】照护师介绍双方案时你愿意先听生活方式建议。'
  };
  const csv = stringifyCsv(PATIENT_CSV_HEADERS, [example]);
  triggerDownload('patients-import-template.csv', csv, 'text/csv;charset=utf-8');
}

function downloadFlashcardsCsvTemplate() {
  const example = {
    id: 'example_01',
    category: '基础概念',
    difficulty: 1,
    front: '示例：CGM 与指尖血的核心区别？',
    back: '示例：CGM 关注趋势与波动；指尖血关注单次数值。两者用途不同。'
  };
  const csv = stringifyCsv(FLASHCARD_CSV_HEADERS, [example]);
  triggerDownload('flashcards-import-template.csv', csv, 'text/csv;charset=utf-8');
}

async function loadCatalogVersions() {
  const tbody = document.querySelector('#catalogVersionsTable tbody');
  if (!tbody) return;
  try {
    const data = await request('/knowledge/catalog/versions');
    const rows = data.versions || [];
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="4" style="color:#999;">暂无备份（在「保存到服务器」成功后会生成）</td></tr>';
      return;
    }
    tbody.innerHTML = rows
      .map(v => {
        const fn = JSON.stringify(v.filename);
        return `<tr>
        <td>${v.filename}</td>
        <td>${v.mtime}</td>
        <td>${v.size}</td>
        <td><button type="button" class="btn-secondary" onclick="restoreCatalogVersion(${fn})">还原</button></td>
      </tr>`;
      })
      .join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="4" style="color:#c00;">${e.message || '加载失败'}</td></tr>`;
  }
}

async function restoreCatalogVersion(filename) {
  if (!confirm('确认从该备份还原 catalog？当前文件会先备份再覆盖。')) return;
  try {
    await request('/knowledge/catalog/restore', {
      method: 'POST',
      body: JSON.stringify({ filename })
    });
    alert('已还原');
    await loadCatalog();
    await loadCatalogRaw();
    await loadCatalogVersions();
  } catch (e) {
    alert(e.message || '还原失败');
  }
}

async function uploadSubunitContentJson() {
  const subUnitId = document.getElementById('catalogUploadSubUnitId')?.value;
  const pf = document.getElementById('uploadPatientsFile')?.files[0];
  const pcsv = document.getElementById('uploadPatientsCsvFile')?.files[0];
  const kf = document.getElementById('uploadKnowledgeFile')?.files[0];
  if (!subUnitId) return alert('请选择知识子单元');
  if (pf && pcsv) return alert('患者数据请勿同时选择 patients.json 与 patients.csv');
  const body = { subUnitId };
  if (pf) {
    const t = await readFileAsText(pf);
    try {
      JSON.parse(t);
    } catch (e) {
      return alert('patients.json 不是合法 JSON：' + e.message);
    }
    body.patientsJson = t;
  }
  if (pcsv) {
    try {
      const arr = patientsCsvTextToJsonArray(await readFileAsText(pcsv));
      body.patientsJson = JSON.stringify(arr);
    } catch (e) {
      return alert('解析 patients.csv 失败：' + (e.message || String(e)));
    }
  }
  if (kf) body.knowledgeMarkdown = await readFileAsText(kf);
  if (body.patientsJson == null && body.knowledgeMarkdown == null) {
    return alert('请至少选择一个文件（患者 JSON/CSV 或 knowledge.md）');
  }
  try {
    await request('/knowledge/upload/subunit', {
      method: 'POST',
      body: JSON.stringify(body)
    });
    alert('已写入服务器 data 目录（旧文件已备份到 data/_content_backups）');
  } catch (e) {
    alert(e.message || '上传失败');
  }
}

async function uploadUnitFlashcardsJson() {
  const unitId = document.getElementById('catalogUploadUnitId')?.value;
  const ff = document.getElementById('uploadFlashcardsFile')?.files[0];
  const fcsv = document.getElementById('uploadFlashcardsCsvFile')?.files[0];
  if (!unitId) return alert('请选择知识单元');
  if (ff && fcsv) return alert('请勿同时选择 flashcards.json 与 flashcards.csv');
  if (!ff && !fcsv) return alert('请选择 flashcards.json 或 flashcards.csv');
  let flashcardsJson;
  try {
    if (ff) {
      flashcardsJson = await readFileAsText(ff);
    } else {
      const arr = flashcardsCsvTextToJsonArray(await readFileAsText(fcsv));
      flashcardsJson = JSON.stringify(arr);
    }
    JSON.parse(flashcardsJson);
  } catch (e) {
    return alert('读取或解析失败：' + (e.message || String(e)));
  }
  try {
    await request('/knowledge/upload/unit', {
      method: 'POST',
      body: JSON.stringify({ unitId, flashcardsJson })
    });
    alert('已写入（旧文件已备份）');
  } catch (e) {
    alert(e.message || '上传失败');
  }
}

function statsQueryString() {
  const u = document.getElementById('statsFilterUnit')?.value || '';
  const s = document.getElementById('statsFilterSubUnit')?.value || '';
  const qs = new URLSearchParams();
  if (u) qs.set('unit_id', u);
  if (s) qs.set('sub_unit_id', s);
  const q = qs.toString();
  return q ? `?${q}` : '';
}

async function loadStats() {
  allStats = await request('/exam/admin/all-stats' + statsQueryString());
  populateStatsFilters(allStats);
  filteredStats = [...allStats];
  renderStats(filteredStats);
}

async function refreshStatsFromServer() {
  await loadStats();
  await loadSummaryBySubunit();
}

function trimCell(s) {
  if (s == null) return '';
  return String(s).trim();
}

function filterStatsLocal() {
  const citySel = document.getElementById('statsFilterCity');
  const deptSel = document.getElementById('statsFilterDepartment');
  const voiceSel = document.getElementById('statsFilterVoicePassedCases');
  if (!citySel || !deptSel || !voiceSel) return;

  const city = trimCell(citySel.value);
  const department = trimCell(deptSel.value);
  const voicePassedCases = trimCell(voiceSel.value);

  filteredStats = allStats.filter(u => {
    if (city && trimCell(u.city) !== city) return false;
    if (department && trimCell(u.department) !== department) return false;
    if (voicePassedCases && String(u.voice_passed_cases) !== voicePassedCases) return false;
    return true;
  });

  renderStats(filteredStats);
}

async function loadSummaryBySubunit() {
  const tbody = document.querySelector('#summarySubunitTable tbody');
  if (!tbody) return;
  try {
    const rows = await request('/exam/admin/summary-by-subunit' + statsQueryString());
    if (!rows || rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#999;">暂无数据</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td>${r.sub_unit_name || r.sub_unit_id}</td>
        <td>${r.unit_id || '-'}</td>
        <td>${r.total}</td>
        <td>${r.passed}</td>
        <td>${r.pass_rate}%</td>
        <td>${r.avg_score}</td>
      </tr>
    `).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#c00;">${e.message}</td></tr>`;
  }
}

function renderStats(stats) {
  const tbody = document.querySelector('#statsTable tbody');
  if (!stats || stats.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #999;">暂无数据</td></tr>';
    return;
  }

  tbody.innerHTML = stats.map(u => `
    <tr>
      <td>${u.name}</td>
      <td>${u.city}</td>
      <td>${u.department}</td>
      <td>${u.total}</td>
      <td>${u.passed}</td>
      <td>${u.pass_rate}%</td>
      <td>${u.voice_passed_cases}/5</td>
    </tr>
  `).join('');
}

function populateStatsFilters(stats) {
  populateSelect('statsFilterCity', '全部城市', uniqueValues(stats.map(u => u.city)));
  populateSelect('statsFilterDepartment', '全部部门', uniqueValues(stats.map(u => u.department)));
  populateSelect('statsFilterVoicePassedCases', '全部语音通过案例数', uniqueValues(stats.map(u => String(u.voice_passed_cases))));
}

function recordsQueryString() {
  const u = document.getElementById('recordsFilterUnit')?.value || '';
  const s = document.getElementById('recordsFilterSubUnit')?.value || '';
  const qs = new URLSearchParams();
  if (u) qs.set('unit_id', u);
  if (s) qs.set('sub_unit_id', s);
  const q = qs.toString();
  return q ? `?${q}` : '';
}

async function loadRecords() {
  allRecords = await request('/exam/admin/all-records' + recordsQueryString());
  filteredRecords = [...allRecords];
  renderRecords(filteredRecords);
}

function renderRecords(records) {
  const tbody = document.querySelector('#recordsTable tbody');
  if (!records || records.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; color: #999;">暂无数据</td></tr>';
    return;
  }
  tbody.innerHTML = records.map(r => `
    <tr>
      <td>${r.user_name}</td>
      <td>${r.city}</td>
      <td>${r.department}</td>
      <td>${r.unit_id || '-'}</td>
      <td>${subunitLabel(r.sub_unit_id)}</td>
      <td>${r.patient_type}</td>
      <td>${r.exam_type === 'voice' ? '语音' : '文字'}</td>
      <td>${r.score}</td>
      <td><span class="badge ${r.passed ? 'pass' : 'fail'}">${r.passed ? '通过' : '未通过'}</span></td>
      <td>${new Date(r.created_at).toLocaleString('zh-CN')}</td>
    </tr>
  `).join('');
}

function subunitLabel(id) {
  const s = catalog.subunits.find(x => x.id === id);
  return s ? s.name : (id || '-');
}

function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });

  document.getElementById('statsTab').classList.add('hidden');
  document.getElementById('recordsTab').classList.add('hidden');
  document.getElementById('employeesTab').classList.add('hidden');
  document.getElementById('catalogTab').classList.add('hidden');

  if (tab === 'stats') {
    document.getElementById('statsTab').classList.remove('hidden');
  } else if (tab === 'records') {
    document.getElementById('recordsTab').classList.remove('hidden');
    loadRecords();
  } else if (tab === 'employees') {
    document.getElementById('employeesTab').classList.remove('hidden');
    loadEmployees();
  } else if (tab === 'catalog') {
    document.getElementById('catalogTab').classList.remove('hidden');
    loadCatalogRaw();
    loadCatalogVersions();
  }
}

function logout() {
  adminToken = '';
  localStorage.removeItem('adminToken');
  document.getElementById('loginBox').classList.remove('hidden');
  document.getElementById('mainContent').classList.add('hidden');
  document.getElementById('adminToken').value = '';
}

window.onload = () => {
  const savedBase = localStorage.getItem('adminApiBase');
  const baseInput = document.getElementById('adminApiBase');
  if (baseInput && savedBase) baseInput.value = savedBase;

  const saved = localStorage.getItem('adminToken');
  if (saved) {
    adminToken = saved;
    loadData();
  }
};

function applyFilters() {
  if (!allRecords || allRecords.length === 0) {
    alert('请先加载数据');
    return;
  }

  const name = document.getElementById('filterName').value.trim().toLowerCase();
  const patient = document.getElementById('filterPatient').value;
  const examType = document.getElementById('filterExamType').value;
  const minScore = document.getElementById('filterMinScore').value;
  const maxScore = document.getElementById('filterMaxScore').value;
  const startDate = document.getElementById('filterStartDate').value;
  const endDate = document.getElementById('filterEndDate').value;

  filteredRecords = allRecords.filter(r => {
    if (name && !r.user_name.toLowerCase().includes(name)) return false;
    if (patient && r.patient_type !== patient) return false;
    if (examType && r.exam_type !== examType) return false;
    if (minScore && r.score < Number(minScore)) return false;
    if (maxScore && r.score > Number(maxScore)) return false;
    if (startDate && new Date(r.created_at) < new Date(startDate)) return false;
    if (endDate && new Date(r.created_at) > new Date(endDate + 'T23:59:59')) return false;
    return true;
  });

  renderRecords(filteredRecords);
}

function resetFilters() {
  document.getElementById('filterName').value = '';
  document.getElementById('filterPatient').value = '';
  document.getElementById('filterExamType').value = '';
  document.getElementById('filterMinScore').value = '';
  document.getElementById('filterMaxScore').value = '';
  document.getElementById('filterStartDate').value = '';
  document.getElementById('filterEndDate').value = '';
  filteredRecords = [...allRecords];
  renderRecords(filteredRecords);
}

function downloadCSV() {
  const headers = ['姓名', '城市', '部门', '知识单元', '知识子单元', '患者类型', '考试类型', '分数', '是否通过', '考试时间'];
  const rows = filteredRecords.map(r => [
    r.user_name,
    r.city,
    r.department,
    r.unit_id || '',
    subunitLabel(r.sub_unit_id),
    r.patient_type,
    r.exam_type === 'voice' ? '语音' : '文字',
    r.score,
    r.passed ? '通过' : '未通过',
    new Date(r.created_at).toLocaleString('zh-CN')
  ]);

  downloadCsvFile(headers, rows, `考试记录_${new Date().toLocaleDateString('zh-CN')}.csv`);
}

async function resetStatsFilters() {
  document.getElementById('statsFilterCity').value = '';
  document.getElementById('statsFilterDepartment').value = '';
  document.getElementById('statsFilterVoicePassedCases').value = '';
  const u = document.getElementById('statsFilterUnit');
  const s = document.getElementById('statsFilterSubUnit');
  if (u) u.value = '';
  if (s) s.value = '';
  await loadStats();
  await loadSummaryBySubunit();
  filteredStats = [...allStats];
  renderStats(filteredStats);
}

function downloadStatsCSV() {
  const headers = ['姓名', '城市', '部门', '考试次数', '通过次数', '通过率', '语音通过案例数', '最近一次语音考试时间'];
  const rows = filteredStats.map(u => [
    u.name,
    u.city,
    u.department,
    u.total,
    u.passed,
    `${u.pass_rate}%`,
    `${u.voice_passed_cases}/5`,
    formatDateTime(u.latest_voice_exam_at)
  ]);

  downloadCsvFile(headers, rows, `用户统计_${new Date().toLocaleDateString('zh-CN')}.csv`);
}

function uniqueValues(values) {
  const norm = values.map(v => {
    if (v === undefined || v === null) return '';
    return String(v).trim();
  });
  return [...new Set(norm.filter(s => s !== '' && s !== '-'))].sort((a, b) => a.localeCompare(b, 'zh-CN'));
}

function populateSelect(selectId, placeholder, values) {
  const select = document.getElementById(selectId);
  if (!select) return;
  select.textContent = '';
  const ph = document.createElement('option');
  ph.value = '';
  ph.textContent = placeholder;
  select.appendChild(ph);
  for (const value of values) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = value;
    select.appendChild(opt);
  }
}

function formatDateTime(value) {
  return value ? new Date(value).toLocaleString('zh-CN') : '-';
}

function downloadCsvFile(headers, rows, filename) {
  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}

async function loadEmployees() {
  allEmployees = await request('/employees/admin/list');
  renderEmployees();
}

function renderEmployeeRoleOptions() {
  const sel = document.getElementById('empRole');
  if (!sel || !catalog.roles) return;
  sel.innerHTML = catalog.roles.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
}

function renderEmployeeSubunitChecks() {
  const box = document.getElementById('empSubunits');
  if (!box || !catalog.subunits) return;
  box.innerHTML = catalog.subunits.map(s => `
    <label style="display:block;margin:4px 0;">
      <input type="checkbox" value="${s.id}" class="emp-sub-cb"> ${s.name} <span style="color:#999;font-size:12px;">(${s.id})</span>
    </label>
  `).join('');
}

function renderEmployees() {
  const tbody = document.querySelector('#employeesTable tbody');
  if (!allEmployees.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#999;">暂无员工</td></tr>';
    return;
  }
  tbody.innerHTML = allEmployees.map(e => {
    const phoneEnc = encodeURIComponent(String(e.phone));
    return `
    <tr>
      <td>${e.name}</td>
      <td>${e.phone}</td>
      <td>${e.city || '-'}</td>
      <td>${e.department || '-'}</td>
      <td>${e.active ? '启用' : '停用'}</td>
      <td>${e.role_name || e.role_id}</td>
      <td><button type="button" class="btn-primary btn-edit-employee" style="padding:6px 12px;font-size:13px;" data-phone="${phoneEnc}">编辑</button></td>
    </tr>`;
  }).join('');
}

function openEmployeeEdit(phone) {
  const phoneStr = String(phone);
  renderEmployeeRoleOptions();
  renderEmployeeSubunitChecks();
  editingPhone = phoneStr;
  const e = allEmployees.find(x => String(x.phone) === phoneStr);
  if (!e) {
    alert('未找到该员工，请切换到其他标签页再回到「员工管理」以刷新列表。');
    return;
  }
  document.getElementById('empName').value = e.name;
  document.getElementById('empPhone').value = e.phone;
  document.getElementById('empCity').value = e.city || '';
  document.getElementById('empDept').value = e.department || '';
  document.getElementById('empActive').checked = !!e.active;
  document.getElementById('empRole').value = e.role_id || 'learner';
  const allowed = new Set((e.allowed_subunit_ids || []).map(String));
  document.querySelectorAll('.emp-sub-cb').forEach(cb => {
    cb.checked = allowed.has(String(cb.value));
  });
  const form = document.getElementById('employeeForm');
  form.classList.remove('hidden');
  form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

window.cancelEmployeeEdit = function () {
  editingPhone = null;
  document.getElementById('employeeForm').classList.add('hidden');
};

window.saveEmployee = async function () {
  if (!editingPhone) return;
  const allowed = [];
  document.querySelectorAll('.emp-sub-cb:checked').forEach(cb => allowed.push(cb.value));
  if (!allowed.length) {
    alert('请至少勾选一个知识子单元');
    return;
  }
  const body = {
    name: document.getElementById('empName').value.trim(),
    city: document.getElementById('empCity').value.trim(),
    department: document.getElementById('empDept').value.trim(),
    active: document.getElementById('empActive').checked,
    role_id: document.getElementById('empRole').value,
    allowed_subunit_ids: allowed
  };
  try {
    await request(`/employees/admin/${encodeURIComponent(editingPhone)}`, {
      method: 'PUT',
      body: JSON.stringify(body)
    });
    alert('已保存');
    cancelEmployeeEdit();
    await loadEmployees();
  } catch (err) {
    alert(err.message || '保存失败');
  }
};

window.login = login;
window.logout = logout;
window.switchTab = switchTab;
window.applyFilters = applyFilters;
window.resetFilters = resetFilters;
window.downloadCSV = downloadCSV;
window.refreshStatsFromServer = refreshStatsFromServer;
window.filterStatsLocal = filterStatsLocal;
window.resetStatsFilters = resetStatsFilters;
window.downloadStatsCSV = downloadStatsCSV;
window.loadRecords = loadRecords;
window.loadCatalogRaw = loadCatalogRaw;
window.saveCatalogJson = saveCatalogJson;
window.loadCatalogVersions = loadCatalogVersions;
window.restoreCatalogVersion = restoreCatalogVersion;
window.uploadSubunitContentJson = uploadSubunitContentJson;
window.uploadUnitFlashcardsJson = uploadUnitFlashcardsJson;
window.openCatalogUsageModal = openCatalogUsageModal;
window.closeCatalogUsageModal = closeCatalogUsageModal;
window.downloadPatientsCsvTemplate = downloadPatientsCsvTemplate;
window.downloadFlashcardsCsvTemplate = downloadFlashcardsCsvTemplate;
window.cancelEmployeeEdit = cancelEmployeeEdit;
window.saveEmployee = saveEmployee;
window.openEmployeeEdit = openEmployeeEdit;

(function bindEmployeesEditClicks() {
  const table = document.getElementById('employeesTable');
  if (!table) return;
  table.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button.btn-edit-employee');
    if (!btn) return;
    const raw = btn.getAttribute('data-phone');
    if (raw == null || raw === '') return;
    let decoded = raw;
    try {
      decoded = decodeURIComponent(raw);
    } catch (_) { /* 使用 raw */ }
    openEmployeeEdit(decoded);
  });
})();
