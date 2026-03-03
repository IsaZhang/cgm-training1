require('dotenv').config();
const cloudbase = require('@cloudbase/node-sdk');

const app = cloudbase.init({
  env: process.env.TCB_ENV
});

const db = app.database();

// 初始员工数据
const employees = [
  { name: '测试员工', phone: '13800000001', active: true }
  // 在这里添加更多员工
  // { name: '张三', phone: '13800000002', active: true },
  // { name: '李四', phone: '13800000003', active: true },
];

async function initEmployees() {
  console.log('开始导入员工数据...');
  console.log('环境ID:', process.env.TCB_ENV);

  const collection = db.collection('employees');

  for (const emp of employees) {
    try {
      // 检查是否已存在
      const { data } = await collection.where({ phone: emp.phone }).get();
      if (data.length > 0) {
        console.log(`员工 ${emp.name} (${emp.phone}) 已存在，跳过`);
      } else {
        await collection.add(emp);
        console.log(`✓ 导入员工: ${emp.name} (${emp.phone})`);
      }
    } catch (e) {
      console.error(`✗ 导入失败: ${emp.name}`, e.message);
    }
  }

  console.log('导入完成！');
}

initEmployees().catch(console.error);
