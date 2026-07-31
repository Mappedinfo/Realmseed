#!/usr/bin/env python3
"""Split and normalize the eight generated Realmseed settlement facilities."""

from __future__ import annotations

import json
import shutil
from pathlib import Path

from PIL import Image

from process_generated_asset import process_asset

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "art/generated/facilities"
RAW = BASE / "raw/facility-set-2026-07-31"
CELLS = BASE / "cells"
PROCESSED = BASE / "processed"
PREVIEWS = BASE / "previews"
REPORTS = BASE / "reports"
PUBLIC = ROOT / "public/assets/art"

SPRITE_SOURCE = RAW / "ChatGPT Image 2026年7月31日 19_32_09 (1).png"
DAY_SOURCE = RAW / "ChatGPT Image 2026年7月31日 19_32_09 (2).png"
NIGHT_SOURCE = RAW / "ChatGPT Image 2026年7月31日 19_32_10 (3).png"

FACILITIES = [
    "camp-core",
    "house",
    "farm",
    "watchtower",
    "market",
    "workshop",
    "shrine",
    "road-gate",
]


def grid_box(size: tuple[int, int], index: int) -> tuple[int, int, int, int]:
    width, height = size
    row, column = divmod(index, 4)
    return (
        round(column * width / 4),
        round(row * height / 2),
        round((column + 1) * width / 4),
        round((row + 1) * height / 2),
    )


def main() -> None:
    for directory in (CELLS, PROCESSED, PREVIEWS, REPORTS):
        if directory.exists():
            shutil.rmtree(directory)
        directory.mkdir(parents=True, exist_ok=True)
    PUBLIC.mkdir(parents=True, exist_ok=True)

    source = Image.open(SPRITE_SOURCE).convert("RGBA")
    processed: list[Path] = []
    for index, name in enumerate(FACILITIES):
        cell_path = CELLS / f"{index:02d}-{name}.png"
        source.crop(grid_box(source.size, index)).save(cell_path, optimize=True)
        logical = PROCESSED / f"{index:02d}-{name}.png"
        preview = PREVIEWS / f"{index:02d}-{name}.png"
        report = REPORTS / f"{index:02d}-{name}.json"
        process_asset(
            cell_path,
            logical,
            preview,
            report,
            grid=(32, 32),
            scale=8,
            colors=32,
            key_mode="auto",
            source_padding=6,
            logical_padding=1,
            transparent_threshold=42,
            opaque_threshold=148,
            alpha_threshold=112,
            contrast=1.05,
            despill=True,
        )
        processed.append(logical)

    atlas = Image.new("RGBA", (len(FACILITIES) * 32, 32), (0, 0, 0, 0))
    for index, path in enumerate(processed):
        atlas.alpha_composite(Image.open(path).convert("RGBA"), (index * 32, 0))
    atlas_output = PUBLIC / "verdant-facilities.png"
    atlas.save(atlas_output, optimize=True)
    atlas.resize((atlas.width * 4, atlas.height * 4), Image.Resampling.NEAREST).save(
        PREVIEWS / "verdant-facilities.png",
        optimize=True,
    )

    scene_outputs: dict[str, str] = {}
    for label, path in (("day", DAY_SOURCE), ("night", NIGHT_SOURCE)):
        output = PUBLIC / f"verdant-camp-scene-{label}.webp"
        Image.open(path).convert("RGB").save(output, "WEBP", quality=88, method=6)
        scene_outputs[label] = str(output.relative_to(ROOT))

    manifest = {
        "source_directory": str(RAW.relative_to(ROOT)),
        "source_sheet": str(SPRITE_SOURCE.relative_to(ROOT)),
        "source_grid": {"rows": 2, "columns": 4},
        "runtime_layout": {"cell": 32, "columns": FACILITIES, "rows": 1},
        "runtime_output": str(atlas_output.relative_to(ROOT)),
        "scene_outputs": scene_outputs,
        "policy": {
            "raw_sources_are_immutable": True,
            "green_background_is_removed": True,
            "runtime_palette_is_limited": True,
        },
    }
    (BASE / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
