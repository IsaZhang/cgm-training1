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
  const kf = document.getElementById('uploadKnowledgeFile')?.files[0];
  if (!subUnitId) return alert('请选择知识子单元');
  const body = { subUnitId };
  if (pf) body.patientsJson = await readFileAsText(pf);
  if (kf) body.knowledgeMarkdown = await readFileAsText(kf);
  if (body.patientsJson == null && body.knowledgeMarkdown == null) {
    return alert('请至少选择一个文件');
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
  if (!unitId || !ff) return alert('请选择知识单元与 flashcards.json');
  try {
    const flashcardsJson = await readFileAsText(ff);
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

function filterStatsLocal() {
  const city = document.getElementById('statsFilterCity').value;
  const department = document.getElementById('statsFilterDepartment').value;
  const voicePassedCases = document.getElementById('statsFilterVoicePassedCases').value;

  filteredStats = allStats.filter(u => {
    if (city && u.city !== city) return false;
    if (department && u.department !== department) return false;
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
  return [...new Set(values.filter(value => value && value !== '-'))].sort((a, b) => a.localeCompare(b, 'zh-CN'));
}

function populateSelect(selectId, placeholder, values) {
  const select = document.getElementById(selectId);
  select.innerHTML = `<option value="">${placeholder}</option>` + values.map(value => (
    `<option value="${value}">${value}</option>`
  )).join('');
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
  tbody.innerHTML = allEmployees.map(e => `
    <tr>
      <td>${e.name}</td>
      <td>${e.phone}</td>
      <td>${e.city || '-'}</td>
      <td>${e.department || '-'}</td>
      <td>${e.active ? '启用' : '停用'}</td>
      <td>${e.role_name || e.role_id}</td>
      <td><button class="btn-primary" style="padding:6px 12px;font-size:13px;" onclick="openEmployeeEdit('${e.phone}')">编辑</button></td>
    </tr>
  `).join('');
}

window.openEmployeeEdit = function (phone) {
  editingPhone = phone;
  const e = allEmployees.find(x => x.phone === phone);
  if (!e) return;
  document.getElementById('empName').value = e.name;
  document.getElementById('empPhone').value = e.phone;
  document.getElementById('empCity').value = e.city || '';
  document.getElementById('empDept').value = e.department || '';
  document.getElementById('empActive').checked = !!e.active;
  document.getElementById('empRole').value = e.role_id || 'learner';
  document.querySelectorAll('.emp-sub-cb').forEach(cb => {
    cb.checked = (e.allowed_subunit_ids || []).includes(cb.value);
  });
  document.getElementById('employeeForm').classList.remove('hidden');
};

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
window.cancelEmployeeEdit = cancelEmployeeEdit;
window.saveEmployee = saveEmployee;
