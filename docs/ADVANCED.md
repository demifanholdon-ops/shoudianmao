# Advanced · 接入真 LLM

> 这一页是给愿意折腾的开发者看的。普通小老板用默认 mock 模式就够了。

守店猫 1.0 默认用 mock 模式跑（看起来像真 AI 的伪响应），如果你想看真 LLM 的输出，按下面操作。

## 1. 选一家 LLM 供应商

推荐顺序：

| 供应商 | 优点 | 注册地址 |
|---|---|---|
| **DeepSeek** | 国内最便宜（约 ¥1/百万 token）、速度快、中文好 | https://platform.deepseek.com |
| Moonshot/Kimi | 国内、上下文长 | https://platform.moonshot.cn |
| 通义千问 | 阿里出品、电商语境理解好 | https://dashscope.aliyun.com |
| OpenAI | 海外、需要科学上网 | https://platform.openai.com |

## 2. 拿到 API key 后

复制 `.env.example` 到项目根目录：

```bash
cp .env.example .env
```

把 `LLM_API_KEY` 填上你拿到的 key，其它字段按 `.env.example` 里的注释切换：

```env
LLM_PROVIDER=deepseek
LLM_BASE_URL=https://api.deepseek.com/v1
LLM_MODEL=deepseek-chat
LLM_API_KEY=sk-xxxxxxxxxxxxxxxx
MOCK=0
```

## 3. 跑一遍 demo 看效果

```bash
node scripts/demo.js
```

你会在终端最上面看到：

```
运行模式: LIVE 模式 （接 deepseek-chat @ https://api.deepseek.com/v1）
```

而不是默认的 `MOCK 模式`。

每次跑会真正调用 4 次 LLM，总花费约 ¥0.005 / 次。

## 4. 在 Chrome 扩展和桌宠里用

桌宠（Electron）：把 `.env` 放在项目根目录，桌宠启动时会自动读。

Chrome 扩展：现在版本不强制要 API key（桌宠会自己调 LLM）；如果未来需要让扩展独立调 LLM，会在扩展 popup 加一个设置入口。

## 5. 切 persona

```js
import { think } from '@shoudianmao/brain';

const result = await think({
  data: shopData,
  alerts: alerts,
  personaId: 'sarcastic', // 或 'gentle' / 'cool' / 'caretaker'
});
```

## 常见问题

**Q: 我担心数据隐私，能用本地大模型吗？**

A: 1.0 暂未集成本地模型。当前架构里数据已经从未经过守店猫的服务器（直接打到 LLM 厂商），如果你连 LLM 厂商都不想信任，可以：
- 自己起一个 Ollama 本地服务（`http://localhost:11434/v1`）
- 把 `LLM_BASE_URL` 指向它
- 用 `qwen2.5:7b` 或 `llama3.1:8b`
- 守店猫的代码不需要任何改动（OpenAI 兼容协议）

**Q: 调用失败怎么办？**

A: brain 里有 fallback：调用失败时返回一个降级版日报（模板填充）。所以即使网络挂了，桌宠也不会卡住。
