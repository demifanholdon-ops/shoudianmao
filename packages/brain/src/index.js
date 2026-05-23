/**
 * @file index.js · @shoudianmao/brain 主入口
 *
 * 守店猫的 AI 内核。把"店铺数据 → 一句话总结 + 3 件要做的事 + 猫的情绪台词"这条链路一站式打包。
 *
 * 典型用法：
 *
 *   import { think } from '@shoudianmao/brain';
 *   const result = await think({ data, alerts, personaId: 'gentle' });
 *   // result.catState   → 猫状态（用于切动画）
 *   // result.catLine    → 浮窗气泡
 *   // result.report     → 日报内容（headline / oneLiner / insights / todos）
 *   // result.rootCause  → 根因分析
 */

import { loadConfigFromEnv } from './llm.js';
import { generateReport } from './report.js';
import { analyzeRootCause } from './agent.js';
import { inferCatState, getPersona, CAT_STATES, PERSONAS } from './persona.js';

export * from './llm.js';
export * from './persona.js';
export * from './report.js';
export * from './agent.js';
export * from './rag.js';

/**
 * @typedef {Object} ThinkInput
 * @property {import('./report.js').ShopSnapshot} data
 * @property {import('./report.js').Alert[]} [alerts]
 * @property {import('./persona.js').PersonaId} [personaId]
 * @property {import('./llm.js').LLMConfig} [llmConfig]
 */

/**
 * 主入口：跑一遍完整 AI 链路。
 * @param {ThinkInput} input
 */
export async function think(input) {
  const { data, alerts = [], personaId = 'gentle' } = input;
  const cfg = input.llmConfig || loadConfigFromEnv();

  // 1) 状态推断（纯规则，0 token）
  const catState = inferCatState(data, alerts);

  // 2) 根因分析（LLM + RAG，仅在有 alerts 时才跑）
  const rootCause = alerts.length > 0
    ? await analyzeRootCause(cfg, data, alerts)
    : { hypotheses: [], rootCause: '', evidence: [], actions: [], retrievedKbIds: [] };

  // 3) 日报生成（LLM，融合 persona）
  const report = await generateReport(cfg, data, alerts, rootCause, personaId);

  return {
    catState,
    persona: getPersona(personaId),
    report,
    rootCause,
    catLine: report.catLine,
  };
}
