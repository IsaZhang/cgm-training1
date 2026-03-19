const API_BASE = 'https://ai-cgm.phrones.com/api';
let adminToken = '';
let allStats = [];
let filteredStats = [];
let allRecords = [];
let filteredRecords = [];

async function request(url, options = {}) {
  const res = await fetch(API_BASE + url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-admin-token': adminToken,
      ...options.headers
    }
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || '请求失败');
  }
  return res.json();
}

function login() {
  const token = document.getElementById('adminToken').value.trim();
  if (!token) return alert('请输入管理员密码');

  adminToken = token;
  localStorage.setItem('adminToken', token);

  loadData();
}

async function loadData() {
  try {
    await loadStats();
    document.getElementById('loginBox').classList.add('hidden');
    document.getElementById('mainContent').classList.remove('hidden');
  } catch (e) {
    alert('登录失败：' + e.message);
    adminToken = '';
    localStorage.removeItem('adminToken');
  }
}

async function loadStats() {
  allStats = await request('/exam/admin/all-stats');
  populateStatsFilters(allStats);
  filteredStats = [...allStats];
  renderStats(filteredStats);
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

async function loadRecords() {
  allRecords = await request('/exam/admin/all-records');
  filteredRecords = [...allRecords];
  renderRecords(filteredRecords);
}

function renderRecords(records) {
  const tbody = document.querySelector('#recordsTable tbody');
  if (!records || records.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: #999;">暂无数据</td></tr>';
    return;
  }
  tbody.innerHTML = records.map(r => `
    <tr>
      <td>${r.user_name}</td>
      <td>${r.city}</td>
      <td>${r.department}</td>
      <td>${r.patient_type}</td>
      <td>${r.exam_type === 'voice' ? '语音' : '文字'}</td>
      <td>${r.score}</td>
      <td><span class="badge ${r.passed ? 'pass' : 'fail'}">${r.passed ? '通过' : '未通过'}</span></td>
      <td>${new Date(r.created_at).toLocaleString('zh-CN')}</td>
    </tr>
  `).join('');
}

function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  event.target.classList.add('active');

  if (tab === 'stats') {
    document.getElementById('statsTab').classList.remove('hidden');
    document.getElementById('recordsTab').classList.add('hidden');
  } else {
    document.getElementById('statsTab').classList.add('hidden');
    document.getElementById('recordsTab').classList.remove('hidden');
    loadRecords();
  }
}

function logout() {
  adminToken = '';
  localStorage.removeItem('adminToken');
  document.getElementById('loginBox').classList.remove('hidden');
  document.getElementById('mainContent').classList.add('hidden');
  document.getElementById('adminToken').value = '';
}

// 自动登录
window.onload = () => {
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
  const headers = ['姓名', '城市', '部门', '患者类型', '考试类型', '分数', '是否通过', '考试时间'];
  const rows = filteredRecords.map(r => [
    r.user_name,
    r.city,
    r.department,
    r.patient_type,
    r.exam_type === 'voice' ? '语音' : '文字',
    r.score,
    r.passed ? '通过' : '未通过',
    new Date(r.created_at).toLocaleString('zh-CN')
  ]);

  downloadCsvFile(headers, rows, `考试记录_${new Date().toLocaleDateString('zh-CN')}.csv`);
}

function applyStatsFilters() {
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

function resetStatsFilters() {
  document.getElementById('statsFilterCity').value = '';
  document.getElementById('statsFilterDepartment').value = '';
  document.getElementById('statsFilterVoicePassedCases').value = '';
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
