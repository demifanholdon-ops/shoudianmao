/**
 * @file rag.js
 * 轻量 RAG：本地 jsonl 知识库 + 关键词预召回 + LLM rerank。
 *
 * 为什么不用向量库？因为：
 * 1) 知识库只有 ~100 条，关键词召回足够
 * 2) 零外部依赖（不用装 chromadb / faiss / @xenova/transformers）
 * 3) 在 Chrome 扩展和 Electron 中都能直接跑
 *
 * 如果将来知识库膨胀到 ~1000 条以上，再换 @xenova/transformers 本地 embedding。
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { chatJSON } from './llm.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_KB_PATH = join(__dirname, '..', '..', '..', 'knowledge', 'pitfalls.jsonl');

/**
 * @typedef {Object} PitfallEntry
 * @property {string} id            稳定 ID，如 "P-014"
 * @property {string} symptom       症状（"流量骤降"）
 * @property {string} category      类目（traffic / conversion / logistics / service / review / violation / pricing）
 * @property {string[]} keywords    用于关键词召回
 * @property {string} cause         可能根因
 * @property {string[]} actions     对症的可执行动作
 * @property {string} [evidence]    数据上的判定特征
 */

let _kbCache = null;

/** 一次性把 jsonl 加载进内存 */
export async function loadKB(kbPath = DEFAULT_KB_PATH) {
  if (_kbCache) return _kbCache;
  const raw = await readFile(kbPath, 'utf8');
  _kbCache = raw
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .map(l => JSON.parse(l));
  return _kbCache;
}

/**
 * 把 alerts/data 拼成检索 query
 * @param {{text?: string, suggestion?: string}[]} alerts
 * @param {Record<string, any>} [extraSignals]
 */
export function buildQueryFromAlerts(alerts, extraSignals = {}) {
  const parts = [];
  for (const a of alerts) {
    if (a.text) parts.push(a.text);
    if (a.suggestion) parts.push(a.suggestion);
  }
  for (const [k, v] of Object.entries(extraSignals)) {
    if (v) parts.push(`${k}=${v}`);
  }
  return parts.join(' \n ');
}

/**
 * 关键词预召回：用 keywords 和 symptom/category 做 token 匹配。
 * 返回 top-K 候选（默认 8 个），后续交给 LLM 精排。
 */
export function recall(kb, query, k = 8) {
  const q = query.toLowerCase();
  const scored = kb.map(entry => {
    let score = 0;
    for (const kw of entry.keywords || []) {
      if (q.includes(kw.toLowerCase())) score += 3;
    }
    if (q.includes(entry.symptom.toLowerCase())) score += 5;
    if (q.includes(entry.category.toLowerCase())) score += 1;
    return { entry, score };
  });
  return scored
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map(x => x.entry);
}

/**
 * LLM rerank: 给 LLM 看候选条目，让它挑出最相关的 top-3，并解释为什么。
 * 失败时直接返回关键词召回的 top-3。
 *
 * @param {import('./llm.js').LLMConfig} cfg
 * @param {string} query
 * @param {PitfallEntry[]} candidates
 * @returns {Promise<PitfallEntry[]>}
 */
export async function rerank(cfg, query, candidates) {
  if (candidates.length <= 3) return candidates;

  const userPrompt = `你是一个电商运营顾问，需要从以下"踩坑经验库"里挑出与当前店铺症状最相关的 3 条。

当前店铺症状：
${query}

候选经验（${candidates.length} 条）：
${candidates.map(c => `[${c.id}] (${c.category}) ${c.symptom}\n   可能根因: ${c.cause}\n   keywords: ${c.keywords.join(', ')}`).join('\n\n')}

输出严格 JSON：
{ "picks": ["P-xxx", "P-yyy", "P-zzz"], "reasoning": "一句话说明为什么挑这 3 条" }`;

  const fallback = { picks: candidates.slice(0, 3).map(c => c.id), reasoning: 'keyword fallback' };
  const result = await chatJSON(cfg, { user: userPrompt, temperature: 0.2 }, fallback);
  const byId = Object.fromEntries(candidates.map(c => [c.id, c]));
  return (result.picks || []).map(id => byId[id]).filter(Boolean);
}

/**
 * 一站式：query → recall → rerank
 * @param {import('./llm.js').LLMConfig} cfg
 * @param {string} query
 * @returns {Promise<PitfallEntry[]>}
 */
export async function retrieve(cfg, query) {
  const kb = await loadKB();
  const candidates = recall(kb, query, 8);
  if (candidates.length === 0) return [];
  return rerank(cfg, query, candidates);
}
