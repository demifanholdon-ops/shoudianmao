# Pet animations

v1.0 用的是 `pet_window.html` 里内联 SVG 画的猫 —— 不依赖任何动画资源就能跑。

v1.1 计划集成原 `blocky_cat` 项目的高清动画帧。届时这个目录会放 4 个 GIF：

- `prosperity.gif` (营业大吉，来自 blocky_cat 的 diamond.gif)
- `heartbreak.gif` (心碎了，需要新拍/选)
- `urgent.gif` (急死了，来自 blocky_cat 的 logistics.gif)
- `overload.gif` (顾不过来，来自 blocky_cat 的 typing.gif)

如果你有 `blocky_cat_electron_app.zip`，可以手动解压把对应 GIF 复制到这里，然后改 `pet_window.html` 把 SVG 块换成 `<img src="./assets/animations/xxx.gif">`。
