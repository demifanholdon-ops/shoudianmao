#!/usr/bin/env node
/**
 * @file demo-persona.js
 * 用同一份店铺数据，让 4 种猫人格各自生成一段台词，对比 persona 系统效果。
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { think, loadConfigFromEnv, PERSONAS } from '../packages/brain/src/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m', italic: '\x1b[3m',
  orange: '\x1b[38;5;208m', green: '\x1b[38;5;42m', red: '\x1b[38;5;203m',
  pink: '\x1b[38;5;213m', cyan: '\x1b[38;5;81m', gray: '\x1b[38;5;245m',
};

async function main() {
  const mockPath = join(__dirname, '..', 'examples', 'mock_shop_data.json');
  const payload = JSON.parse(await readFile(mockPath, 'utf8'));
  const cfg = loadConfigFromEnv();

  console.log(`\n${C.orange}${C.bold}守店猫 · 4 种人格对比${C.reset}\n`);
  console.log(`${C.dim}店铺数据：访客降 63%（452→166），4 条平台预警${C.reset}\n`);

  for (const personaId of Object.keys(PERSONAS)) {
    const persona = PERSONAS[personaId];
    console.log(`${C.cyan}━━━ ${C.bold}${persona.name}${C.reset}${C.cyan} (${persona.id}) ━━━${C.reset}`);
    const result = await think({
      data: payload.data,
      alerts: payload.alerts,
      personaId,
      llmConfig: cfg,
    });
    console.log(`  ${C.italic}气泡:${C.reset} ${C.italic}"${result.catLine}"${C.reset}`);
    console.log(`  ${C.bold}头条:${C.reset} ${result.report.headline}`);
    console.log(`  ${C.dim}总结:${C.reset} ${result.report.oneLiner}\n`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
