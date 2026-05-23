# Contributing

欢迎 PR、issue、想法。守店猫还非常早期。

## 本地开发

```bash
git clone https://github.com/<you>/shoudianmao.git
cd shoudianmao
node scripts/demo.js  # 这一行就能验证 brain 是不是好的
```

## 项目结构

- `packages/brain/` — AI 内核，**改这里最有价值**
- `packages/collector/` — Chrome 扩展
- `packages/pet/` — Electron 桌宠
- `knowledge/pitfalls.jsonl` — 踩坑经验库（社区贡献最容易的入口！）

## 怎么贡献一条踩坑经验

`knowledge/pitfalls.jsonl` 每行一条 JSON：

```json
{"id":"P-101","symptom":"具体症状","category":"traffic","keywords":["关键词1","关键词2"],"cause":"可能根因","actions":["对症动作1","动作2"],"evidence":"数据上怎么判定"}
```

加好 PR 提过来就行，不需要写代码。

## 怎么加一个新的 cat persona

`packages/brain/src/persona.js` 里 `PERSONAS` 对象加一个新 entry，写 system prompt 就行。

## Code style

- 纯 ES modules (brain) / CommonJS (Electron main process)
- JSDoc 类型注释（不用 TS，但要让人能看懂参数）
- 简体中文注释，prompt 也用简体

## License

MIT — 提交即代表你同意以 MIT 协议发布。
