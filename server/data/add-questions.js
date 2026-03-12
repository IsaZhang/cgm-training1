const fs = require('fs');

// 读取当前题目
const current = require('./flashcards.json');

// 处理中文引号的函数
function fixQuotes(str) {
  return str.replace(/"/g, '（').replace(/"/g, '）');
}

// 用户提供的原始题库（部分）
const rawQuestions = [
  {
    question: "固有因素一定是药物导致的，偶然因素一定是饮食或运动导致的。",
    options: "正确；错误",
    correctAnswer: 2
  },
  {
    question: "某患者佩戴完CGM15天，其AGP图谱显示，浅蓝色区域较窄，深蓝色区域对应下午16点的下边缘在3.7-3.8mmol/L之间，说明？",
    options: "此患者有低血糖风险；此患者有高血糖风险；此患者有血糖波动的风险；此患者血糖管理较好",
    correctAnswer: 1
  },
  {
    question: "同一天中不同时段的血糖波动情况分析统称为_____血糖波动分析，比较不同日期相同时段的血糖曲线统称为______血糖波动分析。",
    options: "日内，日间；日间，日内；差异，整体；整体，差异",
    correctAnswer: 1
  }
];

// 转换函数
function convertToFlashcard(raw, index) {
  const opts = raw.options.split('；');
  const answers = typeof raw.correctAnswer === 'string'
    ? raw.correctAnswer.split('；').map(n => parseInt(n))
    : [raw.correctAnswer];

  const answerTexts = answers.map(n => opts[n - 1]).join(' ');

  return {
    id: `converted_${String(index + 1).padStart(2, '0')}`,
    category: "综合知识",
    difficulty: 2,
    front: fixQuotes(raw.question),
    back: fixQuotes(answerTexts)
  };
}

// 转换并添加
const converted = rawQuestions.map((q, i) => convertToFlashcard(q, current.length + i));
const merged = [...current, ...converted];

// 写入
fs.writeFileSync('./flashcards.json', JSON.stringify(merged, null, 2));
console.log('✅ 成功添加', converted.length, '道题');
console.log('✅ 当前总数:', merged.length);
