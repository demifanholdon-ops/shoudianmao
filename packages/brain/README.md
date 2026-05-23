# @shoudianmao/brain

守店猫的 AI 内核。一个零依赖的 Node 包，负责把店铺数据 + 异常 → 猫的状态 + 头条体日报。

## 用法

```js
import { think } from '@shoudianmao/brain';

const result = await think({
  data: {
    revenue: 417.1,
    visitors: 166,
    visitorsYesterday: 452,
    experienceScore: 4.86,
    qualityScore: 4.97,
    logisticsScore: 4.76,
    serviceScore: 4.82,
    // ...
  },
  alerts: [
    { severity: 'high', text: '访客数较昨日下降 63%' }
  ],
  personaId: 'gentle', // gentle | sarcastic | cool | caretaker
});

console.log(result.catState);       // { id: 'urgent', label: '急死了', emoji: '🚚😾' }
console.log(result.catLine);        // 浮窗气泡
console.log(result.report);         // { headline, oneLiner, insights, todos, catLine }
console.log(result.rootCause);      // { rootCause, evidence, actions, retrievedKbIds }
```

## 配置

```env
LLM_BASE_URL=https://api.deepseek.com/v1
LLM_MODEL=deepseek-chat
LLM_API_KEY=sk-...
MOCK=0
```

没填 `LLM_API_KEY` 时自动切到 mock 模式。

## 模块

| 文件 | 干什么 |
|---|---|
| `src/llm.js` | OpenAI 兼容 LLM 客户端 + JSON 响应解析 |
| `src/persona.js` | 4 套猫人格 + 状态推断规则 |
| `src/report.js` | LLM 驱动的日报生成 |
| `src/agent.js` | 根因分析 Agent（多步推理） |
| `src/rag.js` | 踩坑经验库的关键词召回 + LLM rerank |
| `src/mock.js` | 无 API key 时的伪响应（demo 用） |
| `src/index.js` | 主入口，导出 `think()` |

## 设计原则

1. **零依赖** — 只用 `fetch` 和 Node 标准库。能在 Node / Electron / Chrome 扩展里直接跑。
2. **零强制** — 没 API key 也能跑（mock 模式输出和真 LLM 几乎一致）。
3. **结构化输出** — 所有 LLM 调用都用 JSON mode + fallback，避免文本解析坑。
4. **每个能力都能单独跑** — 看 `scripts/demo-persona.js` 和 `scripts/demo-rag.js`。

## License

MIT
