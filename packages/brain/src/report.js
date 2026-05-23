/**
 * @file report.js
 * 把店铺数据 + alerts + 根因分析 → LLM 生成"今日头条"风格的店铺日报。
 *
 * 替代了原版的 renderReport() 字符串拼接。LLM 在这里做"翻译"和"取舍"。
 */

import { chatJSON } from './llm.js';
import { getPersona } from './persona.js';

/**
 * @typedef {Object} ShopSnapshot
 * @property {string} [storeName]
 * @property {number} revenue
 * @property {number} [revenueYesterday]
 * @property {number} [visitors]
 * @property {number} [visitorsYesterday]
 * @property {number} [orders]
 * @property {string} [conversionRate]
 * @property {number} [avgPrice]
 * @property {number} [experienceScore]
 * @property {number} [qualityScore]
 * @property {number} [logisticsScore]
 * @property {number} [serviceScore]
 * @property {number} [pendingShip]
 * @property {number} [pendingBadReview]
 * @property {number} [pendingComplaint]
 * @property {number} [violations]
 * @property {string[]} [platformAlerts]
 *
 * @typedef {Object} Alert
 * @property {string} text
 * @property {'high'|'medium'|'low'} [severity]
 * @property {string} [suggestion]
 * @property {string} [rule]
 *
 * @typedef {Object} ReportResult
 * @property {string} headline      像"今日头条"的标题
 * @property {string} oneLiner       一句话总结（大白话）
 * @property {string[]} insights     2-4 个关键发现（大白话翻译指标）
 * @property {Array<{title: string, why: string, impact?: string}>} todos  今日要做的 3 件事
 * @property {string} catLine        猫的一句口语化台词（用于浮窗气泡）
 */

const SYSTEM_BASE = `你是"守店猫"的报告助手。你的任务是把电商店铺的多个数据指标 + 异常 + 根因，
转成一份给"刚开店的小白卖家"看的极简日报。

死规则：
1. 永远用大白话，不出现"DSR、IPV、ROI、UV、PV、客单价、转化率"等专业术语；如果必须出现，用括号补一句人话。
2. todos 必须是【今天就能做的】具体动作，不能是"加强运营""提升体验"这种空话。
3. todos 最多 3 件；按"先做"的优先级排。
4. 输出严格 JSON，结构见用户消息。
5. 文案要带情绪、有节奏，像今日头条标题。`;

/**
 * 生成日报。
 * @param {import('./llm.js').LLMConfig} cfg
 * @param {ShopSnapshot} data
 * @param {Alert[]} alerts
 * @param {{rootCause?: string, evidence?: string[]}} [rootCause]
 * @param {import('./persona.js').PersonaId} [personaId]
 * @returns {Promise<ReportResult>}
 */
export async function generateReport(cfg, data, alerts = [], rootCause = {}, personaId = 'gentle') {
  const persona = getPersona(personaId);

  const userPrompt = `店铺数据快照（已脱敏）:
${JSON.stringify(compactSnapshot(data), null, 2)}

异常预警 (${alerts.length}):
${alerts.map((a, i) => `  ${i + 1}. [${a.severity || 'medium'}] ${a.text}${a.suggestion ? `  → 建议: ${a.suggestion}` : ''}`).join('\n') || '  无'}

${rootCause?.rootCause ? `根因分析:\n  ${rootCause.rootCause}\n  证据: ${(rootCause.evidence || []).join('; ')}` : ''}

人格说明：
${persona.system}

请输出 JSON，字段如下（严格遵守，不要多字段不要少字段）：
{
  "headline": "像今日头条标题，10-18字，带情绪",
  "oneLiner": "一句话总结，20-40字，大白话",
  "insights": ["2-4 个关键发现，每条不超过 25 字"],
  "todos": [
    {"title": "今天就能做的具体动作", "why": "为什么要做（大白话）", "impact": "预估影响，比如'保住补贴9元/日' 或 '可挽回 5-10 个差评'"}
  ],
  "catLine": "你以"${persona.name}"人设说的一句话，不超过 30 字，用于浮窗气泡"
}`;

  const fallback = makeFallback(data, alerts, persona.name);
  return chatJSON(cfg, { system: SYSTEM_BASE, user: userPrompt, temperature: 0.7 }, fallback);
}

/** 压缩 snapshot 到 LLM 真正需要的字段，减少 token */
function compactSnapshot(d) {
  const trendArrow = (cur, prev) =>
    !prev ? null : { value: cur, yesterday: prev, deltaPct: +((cur - prev) / prev * 100).toFixed(1) };
  return {
    revenue: trendArrow(d.revenue, d.revenueYesterday),
    visitors: trendArrow(d.visitors, d.visitorsYesterday),
    orders: d.orders,
    conversionRate: d.conversionRate,
    avgPrice: d.avgPrice,
    DSR: {
      total: d.experienceScore,
      quality: d.qualityScore,
      logistics: d.logisticsScore,
      service: d.serviceScore,
    },
    pending: {
      ship: d.pendingShip,
      badReview: d.pendingBadReview,
      complaint: d.pendingComplaint,
      violations: d.violations,
    },
    platformAlerts: d.platformAlerts || [],
  };
}

/** 没有 LLM 也能跑出来的兜底报告，确保 demo 永远可用 */
function makeFallback(d, alerts, personaName) {
  const drop = d.visitorsYesterday && d.visitors
    ? Math.round((d.visitors - d.visitorsYesterday) / d.visitorsYesterday * 100)
    : 0;
  return {
    headline: alerts.length ? '今天有 ' + alerts.length + ' 件事要看一眼' : '今天店铺还算平稳',
    oneLiner: alerts.length
      ? `主人，今天有 ${alerts.length} 个地方在掉，挑最痛的 3 件先做。`
      : `主人，今天没大事，继续保持就好。`,
    insights: [
      drop ? `访客比昨天${drop >= 0 ? '多' : '少'}了 ${Math.abs(drop)}%` : '访客和昨天持平',
      d.experienceScore ? `体验分 ${d.experienceScore}` : '',
      d.pendingShip ? `还有 ${d.pendingShip} 单要发货` : '',
    ].filter(Boolean),
    todos: alerts.slice(0, 3).map(a => ({
      title: a.suggestion || a.text,
      why: a.text,
      impact: a.severity === 'high' ? '影响较大' : '影响中等',
    })),
    catLine: alerts.length ? '主人，过来看一下喵～' : '主人，今天可以喝口水了喵～',
  };
}
