const API_BASE = 'https://ai-cgm.phrones.com/api';
let adminToken = '';

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
  const data = await request('/exam/admin/all-records');
  const tbody = document.querySelector('#recordsTable tbody');
  tbody.innerHTML = data.map(r => `
    <tr>
      <td>${r.user_name}</td>
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
