/**
 * @file agent.js
 * 根因分析 Agent（最小版）。
 *
 * 触发条件：alerts 中存在 severity === 'high' 或 'medium' 的项。
 * 流程：
 *   1) LLM 列 2-3 个根因假设（hypotheses）
 *   2) 调 RAG 检索每个假设对应的踩坑经验
 *   3) LLM 综合数据 + RAG 证据，输出"根因 + 3 个对症动作"
 *
 * 这就是 PDF 上"1% 的人告诉你该做什么"的真正闭环。
 */

import { chatJSON } from './llm.js';
import { retrieve, buildQueryFromAlerts } from './rag.js';

/**
 * @typedef {Object} RootCauseResult
 * @property {string[]} hypotheses
 * @property {string} rootCause
 * @property {string[]} evidence      支持根因的数据点
 * @property {Array<{title: string, why: string, kbRef?: string}>} actions
 * @property {string[]} retrievedKbIds RAG 召回的 KB 条目 id
 */

const SYS_HYPOTHESIS = `你是电商运营分析师。给定店铺当前异常，列出 2-3 个最可能的根本原因假设。
要求：
- 假设要具体可验证，不要"运营不够好"这种空话
- 用大白话，避免术语
- 严格输出 JSON: { "hypotheses": ["假设1", "假设2", "假设3"] }`;

const SYS_CONCLUDE = `你是电商运营分析师。根据店铺数据、异常、踩坑经验库的相关案例，得出根本原因并给出 3 个对症动作。

要求：
1. 根因要点到具体一个原因，不要"以上都有可能"
2. evidence 必须列出支撑这个根因的具体数据点
3. actions 是【今天就能做的】具体步骤，每条带"为什么这么做"
4. 引用了 KB 条目就在 kbRef 字段里写它的 id（如 "P-014"）
5. 严格 JSON：
{
  "rootCause": "...",
  "evidence": ["数据点1", "数据点2"],
  "actions": [{"title": "...", "why": "...", "kbRef": "P-xxx 或留空"}]
}`;

/**
 * @param {import('./llm.js').LLMConfig} cfg
 * @param {import('./report.js').ShopSnapshot} data
 * @param {import('./report.js').Alert[]} alerts
 * @returns {Promise<RootCauseResult>}
 */
export async function analyzeRootCause(cfg, data, alerts) {
  if (!alerts || alerts.length === 0) {
    return {
      hypotheses: [],
      rootCause: '店铺无异常，无需分析',
      evidence: [],
      actions: [],
      retrievedKbIds: [],
    };
  }

  // Step 1: 列假设
  const hypUser = `店铺数据：
${JSON.stringify({
    revenue: data.revenue,
    revenueYesterday: data.revenueYesterday,
    visitors: data.visitors,
    visitorsYesterday: data.visitorsYesterday,
    conversionRate: data.conversionRate,
    DSR: {
      quality: data.qualityScore,
      logistics: data.logisticsScore,
      service: data.serviceScore,
    },
  }, null, 2)}

异常：
${alerts.map(a => `- [${a.severity}] ${a.text}`).join('\n')}

平台预警：
${(data.platformAlerts || []).map(a => `- ${a}`).join('\n') || '无'}`;

  const { hypotheses = [] } = await chatJSON(
    cfg,
    { system: SYS_HYPOTHESIS, user: hypUser, temperature: 0.5 },
    { hypotheses: alerts.map(a => a.text).slice(0, 3) }
  );

  // Step 2: RAG 检索（query 综合 alerts + hypotheses）
  const query = buildQueryFromAlerts(alerts) + ' ' + hypotheses.join(' ');
  let kbEntries = [];
  try {
    kbEntries = await retrieve(cfg, query);
  } catch (e) {
    // 文件读取失败时（如 Chrome 扩展场景）静默跳过
    kbEntries = [];
  }

  // Step 3: 综合下结论
  const concludeUser = `店铺数据：
${JSON.stringify({
    revenue: data.revenue,
    visitors: data.visitors,
    visitorsYesterday: data.visitorsYesterday,
    conversionRate: data.conversionRate,
    DSR: { quality: data.qualityScore, logistics: data.logisticsScore, service: data.serviceScore },
    platformAlerts: data.platformAlerts,
  }, null, 2)}

异常：
${alerts.map(a => `- [${a.severity}] ${a.text}`).join('\n')}

刚才你列的假设：
${hypotheses.map(h => '- ' + h).join('\n')}

从踩坑经验库召回的相关案例：
${kbEntries.map(k => `[${k.id}] ${k.symptom}
  可能根因: ${k.cause}
  对症动作: ${k.actions.join('；')}`).join('\n\n') || '（库内无相关案例）'}

请综合给出结论。`;

  const conclusion = await chatJSON(
    cfg,
    { system: SYS_CONCLUDE, user: concludeUser, temperature: 0.4 },
    {
      rootCause: alerts[0].text,
      evidence: [],
      actions: alerts.slice(0, 3).map(a => ({ title: a.suggestion || a.text, why: a.text, kbRef: '' })),
    }
  );

  return {
    hypotheses,
    rootCause: conclusion.rootCause,
    evidence: conclusion.evidence || [],
    actions: conclusion.actions || [],
    retrievedKbIds: kbEntries.map(k => k.id),
  };
}
