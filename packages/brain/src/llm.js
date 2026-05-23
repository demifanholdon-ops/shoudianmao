/**
 * @file llm.js
 * 通用 OpenAI 兼容的 LLM 客户端。
 *
 * 把 base_url / model / api_key 改三个字段就能切换:
 *   - DeepSeek      https://api.deepseek.com/v1   deepseek-chat
 *   - Moonshot/Kimi https://api.moonshot.cn/v1    moonshot-v1-8k
 *   - 通义千问       https://dashscope.aliyuncs.com/compatible-mode/v1   qwen-turbo
 *   - OpenAI        https://api.openai.com/v1     gpt-4o-mini
 *
 * 设计目标：零依赖（只用 fetch），可在 Node ≥18 / Electron / Chrome 扩展中通用。
 */

import { mockChat } from './mock.js';

/**
 * @typedef {Object} LLMConfig
 * @property {string} baseURL  OpenAI 兼容 base url，如 https://api.deepseek.com/v1
 * @property {string} model    模型名
 * @property {string} apiKey   API key
 * @property {boolean} [mock]  true 时跳过网络，用本地伪响应（demo 用）
 * @property {number} [timeoutMs]
 */

/**
 * 从环境变量读取配置（Node 端用）。
 * @returns {LLMConfig}
 */
export function loadConfigFromEnv() {
  const env = (typeof process !== 'undefined' && process.env) || {};
  return {
    baseURL: env.LLM_BASE_URL || 'https://api.deepseek.com/v1',
    model: env.LLM_MODEL || 'deepseek-chat',
    apiKey: env.LLM_API_KEY || '',
    mock: env.MOCK === '1' || !env.LLM_API_KEY,
    timeoutMs: 30000,
  };
}

/**
 * 调用 chat completion。
 * @param {LLMConfig} cfg
 * @param {{system?: string, user: string, temperature?: number, json?: boolean}} opts
 * @returns {Promise<string>}  模型输出（取 choices[0].message.content）
 */
export async function chat(cfg, opts) {
  if (cfg.mock) {
    return mockChat(opts);
  }

  if (!cfg.apiKey) {
    throw new Error('[brain/llm] LLM_API_KEY 未设置；要么填 .env，要么把 MOCK=1');
  }

  const messages = [];
  if (opts.system) messages.push({ role: 'system', content: opts.system });
  messages.push({ role: 'user', content: opts.user });

  const body = {
    model: cfg.model,
    messages,
    temperature: opts.temperature ?? 0.7,
    stream: false,
  };
  if (opts.json) {
    body.response_format = { type: 'json_object' };
  }

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), cfg.timeoutMs ?? 30000);

  try {
    const res = await fetch(`${cfg.baseURL.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`[brain/llm] ${res.status} ${res.statusText} :: ${txt.slice(0, 300)}`);
    }
    const data = await res.json();
    return data?.choices?.[0]?.message?.content ?? '';
  } finally {
    clearTimeout(t);
  }
}

/**
 * 调 LLM 并把输出 parse 成 JSON。失败时返回 fallback。
 * @param {LLMConfig} cfg
 * @param {{system?: string, user: string, temperature?: number}} opts
 * @param {any} fallback
 */
export async function chatJSON(cfg, opts, fallback) {
  try {
    const txt = await chat(cfg, { ...opts, json: true });
    // 容错：有些供应商不严格遵循 json mode，可能裹一层 ```json
    const cleaned = txt.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    return JSON.parse(cleaned);
  } catch (e) {
    if (typeof console !== 'undefined') {
      console.warn('[brain/llm] chatJSON 失败，使用 fallback:', e.message);
    }
    return fallback;
  }
}
