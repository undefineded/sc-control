# 故事机图标 · 设计说明

> 预览：[preview.png](preview.png)（现状 / A / B 三栏对比 + 列表里的效果）
> 源稿：`icons.html`（两版对比）· `png.html`（切图用）
> 成品：`png/a/*.png`、`png/b/*.png`（256×256，透明底）

## 为什么重画

原来的四张图风格不统一：故事是紫黄扁平插画、文件夹是黄红贴纸、音乐是珊瑚+青、儿歌是蓝色小鸟。放在同一个列表里，颜色和画风互相打架。

## 统一规则

- 画布 256×256，图形区约 200×200（占画布 ~78%），4px 网格对齐。
- 无描边、纯色块、圆角几何；每个图标 = **主色 + 深色 + 浅色 + 一个星星黄点缀**。
- 38px（列表里的 76rpx）下仍能认出轮廓。

| 资源 | 主色 | 深色 | 浅色 | 底色（A 版） |
| --- | --- | --- | --- | --- |
| 故事 | `#FF9F43` | `#E8830F` | `#FFC08A` | `#FFF3E7` |
| 文件夹 | `#12B3A8` | `#0E9A90` | `#B7EDE9` | `#E6F8F6` |
| 音乐 | `#3B8EFF` | `#1F6BFF` | `#A9CCFF` | `#EAF2FF` |
| 儿歌（备用） | `#7B6CF6` | `#6152EA` | `#D9D4FF` | `#F3F0FF` |

共用点缀：`#FFC83D`（星星 / 音符火花）。

## 三个版本

- **A · 柔和底色**：图标自带圆角色块，纯扁平，和首页设备图标同一套处理。
- **B · 透明底**：只保留图形，更轻，但 38px 下轮廓容易散。
- **C · 卡通（已应用）**：在 A 的基础上把比例做胖（更大的月亮/星星、更粗的音符、更厚的书壳），整体轻微倾斜。38px 下比 A 更有表情，也不牺牲辨识度。

已把 C 版写入 `src/assets/story-icons/`：

| 文件 | 内容 |
| --- | --- |
| `story.png` | 故事（打开的书 + 月亮星星） |
| `folder.png` | 文件夹 / 音乐分类 |
| `music.png` | 音乐 / 收藏 |
| `nursery-rhyme.png` | 儿歌备用图（当前不启用） |

换 A / B 版：把 `png/a/` 或 `png/b/` 下的同名文件拷到 `src/assets/story-icons/` 即可，代码不用改。

## 重新生成

```bash
# 起一个静态服务（仓库根目录），Chrome 开 9222 调试端口
node docs/icon-design/shot-board.mjs "http://127.0.0.1:4321/docs/icon-design/icons.html" docs/icon-design/preview.png 1280 2
node docs/icon-design/shot-png.mjs "http://127.0.0.1:4321/docs/icon-design/png.html" docs/icon-design/icons-raw.png
python docs/icon-design/slice.py
```

改颜色或形状只需要动 `icons.html` / `png.html` 里的 `icons` 定义（两处保持一致）。
