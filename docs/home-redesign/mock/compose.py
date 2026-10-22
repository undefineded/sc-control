# -*- coding: utf-8 -*-
"""Compose review boards from 2x phone screenshots."""
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SHOTS = os.path.join(HERE, "shots")
OUT = ROOT

FONT_BD = r"C:\Windows\Fonts\msyhbd.ttc"
FONT_RG = r"C:\Windows\Fonts\msyh.ttc"

BG_TOP = (245, 247, 252)
BG_BOT = (233, 238, 247)
INK = (22, 32, 47)
SUB = (122, 135, 154)
FAINT = (168, 178, 193)


def font(path, size, index=0):
    return ImageFont.truetype(path, size, index=index)


def text_w(draw, s, f):
    box = draw.textbbox((0, 0), s, font=f)
    return box[2] - box[0]


def rounded_mask(size, radius):
    m = Image.new("L", size, 0)
    d = ImageDraw.Draw(m)
    d.rounded_rectangle([0, 0, size[0] - 1, size[1] - 1], radius, fill=255)
    return m


def paste_phone(board, shot_path, x, y, radius=48):
    shot = Image.open(shot_path).convert("RGB")
    w, h = shot.size
    # soft shadow
    sh = Image.new("RGBA", (w + 120, h + 120), (0, 0, 0, 0))
    d = ImageDraw.Draw(sh)
    d.rounded_rectangle([60, 68, 60 + w, 68 + h], radius, fill=(24, 40, 70, 90))
    sh = sh.filter(ImageFilter.GaussianBlur(26))
    board.alpha_composite(sh, (x - 60, y - 60))
    # frame + screen
    mask = rounded_mask((w, h), radius)
    frame = Image.new("RGBA", (w + 8, h + 8), (255, 255, 255, 0))
    fd = ImageDraw.Draw(frame)
    fd.rounded_rectangle([0, 0, w + 7, h + 7], radius + 4, fill=(255, 255, 255, 255))
    board.alpha_composite(frame, (x - 4, y - 4))
    board.paste(shot, (x, y), mask)
    # hairline
    d2 = ImageDraw.Draw(board)
    d2.rounded_rectangle([x, y, x + w - 1, y + h - 1], radius, outline=(214, 223, 236, 255), width=1)


def gradient_bg(size):
    w, h = size
    img = Image.new("RGB", size, BG_TOP)
    d = ImageDraw.Draw(img)
    for yy in range(h):
        t = yy / max(1, h - 1)
        c = tuple(int(BG_TOP[i] + (BG_BOT[i] - BG_TOP[i]) * t) for i in range(3))
        d.line([(0, yy), (w, yy)], fill=c)
    return img.convert("RGBA")


def build(filename, title, subtitle, items):
    """items: list of (shot, tag, tag_color, name, note)"""
    scale = 1.0
    pw, ph = 780, 1688
    pad = 96
    gap = 84
    top = 300
    cap_h = 132
    n = len(items)
    width = pad * 2 + pw * n + gap * (n - 1)
    height = top + cap_h + ph + 88
    board = gradient_bg((width, height))
    d = ImageDraw.Draw(board)

    f_kicker = font(FONT_BD, 26)
    f_title = font(FONT_BD, 62)
    f_sub = font(FONT_RG, 30)
    f_tag = font(FONT_BD, 24)
    f_name = font(FONT_BD, 36)
    f_note = font(FONT_RG, 25)

    # header
    kicker = "S C   C O N T R O L   ·   万 物 互 联"
    d.text((pad, 92), kicker, font=f_kicker, fill=(138, 152, 172))
    d.text((pad, 132), title, font=f_title, fill=INK)
    d.text((pad, 214), subtitle, font=f_sub, fill=SUB)

    # hairline
    d.line([(pad, 268), (width - pad, 268)], fill=(219, 226, 238), width=2)

    for i, (shot, tag, color, name, note) in enumerate(items):
        x = pad + i * (pw + gap)
        y = top + cap_h
        # tag pill
        tw = text_w(d, tag, f_tag)
        pill_w = tw + 34
        d.rounded_rectangle([x, top - 4, x + pill_w, top + 34], 19, fill=color)
        d.text((x + 17, top + 1), tag, font=f_tag, fill=(255, 255, 255))
        # name + note
        nx = x + pill_w + 16
        d.text((nx, top - 6), name, font=f_name, fill=INK)
        d.text((x, top + 62), note, font=f_note, fill=SUB)
        paste_phone(board, os.path.join(SHOTS, shot), x, y)

    board.convert("RGB").save(os.path.join(OUT, filename), optimize=True)
    print(filename, board.size)


build(
    "01-三个方向.png",
    "首页改版 · 三个方向",
    "同一套设计语言下的三种信息组织方式：从「概念」到「控制」再到「空间」。",
    [
        ("a.png", "A", (43, 95, 174), "星图中枢", "家是中心，设备是节点 · 概念最直接"),
        ("b.png", "B", (47, 125, 255), "控制台矩阵", "状态与开关一屏完成 · 最能承载增长"),
        ("c.png", "C", (232, 131, 15), "空间流", "按房间组织 · 最贴近家庭心智"),
    ],
)

build(
    "02-推荐方案.png",
    "推荐方案 · 星图 + 控制台",
    "用星图回答「家里现在怎么样」，用设备页回答「有哪些设备、怎么管」。",
    [
        ("d1.png", "1", (31, 107, 255), "首页 · 概览优先", "星图 + 概览 + 场景 + 运行中 + 常用设备"),
        ("d2.png", "2", (31, 107, 255), "全部设备 · 按房间", "分组网格 + 待接入 + 万物互联路线图"),
    ],
)

build(
    "03-扩展与空态.png",
    "扩展性验证",
    "设备从 2 台增长到 10 台时的样子，以及第一次使用时的空态。",
    [
        ("e1.png", "3", (18, 179, 168), "10 台设备 · 3 个房间", "运行中横向卡片 + 房间收起，列表不失控"),
        ("e2.png", "4", (122, 135, 154), "空态 · 第一台设备", "把「等待」设计成「即将点亮」"),
    ],
)

build(
    "04-设备矩阵.png",
    "一期方案 · 设备矩阵（单连接）",
    "没有「家」、不做跨设备联动；蓝牙一次只连一台，所以把「切换」做成主要动作。",
    [
        ("f1.png", "1", (31, 107, 255), "已连接 · 首页", "当前设备控制卡 + 设备矩阵 + 附近设备"),
        ("f2.png", "2", (96, 112, 138), "未连接 · 回连", "没有连接时，一键回连最近使用的设备"),
        ("f3.png", "3", (18, 140, 235), "切换连接 · 确认", "先断开再连接；设备保持原有运行状态"),
    ],
)

build(
    "05-实现截图.png",
    "已按设备矩阵改造 · 实现截图",
    "Taro H5 构建的真实渲染（390×844，2x）；连接态用本地假数据模拟，小程序端走同一套逻辑。",
    [
        ("impl-connected.png", "1", (31, 107, 255), "已连接", "当前设备卡 + 矩阵高亮 + 风速快捷开关"),
        ("impl-idle.png", "2", (96, 112, 138), "未连接", "最近使用回连；长按设备可重命名"),
        ("impl-sheet.png", "3", (18, 140, 235), "切换连接", "先断开再连接，说明设备不会停"),
    ],
)
