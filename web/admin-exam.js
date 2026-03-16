const API_BASE = 'https://ai-cgm.phrones.com/api';
let adminToken = '';
let allRecords = [];

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
  const data = await request('/exam/admin/all-stats');
  const tbody = document.querySelector('#statsTable tbody');
  tbody.innerHTML = data.map(u => `
    <tr>
      <td>${u.name}</td>
      <td>${u.phone}</td>
      <td>${u.total}</td>
      <td>${u.passed}</td>
      <td>${u.pass_rate}%</td>
      <td>${u.avg_score}</td>
    </tr>
  `).join('');
}

async function loadRecords() {
  allRecords = await request('/exam/admin/all-records');
  renderRecords(allRecords);
}

function renderRecords(records) {
  const tbody = document.querySelector('#recordsTable tbody');
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
  const name = document.getElementById('filterName').value.trim().toLowerCase();
  const patient = document.getElementById('filterPatient').value;
  const examType = document.getElementById('filterExamType').value;
  const minScore = document.getElementById('filterMinScore').value;
  const maxScore = document.getElementById('filterMaxScore').value;
  const startDate = document.getElementById('filterStartDate').value;
  const endDate = document.getElementById('filterEndDate').value;

  const filtered = allRecords.filter(r => {
    if (name && !r.user_name.toLowerCase().includes(name)) return false;
    if (patient && r.patient_type !== patient) return false;
    if (examType && r.exam_type !== examType) return false;
    if (minScore && r.score < Number(minScore)) return false;
    if (maxScore && r.score > Number(maxScore)) return false;
    if (startDate && new Date(r.created_at) < new Date(startDate)) return false;
    if (endDate && new Date(r.created_at) > new Date(endDate + 'T23:59:59')) return false;
    return true;
  });

  renderRecords(filtered);
}

function resetFilters() {
  document.getElementById('filterName').value = '';
  document.getElementById('filterPatient').value = '';
  document.getElementById('filterExamType').value = '';
  document.getElementById('filterMinScore').value = '';
  document.getElementById('filterMaxScore').value = '';
  document.getElementById('filterStartDate').value = '';
  document.getElementById('filterEndDate').value = '';
  renderRecords(allRecords);
}

function downloadCSV() {
  const headers = ['姓名', '城市', '部门', '患者类型', '考试类型', '分数', '是否通过', '考试时间'];
  const rows = allRecords.map(r => [
    r.user_name,
    r.city,
    r.department,
    r.patient_type,
    r.exam_type === 'voice' ? '语音' : '文字',
    r.score,
    r.passed ? '通过' : '未通过',
    new Date(r.created_at).toLocaleString('zh-CN')
  ]);

  const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `考试记录_${new Date().toLocaleDateString('zh-CN')}.csv`;
  link.click();
}
