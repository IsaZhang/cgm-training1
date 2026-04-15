const llm = require('./llm');
const kc = require('./knowledgeCatalog');

const PASS_SCORE_FALLBACK = 80;

/**
 * cgm_v1：沿用既有四维提示词结构（内容来自知识库文件，标签来自 catalog）
 */
function buildCgmV1Prompt(knowledge, patientType, conversation, meta) {
  const kt = meta.knowledgeSectionTitle || 'CGM知识参考';
  const examiner = meta.examinerLabel || 'CGM转化培训考官';
  return `你是一位${examiner}。请根据以下评分标准，对照护师与患者的对话进行严格评分。

## ${kt}
${knowledge}

## 患者类型
${patientType}

## 对话记录
${conversation.map(m => `${m.role === 'nurse' ? '照护师' : '患者'}: ${m.content}`).join('\n')}

## 核心评分原则
**重要：如果患者在对话中明确表示同意购买/佩戴CGM，或被照护师说服认同了CGM方案，则该照护师已完成销售转化，基础分为80分（及格），最终得分在80-100分之间，取决于以下质量因素。**

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
  "convinced": true/false,
  "scores": {
    "need_discovery": { "score": 0, "max": 30, "comment": "具体扣分原因" },
    "wearing_plan": { "score": 0, "max": 25, "comment": "具体扣分原因" },
    "professionalism": { "score": 0, "max": 30, "comment": "具体扣分原因" },
    "communication_efficiency": { "score": 0, "max": 15, "comment": "具体扣分原因" }
  },
  "total": 0,
  "summary": "总体评价"
}

**convinced字段说明：如果患者明确同意购买/佩戴CGM或被说服认同方案，则为true；否则为false。**`;
}

/**
 * cgm_agp_v1：AGP/图谱解读场景 — 评照护师能否结合知识库解释图谱、关联临床、守住安全边界
 */
function buildCgmAgpV1Prompt(knowledge, patientType, conversation, meta) {
  const kt = meta.knowledgeSectionTitle || 'AGP与图谱解读参考';
  const examiner = meta.examinerLabel || 'CGM图谱解读培训考官';
  return `你是一位${examiner}。照护师正在与患者对话，帮助其理解AGP/CGM报告。请严格按下列标准评分。

## ${kt}
${knowledge}

## 患者/场景
${patientType}

## 对话记录
${conversation.map(m => `${m.role === 'nurse' ? '照护师' : '患者'}: ${m.content}`).join('\n')}

## 核心原则
若照护师能结合患者具体情况，说清图谱关键要素（趋势、TIR/TAR/TBR、夜间风险等），并给出**个体化**的下一步建议（生活方式、何时就医），且**不擅自给出具体药物剂量调整**，则视为完成有效患教，总分应在80分以上；质量越高分数越高。

**一票否决**：照护师给出具体胰岛素/口服药剂量调整数值（如「把甘精改成XX单位」），professionalism 维度记0分且总分不超过60。

## 评分维度（总分100）

### 1. 读图与要素识别（30分）
是否准确指向AGP中的关键要素：中位线、四分位带、TIR/TAR/TBR、夜间与日间差异等。

### 2. 指标与临床关联（25分）
能否把图谱特征与患者用药、症状、风险（尤其低血糖）联系起来，避免只背定义。

### 3. 安全边界与患教（30分）
是否强调遵医嘱、建议就医评估调药而非代医调药；是否给出可执行的非药物建议。

### 4. 沟通条理性（15分）
是否先了解患者困惑再解释，语言是否通俗、有层次。

## 输出要求
请严格按以下JSON格式返回，不要输出其他内容：
{
  "convinced": true/false,
  "scores": {
    "graph_literacy": { "score": 0, "max": 30, "comment": "" },
    "clinical_link": { "score": 0, "max": 25, "comment": "" },
    "safety_education": { "score": 0, "max": 30, "comment": "" },
    "communication_efficiency": { "score": 0, "max": 15, "comment": "" }
  },
  "total": 0,
  "summary": "总体评价"
}

**convinced**：若患者明确表示「听懂了」「知道下一步怎么办」或愿意按建议记录/就医，则为true；若仍完全困惑且无实质帮助则为false。`;
}

async function scoreConversation(patientType, conversation, subUnitId = kc.DEFAULT_SUB_UNIT_ID) {
  const knowledge = kc.loadKnowledgeTextForSubUnit(subUnitId);
  const meta = kc.getScoringMeta(subUnitId);
  const passScore = meta.passScore != null ? meta.passScore : PASS_SCORE_FALLBACK;
  const profile = meta.promptProfile || 'cgm_v1';

  let prompt;
  if (profile === 'cgm_v1') {
    prompt = buildCgmV1Prompt(knowledge, patientType, conversation, meta);
  } else if (profile === 'cgm_agp_v1') {
    prompt = buildCgmAgpV1Prompt(knowledge, patientType, conversation, meta);
  } else {
    return {
      total: 0,
      passed: false,
      error: `暂不支持的评分模板: ${profile}`,
      dimensions: kc.getUiConfig(subUnitId).historyDetailDimensions || []
    };
  }

  const result = await llm.chat([{ role: 'user', content: prompt }]);

  try {
    const cleaned = result.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    if (parsed.convinced && parsed.total < passScore) {
      parsed.total = passScore;
    }

    parsed.passed = parsed.total >= passScore;
    const dimDisplay = kc.getUiConfig(subUnitId).historyDetailDimensions;
    parsed.dimensions = dimDisplay && dimDisplay.length
      ? dimDisplay
      : [
          { key: 'need_discovery', name: '核心需求挖掘' },
          { key: 'wearing_plan', name: '佩戴方案合理性' },
          { key: 'professionalism', name: '专业度展示' },
          { key: 'communication_efficiency', name: '沟通效率' }
        ];
    parsed.sub_unit_id = subUnitId;
    parsed.unit_id = kc.getSubUnit(subUnitId)?.unitId;
    return parsed;
  } catch {
    return { total: 0, passed: false, error: '评分解析失败', raw: result, dimensions: [] };
  }
}

/** @deprecated 兼容旧引用 */
const SCORING_DIMENSIONS = [
  { key: 'need_discovery', name: '核心需求挖掘', weight: 30 },
  { key: 'wearing_plan', name: '佩戴方案合理性', weight: 25 },
  { key: 'professionalism', name: '专业度展示', weight: 30 },
  { key: 'communication_efficiency', name: '沟通效率', weight: 15 }
];

const PASS_SCORE = 80;

module.exports = { scoreConversation, SCORING_DIMENSIONS, PASS_SCORE };
