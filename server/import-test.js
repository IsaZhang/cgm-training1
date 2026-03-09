const http = require('http');

const data = JSON.stringify({
  employees: [
    { name: "测试员工", phone: "13800000001" }
  ]
});

const req = http.request({
  hostname: 'localhost', port: 3000,
  path: '/api/auth/employees/import',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    ...(process.env.ADMIN_TOKEN ? { 'x-admin-token': process.env.ADMIN_TOKEN } : {})
  }
}, (res) => {
  let body = '';
  res.on('data', c => body += c);
  res.on('end', () => console.log('结果:', body));
});

req.write(data);
req.end();
