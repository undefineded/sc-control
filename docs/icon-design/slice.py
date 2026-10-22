# -*- coding: utf-8 -*-
"""把 4x2 的图标拼图切成 8 张 256x256 PNG。"""
import os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
raw = os.path.join(HERE, "icons-raw.png")
order = ["story", "folder", "music", "spare"]

im = Image.open(raw).convert("RGBA")
w, h = im.size
cell = w // 4
for i in range(8):
    version = "a" if i < 4 else "b"
    name = order[i % 4]
    x = (i % 4) * cell
    y = (i // 4) * (h // 2)
    tile = im.crop((x, y, x + cell, y + h // 2)).resize((256, 256), Image.LANCZOS)
    out_dir = os.path.join(HERE, "png", version)
    os.makedirs(out_dir, exist_ok=True)
    path = os.path.join(out_dir, f"{name}.png")
    tile.save(path, optimize=True)
    print(path, tile.size)
