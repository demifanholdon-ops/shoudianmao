#!/usr/bin/env node
/**
 * @file demo-rag.js
 * 只演示 RAG 这一层：给一个症状描述，看它从踩坑库里召回什么。
 */

import { loadKB, recall, retrieve } from '../packages/brain/src/rag.js';
import { loadConfigFromEnv } from '../packages/brain/src/llm.js';

const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  orange: '\x1b[38;5;208m', cyan: '\x1b[38;5;81m', gray: '\x1b[38;5;245m', green: '\x1b[38;5;42m',
};

async function main() {
  const query = process.argv.slice(2).join(' ')
    || '访客下降 63% 免费 IPV 落后同行 71% 物流到货时长 58 小时';
  const cfg = loadConfigFromEnv();

  console.log(`\n${C.orange}${C.bold}守店猫 · RAG 踩坑经验库${C.reset}`);
  console.log(`${C.dim}query: "${query}"${C.reset}\n`);

  const kb = await loadKB();
  console.log(`${C.gray}知识库总条数: ${kb.length}${C.reset}`);

  console.log(`\n${C.cyan}━━━ 关键词召回（top 8）━━━${C.reset}`);
  const recalled = recall(kb, query, 8);
  recalled.forEach((e, i) => {
    console.log(`  ${C.bold}${i + 1}.${C.reset} [${e.id}] ${e.symptom} ${C.gray}(${e.category})${C.reset}`);
  });

  console.log(`\n${C.cyan}━━━ LLM Rerank（top 3）━━━${C.reset}`);
  const top = await retrieve(cfg, query);
  top.forEach((e, i) => {
    console.log(`\n  ${C.bold}${C.green}${i + 1}. [${e.id}] ${e.symptom}${C.reset}`);
    console.log(`     ${C.gray}category:${C.reset} ${e.category}`);
    console.log(`     ${C.gray}cause:${C.reset} ${e.cause}`);
    console.log(`     ${C.gray}actions:${C.reset}`);
    e.actions.forEach(a => console.log(`       ${C.gray}·${C.reset} ${a}`));
  });

  console.log(`\n${C.dim}用法: npm run demo:rag '<你的症状描述>'${C.reset}\n`);
}

main().catch(err => { console.error(err); process.exit(1); });
