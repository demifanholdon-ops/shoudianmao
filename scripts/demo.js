#!/usr/bin/env node
/**
 * @file demo.js · 一键 AI 流程演示
 *
 * 不需要任何 API key，不需要装 Electron，不需要装 Chrome。
 * 跑这一个文件，就能在终端看到守店猫的完整 AI 推理链路：
 *
 *   1) 读 mock 店铺数据
 *   2) 推断猫的情绪状态（纯规则）
 *   3) 跑根因 Agent（LLM 多步推理）
 *   4) 检索 RAG 踩坑经验库
 *   5) 生成"今日头条"风格日报
 *
 * 用法：
 *   npm run demo            # 默认用 mock LLM（看上去像真 AI 的伪响应）
 *   LLM_API_KEY=sk-... npm run demo   # 用真 LLM 跑
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { think, loadConfigFromEnv, PERSONAS, CAT_STATES } from '../packages/brain/src/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ===== ANSI 颜色（给终端打扮一下）=====
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  orange: '\x1b[38;5;208m',
  green: '\x1b[38;5;42m',
  red: '\x1b[38;5;203m',
  yellow: '\x1b[38;5;221m',
  cyan: '\x1b[38;5;81m',
  pink: '\x1b[38;5;213m',
  gray: '\x1b[38;5;245m',
};

function box(title, color = C.orange) {
  const line = '━'.repeat(60);
  console.log(`\n${color}${line}${C.reset}`);
  console.log(`${color}${C.bold}  ${title}${C.reset}`);
  console.log(`${color}${line}${C.reset}\n`);
}

function step(n, label) {
  console.log(`${C.cyan}${C.bold}[STEP ${n}]${C.reset} ${C.bold}${label}${C.reset}`);
}

function dim(text) { return `${C.dim}${text}${C.reset}`; }
function k(label, value) { return `  ${C.gray}${label}${C.reset}: ${value}`; }

const ART = `
${C.orange}        ___              ___${C.reset}
${C.orange}       /   \\            /   \\${C.reset}
${C.orange}      | ●   ●_______●  ● |${C.reset}    ${C.bold}守店猫${C.reset}  ${C.dim}· A desktop cat that reads your shop data${C.reset}
${C.orange}       \\___/          \\___/${C.reset}
${C.orange}        |_|            |_|${C.reset}      ${C.italic}${C.gray}data → mood + 3 things to do today${C.reset}
`;

async function main() {
  console.log(ART);

  // 选择一个 mock 场景
  const scenario = process.argv[2] === 'happy' ? 'mock_shop_data_happy.json' : 'mock_shop_data.json';
  const mockPath = join(__dirname, '..', 'examples', scenario);
  const payload = JSON.parse(await readFile(mockPath, 'utf8'));

  box('1 · 输入：店铺今日数据', C.cyan);
  console.log(k('店铺', payload.data.storeName));
  console.log(k('营收', `¥${payload.data.revenue}` + (payload.data.revenueYesterday ? ` ${C.gray}(昨日 ¥${payload.data.revenueYesterday})${C.reset}` : '')));
  console.log(k('访客', `${payload.data.visitors}` + (payload.data.visitorsYesterday ? ` ${C.gray}(昨日 ${payload.data.visitorsYesterday})${C.reset}` : '')));
  console.log(k('体验分', `${payload.data.experienceScore}  ${C.dim}(质量${payload.data.qualityScore} · 物流${payload.data.logisticsScore} · 服务${payload.data.serviceScore})${C.reset}`));
  console.log(k('异常', `${payload.alerts.length} 条` + (payload.alerts.length ? ` ${C.red}↓${C.reset}` : ` ${C.green}✓${C.reset}`)));
  payload.alerts.slice(0, 3).forEach(a => {
    console.log(`    ${C.red}•${C.reset} [${a.severity || 'medium'}] ${a.text}`);
  });

  const cfg = loadConfigFromEnv();
  const mode = cfg.mock
    ? `${C.yellow}MOCK 模式${C.reset} ${C.dim}（无 API key — 用伪响应演示）${C.reset}`
    : `${C.green}LIVE 模式${C.reset} ${C.dim}（接 ${cfg.model} @ ${cfg.baseURL}）${C.reset}`;
  console.log(`\n${C.gray}━━━ LLM 配置 ━━━${C.reset}`);
  console.log(k('运行模式', mode));

  box('2 · AI 推理（brain.think）', C.orange);
  step(1, '推断猫的情绪状态（纯规则，0 token）');
  step(2, '调用 LLM 列根因假设 →');
  step(3, '从 RAG 踩坑库召回相关案例 →');
  step(4, '让 LLM 综合给出根因 + 3 个对症动作 →');
  step(5, '让 LLM 以 persona 口吻生成头条体日报');
  console.log(dim('\n  ↻ 推理中...'));

  const t0 = Date.now();
  const result = await think({
    data: payload.data,
    alerts: payload.alerts,
    personaId: payload.personaId || 'gentle',
    llmConfig: cfg,
  });
  const dt = Date.now() - t0;
  console.log(`${C.green}  ✓ 完成${C.reset} ${C.dim}(${dt}ms)${C.reset}`);

  // === 输出 ===
  box('3 · 猫的当前状态', C.pink);
  console.log(`  状态: ${C.bold}${result.catState.label}${C.reset} ${result.catState.emoji}`);
  console.log(`  人格: ${C.bold}${result.persona.name}${C.reset} ${C.dim}(${result.persona.id})${C.reset}`);
  console.log(`  气泡: ${C.italic}"${result.catLine}"${C.reset}`);

  if (result.rootCause.rootCause) {
    box('4 · 根因分析', C.yellow);
    console.log(`  ${C.bold}根因:${C.reset} ${result.rootCause.rootCause}`);
    if (result.rootCause.evidence?.length) {
      console.log(`  ${C.gray}证据:${C.reset}`);
      result.rootCause.evidence.forEach(e => console.log(`    ${C.gray}·${C.reset} ${e}`));
    }
    if (result.rootCause.retrievedKbIds?.length) {
      console.log(`  ${C.gray}RAG 召回:${C.reset} ${result.rootCause.retrievedKbIds.join(', ')}`);
    }
    if (result.rootCause.hypotheses?.length) {
      console.log(`\n  ${C.gray}LLM 列举的假设:${C.reset}`);
      result.rootCause.hypotheses.forEach((h, i) => console.log(`    ${C.gray}${i + 1}.${C.reset} ${h}`));
    }
  }

  box('5 · 今日头条式日报', C.orange);
  const r = result.report;
  console.log(`  ${C.bold}${C.orange}${r.headline}${C.reset}`);
  console.log(`  ${C.italic}${r.oneLiner}${C.reset}\n`);

  if (r.insights?.length) {
    console.log(`  ${C.gray}关键发现:${C.reset}`);
    r.insights.forEach(i => console.log(`    ${C.gray}·${C.reset} ${i}`));
  }

  if (r.todos?.length) {
    console.log(`\n  ${C.bold}今日要做的 ${r.todos.length} 件事:${C.reset}`);
    r.todos.forEach((t, i) => {
      console.log(`    ${C.orange}${C.bold}${i + 1}.${C.reset} ${C.bold}${t.title}${C.reset}`);
      if (t.why) console.log(`       ${C.gray}why:${C.reset} ${t.why}`);
      if (t.impact) console.log(`       ${C.green}impact:${C.reset} ${t.impact}`);
      if (t.kbRef) console.log(`       ${C.cyan}kbRef:${C.reset} ${t.kbRef}`);
    });
  }

  console.log(`\n${C.dim}━━━ END ━━━${C.reset}`);
  console.log(`${C.dim}试试: npm run demo happy  (切换到无异常场景)${C.reset}`);
  console.log(`${C.dim}试试: LLM_API_KEY=sk-... npm run demo  (接真 LLM)${C.reset}\n`);
}

main().catch(err => {
  console.error('\n[demo] 失败：', err.message);
  console.error(err.stack);
  process.exit(1);
});
