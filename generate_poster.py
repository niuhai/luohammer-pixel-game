from PIL import Image, ImageDraw, ImageFont
import math

# Canvas size (9:16 for Douyin/Xiaohongshu)
W, H = 1080, 1920

# Colors
BG_TOP = (6, 6, 13)
BG_BOTTOM = (18, 16, 28)
GOLD = (255, 215, 0)
GOLD_DIM = (200, 170, 80)
AMBER = (240, 192, 64)
BLUE = (68, 170, 255)
TEXT = (240, 230, 210)
TEXT_DIM = (160, 150, 130)

# Create image
img = Image.new('RGB', (W, H), BG_TOP)
draw = ImageDraw.Draw(img)

# Background gradient
for y in range(H):
    t = y / H
    r = int(BG_TOP[0] + (BG_BOTTOM[0] - BG_TOP[0]) * t)
    g = int(BG_TOP[1] + (BG_BOTTOM[1] - BG_TOP[1]) * t)
    b = int(BG_TOP[2] + (BG_BOTTOM[2] - BG_TOP[2]) * t)
    draw.line([(0, y), (W, y)], fill=(r, g, b))

# Add subtle scanlines
for y in range(0, H, 4):
    draw.line([(0, y), (W, y)], fill=(0, 0, 0, 30))

# Try to load fonts
font_paths = [
    "C:/Windows/Fonts/msyh.ttc",
    "C:/Windows/Fonts/msyhbd.ttc",
    "C:/Windows/Fonts/simhei.ttf",
    "C:/Windows/Fonts/simsun.ttc",
]

def load_font(size, bold=False):
    for fp in font_paths:
        try:
            return ImageFont.truetype(fp, size)
        except:
            continue
    return ImageFont.load_default()

font_title = load_font(96, bold=True)
font_subtitle = load_font(28)
font_en = load_font(22)
font_tag = load_font(20)
font_body = load_font(34)
font_small = load_font(22)
font_qr = load_font(18)

# Draw pixelated crossroads in the center
# Vanishing point
cx, cy = W // 2, H // 2 - 80

# Ground lines converging to center
line_color = (45, 42, 60)
for angle in [-30, -10, 10, 30]:
    rad = math.radians(angle)
    x2 = cx + math.sin(rad) * 600
    y2 = cy + math.cos(rad) * 700
    draw.line([(cx, cy), (x2, y2)], fill=line_color, width=3)

# Pixel blocks / road tiles
pixel_size = 16
for row in range(8, 30):
    y = cy + row * 22
    for col in [-3, -1, 1, 3]:
        x = cx + col * 45 + (row % 2) * 8
        alpha = max(20, 80 - row * 2)
        color = (GOLD[0], GOLD[1], GOLD[2])
        draw.rectangle([x, y, x + pixel_size, y + pixel_size], fill=(color[0]//4, color[1]//4, color[2]//4))

# Glowing center
draw.ellipse([cx-60, cy-60, cx+60, cy+60], fill=(255, 215, 0, 20))
draw.ellipse([cx-30, cy-30, cx+30, cy+30], fill=(255, 215, 0, 40))

# Floating particles
import random
random.seed(42)
for _ in range(40):
    x = random.randint(50, W-50)
    y = random.randint(100, H-100)
    r = random.randint(1, 3)
    o = random.randint(80, 200)
    draw.ellipse([x-r, y-r, x+r, y+r], fill=(GOLD[0], GOLD[1], GOLD[2], o))

# Top tag
margin = 70
tag_text = "TRAE AI 创造力大赛 · 参赛作品"
bbox = draw.textbbox((0, 0), tag_text, font=font_tag)
tw = bbox[2] - bbox[0]
draw.rectangle([cx - tw//2 - 20, margin - 10, cx + tw//2 + 20, margin + 34], outline=GOLD_DIM, width=1)
draw.text((cx - tw//2, margin), tag_text, font=font_tag, fill=GOLD_DIM)

# Main title
title = "十字路口 · 人生模拟器"
bbox = draw.textbbox((0, 0), title, font=font_title)
tw = bbox[2] - bbox[0]
th = bbox[3] - bbox[1]
title_y = 340
draw.text((cx - tw//2, title_y), title, font=font_title, fill=GOLD)

# English subtitle
en_title = "LUOHAMMER: CROSSROADS OF DESTINY"
bbox = draw.textbbox((0, 0), en_title, font=font_en)
tw = bbox[2] - bbox[0]
draw.text((cx - tw//2, title_y + th + 30), en_title, font=font_en, fill=TEXT_DIM)

# Subtitle line
subtitle = "以真实创业者经历为蓝本的像素风互动叙事游戏"
bbox = draw.textbbox((0, 0), subtitle, font=font_subtitle)
tw = bbox[2] - bbox[0]
draw.text((cx - tw//2, 560), subtitle, font=font_subtitle, fill=TEXT)

# Feature bullets
features = [
    ("6 项核心属性", "理想 · 财富 · 名声 · 翻车 · 压力 · 信任"),
    ("12+ 种人生结局", "每一次选择都在通向不同的终点"),
    ("10 分钟一局", "浏览器打开即玩，无需下载"),
]

y_start = 720
for i, (title, desc) in enumerate(features):
    y = y_start + i * 140
    # Pixel marker
    draw.rectangle([margin, y+8, margin+16, y+24], fill=GOLD)
    draw.text((margin + 36, y), title, font=font_body, fill=GOLD)
    bbox = draw.textbbox((0, 0), desc, font=font_small)
    tw = bbox[2] - bbox[0]
    draw.text((margin + 36, y + 56), desc, font=font_small, fill=TEXT_DIM)

# QR code placeholder
qr_size = 220
qr_x = W - margin - qr_size
qr_y = H - margin - qr_size - 60
draw.rectangle([qr_x, qr_y, qr_x + qr_size, qr_y + qr_size], outline=GOLD_DIM, width=2)
qr_text = "扫码体验"
bbox = draw.textbbox((0, 0), qr_text, font=font_small)
tw = bbox[2] - bbox[0]
draw.text((qr_x + (qr_size - tw)//2, qr_y + qr_size + 16), qr_text, font=font_small, fill=TEXT_DIM)

# CTA on the left
cta_title = "打开浏览器 即刻开始"
cta_desc = "搜索：十字路口 · 人生模拟器"
draw.text((margin, qr_y + 60), cta_title, font=font_body, fill=TEXT)
draw.text((margin, qr_y + 120), cta_desc, font=font_small, fill=TEXT_DIM)

# Bottom disclaimer
disc = "本作品为虚构叙事，部分情节经过艺术加工"
bbox = draw.textbbox((0, 0), disc, font=font_small)
tw = bbox[2] - bbox[0]
draw.text((cx - tw//2, H - 50), disc, font=font_small, fill=(100, 95, 85))

# Save
output_path = "e:/ownWorkPlace/罗的十字路口/luohammer-pixel-game/poster.png"
img.save(output_path, "PNG")
print(f"Poster saved to: {output_path}")