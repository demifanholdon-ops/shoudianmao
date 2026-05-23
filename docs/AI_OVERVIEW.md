# What's AI Doing Here?

守店猫 1.0 的 AI 不是一个黑盒"调一下 GPT 给你写日报"，而是 4 个独立模块串成的推理链。这一页讲清楚每个模块在做什么、为什么这样设计、代码在哪。

## 推理流程总览

```
店铺数据 + 异常
       │
       ▼
┌──────────────┐
│ ① 情绪推断    │  纯规则，0 token，毫秒级
│ (rule-based) │  → 决定猫的当前动画
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ ② 根因 Agent │  LLM 调用 1: 列 2-3 个根因假设
│              │  LLM 调用 2: rerank RAG 候选
│              │  LLM 调用 3: 综合下结论
└──────┬───────┘
       │      ⇅
       ▼   ┌────────────────────┐
           │ ③ RAG 踩坑库        │
           │ 100 条 jsonl        │
           │ 关键词召回 → rerank │
           └────────────────────┘
       │
       ▼
┌──────────────┐
│ ④ 日报生成    │  LLM 调用 4: persona + 数据 + 根因 → 头条体日报
│ (persona)    │
└──────────────┘
       │
       ▼
   头条 / 一句话 / 关键发现 / 3 件事 / 猫的台词
```

一次完整链路总共 **4 次 LLM 调用**（约 1.5-2 万 tokens），DeepSeek 上花费约 ¥0.005。

---

## ① 情绪推断（zero-token）

**为什么不用 LLM？** 因为这是个 ms 级延迟问题 —— 猫的状态变化要在数据进来的瞬间就反映，等 LLM 返回会有 1-3 秒卡顿。

**规则**（按优先级）：

1. 宝贝质量 < 4.6 → **心碎了**
2. 物流速度 < 4.6 → **急死了**
3. 服务保障 < 4.6 → **顾不过来**
4. 有 high 级别警报 → **急死了**
5. ≥3 条 medium 警报 → **顾不过来**
6. 营收同比降 > 30% → **心碎了**
7. 其它 → **营业大吉**

代码：`packages/brain/src/persona.js → inferCatState()`

---

## ② 根因 Agent

**多步 chain-of-thought**，三次 LLM 调用：

### Step 2.1 — 列假设

system prompt: _"给定店铺当前异常，列出 2-3 个最可能的根本原因假设。假设要具体可验证。"_

输入：`{ revenue, visitors, conversionRate, DSR, platformAlerts }` + 当前 alerts。
输出：`{ "hypotheses": ["...", "...", "..."] }`

### Step 2.2 — 验证（RAG 检索 → rerank）

用 alerts 和 hypotheses 拼成 query，调用 RAG 召回 top-8 候选，让 LLM 挑出最相关的 top-3。

### Step 2.3 — 综合下结论

system prompt: _"根据店铺数据、异常、踩坑经验库的相关案例，得出根本原因并给出 3 个对症动作。要点到具体一个原因。evidence 必须列出支撑这个根因的具体数据点。"_

输出：

```json
{
  "rootCause": "...",
  "evidence": ["数据点1", "数据点2"],
  "actions": [{ "title": "...", "why": "...", "kbRef": "P-014" }]
}
```

代码：`packages/brain/src/agent.js`

---

## ③ RAG 踩坑库

**为什么不用向量库？**

- 知识库只有 100 条
- 关键词召回的命中率已经够（80%+）
- 零外部依赖（不装 chromadb / faiss / @xenova/transformers）
- 可以在 Chrome 扩展（service worker 受限环境）里直接跑

**两阶段检索：**

1. **关键词召回 (top-8)** — 每个 KB 条目预定义 `keywords` 字段，query 命中加分；命中 `symptom` 额外加 5 分。
2. **LLM rerank (top-3)** — 让 LLM 看候选条目和当前症状，挑出最相关的 3 条并解释理由。

知识库结构（jsonl）：

```jsonc
{
  "id": "P-014",
  "symptom": "主推款搜索排名突然跌出首页",
  "category": "traffic",
  "keywords": ["排名", "搜索", "跌出", "首页", "降权"],
  "cause": "商品被搜索引擎重排（可能因销量/转化/最近差评）",
  "actions": [
    "先排除违规：千牛『违规中心』看有没有处罚",
    "看商品最近 7 天 UV/转化/收藏数据是否异常",
    "找一批老客户进店下单（不能刷单），把销量分拉回去"
  ],
  "evidence": "主推款 keyword 排名跌 >10 位"
}
```

代码：
- 知识库：`knowledge/pitfalls.jsonl`（100 条）
- 检索：`packages/brain/src/rag.js`

未来扩展路径：当知识库超过 1000 条时，加入本地 embedding（`@xenova/transformers`）。

---

## ④ Persona 驱动的日报生成

**核心思路**：把"翻译数据"这件事完全交给 LLM，但限制它必须用某个猫人格的口吻 + 输出结构化 JSON。

system prompt（节选）：

```
你是"守店猫"的报告助手。把电商店铺的多个数据指标 + 异常 + 根因，转成
一份给"刚开店的小白卖家"看的极简日报。

死规则：
1. 永远用大白话，不出现"DSR、IPV、ROI、UV、PV"等专业术语
2. todos 必须是【今天就能做的】具体动作
3. todos 最多 3 件；按优先级排
4. 输出严格 JSON
5. 文案要带情绪、有节奏，像今日头条标题
```

输出：

```json
{
  "headline": "12 位买家对你说了'不'",
  "oneLiner": "主人，今天访客掉了 63%，但来的人更精准，3 件事就能稳住。",
  "insights": ["访客从 452 降到 166（−63%）", "..."],
  "todos": [
    { "title": "万相台速投关键词，预算 50 元", "why": "...", "impact": "..." }
  ],
  "catLine": "主人，别慌喵～ 3 件事干完今天就好了。"
}
```

**4 套 persona**：温柔/毒舌/高冷/操心。每种 persona 是一段独立 system prompt，描述说话风格、口头禅、长度限制。切换 persona = 同一份数据生成完全不同口吻的日报。

代码：
- Persona 定义：`packages/brain/src/persona.js`
- 日报生成：`packages/brain/src/report.js`

---

## LLM Router

所有 LLM 调用都走 `packages/brain/src/llm.js` 里的 `chat()`，OpenAI 兼容协议。配置三个字段就能切供应商：

```env
LLM_BASE_URL=https://api.deepseek.com/v1
LLM_MODEL=deepseek-chat
LLM_API_KEY=sk-...
```

支持：
- DeepSeek-V3（推荐 / 国内 / 便宜）
- Moonshot Kimi
- 通义千问（DashScope 兼容模式）
- OpenAI / Claude（海外）

**没填 key 时自动启用 mock 模式** — 用伪响应跑完整链路，用于 demo。

---

## Mock 模式

`packages/brain/src/mock.js` 不是"假装在调 LLM"，而是根据 prompt 关键词识别正在调用的子能力（列假设/根因/日报/...），返回一个看起来像真 LLM 输出的 JSON。

设计目的：

- GitHub 浏览者一行 `node scripts/demo.js` 就能看到完整 AI 流程
- 不需要任何 API key，不需要付钱
- 离线可用、无网络依赖

代码：`packages/brain/src/mock.js`
