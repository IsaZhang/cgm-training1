const llm = require('./llm');
const fs = require('fs');
const path = require('path');

const knowledge = fs.readFileSync(path.join(__dirname, '../data/knowledge.md'), 'utf-8');

// 新的评分维度及权重
const SCORING_DIMENSIONS = [
  { key: 'need_discovery', name: '核心需求挖掘', weight: 30, desc: '是否主动挖掘出患者的核心需求（刚诊断、低血糖、饮食波动、作息不规律、扎手指烦恼、治疗方案调整、指标变化等）' },
  { key: 'wearing_plan', name: '佩戴方案合理性', weight: 25, desc: '是否给出合理的佩戴台数和每台的明确目的（第一台了解基础+排查低血糖、第二台观察药物饮食规律、最后一台培养自我管理）' },
  { key: 'professionalism', name: '专业度展示', weight: 30, desc: '是否配合医嘱不擅自调药（提到药物剂量直接0分）、是否个体化分析病情（糖化、低血糖等）、是否展现专业且有人情味' },
  { key: 'communication_efficiency', name: '沟通效率', weight: 15, desc: '逻辑是否清晰、是否一针见血、是否避免啰嗦和车轱辘话' }
];

const PASS_SCORE = 80;

async function scoreConversation(patientType, conversation) {
  const prompt = `你是一位CGM转化培训考官。请根据以下评分标准，对照护师与患者的对话进行严格评分。

## CGM知识参考
${knowledge}

## 患者类型
${patientType}

## 对话记录
${conversation.map(m => `${m.role === 'nurse' ? '照护师' : '患者'}: ${m.content}`).join('\n')}

## 评分维度（总分100分）

### 1. 核心需求挖掘（30分）
- 是否主动询问并挖掘出患者的核心需求？
- 核心需求包括：刚诊断不了解血糖、频繁低血糖、饮食波动大、作息不规律、经常出差、扎手指烦恼、医生刚调整治疗方案、化验指标变化等
- 患者通常不会主动说，需要照护师通过提问来挖掘
- 评分标准：
  * 30分：准确挖掘出2个以上核心需求，提问有针对性
  * 20-25分：挖掘出1个核心需求
  * 10-15分：有提问但未挖掘到核心需求
  * 0-5分：没有主动挖掘，只是被动回应

### 2. 佩戴方案合理性（25分）
- 是否给出了明确的佩戴台数建议？
- 是否说明了每一台的具体目的？
- 参考标准方案：
  * 第一台：了解基础血糖情况，排查夜间/无症状低血糖风险
  * 第二台：结合上一台数据和AGP报告观察，看药物是否需要调整，摸饮食规律（每个人代谢不同）
  * 最后一台：培养患者独立管理血糖的能力，能看懂趋势并调整
- 评分标准：
  * 25分：给出完整方案，每台目的清晰，逻辑合理
  * 15-20分：给出台数但目的不够清晰
  * 5-10分：只提到CGM但没有具体方案
  * 0分：完全没有提及佩戴方案

### 3. 专业度展示（30分）
- **一票否决项**：如果照护师提到任何药物剂量调整建议（如"您可以把胰岛素调到XX单位"），直接0分
- 是否强调配合医嘱，不擅自调药？
- 是否进行个体化分析（如针对糖化9.6%、频繁低血糖等具体情况分析）？
- 是否展现专业且有人情味的沟通？
- 评分标准：
  * 30分：强调配合医嘱，个体化分析到位，专业且有温度
  * 20-25分：有专业性但个体化分析不足
  * 10-15分：基本专业但缺乏深度
  * 0分：擅自提及药物剂量调整

### 4. 沟通效率（15分）
- 逻辑是否清晰？
- 是否一针见血，避免啰嗦？
- 是否有车轱辘话反复说？
- 评分标准：
  * 15分：逻辑清晰，简洁有力，一针见血
  * 10-12分：基本清晰但略有啰嗦
  * 5-8分：逻辑不够清晰或较啰嗦
  * 0-3分：混乱或严重啰嗦

## 输出要求
请严格按以下JSON格式返回评分结果，不要输出其他内容：
{
  "scores": {
    "need_discovery": { "score": 0, "max": 30, "comment": "具体扣分原因" },
    "wearing_plan": { "score": 0, "max": 25, "comment": "具体扣分原因" },
    "professionalism": { "score": 0, "max": 30, "comment": "具体扣分原因" },
    "communication_efficiency": { "score": 0, "max": 15, "comment": "具体扣分原因" }
  },
  "total": 0,
  "summary": "总体评价"
}`;

  const result = await llm.chat([{ role: 'user', content: prompt }]);

  try {
    const cleaned = result.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    parsed.passed = parsed.total >= PASS_SCORE;
    parsed.dimensions = SCORING_DIMENSIONS;
    return parsed;
  } catch {
    return { total: 0, passed: false, error: '评分解析失败', raw: result };
  }
}

module.exports = { scoreConversation, SCORING_DIMENSIONS, PASS_SCORE };
