"""Build the HGScripts Illustrator README icon set.

Run from any directory: python tools/build_script_icons.py
Requires Pillow. SVG and PNG files are rendered from the same 64x64 primitives.
The catalog is checked against every JSX in the current public release.
"""
from pathlib import Path
import hashlib
import json
import math
import os

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "script-icons"
SCRIPT_ROOT = ROOT / "HGScripts_0.3.7" / "cep" / "HGScripts" / "user_scripts" / "illustrator"
SCALE = 8
# HGScripts panel greens, with neutral values reserved for color semantics.
INK = "#C9D8D0"
GREEN = "#56B982"
MINT = "#8BD8AE"
DEEP_GREEN = "#328760"
DARK = "#26332D"
LIGHT = "#F1F5F2"
BACKGROUND = "#17211C"

CATALOG = [
    ("black-white-swap", "纯黑纯白互换", "选择对象黑白互换.jsx"),
    ("sample-color-custom", "同色改为自定义色", "单一色转其它色.jsx"),
    ("sample-others-custom", "样本色与其它色分别替换", "单一色转自定义色_其它转自定义色.jsx"),
    ("sample-white-mask", "同色转白遮罩", "同色转白其余转黑.jsx"),
    ("sample-black-mask", "同色转黑遮罩", "同色转黑其余转白.jsx"),
    ("selected-white", "选中对象转白", "选择对象转白色.jsx"),
    ("selected-custom-color", "选中对象自定义改色", "选择对象转自定义颜色.jsx"),
    ("selected-black", "选中对象转黑", "选择对象转黑色.jsx"),
    ("selection-white-mask", "选中区域转白遮罩", "选择转白其余转黑.jsx"),
    ("selection-black-mask", "选中区域转黑遮罩", "选择转黑其余转白.jsx"),
    ("fill-to-stroke", "填充色同步到描边", "填充色同步到描边色.jsx"),
    ("stroke-to-fill", "描边色同步到填充", "描边色同步到填充色.jsx"),
    ("select-same-strict", "严格选择同色对象", "选择同色对象-严格版.jsx"),
    ("select-same-loose", "宽松选择同色对象", "选择同色对象-宽松版.jsx"),
    ("select-empty", "快速选择空路径", "选择空对象_极速版.jsx"),
    ("clean-empty", "保守清理空对象", "清理真正无用的空对象.jsx"),
    ("align-right", "基准对象右对齐", "手选基准对齐画板-右对齐.jsx"),
    ("align-vertical-center", "基准对象垂直居中", "手选基准对齐画板-垂直居中.jsx"),
    ("align-left", "基准对象左对齐", "手选基准对齐画板-左对齐.jsx"),
    ("align-bottom", "基准对象底部对齐", "手选基准对齐画板-底部对齐.jsx"),
    ("align-horizontal-center", "基准对象水平居中", "手选基准对齐画板-水平居中.jsx"),
    ("align-top", "基准对象顶部对齐", "手选基准对齐画板-顶部对齐.jsx"),
    ("basis-scale", "按基准对象缩放父组", "手选基准缩放.jsx"),
    ("round-size-up", "尺寸向上取整", "尺寸无小数.jsx"),
    ("long-edge-1024", "选区长边标准化", "选择对象长边设为1024.jsx"),
    ("six-grid", "六对象两行三列排版", "六个对象两行三列最大化.jsx"),
    ("record-position", "记录画板相对位置", "记录对象中心相对画板位置.jsx"),
    ("apply-position", "应用画板相对位置", "应用对象中心相对画板位置.jsx"),
    ("coordinates-legacy", "坐标转换旧版", "ai坐标转其它_gemini.jsx"),
    ("coordinates", "坐标与UV参数转换", "AI坐标转换工具.jsx"),
    ("selection-frame", "创建选区外框", "为选择对象创建外框.jsx"),
    ("white-overlay", "创建白色覆盖矩形", "选择对象上方创建白色矩形.jsx"),
    ("black-background", "创建画板黑色背景", "当前画板创建黑色背景矩形.jsx"),
    ("copy-new-artboard", "复制对象到新画板", "复制选择对象到新画板.jsx"),
    ("export-ai-1024", "导出标准化AI素材", "导出选择对象为长边1024AI.jsx"),
    ("paper-cup", "纸杯杯身展开", "纸杯展开.jsx"),
    ("upca-barcode", "生成矢量条形码", "生成UPC-A条形码.jsx"),
]


class Icon:
    def __init__(self):
        self.image = Image.new("RGBA", (64 * SCALE, 64 * SCALE))
        self.draw = ImageDraw.Draw(self.image)
        self.svg = []

    def line(self, points, color=INK, width=3):
        points = list(points)
        scaled = [(round(x * SCALE), round(y * SCALE)) for x, y in points]
        self.draw.line(scaled, fill=color, width=round(width * SCALE), joint="curve")
        for x, y in (points[0], points[-1]):
            radius = width * SCALE / 2
            self.draw.ellipse(
                (x * SCALE - radius, y * SCALE - radius, x * SCALE + radius, y * SCALE + radius),
                fill=color,
            )
        data = " ".join(f"{x:g},{y:g}" for x, y in points)
        self.svg.append(
            f'<polyline points="{data}" fill="none" stroke="{color}" stroke-width="{width}" '
            'stroke-linecap="round" stroke-linejoin="round"/>'
        )

    def polygon(self, points, color=INK, fill=None, width=3):
        points = list(points)
        if fill:
            self.draw.polygon([(round(x * SCALE), round(y * SCALE)) for x, y in points], fill=fill)
            data = " ".join(f"{x:g},{y:g}" for x, y in points)
            self.svg.append(f'<polygon points="{data}" fill="{fill}"/>')
        if color:
            self.line(points + [points[0]], color, width)

    def circle(self, x, y, radius, color=INK, fill=None, width=3):
        box = ((x - radius) * SCALE, (y - radius) * SCALE, (x + radius) * SCALE, (y + radius) * SCALE)
        if fill:
            self.draw.ellipse(box, fill=fill)
        if color:
            points = [
                (x + radius * math.cos(t * math.tau / 128), y + radius * math.sin(t * math.tau / 128))
                for t in range(129)
            ]
            self.draw.line(
                [(round(a * SCALE), round(b * SCALE)) for a, b in points],
                fill=color,
                width=round(width * SCALE),
                joint="curve",
            )
        self.svg.append(
            f'<circle cx="{x}" cy="{y}" r="{radius}" fill="{fill or "none"}" '
            f'stroke="{color or "none"}" stroke-width="{width}"/>'
        )

    def box(self, x, y, w, h, color=INK, fill=None, width=3):
        self.polygon([(x, y), (x + w, y), (x + w, y + h), (x, y + h)], color, fill, width)

    def arrow(self, a, b, color=MINT, width=3, head=5):
        self.line([a, b], color, width)
        theta = math.atan2(b[1] - a[1], b[0] - a[0])
        left = (b[0] - head * math.cos(theta - 0.65), b[1] - head * math.sin(theta - 0.65))
        right = (b[0] - head * math.cos(theta + 0.65), b[1] - head * math.sin(theta + 0.65))
        self.line([left, b, right], color, width)

    def finish(self, slug):
        OUT.mkdir(parents=True, exist_ok=True)
        text = (
            '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 64 64">\n'
            + "\n".join(self.svg)
            + "\n</svg>\n"
        )
        (OUT / f"{slug}.svg").write_text(text, encoding="utf-8")
        raster = self.image.resize((128, 128), Image.Resampling.LANCZOS)
        raster.save(OUT / f"{slug}.png")
        return raster


def artboard(icon, color=INK, width=4):
    icon.box(7, 7, 50, 50, color, width=width)


def selected_box(icon, x, y, w, h, color=GREEN, fill=None):
    icon.box(x, y, w, h, color, fill=fill, width=4)


def conversion_icon(target_fill, target_stroke=INK):
    icon = Icon()
    selected_box(icon, 7, 20, 20, 24, MINT, DARK)
    icon.arrow((29, 32), (39, 32), MINT, 4.5, 6)
    icon.box(42, 20, 16, 24, target_stroke, fill=target_fill, width=4)
    return icon


def sample_mask_icon(same_is_light):
    icon = Icon()
    artboard(icon)
    same_fill = LIGHT if same_is_light else DARK
    other_fill = DARK if same_is_light else LIGHT
    icon.circle(22, 24, 8, INK, fill=same_fill, width=3.5)
    icon.circle(42, 24, 8, INK, fill=other_fill, width=3.5)
    icon.circle(22, 43, 8, INK, fill=other_fill, width=3.5)
    icon.circle(42, 43, 8, INK, fill=other_fill, width=3.5)
    icon.circle(22, 24, 11, MINT, width=4)
    return icon


def selection_mask_icon(selected_is_light):
    icon = Icon()
    artboard(icon)
    chosen = LIGHT if selected_is_light else DARK
    others = DARK if selected_is_light else LIGHT
    icon.box(16, 16, 15, 15, INK, fill=chosen, width=3.5)
    icon.box(36, 16, 12, 15, INK, fill=others, width=3.5)
    icon.box(16, 36, 32, 11, INK, fill=others, width=3.5)
    return icon


def align_icon(mode):
    icon = Icon()
    # 加粗其余五个对齐图标时，保持已确认的右对齐 B 版资源字节不变。
    artboard(icon, width=2.5 if mode == "right" else 4)
    if mode == "left":
        icon.box(16, 18, 32, 10, MINT, fill=MINT)
        icon.box(16, 36, 20, 10, GREEN, fill=GREEN)
        icon.line([(12, 13), (12, 51)], MINT, 4.5)
    elif mode == "right":
        icon.box(7, 8, 50, 48, INK, width=4)
        icon.box(16, 18, 32, 10, MINT, fill=MINT)
        icon.box(28, 36, 20, 10, GREEN, fill=GREEN)
        icon.line([(52, 13), (52, 51)], MINT, 4.5)
    elif mode == "top":
        icon.box(18, 16, 10, 32, MINT, fill=MINT)
        icon.box(36, 16, 10, 20, GREEN, fill=GREEN)
        icon.line([(13, 12), (51, 12)], MINT, 4.5)
    elif mode == "bottom":
        icon.box(18, 16, 10, 32, MINT, fill=MINT)
        icon.box(36, 28, 10, 20, GREEN, fill=GREEN)
        icon.line([(13, 52), (51, 52)], MINT, 4.5)
    elif mode == "horizontal":
        icon.line([(32, 13), (32, 51)], MINT, 4.5)
        icon.box(16, 18, 32, 10, MINT, fill=MINT)
        icon.box(22, 36, 20, 10, GREEN, fill=GREEN)
    else:
        icon.line([(13, 32), (51, 32)], MINT, 4.5)
        icon.box(18, 16, 10, 32, MINT, fill=MINT)
        icon.box(36, 22, 10, 20, GREEN, fill=GREEN)
    return icon


def arc_points(cx, cy, radius, start, end, steps=18):
    return [
        (
            cx + radius * math.cos(math.radians(start + (end - start) * n / steps)),
            cy + radius * math.sin(math.radians(start + (end - start) * n / steps)),
        )
        for n in range(steps + 1)
    ]


def make_icons():
    icons = {}

    def add(slug, icon):
        icons[slug] = icon.finish(slug)

    i = Icon()
    i.box(6, 13, 23, 23, INK, fill=DARK, width=4.5)
    i.box(35, 29, 23, 23, INK, fill=LIGHT, width=4.5)
    i.arrow((31, 17), (54, 17), MINT, 5, 7)
    i.arrow((33, 48), (10, 48), MINT, 5, 7)
    add("black-white-swap", i)

    i = Icon()
    i.circle(14, 32, 10, MINT, fill=DARK, width=4)
    i.arrow((27, 32), (38, 32), MINT, 4.5, 6)
    i.circle(50, 32, 10, GREEN, fill=GREEN, width=4)
    add("sample-color-custom", i)

    i = Icon()
    i.circle(12, 20, 8, MINT, fill=DARK, width=3.5)
    i.circle(12, 44, 8, INK, fill=DARK, width=3.5)
    i.arrow((23, 20), (36, 20), MINT, 4, 5)
    i.arrow((23, 44), (36, 44), MINT, 4, 5)
    i.circle(49, 20, 9, MINT, fill=MINT, width=3.5)
    i.circle(49, 44, 9, GREEN, fill=GREEN, width=3.5)
    add("sample-others-custom", i)

    add("sample-white-mask", sample_mask_icon(True))
    add("sample-black-mask", sample_mask_icon(False))
    add("selected-white", conversion_icon(LIGHT))
    add("selected-custom-color", conversion_icon(DEEP_GREEN, MINT))
    add("selected-black", conversion_icon(DARK))
    add("selection-white-mask", selection_mask_icon(True))
    add("selection-black-mask", selection_mask_icon(False))

    i = Icon()
    i.box(7, 19, 20, 26, MINT, fill=MINT, width=4)
    i.arrow((30, 32), (39, 32), MINT, 4.5, 6)
    i.box(42, 19, 16, 26, MINT, fill=None, width=4)
    add("fill-to-stroke", i)

    i = Icon()
    i.box(7, 19, 16, 26, MINT, fill=None, width=4)
    i.arrow((26, 32), (35, 32), MINT, 4.5, 6)
    i.box(38, 19, 20, 26, MINT, fill=MINT, width=4)
    add("stroke-to-fill", i)

    i = Icon()
    for x in (15, 43):
        i.box(x - 10, 19, 20, 26, MINT, fill=DARK, width=4)
        i.box(x - 6, 24, 12, 16, GREEN, fill=GREEN)
    i.line([(27, 28), (31, 28)], MINT, 3.5)
    i.line([(27, 36), (31, 36)], MINT, 3.5)
    add("select-same-strict", i)

    i = Icon()
    i.circle(16, 32, 12, MINT, fill=MINT)
    i.circle(48, 32, 12, MINT, fill=DARK, width=4.5)
    i.line([(6, 14), (6, 7), (26, 7), (26, 14)], MINT, 4.5)
    i.line([(38, 50), (38, 57), (58, 57), (58, 50)], MINT, 4.5)
    add("select-same-loose", i)

    i = Icon()
    for x, y in ((9, 14), (39, 14), (9, 40), (39, 40)):
        i.box(x, y, 16, 12, INK, width=3.5)
    i.line([(35, 38), (35, 34), (58, 34), (58, 56), (35, 56)], MINT, 4)
    add("select-empty", i)

    i = Icon()
    i.box(7, 13, 18, 14, INK, width=3.5)
    i.box(7, 34, 18, 14, INK, width=3.5)
    i.arrow((28, 31), (37, 31), MINT, 4.5, 6)
    i.polygon([(40, 20), (56, 20), (53, 52), (43, 52)], MINT, fill=DARK, width=4)
    i.line([(38, 15), (58, 15)], MINT, 4)
    i.line([(45, 15), (45, 10), (52, 10), (52, 15)], MINT, 3.5)
    add("clean-empty", i)

    add("align-right", align_icon("right"))
    add("align-vertical-center", align_icon("vertical"))
    add("align-left", align_icon("left"))
    add("align-bottom", align_icon("bottom"))
    add("align-horizontal-center", align_icon("horizontal"))
    add("align-top", align_icon("top"))

    i = Icon()
    i.box(8, 10, 48, 44, INK, width=4)
    selected_box(i, 20, 20, 24, 24, MINT, DARK)
    i.circle(32, 32, 4, MINT, fill=MINT)
    i.arrow((20, 15), (44, 15), MINT, 4, 6)
    i.arrow((15, 44), (15, 20), MINT, 4, 6)
    add("basis-scale", i)

    i = Icon()
    i.box(13, 15, 35, 32, MINT, fill=DARK, width=4)
    i.line([(30, 15), (30, 47)], INK, 3.5)
    i.line([(13, 31), (48, 31)], INK, 3.5)
    i.arrow((30, 31), (48, 15), MINT, 4.5, 7)
    i.circle(48, 15, 3.5, MINT, fill=MINT)
    add("round-size-up", i)

    i = Icon()
    selected_box(i, 13, 20, 38, 24, MINT, DARK)
    i.arrow((13, 12), (51, 12), MINT, 4, 6)
    i.arrow((51, 12), (13, 12), MINT, 4, 6)
    i.line([(13, 15), (13, 18)], INK, 3.5)
    i.line([(51, 15), (51, 18)], INK, 3.5)
    add("long-edge-1024", i)

    i = Icon()
    artboard(i)
    for y in (17, 36):
        for x in (15, 29, 43):
            i.box(x - 5, y - 5, 10, 10, GREEN, fill=GREEN)
    for a, b in (((32, 12), (32, 8)), ((32, 52), (32, 56)), ((10, 32), (7, 32)), ((54, 32), (57, 32))):
        i.arrow(a, b, MINT, 3.5, 4)
    add("six-grid", i)

    i = Icon()
    artboard(i)
    i.line([(20, 30), (44, 30)], INK, 3.5)
    i.line([(32, 18), (32, 42)], INK, 3.5)
    i.circle(32, 30, 7, MINT, fill=DARK, width=4)
    i.circle(32, 30, 3, None, MINT)
    i.box(22, 46, 20, 7, MINT, fill=DARK, width=3.5)
    i.arrow((32, 38), (32, 45), MINT, 4, 5)
    add("record-position", i)

    i = Icon()
    artboard(i)
    i.circle(19, 21, 6, INK, fill=DARK, width=3.5)
    i.line([(13, 21), (25, 21)], INK, 3)
    i.line([(19, 15), (19, 27)], INK, 3)
    i.arrow((25, 25), (39, 37), MINT, 4.5, 6)
    i.circle(44, 42, 8, MINT, fill=DARK, width=4)
    i.circle(44, 42, 3, None, MINT)
    add("apply-position", i)

    def coordinate_icon(legacy=False):
        if not legacy:
            icon = Icon()
            icon.arrow((8, 54), (8, 10), INK, 4.5, 6)
            icon.arrow((8, 54), (30, 54), INK, 4.5, 6)
            icon.box(17, 18, 20, 20, MINT, fill=MINT)
            icon.arrow((38, 29), (44, 29), MINT, 4.5, 6)
            icon.box(47, 12, 12, 36, INK, width=4)
            icon.line([(47, 30), (59, 30)], INK, 3.5)
            return icon
        icon = Icon()
        main = INK
        icon.arrow((10, 51), (10, 12), INK, 4, 6)
        icon.arrow((10, 51), (29, 51), INK, 4, 6)
        selected_box(icon, 15, 20, 20, 20, main, DARK)
        icon.arrow((36, 30), (43, 30), MINT, 4.5, 6)
        icon.box(46, 13, 12, 34, INK, width=4)
        icon.line([(46, 30), (58, 30)], INK, 3)
        icon.line([(52, 13), (52, 47)], INK, 3)
        icon.line([(47, 54), (53, 58), (59, 54)], MINT, 3.5)
        icon.arrow((59, 54), (59, 48), MINT, 3.5, 5)
        return icon

    add("coordinates-legacy", coordinate_icon(True))
    add("coordinates", coordinate_icon(False))

    i = Icon()
    i.polygon([(20, 18), (36, 14), (45, 29), (36, 46), (19, 40)], GREEN, fill=DARK, width=4)
    i.box(11, 8, 43, 44, MINT, width=4)
    add("selection-frame", i)

    i = Icon()
    i.polygon([(12, 22), (28, 13), (42, 24), (34, 43), (16, 42)], GREEN, fill=DARK, width=4)
    i.box(19, 17, 35, 35, INK, fill=LIGHT, width=4)
    i.arrow((46, 12), (46, 7), MINT, 4, 5)
    add("white-overlay", i)

    i = Icon()
    artboard(i)
    i.box(12, 12, 40, 40, INK, fill=DARK, width=4)
    i.polygon([(23, 23), (38, 18), (45, 34), (31, 45), (19, 36)], GREEN, fill=GREEN, width=3.5)
    add("black-background", i)

    i = Icon()
    i.box(5, 15, 23, 34, INK, width=4)
    i.box(36, 15, 23, 34, MINT, width=4)
    i.circle(16, 30, 6, MINT, fill=DARK, width=3.5)
    i.circle(47, 30, 6, MINT, fill=DARK, width=3.5)
    i.arrow((26, 10), (39, 10), MINT, 4.5, 6)
    add("copy-new-artboard", i)

    i = Icon()
    i.box(5, 22, 24, 22, MINT, fill=MINT)
    i.arrow((30, 33), (39, 33), MINT, 5, 7)
    i.polygon([(43, 10), (53, 10), (60, 17), (60, 54), (43, 54)], INK, fill=DARK, width=4)
    i.line([(53, 10), (53, 17), (60, 17)], INK, 3.5)
    add("export-ai-1024", i)

    i = Icon()
    i.polygon([(7, 16), (25, 16), (22, 47), (10, 47)], MINT, fill=DARK, width=4)
    i.line([(7, 16), (16, 20), (25, 16)], MINT, 3.5)
    i.arrow((25, 28), (31, 28), MINT, 4.5, 6)
    outer = arc_points(44, 43, 20, 200, 340)
    inner = list(reversed(arc_points(44, 43, 8, 200, 340)))
    i.polygon(outer + inner, MINT, fill=DARK, width=4)
    i.line([(44, 35), (44, 23)], INK, 3.5)
    add("paper-cup", i)

    i = Icon()
    i.box(6, 9, 52, 46, INK, width=4)
    for x, width in ((12, 4), (19, 6), (29, 4), (36, 6), (46, 5)):
        i.box(x, 15, width, 34, None, fill=MINT)
    add("upca-barcode", i)

    expected = {slug for slug, _, _ in CATALOG}
    if set(icons) != expected:
        missing = sorted(expected - set(icons))
        extra = sorted(set(icons) - expected)
        raise RuntimeError(f"Icon catalog mismatch; missing={missing}, extra={extra}")
    return [(slug, title, filename, icons[slug]) for slug, title, filename in CATALOG]


def preview(items):
    columns = 4
    rows = (len(items) + columns - 1) // columns
    image = Image.new("RGB", (1200, 104 + rows * 190 + 24), BACKGROUND)
    draw = ImageDraw.Draw(image)

    def font(size):
        windows = Path(os.environ.get("WINDIR", "C:/Windows"))
        for name in ("msyh.ttc", "segoeui.ttf"):
            try:
                return ImageFont.truetype(str(windows / "Fonts" / name), size)
            except OSError:
                pass
        return ImageFont.load_default()

    draw.text((32, 20), "HAIGE / HGSCRIPTS / ILLUSTRATOR", font=font(28), fill=LIGHT)
    draw.text(
        (32, 60),
        f"{len(items)} script icons  |  128 px transparent PNG  |  64 / 17 px previews",
        font=font(16),
        fill="#9DB3A7",
    )
    for index, (slug, title, _, icon) in enumerate(items):
        x = 24 + (index % columns) * 294
        y = 104 + (index // columns) * 190
        draw.rounded_rectangle((x, y, x + 278, y + 174), radius=12, fill="#223029")
        large = icon.resize((64, 64), Image.Resampling.LANCZOS)
        small = icon.resize((17, 17), Image.Resampling.LANCZOS)
        image.paste(large, (x + 18, y + 18), large)
        image.paste(small, (x + 111, y + 43), small)
        draw.rounded_rectangle((x + 164, y + 17, x + 258, y + 84), radius=6, fill="#EEF3F0")
        image.paste(small, (x + 202, y + 51), small)
        draw.text((x + 16, y + 106), title, font=font(16), fill=LIGHT)
        slug_font = font(12)
        for size in range(12, 8, -1):
            slug_font = font(size)
            if draw.textbbox((0, 0), slug, font=slug_font)[2] <= 246:
                break
        draw.text((x + 16, y + 137), slug, font=slug_font, fill="#93AA9D")
    image.save(OUT / "preview.png")


def main():
    actual_scripts = {path.name for path in SCRIPT_ROOT.glob("*.jsx")}
    catalog_scripts = {filename for _, _, filename in CATALOG}
    if actual_scripts != catalog_scripts:
        missing = sorted(actual_scripts - catalog_scripts)
        stale = sorted(catalog_scripts - actual_scripts)
        raise RuntimeError(f"Script catalog mismatch; undocumented={missing}, missing_files={stale}")

    items = make_icons()
    preview(items)
    entries = []
    for slug, title, filename, _ in items:
        png = OUT / f"{slug}.png"
        svg = OUT / f"{slug}.svg"
        entries.append(
            {
                "slug": slug,
                "title": title,
                "script": (SCRIPT_ROOT / filename).relative_to(ROOT).as_posix(),
                "png": png.relative_to(ROOT).as_posix(),
                "svg": svg.relative_to(ROOT).as_posix(),
                "png_sha256": hashlib.sha256(png.read_bytes()).hexdigest(),
                "svg_sha256": hashlib.sha256(svg.read_bytes()).hexdigest(),
            }
        )
    manifest = {"size": [128, 128], "mode": "RGBA", "count": len(entries), "icons": entries}
    (OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Built {len(entries)} SVG/PNG icon pairs for {len(actual_scripts)} Illustrator scripts")
    print(f"Preview: {OUT / 'preview.png'}")


if __name__ == "__main__":
    main()
