"""
N@XOPRO - Complete Brand Identity Generator
Electric Authority Design Philosophy
"""

from PIL import Image, ImageDraw, ImageFont, ImageFilter
import math
import os

# ─── OUTPUT DIR ──────────────────────────────────────────────────────────────
OUT = os.path.dirname(os.path.abspath(__file__))

# ─── BRAND COLORS ─────────────────────────────────────────────────────────────
BLUE       = (43,  53, 255)    # #2B35FF - Electric Authority
CYAN       = (0,  212, 255)    # #00D4FF - Secondary signal
DARK       = (10,  10,  26)    # #0A0A1A - Deep space
DARK2      = (18,  18,  42)    # #12122A - Panel
WHITE      = (240, 248, 255)   # #F0F8FF - Pure signal
GREY       = (110, 118, 160)   # #6E76A0 - Muted
BLUE_DIM   = (43,  53, 255, 60)  # transparent blue for layers

# ─── FONTS ────────────────────────────────────────────────────────────────────
F = "C:/Windows/Fonts/"
def font(name, size):
    return ImageFont.truetype(F + name, size)

# ─── HELPERS ──────────────────────────────────────────────────────────────────
def center_text(draw, text, y, fnt, color, img_w, letter_spacing=0):
    """Draw centered text with optional letter spacing."""
    if letter_spacing == 0:
        bbox = draw.textbbox((0, 0), text, font=fnt)
        w = bbox[2] - bbox[0]
        draw.text(((img_w - w) / 2, y), text, font=fnt, fill=color)
    else:
        # manual letter spacing
        total_w = 0
        for ch in text:
            bbox = draw.textbbox((0, 0), ch, font=fnt)
            total_w += bbox[2] - bbox[0] + letter_spacing
        total_w -= letter_spacing
        x = (img_w - total_w) / 2
        for ch in text:
            draw.text((x, y), ch, font=fnt, fill=color)
            bbox = draw.textbbox((0, 0), ch, font=fnt)
            x += bbox[2] - bbox[0] + letter_spacing

def draw_rule(draw, y, img_w, color=None, margin=80, thickness=1):
    color = color or BLUE
    draw.line([(margin, y), (img_w - margin, y)], fill=color, width=thickness)

def draw_dot_grid(draw, x0, y0, x1, y1, spacing=18, color=None, r=1):
    """Subtle dot grid pattern."""
    color = color or (43, 53, 255, 30)
    for row in range(int((y1 - y0) / spacing) + 1):
        for col in range(int((x1 - x0) / spacing) + 1):
            cx = x0 + col * spacing
            cy = y0 + row * spacing
            draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color)

def draw_corner_accent(draw, img_w, img_h, size=40, color=None):
    """Draw corner brackets."""
    color = color or BLUE
    lw = 2
    m = 24  # margin
    # top-left
    draw.line([(m, m), (m + size, m)], fill=color, width=lw)
    draw.line([(m, m), (m, m + size)], fill=color, width=lw)
    # top-right
    draw.line([(img_w - m - size, m), (img_w - m, m)], fill=color, width=lw)
    draw.line([(img_w - m, m), (img_w - m, m + size)], fill=color, width=lw)
    # bottom-left
    draw.line([(m, img_h - m), (m + size, img_h - m)], fill=color, width=lw)
    draw.line([(m, img_h - m - size), (m, img_h - m)], fill=color, width=lw)
    # bottom-right
    draw.line([(img_w - m - size, img_h - m), (img_w - m, img_h - m)], fill=color, width=lw)
    draw.line([(img_w - m, img_h - m - size), (img_w - m, img_h - m)], fill=color, width=lw)

def draw_naxopro_logo_text(draw, img_w, cy, scale=1.0):
    """
    Renders N@XOPRO with:
    - N X O P R O  in white Bahnschrift
    - @  in BLUE, slightly larger / offset
    Returns the bounding box y-range.
    """
    size_main = int(120 * scale)
    size_at   = int(132 * scale)

    f_main = font("bahnschrift.ttf", size_main)
    f_at   = font("bahnschrift.ttf", size_at)

    # Split: "N" + "@" + "XOPRO"
    parts = [("N", WHITE, f_main), ("@", BLUE, f_at), ("XOPRO", WHITE, f_main)]

    # Measure total width
    total_w = 0
    spacing = int(4 * scale)
    metrics = []
    for ch, col, fnt in parts:
        bb = draw.textbbox((0, 0), ch, font=fnt)
        w = bb[2] - bb[0]
        h = bb[3] - bb[1]
        metrics.append((ch, col, fnt, w, h, bb[1]))
        total_w += w + spacing
    total_w -= spacing

    x = (img_w - total_w) / 2
    for ch, col, fnt, w, h, top_off in metrics:
        # vertically align on baseline
        y_off = cy - size_main // 2 - top_off + (size_at - size_main) // 2 if fnt == f_at else cy - size_main // 2 - top_off
        draw.text((x, y_off), ch, font=fnt, fill=col)
        x += w + spacing


# ═══════════════════════════════════════════════════════════════════════════════
# 1. LOGO — DARK BACKGROUND
# ═══════════════════════════════════════════════════════════════════════════════
def create_logo_dark():
    W, H = 1600, 600
    img = Image.new("RGB", (W, H), DARK)
    draw = ImageDraw.Draw(img)

    # subtle dot grid (very dim)
    for row in range(0, H, 22):
        for col in range(0, W, 22):
            c = (30, 35, 80) if (row + col) % 44 == 0 else (20, 22, 50)
            draw.ellipse([col - 1, row - 1, col + 1, row + 1], fill=c)

    # glowing aura behind text
    for radius in [260, 200, 140, 90]:
        alpha = int(255 * (1 - radius / 280) * 0.12)
        aura = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ad = ImageDraw.Draw(aura)
        ad.ellipse([(W//2 - radius, H//2 - radius//2),
                    (W//2 + radius, H//2 + radius//2)],
                   fill=(*BLUE, alpha))
        img = Image.alpha_composite(img.convert("RGBA"), aura).convert("RGB")
        draw = ImageDraw.Draw(img)

    # top rule
    draw_rule(draw, H // 2 - 90, W, margin=60, thickness=1)
    # bottom rule
    draw_rule(draw, H // 2 + 90, W, margin=60, thickness=1)

    # small accent dots on rules
    for x in [60, W - 60]:
        for y in [H // 2 - 90, H // 2 + 90]:
            draw.ellipse([x - 3, y - 3, x + 3, y + 3], fill=BLUE)

    # Logo text
    draw_naxopro_logo_text(draw, W, H // 2, scale=1.0)

    # tagline
    f_tag = font("FUTURAB.TTF", 22)
    tagline = "SOLUCIONES TECNOLÓGICAS · IA · REDES · TELECOMUNICACIONES"
    center_text(draw, tagline, H // 2 + 100, f_tag, GREY, W, letter_spacing=3)

    # corner accents
    draw_corner_accent(draw, W, H, size=50)

    # thin side bars
    draw.line([(60, 60), (60, H - 60)], fill=(43, 53, 255, 40), width=1)
    draw.line([(W - 60, 60), (W - 60, H - 60)], fill=(43, 53, 255, 40), width=1)

    img.save(os.path.join(OUT, "logo_dark.png"), dpi=(300, 300))
    print("✓ logo_dark.png")


# ═══════════════════════════════════════════════════════════════════════════════
# 2. LOGO — LIGHT BACKGROUND
# ═══════════════════════════════════════════════════════════════════════════════
def create_logo_light():
    W, H = 1600, 600
    img = Image.new("RGB", (W, H), (250, 252, 255))
    draw = ImageDraw.Draw(img)

    # very light dot grid
    for row in range(0, H, 22):
        for col in range(0, W, 22):
            draw.ellipse([col - 1, row - 1, col + 1, row + 1], fill=(220, 226, 245))

    draw_rule(draw, H // 2 - 90, W, color=BLUE, margin=60, thickness=1)
    draw_rule(draw, H // 2 + 90, W, color=BLUE, margin=60, thickness=1)

    for x in [60, W - 60]:
        for y in [H // 2 - 90, H // 2 + 90]:
            draw.ellipse([x - 3, y - 3, x + 3, y + 3], fill=BLUE)

    # Logo text (dark on light)
    # Override white → dark
    size_main = 120
    size_at   = 132
    f_main = font("bahnschrift.ttf", size_main)
    f_at   = font("bahnschrift.ttf", size_at)
    parts = [("N", DARK, f_main), ("@", BLUE, f_at), ("XOPRO", DARK, f_main)]
    spacing = 4
    total_w = 0
    metrics = []
    for ch, col, fnt in parts:
        bb = draw.textbbox((0, 0), ch, font=fnt)
        w = bb[2] - bb[0]
        h = bb[3] - bb[1]
        metrics.append((ch, col, fnt, w, h, bb[1]))
        total_w += w + spacing
    total_w -= spacing
    x = (W - total_w) / 2
    cy = H // 2
    for ch, col, fnt, w, h, top_off in metrics:
        y_off = cy - size_main // 2 - top_off + (size_at - size_main) // 2 if fnt == f_at else cy - size_main // 2 - top_off
        draw.text((x, y_off), ch, font=fnt, fill=col)
        x += w + spacing

    f_tag = font("FUTURAB.TTF", 22)
    tagline = "SOLUCIONES TECNOLÓGICAS · IA · REDES · TELECOMUNICACIONES"
    center_text(draw, tagline, H // 2 + 100, f_tag, (100, 110, 160), W, letter_spacing=3)

    draw_corner_accent(draw, W, H, size=50, color=BLUE)

    img.save(os.path.join(OUT, "logo_light.png"), dpi=(300, 300))
    print("✓ logo_light.png")


# ═══════════════════════════════════════════════════════════════════════════════
# 3. BUSINESS CARD — FRONT
# ═══════════════════════════════════════════════════════════════════════════════
def create_card_front():
    # 3.5 x 2 inches @ 300 DPI
    W, H = 1050, 600
    img = Image.new("RGB", (W, H), DARK)
    draw = ImageDraw.Draw(img)

    # ── background geometry ──
    # left panel (dark blue strip)
    draw.rectangle([(0, 0), (320, H)], fill=(14, 14, 38))

    # dot grid on left panel
    for row in range(0, H, 18):
        for col in range(0, 320, 18):
            draw.ellipse([col - 1, row - 1, col + 1, row + 1], fill=(30, 35, 80))

    # diagonal separator line
    draw.polygon([(295, 0), (320, 0), (320, H), (268, H)], fill=DARK)

    # vertical blue accent line
    draw.line([(295, 30), (295, H - 30)], fill=BLUE, width=2)

    # ── LEFT PANEL — logo mark (@ symbol large) ──
    f_at_large = font("bahnschrift.ttf", 160)
    at_bb = draw.textbbox((0, 0), "@", font=f_at_large)
    at_w = at_bb[2] - at_bb[0]
    at_h = at_bb[3] - at_bb[1]
    at_x = (295 - at_w) // 2
    at_y = (H - at_h) // 2 - at_bb[1]
    # ghost version (dim)
    draw.text((at_x + 4, at_y + 4), "@", font=f_at_large, fill=(20, 28, 120))
    draw.text((at_x, at_y), "@", font=f_at_large, fill=(*BLUE, 200))

    # ── RIGHT PANEL — company name + info ──
    # Brand name
    f_brand_n = font("bahnschrift.ttf", 52)
    f_brand_at = font("bahnschrift.ttf", 58)
    # Draw N@XOPRO manually
    spacing = 2
    parts = [("N", WHITE, f_brand_n), ("@", BLUE, f_brand_at), ("XOPRO", WHITE, f_brand_n)]
    total_w = 0
    metrics = []
    for ch, col, fnt in parts:
        bb = draw.textbbox((0, 0), ch, font=fnt)
        w = bb[2] - bb[0]
        metrics.append((ch, col, fnt, w, bb[1]))
        total_w += w + spacing
    total_w -= spacing
    x = 360
    cy = 130
    for ch, col, fnt, w, top_off in metrics:
        y_off = cy - 26 - top_off + (58 - 52) // 2 if fnt == f_brand_at else cy - 26 - top_off
        draw.text((x, y_off), ch, font=fnt, fill=col)
        x += w + spacing

    # thin rule
    draw.line([(360, 185), (W - 40, 185)], fill=BLUE, width=1)
    draw.ellipse([355, 182, 361, 188], fill=BLUE)

    # tagline
    f_sub = font("FUTURAB.TTF", 14)
    draw.text((362, 195), "SOLUCIONES TECNOLÓGICAS · IA · REDES · TELECOMUNICACIONES",
              font=f_sub, fill=GREY, spacing=0)

    # ── contact info ──
    f_info = font("calibril.ttf", 20)
    f_label = font("FUTURAB.TTF", 11)

    info_x = 362
    info_y = 270

    contacts = [
        ("WEB",   "www.naxopro.com"),
        ("EMAIL", "contacto@naxopro.com"),
        ("TEL",   "+34 900 000 000"),
    ]
    for label, value in contacts:
        draw.text((info_x, info_y), label, font=f_label, fill=BLUE)
        draw.text((info_x + 70, info_y), value, font=f_info, fill=WHITE)
        info_y += 42

    # ── bottom rule ──
    draw.line([(362, H - 50), (W - 40, H - 50)], fill=(40, 50, 120), width=1)
    f_tiny = font("FUTURAB.TTF", 11)
    draw.text((362, H - 40), "N@XOPRO · ELECTRIC AUTHORITY", font=f_tiny, fill=GREY)

    # corner accents (right area only)
    lw = 2; sz = 30; m = 20
    draw.line([(W - m - sz, m), (W - m, m)], fill=BLUE, width=lw)
    draw.line([(W - m, m), (W - m, m + sz)], fill=BLUE, width=lw)
    draw.line([(W - m - sz, H - m), (W - m, H - m)], fill=BLUE, width=lw)
    draw.line([(W - m, H - m - sz), (W - m, H - m)], fill=BLUE, width=lw)

    img.save(os.path.join(OUT, "card_front.png"), dpi=(300, 300))
    print("✓ card_front.png")


# ═══════════════════════════════════════════════════════════════════════════════
# 4. BUSINESS CARD — BACK
# ═══════════════════════════════════════════════════════════════════════════════
def create_card_back():
    W, H = 1050, 600
    img = Image.new("RGB", (W, H), DARK2)
    draw = ImageDraw.Draw(img)

    # ── large geometric circuit pattern ──
    # concentric circles (very dim)
    cx, cy_c = W // 2, H // 2
    for r in range(40, 500, 40):
        alpha_val = max(8, 35 - r // 15)
        col = (43, 53, 255, alpha_val)
        circ_img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        cd = ImageDraw.Draw(circ_img)
        cd.ellipse([cx - r, cy_c - r, cx + r, cy_c + r],
                   outline=(*BLUE, alpha_val), width=1)
        img = Image.alpha_composite(img.convert("RGBA"), circ_img).convert("RGB")
        draw = ImageDraw.Draw(img)

    # cross-hair lines
    draw.line([(cx, 0), (cx, H)], fill=(43, 53, 255, 20), width=1)
    draw.line([(0, cy_c), (W, cy_c)], fill=(43, 53, 255, 20), width=1)

    # dot grid
    for row in range(0, H, 22):
        for col in range(0, W, 22):
            draw.ellipse([col - 1, row - 1, col + 1, row + 1], fill=(30, 35, 80))

    # ── center logo mark ──
    f_logo_b = font("bahnschrift.ttf", 220)
    f_logo_s = font("bahnschrift.ttf", 200)
    parts = [("N", (255, 255, 255, 18), f_logo_s),
             ("@", (*BLUE, 90),          f_logo_b),
             ("XOPRO", (255, 255, 255, 18), f_logo_s)]

    total_w = 0
    metrics2 = []
    tmp = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    td = ImageDraw.Draw(tmp)
    for ch, col, fnt in parts:
        bb = td.textbbox((0, 0), ch, font=fnt)
        w = bb[2] - bb[0]
        metrics2.append((ch, col, fnt, w, bb[1]))
        total_w += w + 3
    total_w -= 3
    x = (W - total_w) / 2
    for ch, col, fnt, w, top_off in metrics2:
        size_main = 200; size_at = 220
        y_off = H // 2 - size_main // 2 - top_off + (size_at - size_main) // 2 if fnt == f_logo_b else H // 2 - size_main // 2 - top_off
        td.text((x, y_off), ch, font=fnt, fill=col)
        x += w + 3

    img = Image.alpha_composite(img.convert("RGBA"), tmp).convert("RGB")
    draw = ImageDraw.Draw(img)

    # center dot
    draw.ellipse([cx - 5, cy_c - 5, cx + 5, cy_c + 5], fill=BLUE)

    # ── tag bottom ──
    f_tag = font("FUTURAB.TTF", 16)
    center_text(draw, "N@XOPRO · ELECTRIC AUTHORITY · EST. 2024",
                H - 50, f_tag, GREY, W, letter_spacing=4)

    # corner brackets
    draw_corner_accent(draw, W, H, size=40)

    img.save(os.path.join(OUT, "card_back.png"), dpi=(300, 300))
    print("✓ card_back.png")


# ═══════════════════════════════════════════════════════════════════════════════
# 5. COLOR PALETTE
# ═══════════════════════════════════════════════════════════════════════════════
def create_palette():
    W, H = 1600, 500
    img = Image.new("RGB", (W, H), DARK)
    draw = ImageDraw.Draw(img)

    colors = [
        (BLUE,          "#2B35FF", "ELECTRIC BLUE",  "Color Principal"),
        (CYAN,          "#00D4FF", "SIGNAL CYAN",    "Acento Secundario"),
        (DARK,          "#0A0A1A", "DEEP SPACE",     "Fondo Principal"),
        (DARK2,         "#12122A", "PANEL DARK",     "Fondo Secundario"),
        (WHITE,         "#F0F8FF", "PURE SIGNAL",    "Texto Principal"),
        (GREY,          "#6E76A0", "MUTED CIRCUIT",  "Texto Secundario"),
    ]

    n = len(colors)
    sw = W // n
    f_hex = font("consola.ttf", 22)
    f_name = font("FUTURAB.TTF", 14)
    f_desc = font("calibril.ttf", 18)

    for i, (col, hex_val, name, desc) in enumerate(colors):
        x0 = i * sw
        # color swatch (top 60%)
        draw.rectangle([(x0, 0), (x0 + sw, int(H * 0.58))], fill=col)
        # separator
        if i > 0:
            draw.line([(x0, 0), (x0, int(H * 0.58))], fill=DARK, width=2)

        # info block
        draw.rectangle([(x0, int(H * 0.58)), (x0 + sw, H)], fill=(14, 14, 36))
        draw.line([(x0 + 20, int(H * 0.58) + 1),
                   (x0 + sw - 20, int(H * 0.58) + 1)], fill=col, width=2)

        y_info = int(H * 0.62)
        draw.text((x0 + 20, y_info),      hex_val, font=f_hex,  fill=WHITE)
        draw.text((x0 + 20, y_info + 40), name,    font=f_name, fill=col)
        draw.text((x0 + 20, y_info + 65), desc,    font=f_desc, fill=GREY)

    # header
    f_hdr = font("bahnschrift.ttf", 28)
    draw.text((40, 18), "N@XOPRO", font=f_hdr, fill=WHITE)
    draw.text((40, 18), "N", font=f_hdr, fill=WHITE)

    # redo with colored @
    f_hdr2 = font("bahnschrift.ttf", 28)
    # measure N
    bb_n = draw.textbbox((0, 0), "N", font=f_hdr2)
    x_at = 40 + bb_n[2] - bb_n[0]
    draw.text((x_at, 18), "@", font=f_hdr2, fill=BLUE)
    bb_at = draw.textbbox((0, 0), "@", font=f_hdr2)
    draw.text((x_at + bb_at[2] - bb_at[0], 18), "XOPRO", font=f_hdr2, fill=WHITE)

    f_title = font("FUTURAB.TTF", 18)
    draw.text((40, 52), "BRAND COLOR SYSTEM", font=f_title, fill=GREY, spacing=4)

    img.save(os.path.join(OUT, "brand_palette.png"), dpi=(300, 300))
    print("✓ brand_palette.png")


# ═══════════════════════════════════════════════════════════════════════════════
# 6. DIGITAL BANNER (LinkedIn / Web header)
# ═══════════════════════════════════════════════════════════════════════════════
def create_banner():
    W, H = 1584, 396  # LinkedIn banner ratio
    img = Image.new("RGB", (W, H), DARK)
    draw = ImageDraw.Draw(img)

    # ── background: diagonal gradient stripes ──
    for i in range(0, W + H, 6):
        alpha = int(6 + 4 * math.sin(i / 80))
        col = (10 + alpha // 3, 12 + alpha // 3, 32 + alpha)
        draw.line([(i, 0), (0, i)], fill=col, width=3)

    # blue glow left side
    for radius in [300, 220, 150, 90, 50]:
        a = int(255 * 0.06 * (1 - radius / 320))
        glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        gd = ImageDraw.Draw(glow)
        gd.ellipse([-radius + 200, H // 2 - radius,
                     200 + radius, H // 2 + radius], fill=(*BLUE, a))
        img = Image.alpha_composite(img.convert("RGBA"), glow).convert("RGB")
        draw = ImageDraw.Draw(img)

    # dot grid (dim)
    for row in range(0, H, 22):
        for col in range(0, W, 22):
            draw.ellipse([col - 1, row - 1, col + 1, row + 1], fill=(22, 25, 60))

    # ── left: large logo ──
    draw_naxopro_logo_text(draw, W // 2, H // 2, scale=0.72)

    # horizontal rules
    draw_rule(draw, H // 2 - 65, W, margin=60, thickness=1)
    draw_rule(draw, H // 2 + 68, W, margin=60, thickness=1)

    # ── tagline ──
    f_tag = font("FUTURAB.TTF", 17)
    tagline = "PROGRAMAS A MEDIDA · IA · REDES · IP TELEPHONY · ALARMAS ADT · ENERGÍA"
    center_text(draw, tagline, H // 2 + 80, f_tag, GREY, W, letter_spacing=3)

    # corner accents
    draw_corner_accent(draw, W, H, size=40)

    # side accent dots
    for y in [H // 2 - 65, H // 2 + 68]:
        draw.ellipse([57, y - 3, 63, y + 3], fill=BLUE)
        draw.ellipse([W - 63, y - 3, W - 57, y + 3], fill=BLUE)

    img.save(os.path.join(OUT, "banner_digital.png"), dpi=(150, 150))
    print("✓ banner_digital.png")


# ═══════════════════════════════════════════════════════════════════════════════
# 7. ICON / FAVICON MARK
# ═══════════════════════════════════════════════════════════════════════════════
def create_icon():
    W = H = 512
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # rounded square bg
    pad = 20
    for offset in range(6, 0, -1):
        alpha = 255 - offset * 20
        draw.rounded_rectangle([pad, pad, W - pad, H - pad],
                                radius=80, fill=(*DARK, alpha))
    draw.rounded_rectangle([pad, pad, W - pad, H - pad],
                            radius=80, fill=DARK)

    # blue border
    draw.rounded_rectangle([pad, pad, W - pad, H - pad],
                            radius=80, outline=BLUE, width=4)

    # Large @ centered
    f_icon = font("bahnschrift.ttf", 320)
    at_bb = draw.textbbox((0, 0), "@", font=f_icon)
    at_w = at_bb[2] - at_bb[0]
    at_h = at_bb[3] - at_bb[1]
    ax = (W - at_w) / 2
    ay = (H - at_h) / 2 - at_bb[1]
    draw.text((ax, ay), "@", font=f_icon, fill=BLUE)

    # N and PRO small labels
    f_small = font("bahnschrift.ttf", 48)
    draw.text((50, 50), "N", font=f_small, fill=WHITE)
    draw.text((W - 115, H - 85), "PRO", font=f_small, fill=WHITE)

    # save both RGBA and RGB versions
    img.save(os.path.join(OUT, "icon_512.png"))
    img_rgb = img.convert("RGB")
    img_rgb.save(os.path.join(OUT, "icon_512_rgb.png"), dpi=(300, 300))
    print("✓ icon_512.png")


# ═══════════════════════════════════════════════════════════════════════════════
# RUN ALL
# ═══════════════════════════════════════════════════════════════════════════════
if __name__ == "__main__":
    print("Generating N@XOPRO Brand Identity...")
    create_logo_dark()
    create_logo_light()
    create_card_front()
    create_card_back()
    create_palette()
    create_banner()
    create_icon()
    print("\nAll brand assets generated successfully.")
