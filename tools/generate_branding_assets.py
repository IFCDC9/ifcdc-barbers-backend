import os
import sys

# Allow local vendored deps
DEPS = os.path.join(os.path.dirname(__file__), "_pydeps")
if os.path.isdir(DEPS):
    sys.path.insert(0, DEPS)

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MOBILE_ASSETS = os.path.join(ROOT, "mobile", "assets")
RESOURCES_DIR = os.path.join(ROOT, "resources")

os.makedirs(MOBILE_ASSETS, exist_ok=True)
os.makedirs(RESOURCES_DIR, exist_ok=True)

BLACK = (0, 0, 0, 255)
GOLD_DARK = (165, 124, 34, 255)
GOLD = (212, 175, 55, 255)
GOLD_BRIGHT = (255, 224, 128, 255)


def _font(size: int):
    # Use default font if no system fonts available.
    try:
        return ImageFont.truetype("/System/Library/Fonts/SFNS.ttf", size)
    except Exception:
        return ImageFont.load_default()


def make_icon_1024(path_png: str):
    W = H = 1024
    img = Image.new("RGBA", (W, H), BLACK)
    d = ImageDraw.Draw(img)

    # Circular ring
    cx, cy = W // 2, H // 2
    r_outer = 360
    ring_w = 14
    bbox_outer = (cx - r_outer, cy - r_outer, cx + r_outer, cy + r_outer)

    # ring glow
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse(bbox_outer, outline=GOLD_BRIGHT, width=ring_w)
    glow = glow.filter(ImageFilter.GaussianBlur(8))
    img = Image.alpha_composite(img, glow)

    d = ImageDraw.Draw(img)
    d.ellipse(bbox_outer, outline=GOLD, width=ring_w)

    # Inner monogram
    title_font = _font(160)
    sub_font = _font(64)
    title = "IFCDC"
    subtitle = "BARBERS"

    tw, th = d.textbbox((0, 0), title, font=title_font)[2:]
    sw, sh = d.textbbox((0, 0), subtitle, font=sub_font)[2:]

    # Center with small gap
    y_title = cy - th // 2 - 40
    y_sub = y_title + th + 30

    # subtle text glow
    tg = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    tgd = ImageDraw.Draw(tg)
    tgd.text((cx - tw // 2, y_title), title, font=title_font, fill=GOLD_BRIGHT)
    tgd.text((cx - sw // 2, y_sub), subtitle, font=sub_font, fill=GOLD_BRIGHT)
    tg = tg.filter(ImageFilter.GaussianBlur(6))
    img = Image.alpha_composite(img, tg)

    d = ImageDraw.Draw(img)
    d.text((cx - tw // 2, y_title), title, font=title_font, fill=GOLD)
    d.text((cx - sw // 2, y_sub), subtitle, font=sub_font, fill=GOLD_DARK)

    img.convert("RGBA").save(path_png, format="PNG")


def make_splash_2048(path_png: str):
    W = H = 2048
    img = Image.new("RGBA", (W, H), BLACK)

    # big soft glow in center
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    cx, cy = W // 2, H // 2
    r = 520
    gd.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(212, 175, 55, 45))
    glow = glow.filter(ImageFilter.GaussianBlur(80))
    img = Image.alpha_composite(img, glow)

    # paste scaled icon center
    icon = Image.open(os.path.join(MOBILE_ASSETS, "icon.png")).convert("RGBA")
    icon = icon.resize((820, 820), Image.Resampling.LANCZOS)
    img.alpha_composite(icon, (cx - 410, cy - 500))

    # tagline
    d = ImageDraw.Draw(img)
    font = _font(56)
    text = "IFCDC Barbers"
    tw, th = d.textbbox((0, 0), text, font=font)[2:]
    y = cy + 380
    d.text((cx - tw // 2, y), text, font=font, fill=(212, 175, 55, 220))

    img.convert("RGBA").save(path_png, format="PNG")


if __name__ == "__main__":
    icon_path = os.path.join(MOBILE_ASSETS, "icon.png")
    splash_path = os.path.join(MOBILE_ASSETS, "splash.png")

    make_icon_1024(icon_path)
    make_splash_2048(splash_path)

    # Capacitor-style copy
    icon_cap = os.path.join(RESOURCES_DIR, "icon.png")
    Image.open(icon_path).save(icon_cap, format="PNG")

    print("WROTE", icon_path)
    print("WROTE", splash_path)
    print("WROTE", icon_cap)
