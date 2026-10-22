# 故事机图标素材

## 原始素材

- `originals/icons-v1-3d.png`：第一版立体图标。
- `originals/icons-v2-selected.png`：最终选用的四宫格透明 PNG，是当前切片的来源。
- `originals/icons-v3-flat.png`：第三版扁平风格备选。
- `originals/folder-alternative.png`：单独生成的文件夹备选，未用于当前切片。

## 当前切片

应用资源位于 `src/assets/story-icons/`：`folder.png`、`music.png`、`story.png`、`nursery-rhyme.png`。

切片来自选定原图的左上、右上、左下、右下四个 768×512 象限。以 alpha > 3% 的可见内容确定裁剪边界，裁剪时保留原始 alpha，等比缩放至最长边 244px，再居中放入 256×256 透明画布。最长边两侧各留 6px，短边留白随原图比例变化。
