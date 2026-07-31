#!/usr/bin/env python3
"""Build Realmseed's canonical 16 px sprite atlas.

Generated concept art is first reduced to this same grid by pixelize_concept.py.
The checked-in atlas is deterministic so the game never depends on a remote
image service at build or runtime.
"""

from pathlib import Path
from PIL import Image, ImageColor, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "public/assets/art"
CELL = 16
COLS = 8
ROWS = 3

P = {
    "ink": "#17201d",
    "deep": "#24312b",
    "moss": "#355342",
    "leaf": "#4f7452",
    "fern": "#71965f",
    "light_leaf": "#9bb56d",
    "water": "#356c75",
    "water_light": "#67a0a0",
    "water_glint": "#a4c5b2",
    "stone": "#626b62",
    "stone_light": "#929481",
    "cream": "#ded2a3",
    "sand": "#b99e62",
    "sand_light": "#d3bd78",
    "wood": "#6e4937",
    "wood_light": "#a56b43",
    "ember": "#dc744a",
    "gold": "#edc95d",
    "cyan": "#66d2bd",
    "cyan_light": "#b3f0d2",
    "plum": "#604b68",
    "plum_light": "#96739d",
}

THEME_PALETTES = {
    "verdant": P,
    "ember": {
        **P,
        "ink": "#211a1e", "deep": "#38282c", "moss": "#5d4a38",
        "leaf": "#7c6947", "fern": "#9a8556", "light_leaf": "#c3a364",
        "water": "#445f69", "water_light": "#6f8790", "water_glint": "#b7bbb0",
        "stone": "#766b66", "stone_light": "#a09282", "cream": "#e5d4aa",
        "sand": "#a97a47", "sand_light": "#d2a15c", "wood": "#603a2e",
        "wood_light": "#936044", "ember": "#e36d42", "gold": "#f2c35a",
        "cyan": "#d98b4f", "cyan_light": "#f5c785",
        "plum": "#4c3549", "plum_light": "#7d586e",
    },
    "moonlit": {
        **P,
        "ink": "#111629", "deep": "#1b2940", "moss": "#233d4a",
        "leaf": "#285d5a", "fern": "#3d8071", "light_leaf": "#71aa83",
        "water": "#1e5267", "water_light": "#3698a1", "water_glint": "#8edbd0",
        "stone": "#5b5877", "stone_light": "#8a82a7", "cream": "#e8d9ad",
        "sand": "#756f76", "sand_light": "#a79a8e", "wood": "#4b3550",
        "wood_light": "#76506a", "ember": "#df6f75", "gold": "#edc96a",
        "cyan": "#52d5ca", "cyan_light": "#b6f1d1",
        "plum": "#513a70", "plum_light": "#8865a3",
    },
}


def px(draw: ImageDraw.ImageDraw, color: str, box: tuple[int, int, int, int]) -> None:
    draw.rectangle(box, fill=color)


def tile_base(draw: ImageDraw.ImageDraw, base: str, accent: str, variant: int) -> None:
    px(draw, base, (0, 0, 15, 15))
    points = ((2, 3), (11, 2), (6, 10), (14, 13)) if variant == 0 else ((5, 1), (13, 6), (2, 12), (9, 14))
    for x, y in points:
        px(draw, accent, (x, y, x + 1, y + 1))


def meadow(draw: ImageDraw.ImageDraw, variant: int) -> None:
    tile_base(draw, P["leaf"], P["fern"], variant)
    x = 11 if variant == 0 else 4
    px(draw, P["light_leaf"], (x, 6, x, 10))
    px(draw, P["cream"], (x - 1, 5, x + 1, 6))
    px(draw, P["deep"], (1, 14, 4, 15))


def forest(draw: ImageDraw.ImageDraw, variant: int) -> None:
    tile_base(draw, P["moss"], P["leaf"], variant)
    trees = ((4, 5, 9, 11), (10, 9, 14, 14)) if variant == 0 else ((1, 8, 6, 14), (8, 3, 14, 11))
    for x0, y0, x1, y1 in trees:
        px(draw, P["ink"], (x0 + 2, y1 - 1, x0 + 3, min(15, y1 + 2)))
        px(draw, P["deep"], (x0 + 1, y0 + 2, x1 - 1, y1))
        px(draw, P["leaf"], (x0, y0 + 3, x1, y1 - 2))
        px(draw, P["fern"], (x0 + 2, y0, x1 - 1, y0 + 3))
        px(draw, P["light_leaf"], (x0 + 3, y0 + 1, x0 + 4, y0 + 2))


def water(draw: ImageDraw.ImageDraw, variant: int) -> None:
    px(draw, P["water"], (0, 0, 15, 15))
    lines = ((1, 3, 8), (7, 8, 14), (2, 13, 10)) if variant == 0 else ((8, 2, 14), (1, 7, 9), (6, 12, 15))
    for x0, y, x1 in lines:
        px(draw, P["water_light"], (x0, y, x1, y))
        px(draw, P["deep"], (x0 + 2, y + 1, min(15, x1 + 1), y + 1))
    px(draw, P["water_glint"], (10 if variant == 0 else 3, 6, 12 if variant == 0 else 5, 6))


def mountain(draw: ImageDraw.ImageDraw, variant: int) -> None:
    tile_base(draw, P["deep"], P["stone"], variant)
    peak = 7 if variant == 0 else 9
    draw.polygon([(1, 15), (peak, 2), (15, 15)], fill=P["stone"])
    draw.polygon([(peak, 2), (peak + 4, 9), (peak + 1, 8), (peak - 1, 11), (peak - 3, 7)], fill=P["stone_light"])
    draw.polygon([(peak - 2, 6), (peak, 2), (peak + 2, 6), (peak, 5)], fill=P["cream"])
    px(draw, P["ink"], (2, 14, 14, 15))


def marsh(draw: ImageDraw.ImageDraw, variant: int) -> None:
    tile_base(draw, P["water"], P["moss"], variant)
    for x in ((3, 11) if variant == 0 else (6, 13)):
        px(draw, P["deep"], (x, 6, x, 14))
        px(draw, P["fern"], (x - 1, 7, x - 1, 10))
        px(draw, P["light_leaf"], (x + 1, 4, x + 1, 9))
    px(draw, P["water_light"], (1, 13, 7, 13))


def sand(draw: ImageDraw.ImageDraw, variant: int) -> None:
    tile_base(draw, P["sand"], P["sand_light"], variant)
    x = 10 if variant == 0 else 5
    px(draw, P["cream"], (x, 4, x + 2, 5))
    px(draw, P["wood"], (x + 1, 6, x + 1, 10))
    px(draw, P["deep"], (2, 13, 6, 14))


def structure(draw: ImageDraw.ImageDraw, kind: str) -> None:
    # Transparent cells let structures sit naturally over terrain.
    if kind == "camp":
        draw.polygon([(2, 13), (7, 4), (13, 13)], fill=P["ember"])
        draw.polygon([(7, 4), (9, 13), (13, 13)], fill=P["wood"])
        px(draw, P["cream"], (5, 7, 6, 9))
        px(draw, P["ink"], (1, 14, 14, 15))
    elif kind == "village":
        px(draw, P["wood"], (3, 8, 13, 14))
        draw.polygon([(1, 8), (8, 2), (15, 8)], fill=P["ember"])
        px(draw, P["gold"], (10, 10, 12, 14))
        px(draw, P["cream"], (5, 9, 7, 11))
        px(draw, P["ink"], (1, 15, 15, 15))
    elif kind == "ruin":
        px(draw, P["stone"], (2, 7, 5, 14))
        px(draw, P["stone_light"], (3, 5, 6, 8))
        px(draw, P["stone"], (10, 3, 13, 14))
        px(draw, P["stone_light"], (9, 2, 14, 5))
        px(draw, P["deep"], (4, 13, 11, 15))
        px(draw, P["leaf"], (1, 12, 3, 14))
    else:
        px(draw, "#4c655c", (3, 4, 5, 14))
        px(draw, P["stone_light"], (3, 2, 12, 5))
        px(draw, "#4c655c", (10, 4, 12, 14))
        px(draw, P["ink"], (6, 5, 9, 14))
        px(draw, P["cyan"], (7, 7, 8, 11))
        px(draw, P["cyan_light"], (8, 8, 9, 9))
        px(draw, P["deep"], (1, 14, 14, 15))


def person(draw: ImageDraw.ImageDraw, role: str) -> None:
    clothes = {"player": P["gold"], "wanderer": P["plum"], "villager": P["fern"], "follower": P["water_light"]}[role]
    skin = "#d9a66f"
    px(draw, "#11191680", (3, 14, 13, 15))
    # Hair/hat silhouette changes by role.
    if role == "player":
        px(draw, P["wood"], (5, 2, 10, 4))
        px(draw, P["ember"], (4, 3, 11, 3))
    elif role == "wanderer":
        px(draw, P["deep"], (4, 1, 11, 4))
        px(draw, clothes, (3, 3, 12, 4))
    elif role == "villager":
        px(draw, P["cream"], (5, 2, 10, 3))
        px(draw, P["wood"], (4, 3, 11, 4))
    else:
        px(draw, P["water"], (4, 2, 11, 4))
        px(draw, P["cyan"], (10, 3, 12, 5))
    px(draw, skin, (5, 4, 10, 8))
    px(draw, P["ink"], (6, 6, 6, 6))
    px(draw, P["ink"], (9, 6, 9, 6))
    px(draw, clothes, (4, 8, 11, 12))
    px(draw, P["cream"], (7, 9, 8, 10))
    px(draw, P["deep"], (5, 13, 7, 15))
    px(draw, P["deep"], (9, 13, 11, 15))


def monster(draw: ImageDraw.ImageDraw, kind: str) -> None:
    px(draw, "#11191670", (2, 14, 13, 15))
    if kind == "slime":
        draw.polygon([(2, 13), (4, 7), (7, 4), (11, 6), (14, 13)], fill=P["plum"])
        px(draw, P["plum_light"], (5, 6, 10, 8))
        px(draw, P["cream"], (5, 10, 6, 11))
        px(draw, P["cream"], (10, 10, 11, 11))
    elif kind == "boar":
        px(draw, P["wood"], (2, 7, 12, 13))
        px(draw, P["wood_light"], (8, 5, 14, 11))
        px(draw, P["cream"], (12, 10, 15, 11))
        px(draw, P["ink"], (11, 7, 11, 7))
        px(draw, P["deep"], (3, 13, 5, 15))
        px(draw, P["deep"], (10, 13, 12, 15))
    else:
        px(draw, P["cyan"], (6, 4, 10, 12))
        px(draw, P["water_light"], (4, 7, 12, 10))
        px(draw, P["cyan_light"], (7, 2, 9, 6))
        px(draw, P["cream"], (7, 7, 7, 8))
        px(draw, P["cream"], (10, 7, 10, 8))


def coin(draw: ImageDraw.ImageDraw) -> None:
    px(draw, P["wood"], (5, 12, 11, 14))
    px(draw, P["gold"], (4, 5, 11, 12))
    px(draw, P["cream"], (6, 4, 10, 5))
    px(draw, "#fff0a3", (6, 6, 7, 8))
    px(draw, P["ember"], (10, 9, 11, 11))


def build_atlas() -> Image.Image:
    atlas = Image.new("RGBA", (COLS * CELL, ROWS * CELL), (0, 0, 0, 0))
    sprites = [
        (meadow, 0), (meadow, 1), (forest, 0), (forest, 1),
        (water, 0), (water, 1), (mountain, 0), (mountain, 1),
        (marsh, 0), (marsh, 1), (sand, 0), (sand, 1),
        (structure, "camp"), (structure, "village"), (structure, "ruin"), (structure, "waystone"),
        (person, "player"), (person, "wanderer"), (person, "villager"), (person, "follower"),
        (monster, "slime"), (monster, "boar"), (monster, "wisp"), (coin, None),
    ]
    for index, (renderer, arg) in enumerate(sprites):
        cell = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
        draw = ImageDraw.Draw(cell)
        renderer(draw) if arg is None else renderer(draw, arg)
        atlas.alpha_composite(cell, ((index % COLS) * CELL, (index // COLS) * CELL))
    return atlas


def recolor(atlas: Image.Image, palette: dict[str, str]) -> Image.Image:
    substitutions = {
        ImageColor.getrgb(source): ImageColor.getrgb(palette[key])
        for key, source in P.items()
        if key in palette
    }
    pixels = []
    for red, green, blue, alpha in atlas.getdata():
        mapped = substitutions.get((red, green, blue), (red, green, blue))
        pixels.append((*mapped, alpha))
    themed = Image.new("RGBA", atlas.size)
    themed.putdata(pixels)
    return themed


def add_theme_motifs(atlas: Image.Image, theme: str, palette: dict[str, str]) -> Image.Image:
    """Give each direction its own readable motifs, not only a palette swap."""
    themed = atlas.copy()
    draw = ImageDraw.Draw(themed)
    if theme == "ember":
        # Frontier stones and dry grass.
        px(draw, palette["stone_light"], (3, 12, 5, 13))
        px(draw, palette["cream"], (20, 4, 20, 7))
        px(draw, palette["ember"], (66, 25, 68, 27))  # camp pennant
        px(draw, palette["gold"], (69, 22, 69, 27))
        # Red scarves distinguish scouts and followers.
        px(draw, palette["ember"], (10, 40, 12, 41))
        px(draw, palette["ember"], (58, 40, 60, 41))
    elif theme == "moonlit":
        # Bioluminescent flowers and moonlit water sparkles.
        px(draw, palette["cyan_light"], (3, 6, 3, 6))
        px(draw, palette["cyan"], (20, 11, 21, 11))
        px(draw, palette["cyan_light"], (70, 3, 72, 3))
        px(draw, palette["cyan"], (87, 10, 88, 11))
        # Coral travel ribbons and a shrine moon-sigil.
        px(draw, palette["ember"], (10, 40, 12, 41))
        px(draw, palette["ember"], (43, 39, 44, 42))
        px(draw, palette["cyan_light"], (118, 21, 120, 21))
        px(draw, palette["cyan"], (117, 22, 121, 23))
    return themed


def main() -> None:
    base = build_atlas()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for theme, palette in THEME_PALETTES.items():
        atlas = add_theme_motifs(recolor(base, palette), theme, palette)
        output = OUT_DIR / f"realmseed-atlas-{theme}.png"
        preview = OUT_DIR / f"realmseed-atlas-{theme}-preview.png"
        atlas.save(output, optimize=True)
        atlas.resize((atlas.width * 6, atlas.height * 6), Image.Resampling.NEAREST).save(preview, optimize=True)
        print(f"Wrote {output.relative_to(ROOT)} ({atlas.width}x{atlas.height})")

    # Stable aliases preserve existing links and downstream mods.
    recolor(base, THEME_PALETTES["verdant"]).save(OUT_DIR / "realmseed-atlas.png", optimize=True)
    recolor(base, THEME_PALETTES["verdant"]).resize(
        (base.width * 6, base.height * 6), Image.Resampling.NEAREST
    ).save(OUT_DIR / "realmseed-atlas-preview.png", optimize=True)


if __name__ == "__main__":
    main()
