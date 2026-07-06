const llm = require('./llm');
const kc = require('./knowledgeCatalog');

const PASS_SCORE_FALLBACK = 80;

/**
 * 全局红线检测块：附加到所有评分提示词末尾。
 * 被考核者触碰任一红线 → 该次考核直接判不合格（在 scoreConversation 中强制 passed=false）。
 */
const RED_LINE_BLOCK = `## 红线检测（最高优先级，独立于上面的评分）
请额外审查【被考核者】在对话/作答中是否**触碰、或明确表示自己会做**以下任一红线行为：
1. 擅自调药：建议或给出药物调整（加减剂量、换药、停药、调整用药方案等）。照护师只能调整生活方式（饮食、运动、正确的用药方法），调药是医生的处方权。
2. 用患者口述数据代替当场测量：体重、血压、腰围、臀围等关键指标必须当场测量；患者说"我报个数你记一下"时也不能直接记录，应坚持测量。
3. 数据造假：任何伪造数据行为，例如未亲眼在门诊见到患者就为其签到。
4. 泄露患者隐私：如在大群/公开场合发送患者姓名、身份证号、手机号、医保卡号等。

请在返回的 JSON 中**额外增加** red_line 字段：
"red_line": { "violated": true/false, "type": "调药|口述代测量|数据造假|泄露隐私|无", "evidence": "触碰的原话或概括；未触碰则留空" }
**只要触碰任一红线，无论其他维度得分多少，该次考核都判为不合格。**`;

/**
 * cgm_v1：转化过程质检框架（质量部点评 prompt）。
 * 只评价「转化过程」，不评价医学知识是否完整，也不把健康教育本身等同于转化有效。
 * 仍输出 0-100 数字分与五维评分（兼容成绩页/历史/后台统计），并附带定性结论。
 */
function buildCgmV1Prompt(knowledge, patientType, conversation, meta) {
  const kt = meta.knowledgeSectionTitle || 'CGM知识参考';
  return `你是一名糖尿病慢病管理转化质检专家。请只评价「转化过程」，不要评价医学知识是否完整，也不要把健康教育本身等同于转化有效。

重要前提：
本次评价不是判断照护师是否"卖产品"，也不是把 CGM 当成唯一转化目标。正确的转化逻辑应是：
患者疾病风险/血糖问题 → 为什么必须管好血糖 → 当前管理缺口是什么 → 应该采用什么管理方案 → CGM/动态血糖是否作为监测工具被合理引入 → 是否建立连续管理周期 → 是否形成明确下一步动作。
请判断照护师是否先建立"血糖管理必要性"，再引入 CGM 等工具。不要把单纯介绍 CGM 功能、APP 流程或耗材价格等同于有效转化。

## ${kt}（仅作背景参考，不要据此评价医学知识完整性）
${knowledge}

## 患者/场景
${patientType}

## 对话记录
${conversation.map(m => `${m.role === 'nurse' ? '照护师' : '患者'}: ${m.content}`).join('\n')}

## 重点判断维度（用于打分与定性）
1. 转化切入节奏：识别到管理风险后是否及时切入"为什么需要系统管理血糖"。长时间停留在检查安排、病史采集、健康教育、用药解释、APP 流程而没把风险转化为管理需求 → 转化切入慢。
2. 转化主线意识：是否有清晰主线（风险/痛点→管理必要性→管理缺口→管理方案→CGM 作为监测工具→连续管理周期→顾虑处理→明确下一步）。只是信息采集/科普/服务介绍/流程办理堆叠 → 缺少转化主线。
3. 管理必要性建立：是否让患者意识到"为什么必须管好血糖"（把血糖波动、夜间低血糖、餐后高血糖、糖化高、监测少、复查不规律、担心并发症等转化为必要性）。只说"要管理/要控制"而没说明为什么这个患者现在必须系统管理 → 管理必要性建立不足。
4. 痛点提炼能力：是否把患者信息提炼成转化痛点（如血糖忽高忽低→需持续监测；夜间低血糖→需连续监测；测得少→数据不足；担心并发症→需稳定控糖；复诊不规律→需持续记录；觉得麻烦/费用→决策障碍）。只是听到却没提炼 → 痛点提炼不足。
5. 健康教育匹配度：是否针对患者本人（复述确认、基于其情况给建议、追问背后顾虑、连接到管理方案）。讲很多知识却不紧扣患者信息 → 科普过长/健康教育泛化。
6. CGM 工具价值连接：CGM 是监测工具而非最终目标。是否在管理必要性成立后说明 CGM 为何适合该患者（夜间低血糖→发现夜间风险；餐后高→观察餐后波动；波动大→看全天趋势；测得少→补足数据；调药→提供趋势依据）。只介绍功能/价格/佩戴 → CGM 工具价值连接弱。
7. 多台转化意识：是否讲清为何需要连续佩戴多台完成一个管理周期（第一台观察真实波动→第二台调整后继续观察→后续验证调整是否有效）。只说"先戴一台看看/先试15天/一台能戴15天" → 多台转化意识不足。
8. 方案收口能力：是否讲清核心管理问题、先做什么、为何适合、为何需连续周期、有顾虑时的最低门槛方案、下一步何时跟进。都提到却无优先级 → 方案收口不足。
9. 决策障碍识别与处理：患者说"多少钱/太麻烦/回去问问/先研究/下次再说/先自己试试"都属决策障碍。未追问原因、未降低门槛、未给替代方案、未约定下一步 → 决策障碍识别不足/异议处理不足/成交推进弱。

## 判断注意事项
- 不要因为照护师讲了很多饮食/运动/用药知识就判断转化好。
- 健康教育很长但没服务于管理必要性或转化目标 → 科普过长/健康教育泛化。
- 听到风险却没提炼成管理需求 → 痛点提炼不足。
- CGM 只被讲成功能/耗材/价格而没连接患者痛点 → CGM 工具价值连接弱。
- 只说"先戴一台/短期试一下/一台15天"而没讲清连续多台完成观察—调整—验证 → 多台转化意识不足。
- 患者已说出费用/麻烦/回去问家人/先研究/下次再说等犹豫却没收口 → 决策障碍识别不足/成交推进弱。
- 现场被打断不应成为主要免责理由；评价基于转化过程而非医学指导质量。

## 评分维度（总分100分，分数与定性必须自洽）
### 1. 转化切入与主线（conversion_mainline，25分）
对应重点维度 1、2。切入及时且主线清晰=22-25；主线基本成立但偏慢或不够有力=15-21；信息/科普堆叠、缺少主线=6-14；几乎无转化意识=0-5。

### 2. 管理必要性与痛点提炼（need_necessity，25分）
对应重点维度 3、4、5。让患者明确"为什么必须管"并把痛点提炼到位=22-25；建立了部分必要性/提炼不全=15-21；只泛泛说要管理、科普泛化=6-14；几乎没有=0-5。

### 3. CGM 工具价值连接（cgm_value_link，20分）
对应重点维度 6。在必要性成立后把 CGM 价值连接到患者具体痛点=17-20；有连接但偏弱=11-16；只介绍功能/价格/佩戴=4-10；未引入或不合理=0-3。

### 4. 多台连续管理周期（multi_device_cycle，15分）
对应重点维度 7。讲清多台完成观察—调整—验证的管理周期=13-15；提到多台但周期价值不清=8-12；只讲单台/短期试戴=3-7；未提=0-2。

### 5. 方案收口与决策障碍处理（closing_objection，15分）
对应重点维度 8、9。收口清晰且有效处理犹豫并约定下一步=13-15；收口或异议处理之一不足=8-12；明显犹豫未处理/无下一步=3-7；完全未收口=0-2。

## 评级规则（conversion_rating）
- 正常：较早识别风险、建立管理必要性、把 CGM 作为监测工具自然引入、讲清多台连续管理周期价值、处理主要顾虑并形成明确下一步。对应 total≥80。
- 待优化：有一定转化意识，但切入偏慢/痛点提炼不够/CGM 价值连接不强/多台周期讲不清/收口或异议处理不足；仍能看到基本主线。对应 total 60-79。
- 严重待优化：没有形成有效转化主线（长时间科普或信息采集、未建立管理必要性、只介绍 CGM/APP/流程/价格、只讲单台短期、犹豫未处理、无明确下一步）。对应 total<60。

## 倾听匹配度（listening_score）
2=高匹配（充分复述确认患者信息并据此推进）；1=部分匹配；0=低匹配（基本忽略患者表达）。

## 输出要求
请严格按以下 JSON 返回，不要输出其他内容。total 必须等于五个维度分之和，且与 conversion_rating 的分数区间自洽：
{
  "convinced": true/false,
  "conversion_rating": "正常" | "待优化" | "严重待优化",
  "scores": {
    "conversion_mainline": { "score": 0, "max": 25, "comment": "判断依据" },
    "need_necessity": { "score": 0, "max": 25, "comment": "判断依据" },
    "cgm_value_link": { "score": 0, "max": 20, "comment": "判断依据" },
    "multi_device_cycle": { "score": 0, "max": 15, "comment": "判断依据" },
    "closing_objection": { "score": 0, "max": 15, "comment": "判断依据" }
  },
  "total": 0,
  "listening_score": 0,
  "problem_tags": ["从以下选择，可多选：转化切入慢/缺少转化主线/管理必要性建立不足/痛点提炼不足/健康教育泛化/科普过长/CGM工具价值连接弱/多台转化意识不足/方案收口不足/决策障碍识别不足/异议处理不足/成交推进弱/下一步动作不明确/患者意向确认不足/暂无明显问题"],
  "root_problem": "用1-2句话指出最核心问题",
  "mainlines": {
    "necessity": { "level": "清晰|部分清晰|不清晰|未出现", "basis": "判断依据" },
    "cgm": { "level": "合理|偏弱|不合理|未引入", "basis": "判断依据" },
    "multi_device": { "level": "清晰|部分清晰|不清晰|未出现", "basis": "判断依据" },
    "online_mgmt": { "level": "清晰|部分清晰|不清晰|未出现", "basis": "判断依据" },
    "followup": { "level": "清晰|部分清晰|不清晰|未出现", "basis": "判断依据" },
    "other": { "basis": "其他转化主线，无则留空" }
  },
  "key_evidence": "引用或概括对话中最能证明判断的关键片段：患者暴露的痛点/顾虑、照护师如何回应、为何形成或没形成有效转化、CGM 是否作为管理工具合理引入、多台必要性是否讲清",
  "suggested_actions": "可执行改进建议：何时切入管理必要性、如何提炼痛点、如何连接 CGM 工具价值、如何讲清多台连续管理周期、如何处理犹豫并收口下一步",
  "summary": "分析结论，3-5句，覆盖切入是否及时、是否先建立管理必要性、是否有清晰主线、健康教育是否针对患者、CGM 是否作为工具自然引入、是否建立多台连续管理周期、是否处理决策障碍"
}

**convinced**：若患者明确同意购买/佩戴 CGM 或被说服认同方案则为 true，否则 false（仅作记录，不影响是否及格）。

${RED_LINE_BLOCK}`;
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

**convinced**：若患者明确表示「听懂了」「知道下一步怎么办」或愿意按建议记录/就医，则为true；若仍完全困惑且无实质帮助则为false。

${RED_LINE_BLOCK}`;
}

/**
 * core_concept_v1：核心理念与认知考核。考核员工对使命/愿景/价值观/核心模式/0-1/三梯队/包产到护的理解与践行。
 * 合格规则：基本答出 = 80（合格）；深入理解 / 践行故事讲透才往 100 加分。仍输出 0-100 数字分（兼容统计）。
 * 对话中 role=nurse 为「被考核员工」，role=patient 为「考官」。
 */
function buildCoreConceptV1Prompt(knowledge, scenarioLabel, conversation, meta) {
  const kt = meta.knowledgeSectionTitle || '核心理念参考';
  return `你是一名公司核心理念考核质检官。请依据下方「判分依据」，对一名员工在与考官问答中的表现进行评分。只评价**被考核员工（员工:）的回答**，不评价考官。

## ${kt}（判分依据，标准答案以此为准）
${knowledge}

## 考核场景
${scenarioLabel}

## 问答记录
${conversation.map(m => `${m.role === 'nurse' ? '员工' : '考官'}: ${m.content}`).join('\n')}

## 合格与加分规则
- **基本答出即合格（80 分基线）**：员工能正确说出使命 / 愿景 / 价值观 / 核心模式等「必答」考点的基本答案，即应达到约 80 分。
- **加分（往 100 走）**：能在**深入理解**（业务含义、深层逻辑）或**践行故事**（真实具体的工作事例）上讲得透彻通透。
- 标准对所有人统一，叙述角度可不同（如管理者可从与医生合作的角度切入），不因角度不同而加减分。

## 评分维度（总分 100，total = 三项之和）
### 1. 核心概念与事实正确度（core_facts，80 分）
覆盖「必答」考点：使命（长=长久、健康更简单的双重价值）、愿景、价值观四条、核心模式（O+O、先线下、本质是做糖尿病管理而非卖 CGM）、三个一体化、IoT 三性、0-1 是什么、一二三梯队的划分与总目的、包产到护（"护"是什么、本质是管理责任制、有护主）。
- 基本答全且正确 ≈ 72-80；有明显缺漏或部分答错按比例扣；连基本答案都说不出则 ≤40。
- 「了解级」内容（三个关键指标数值、一诊 350-500 测算、付费有效期天数算法）答不全或记错**不重扣**。
- **易错纠正（在本维度重扣并在 comment / key_evidence 指出纠正）**：以医生为中心 / 以患者为核心说反；把「长」说成「常」；先线上后线下或说患者来源在线上；IoT 三性张冠李戴；梯队目的 / 顺序错；把「卖 CGM」当成核心目的。

### 2. 理解深度（understanding_depth，10 分）
能否解释业务含义与深层逻辑：CGM 解决人性问题 / AI 解决成本问题、为何先线下、以医生为核心≠以患者为中心的辨析、三梯队各级运营策略差异、包产到护如何兼顾「责任制 + 员工成长」。讲透给高分，仅复述定义给低分。

### 3. 践行故事（practice_story，10 分）
是否用真实、具体的工作事例讲清「怎么践行」（价值观、线上线下一体化等）。具体可信给高分；空泛、无事例给低分；未涉及给 0-2。

## 输出要求
请严格按以下 JSON 返回，不要输出其他内容。conversion_rating 与 total 必须自洽（优秀=total≥90，合格=80-89，不合格<80）：
{
  "conversion_rating": "优秀" | "合格" | "不合格",
  "scores": {
    "core_facts": { "score": 0, "max": 80, "comment": "答对/答错/缺漏与纠正说明" },
    "understanding_depth": { "score": 0, "max": 10, "comment": "判断依据" },
    "practice_story": { "score": 0, "max": 10, "comment": "判断依据" }
  },
  "total": 0,
  "problem_tags": ["从以下选择，可多选：核心概念答不全/关键概念答错/理念辨析错误(易错点)/只会背诵缺乏理解/缺少践行故事/践行故事空泛/业务框架理解不足/暂无明显问题"],
  "root_problem": "用1-2句话指出最主要的不足；若整体优秀可写明亮点",
  "key_evidence": "引用或概括问答中最能支撑判断的关键片段：答对了哪些、答错或答反了哪些（并给出正确说法）、践行故事是否具体",
  "suggested_actions": "可执行改进建议：哪些必答概念要补、哪些理解要加深、践行故事如何讲得更具体",
  "summary": "总评，3-5句：识记是否到位、理解是否深入、是否有真实践行、主要差距在哪"
}

${RED_LINE_BLOCK}`;
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
  } else if (profile === 'core_concept_v1') {
    prompt = buildCoreConceptV1Prompt(knowledge, patientType, conversation, meta);
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

    // cgm_agp_v1 沿用旧规则：患者听懂/认同则保底及格；
    // cgm_v1（转化质检）按质量部要求，不把结果等同于转化有效，取消自动保底。
    if (profile === 'cgm_agp_v1' && parsed.convinced && parsed.total < passScore) {
      parsed.total = passScore;
    }

    parsed.passed = parsed.total >= passScore;

    // 全局红线一票否决：触碰任一红线 → 该次直接判不合格
    if (parsed.red_line && parsed.red_line.violated) {
      parsed.passed = false;
    }
    const dimDisplay = kc.getUiConfig(subUnitId).historyDetailDimensions;
    parsed.dimensions = dimDisplay && dimDisplay.length
      ? dimDisplay
      : (profile === 'cgm_v1'
          ? DEFAULT_CGM_V1_DIMENSIONS
          : profile === 'core_concept_v1'
            ? DEFAULT_CORE_CONCEPT_DIMENSIONS
            : [
                { key: 'graph_literacy', name: '读图与要素识别' },
                { key: 'clinical_link', name: '指标与临床关联' },
                { key: 'safety_education', name: '安全边界与患教' },
                { key: 'communication_efficiency', name: '沟通条理性' }
              ]);
    parsed.sub_unit_id = subUnitId;
    parsed.unit_id = kc.getSubUnit(subUnitId)?.unitId;
    return parsed;
  } catch {
    return { total: 0, passed: false, error: '评分解析失败', raw: result, dimensions: [] };
  }
}

/** cgm_v1 转化质检五维（无 catalog 自定义时的回退展示名） */
const DEFAULT_CGM_V1_DIMENSIONS = [
  { key: 'conversion_mainline', name: '转化切入与主线' },
  { key: 'need_necessity', name: '管理必要性与痛点提炼' },
  { key: 'cgm_value_link', name: 'CGM工具价值连接' },
  { key: 'multi_device_cycle', name: '多台连续管理周期' },
  { key: 'closing_objection', name: '方案收口与决策障碍处理' }
];

/** core_concept_v1 核心理念三维 */
const DEFAULT_CORE_CONCEPT_DIMENSIONS = [
  { key: 'core_facts', name: '核心概念与事实正确度' },
  { key: 'understanding_depth', name: '理解深度' },
  { key: 'practice_story', name: '践行故事' }
];

/** @deprecated 兼容旧引用 */
const SCORING_DIMENSIONS = [
  { key: 'need_discovery', name: '核心需求挖掘', weight: 30 },
  { key: 'wearing_plan', name: '佩戴方案合理性', weight: 25 },
  { key: 'professionalism', name: '专业度展示', weight: 30 },
  { key: 'communication_efficiency', name: '沟通效率', weight: 15 }
];

const PASS_SCORE = 80;

module.exports = { scoreConversation, SCORING_DIMENSIONS, PASS_SCORE };
