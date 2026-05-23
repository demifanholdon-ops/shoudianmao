# Screenshots & Demo

> v1.0 的演示图与录屏位。GitHub README 引用从这里取。

## 桌宠浮窗（4 种状态）

> _截图位 · 在你的电脑上跑起来后截图放这里_

| 营业大吉 | 心碎了 | 急死了 | 顾不过来 |
|---|---|---|---|
| `prosperity.png` | `heartbreak.png` | `urgent.png` | `overload.png` |

## 日报窗

> _截图位 · 点猫之后展开的"今日头条"风格日报_

`report-window.png`

## 终端 demo

```bash
node scripts/demo.js
```

> _gif 位 · 跑 demo.js 的录屏，2-3 秒_

`terminal-demo.gif`

## RAG 检索演示

```bash
node scripts/demo-rag.js '物流到货时长 58 小时'
```

> _gif 位 · 关键词召回 → LLM rerank 的过程_

`rag-demo.gif`

---

## 怎么生成这些截图（v1.0 之后做）

1. **桌宠浮窗**: 启动 Electron 桌宠 `npm start --workspace=@shoudianmao/pet`，用 macOS 截图 `Cmd+Shift+5`
2. **4 种状态**: 改 `examples/mock_shop_data.json` 里的 `qualityScore/logisticsScore/serviceScore`，触发不同状态
3. **终端录屏**: 用 [asciinema](https://asciinema.org/) 或 [terminalizer](https://terminalizer.com/) 录一段
4. **拖到 docs/screenshots/ 目录下**

未来推荐打包发布时一并附上。
