#!/usr/bin/env python3
"""Ingest the current Realmseed GPT Image 2 source sheets.

The source images stay untouched under art/generated/raw. Derived cells,
transparent logical sprites, previews, detection crops, and runtime atlases are
reproducible outputs.
"""

from __future__ import annotations

import json
import shutil
from collections import deque
from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter

from process_generated_asset import (
    expanded_bbox,
    median_key,
    process_asset,
    quantize_rgba,
    remove_connected_background,
)

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "art/generated/raw"
CELLS = ROOT / "art/generated/cells"
PROCESSED = ROOT / "art/generated/processed"
PREVIEWS = ROOT / "art/generated/previews"
REPORTS = ROOT / "art/generated/reports"
DETECTED = ROOT / "art/generated/detected"
PUBLIC = ROOT / "public/assets/art"

GRID_SHEETS = {
    "characters": {
        "file": "2r8c-人物设计1.png",
        "key": "white",
        "colors": 24,
        "names": ["traveler", "scout", "farmer", "keeper", "merchant", "healer", "guard", "scholar"],
    },
    "monsters": {
        "file": "2r8c-怪物设计1.png",
        "key": "auto",
        "colors": 28,
        "names": ["slime", "boar", "wisp", "rock-crab", "marsh-crawler", "ember-moth", "moon-jelly", "seed-guardian"],
    },
    "buildings": {
        "file": "2r4c 建筑素材.png",
        "key": "white",
        "colors": 32,
        "names": ["camp", "cottage", "village", "ruin", "waystone", "bridge", "farm", "watchtower"],
    },
    "resources": {
        "file": "2r4c资源素材.png",
        "key": "auto",
        "colors": 24,
        "names": ["coin", "food", "bread", "fish", "seed", "wood", "stone", "crystal"],
    },
}


def grid_box(size: tuple[int, int], row: int, column: int, rows: int = 2, columns: int = 4) -> tuple[int, int, int, int]:
    width, height = size
    return (
        round(column * width / columns),
        round(row * height / rows),
        round((column + 1) * width / columns),
        round((row + 1) * height / rows),
    )


def split_and_process_sheets() -> dict[str, list[Path]]:
    outputs: dict[str, list[Path]] = {}
    for group, spec in GRID_SHEETS.items():
        source = Image.open(RAW / spec["file"]).convert("RGBA")
        group_outputs: list[Path] = []
        for index, name in enumerate(spec["names"]):
            row, column = divmod(index, 4)
            cell = source.crop(grid_box(source.size, row, column))
            cell_path = CELLS / group / f"{index:02d}-{name}.png"
            cell_path.parent.mkdir(parents=True, exist_ok=True)
            cell.save(cell_path, optimize=True)

            logical = PROCESSED / group / f"{name}.png"
            preview = PREVIEWS / group / f"{name}.png"
            report = REPORTS / group / f"{name}.json"
            process_asset(
                cell_path,
                logical,
                preview,
                report,
                grid=(32, 32),
                scale=8,
                colors=spec["colors"],
                key_mode=spec["key"],
                source_padding=5,
                logical_padding=1 if group == "buildings" else 2,
                transparent_threshold=16,
                opaque_threshold=88 if spec["key"] == "white" else 76,
                alpha_threshold=112,
                contrast=1.06,
                despill=True,
            )
            group_outputs.append(logical)
        outputs[group] = group_outputs
    return outputs


def square_variant(cell: Image.Image, variant: int) -> Image.Image:
    side = min(cell.width, cell.height // 2)
    top = 0 if variant == 0 else cell.height - side
    left = max(0, (cell.width - side) // 2)
    return cell.crop((left, top, left + side, top + side))


def terrain_tile(image: Image.Image) -> Image.Image:
    tile = image.convert("RGB").resize((32, 32), Image.Resampling.LANCZOS)
    tile = tile.filter(ImageFilter.UnsharpMask(radius=0.7, percent=65, threshold=3))
    tile = ImageEnhance.Contrast(tile).enhance(1.05)
    return tile.quantize(colors=64, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGBA")


def build_terrain_atlas() -> Path:
    sheet = Image.open(RAW / "2r4c 场景贴图.png").convert("RGB")
    source_cells = {
        "meadow-0": square_variant(sheet.crop(grid_box(sheet.size, 0, 0)), 0),
        "meadow-1": square_variant(sheet.crop(grid_box(sheet.size, 0, 1)), 1),
        "forest-0": square_variant(sheet.crop(grid_box(sheet.size, 0, 2)), 0),
        "forest-1": square_variant(sheet.crop(grid_box(sheet.size, 0, 3)), 1),
        "water-0": square_variant(sheet.crop(grid_box(sheet.size, 1, 0)), 0),
        "water-1": square_variant(sheet.crop(grid_box(sheet.size, 1, 0)), 1),
        "mountain-0": square_variant(sheet.crop(grid_box(sheet.size, 1, 3)), 0),
        "mountain-1": square_variant(sheet.crop(grid_box(sheet.size, 1, 3)), 1),
        "marsh-0": square_variant(sheet.crop(grid_box(sheet.size, 1, 1)), 0),
        "marsh-1": square_variant(sheet.crop(grid_box(sheet.size, 1, 1)), 1),
        "sand-0": square_variant(sheet.crop(grid_box(sheet.size, 1, 2)), 0),
        "sand-1": square_variant(sheet.crop(grid_box(sheet.size, 1, 2)), 1),
    }
    order = [
        "meadow-0", "meadow-1", "forest-0", "forest-1",
        "water-0", "water-1", "mountain-0", "mountain-1",
        "marsh-0", "marsh-1", "sand-0", "sand-1",
    ]
    atlas = Image.new("RGBA", (8 * 32, 2 * 32), (0, 0, 0, 0))
    terrain_cells = CELLS / "terrain"
    terrain_cells.mkdir(parents=True, exist_ok=True)
    for index, name in enumerate(order):
        source_cells[name].save(terrain_cells / f"{index:02d}-{name}.png", optimize=True)
        atlas.alpha_composite(terrain_tile(source_cells[name]), ((index % 8) * 32, (index // 8) * 32))
    output = PUBLIC / "verdant-generated-terrain.png"
    output.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(output, optimize=True)
    atlas.resize((atlas.width * 4, atlas.height * 4), Image.Resampling.NEAREST).save(
        PREVIEWS / "verdant-generated-terrain.png",
        optimize=True,
    )
    return output


def paste_atlas_cell(atlas: Image.Image, sprite: Image.Image, index: int) -> None:
    atlas.alpha_composite(sprite.convert("RGBA"), ((index % 8) * 32, (index // 8) * 32))


def build_runtime_object_atlas(outputs: dict[str, list[Path]]) -> Path:
    atlas = Image.new("RGBA", (8 * 32, 4 * 32), (0, 0, 0, 0))
    buildings = [Image.open(path) for path in outputs["buildings"]]
    monsters = [Image.open(path) for path in outputs["monsters"]]
    resources = [Image.open(path) for path in outputs["resources"]]
    paste_atlas_cell(atlas, buildings[0], 12)  # camp
    paste_atlas_cell(atlas, buildings[2], 13)  # village hall
    paste_atlas_cell(atlas, buildings[3], 14)  # ruin
    paste_atlas_cell(atlas, buildings[4], 15)  # waystone
    paste_atlas_cell(atlas, monsters[0], 20)
    paste_atlas_cell(atlas, monsters[1], 21)
    paste_atlas_cell(atlas, monsters[2], 22)
    paste_atlas_cell(atlas, resources[0], 23)
    paste_atlas_cell(atlas, resources[1], 24)
    output = PUBLIC / "verdant-generated-objects.png"
    atlas.save(output, optimize=True)
    atlas.resize((atlas.width * 4, atlas.height * 4), Image.Resampling.NEAREST).save(
        PREVIEWS / "verdant-generated-objects.png",
        optimize=True,
    )
    return output


def build_character_atlas(outputs: dict[str, list[Path]]) -> Path:
    atlas = Image.new("RGBA", (8 * 32, 32), (0, 0, 0, 0))
    for index, path in enumerate(outputs["characters"]):
        atlas.alpha_composite(Image.open(path).convert("RGBA"), (index * 32, 0))
    output = PUBLIC / "verdant-generated-characters.png"
    atlas.save(output, optimize=True)
    atlas.resize((atlas.width * 4, atlas.height * 4), Image.Resampling.NEAREST).save(
        PREVIEWS / "verdant-generated-characters.png",
        optimize=True,
    )
    return output


def build_theme_preview(terrain_path: Path, objects_path: Path, characters_path: Path) -> Path:
    terrain = Image.open(terrain_path).convert("RGBA")
    objects = Image.open(objects_path).convert("RGBA")
    characters = Image.open(characters_path).convert("RGBA")
    preview = Image.new("RGBA", (8 * 32, 3 * 32), (15, 25, 20, 255))
    preview.alpha_composite(terrain.crop((0, 0, 8 * 32, 2 * 32)), (0, 0))
    featured_objects = [12, 13, 14, 15, 20, 21, 22, 23]
    for column, index in enumerate(featured_objects):
        source = (
            (index % 8) * 32,
            (index // 8) * 32,
            (index % 8 + 1) * 32,
            (index // 8 + 1) * 32,
        )
        preview.alpha_composite(objects.crop(source), (column * 32, 32))
    preview.alpha_composite(characters, (0, 64))
    output = PUBLIC / "verdant-generated-preview.png"
    preview.save(output, optimize=True)
    return output


def connected_components(alpha: Image.Image, min_area: int) -> list[tuple[int, int, int, int, int]]:
    width, height = alpha.size
    data = alpha.load()
    visited = bytearray(width * height)
    components: list[tuple[int, int, int, int, int]] = []
    for y in range(height):
        for x in range(width):
            start = y * width + x
            if visited[start] or data[x, y] < 128:
                continue
            queue = deque([(x, y)])
            visited[start] = 1
            area = 0
            left = right = x
            top = bottom = y
            while queue:
                cx, cy = queue.popleft()
                area += 1
                left, right = min(left, cx), max(right, cx)
                top, bottom = min(top, cy), max(bottom, cy)
                for nx, ny in (
                    (cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1),
                    (cx - 1, cy - 1), (cx + 1, cy - 1), (cx - 1, cy + 1), (cx + 1, cy + 1),
                ):
                    if 0 <= nx < width and 0 <= ny < height:
                        index = ny * width + nx
                        if not visited[index] and data[nx, ny] >= 128:
                            visited[index] = 1
                            queue.append((nx, ny))
            if area >= min_area:
                components.append((left, top, right + 1, bottom + 1, area))
    return sorted(components, key=lambda item: item[4], reverse=True)


def detect_concept_board_assets() -> list[tuple[int, int, int, int, int]]:
    source = Image.open(RAW / "场景-怪物-素材.png").convert("RGBA")
    key = median_key(source)
    extracted = remove_connected_background(
        source,
        key,
        transparent_threshold=8,
        opaque_threshold=48,
        despill=False,
    )
    all_components = connected_components(extracted.getchannel("A"), min_area=500)
    # The authored board has one large scene at upper-left and intentionally
    # separated assets in the right and bottom margins. Restrict detection to
    # those known zones so foliage fragments inside the scene are not mistaken
    # for standalone sprites.
    components = [
        component
        for index, component in enumerate(all_components)
        if index == 0 or component[0] >= 960 or component[1] >= 990
    ]
    DETECTED.mkdir(parents=True, exist_ok=True)
    for index, (left, top, right, bottom, _) in enumerate(components):
        padding = 8
        box = (
            max(0, left - padding),
            max(0, top - padding),
            min(source.width, right + padding),
            min(source.height, bottom + padding),
        )
        extracted.crop(box).save(DETECTED / f"component-{index:02d}.png", optimize=True)
    return components


def export_world_scene() -> Path:
    source = Image.open(RAW / "大场景.png").convert("RGB")
    if source.width > 1600:
        height = round(source.height * 1600 / source.width)
        source = source.resize((1600, height), Image.Resampling.LANCZOS)
    output = PUBLIC / "verdant-world-scene.webp"
    source.save(output, "WEBP", quality=88, method=6)
    return output


def main() -> None:
    for directory in (CELLS, PROCESSED, PREVIEWS, REPORTS, DETECTED):
        if directory.exists():
            shutil.rmtree(directory)
    for directory in (CELLS, PROCESSED, PREVIEWS, REPORTS, DETECTED, PUBLIC):
        directory.mkdir(parents=True, exist_ok=True)
    outputs = split_and_process_sheets()
    terrain_path = build_terrain_atlas()
    objects_path = build_runtime_object_atlas(outputs)
    characters_path = build_character_atlas(outputs)
    runtime = {
        "terrain": str(terrain_path.relative_to(ROOT)),
        "objects": str(objects_path.relative_to(ROOT)),
        "characters": str(characters_path.relative_to(ROOT)),
        "theme_preview": str(build_theme_preview(terrain_path, objects_path, characters_path).relative_to(ROOT)),
        "world_scene": str(export_world_scene().relative_to(ROOT)),
    }
    components = detect_concept_board_assets()
    manifest = {
        "source_directory": str(RAW.relative_to(ROOT)),
        "grid": {"rows": 2, "columns": 4},
        "runtime_outputs": runtime,
        "detected_components": [
            {"bbox": component[:4], "area": component[4]} for component in components
        ],
        "policy": {
            "raw_sources_are_immutable": True,
            "terrain_cell": 32,
            "sprite_cell": 32,
            "runtime_people": "processed generated 32px pixel characters",
        },
    }
    manifest_path = ROOT / "art/generated/manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
