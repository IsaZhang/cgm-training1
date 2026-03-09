# CGM 训练系统 - 数据统计使用指南

## 一、员工数据配置

### 1. 员工字段说明
每个员工记录包含以下字段：
```json
{
  "name": "张三",
  "phone": "13800000001",
  "city": "北京",           // 所属城市
  "department": "运营部",    // 所属部门
  "active": true            // 是否启用
}
```

### 2. 批量导入员工
使用 `/api/auth/employees/import` 接口：
```bash
curl -X POST http://localhost:3000/api/auth/employees/import \
  -H "Content-Type: application/json" \
  -H "x-admin-token: $ADMIN_TOKEN" \
  -d '{
    "employees": [
      {"name": "张三", "phone": "13800000001", "city": "北京", "department": "运营一部"},
      {"name": "李四", "phone": "13800000002", "city": "上海", "department": "运营二部"},
      {"name": "王五", "phone": "13800000003", "city": "广州", "department": "运营三部"}
    ]
  }'
```

## 二、统计接口

### 1. 全局统计概览
**接口**：`GET /api/stats/overview`

**返回数据**：
```json
{
  "total_employees": 100,    // 总员工数
  "total_users": 85,         // 已登录用户数
  "total_exams": 320,        // 总考核次数
  "total_passed": 256,       // 通过次数
  "avg_score": "82.50"       // 平均分
}
```

**使用示例**：
```bash
curl http://localhost:3000/api/stats/overview -H "x-admin-token: $ADMIN_TOKEN"
```

### 2. 按城市/部门统计
**接口**：`GET /api/stats/by-region`

**返回数据**：
```json
[
  {
    "city": "北京",
    "employee_count": 30,    // 该城市员工数
    "exam_count": 120,       // 考核次数
    "passed_count": 96,      // 通过次数
    "avg_score": "83.20"     // 平均分
  },
  {
    "city": "上海",
    "employee_count": 25,
    "exam_count": 100,
    "passed_count": 80,
    "avg_score": "81.50"
  }
]
```

**使用示例**：
```bash
curl http://localhost:3000/api/stats/by-region -H "x-admin-token: $ADMIN_TOKEN"
```

### 3. 导出 CSV 数据
**接口**：`GET /api/stats/export`

**返回**：CSV 文件，包含所有员工的详细统计

**字段**：
- 姓名
- 手机号
- 城市
- 部门
- 考核次数
- 通过次数
- 最高分
- 平均分
- 最近考核时间

**使用示例**：
```bash
# 下载到本地
curl http://localhost:3000/api/stats/export -H "x-admin-token: $ADMIN_TOKEN" -o stats.csv

# 在浏览器中直接访问
open "http://localhost:3000/api/stats/export?admin_token=$ADMIN_TOKEN"
```

### 4. 详细考核记录
**接口**：`GET /api/stats/exam-details`

**返回数据**：所有考核记录的详细信息
```json
[
  {
    "name": "张三",
    "phone": "13800000001",
    "city": "北京",
    "department": "运营一部",
    "patient_type": "新诊断年轻患者",
    "score": 85,
    "passed": true,
    "created_at": "2026-03-03T10:30:00.000Z",
    "deductions": {
      "need_discovery": { "score": 25, "max": 30, "comment": "..." },
      "wearing_plan": { "score": 20, "max": 25, "comment": "..." },
      "professionalism": { "score": 28, "max": 30, "comment": "..." },
      "communication_efficiency": { "score": 12, "max": 15, "comment": "..." }
    }
  }
]
```

**使用示例**：
```bash
curl http://localhost:3000/api/stats/exam-details -H "x-admin-token: $ADMIN_TOKEN"
```

## 三、数据分析场景

### 场景1：对比不同城市的培训效果
```bash
curl http://localhost:3000/api/stats/by-region -H "x-admin-token: $ADMIN_TOKEN" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for city in sorted(data, key=lambda x: float(x['avg_score']), reverse=True):
    print(f\"{city['city']}: 平均分 {city['avg_score']}, 通过率 {city['passed_count']}/{city['exam_count']}\")"
```

### 场景2：找出需要重点培训的员工
```bash
curl http://localhost:3000/api/stats/export -H "x-admin-token: $ADMIN_TOKEN" -o stats.csv
# 用 Excel 打开 stats.csv，按平均分排序，找出低分员工
```

### 场景3：分析各维度得分情况
```bash
curl http://localhost:3000/api/stats/exam-details -H "x-admin-token: $ADMIN_TOKEN" | python3 -c "
import sys, json
data = json.load(sys.stdin)
# 统计各维度平均分
dimensions = {}
for record in data:
    for key, val in record['deductions'].items():
        if key not in dimensions:
            dimensions[key] = []
        dimensions[key].append(val['score'] / val['max'] * 100)

for dim, scores in dimensions.items():
    avg = sum(scores) / len(scores)
    print(f\"{dim}: {avg:.2f}%\")"
```

## 四、部署到云端后的使用

部署到微信云托管后，将 `http://localhost:3000` 替换为你的云托管地址：

```bash
# 例如
curl https://cgm-training-api-xxx.ap-shanghai.run.tcb.qq.com/api/stats/overview
```

## 五、注意事项

1. **数据隐私**：统计/员工导入接口需要管理员口令（请求头 `x-admin-token`），请妥善保管 `ADMIN_TOKEN`
2. **数据备份**：定期导出 CSV 数据进行备份
3. **城市/部门字段**：导入员工时务必填写完整，否则统计时会显示"未知"
