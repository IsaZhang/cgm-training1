require('dotenv').config();
const db = require('./db');

// 初始员工数据
const employees = [
  { name: '测试员工', phone: '13800000001', active: true }
  // 在这里添加更多员工
  // { name: '张三', phone: '13800000002', active: true },
  // { name: '李四', phone: '13800000003', active: true },
];

async function initEmployees() {
  console.log('开始导入员工数据...');
  console.log('使用本地存储: store/employees.json');

  for (const emp of employees) {
    try {
      const exists = await db.find('employees', e => e.phone === emp.phone);
      if (exists) {
        console.log(`员工 ${emp.name} (${emp.phone}) 已存在，跳过`);
      } else {
        await db.insert('employees', emp);
        console.log(`✓ 导入员工: ${emp.name} (${emp.phone})`);
      }
    } catch (e) {
      console.error(`✗ 导入失败: ${emp.name}`, e.message);
    }
  }

  console.log('导入完成！');
}

initEmployees().catch(console.error);
