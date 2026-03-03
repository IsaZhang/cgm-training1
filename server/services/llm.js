const axios = require('axios');

// 通用LLM接口，支持切换不同模型
const LLM_CONFIGS = {
  // 通义千问
  qwen: {
    url: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    model: 'qwen-plus',
    headerFn: (key) => ({ Authorization: `Bearer ${key}` })
  },
  // 智谱GLM
  zhipu: {
    url: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    model: 'glm-4',
    headerFn: (key) => ({ Authorization: `Bearer ${key}` })
  },
  // 文心一言
  wenxin: {
    url: 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/completions_pro',
    model: 'ernie-4.0',
    headerFn: (key) => ({ Authorization: `Bearer ${key}` })
  }
};

const PROVIDER = process.env.LLM_PROVIDER || 'qwen';
const API_KEY = process.env.LLM_API_KEY || '';

async function chat(messages) {
  const config = LLM_CONFIGS[PROVIDER];
  if (!config) throw new Error(`Unknown LLM provider: ${PROVIDER}`);

  const res = await axios.post(config.url, {
    model: config.model,
    messages
  }, {
    headers: { 'Content-Type': 'application/json', ...config.headerFn(API_KEY) }
  });

  return res.data.choices[0].message.content;
}

module.exports = { chat };
