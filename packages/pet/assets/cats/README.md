# Cat animation assets

5 个 **APNG**（Animated PNG），每个 ~2MB，对应桌宠的 5 种状态。
源自 `blocky_cat_electron_app` 项目，团队同事 Su 出的 4×6 voxel sprite 渲染。

## 为什么是 APNG 不是 GIF？

GIF 只支持二值透明（一像素要么完全可见要么完全透明），所以原 GIF 把"奶米色卡片背景"烤进了图片里，桌宠浮窗会看到白方块。

APNG 是带 alpha 通道的动画 PNG（RGBA，512×512 24 帧），背景真透明，能直接和桌面/浮窗融合。

文件大一些（~2MB vs GIF ~500KB），但 Electron / Chromium 原生支持，加载和播放都很顺。

## 文件清单

| 文件 | 状态 | PDF 第 7 页含义 | 历史命名 |
|---|---|---|---|
| `prosperity.apng` | 营业大吉 | 皇冠 + 金币 + 星星庆祝 | `profit_` |
| `heartbreak.apng` | 心碎了 | 破损商品箱 + 放大镜检查 + 修复 | `diamond_` ⚠️ |
| `urgent.apng`     | 急死了 | 追物流车（乌龟驮包裹） | `logistics_` |
| `overload.apng`   | 顾不过来 | 问号 + 思考 + 敲键盘 | `typing_` |
| `idle.apng`       | 巡店中 / 默认 | 复用 prosperity | （= profit） |

> ⚠️ **`diamond_` 不是水晶。** 这是历史命名遗留 —— 那组动画画的是"破损商品箱 → 检查 → 修复"，对应"宝贝质量低 → 心碎了"。详见原版 `FRAME_RELATION_GUIDE.md`。

## 其它格式（v1.1 备用）

团队的 `blocky_cat_electron_app` 还提供了：

- **24 帧 PNG 序列**（在 `frames_smooth.7z` 里，每张 ~85KB，可程序化控制速率/暂停/倒放）
- **WebP 动画**（lossless，文件更小）
- **palette GIF**（强压缩版，可惜还是带白底）

1.0 用 APNG 是因为：单文件、原生支持、真透明、不需要 JS 帧循环逻辑。
v1.1 如果需要细粒度动画控制（暂停、慢放、状态间过渡帧），再切到 PNG 序列。
