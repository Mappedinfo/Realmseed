#!/usr/bin/env python3
"""Build four-direction Realmseed character and monster atlases.

The four user-provided 4x4 sheets are preserved in
art/generated/directional/raw. Each source row is one identity and the source
columns are south, north, west, east.
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path

from PIL import Image

from process_generated_asset import process_asset

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "art/generated/directional"
RAW = BASE / "raw"
CELLS = BASE / "cells"
PROCESSED = BASE / "processed"
PREVIEWS = BASE / "previews"
REPORTS = BASE / "reports"
PUBLIC = ROOT / "public/assets/art"

DIRECTIONS = ["south", "north", "west", "east"]
# GPT Image produced the character "west" column facing screen-right. Keep the
# immutable source crop, then normalize only that derived output by mirroring it.
# Monster west/east columns are already correct and must not be flipped.
HORIZONTAL_FLIP_OUTPUTS = {("characters", "west")}
SHEETS = [
    {
        "group": "characters",
        "file": "ChatGPT Image 2026年7月31日 13_38_46 (1).png",
        "names": ["traveler", "keeper", "farmer", "scout"],
        "colors": 28,
    },
    {
        "group": "characters",
        "file": "ChatGPT Image 2026年7月31日 13_38_46 (2).png",
        "names": ["merchant", "healer", "guard", "scholar"],
        "colors": 28,
    },
    {
        "group": "monsters",
        "file": "ChatGPT Image 2026年7月31日 13_38_48 (3).png",
        "names": ["slime", "boar", "wisp", "rock-crab"],
        "colors": 30,
    },
    {
        "group": "monsters",
        "file": "ChatGPT Image 2026年7月31日 13_38_48 (4).png",
        "names": ["marsh-crawler", "ember-moth", "moon-jelly", "seed-guardian"],
        "colors": 30,
    },
]


def grid_box(size: tuple[int, int], row: int, column: int) -> tuple[int, int, int, int]:
    width, height = size
    return (
        round(column * width / 4),
        round(row * height / 4),
        round((column + 1) * width / 4),
        round((row + 1) * height / 4),
    )


def main() -> None:
    for directory in (CELLS, PROCESSED, PREVIEWS, REPORTS):
        if directory.exists():
            shutil.rmtree(directory)
        directory.mkdir(parents=True, exist_ok=True)
    PUBLIC.mkdir(parents=True, exist_ok=True)

    names_by_group: dict[str, list[str]] = {"characters": [], "monsters": []}
    processed: dict[tuple[str, str, str], Path] = {}
    for spec in SHEETS:
        source = Image.open(RAW / spec["file"]).convert("RGBA")
        names_by_group[spec["group"]].extend(spec["names"])
        for row, name in enumerate(spec["names"]):
            for column, direction in enumerate(DIRECTIONS):
                cell = source.crop(grid_box(source.size, row, column))
                cell_path = CELLS / spec["group"] / name / f"{direction}.png"
                cell_path.parent.mkdir(parents=True, exist_ok=True)
                cell.save(cell_path, optimize=True)
                logical = PROCESSED / spec["group"] / name / f"{direction}.png"
                preview = PREVIEWS / spec["group"] / name / f"{direction}.png"
                report = REPORTS / spec["group"] / name / f"{direction}.json"
                process_asset(
                    cell_path,
                    logical,
                    preview,
                    report,
                    grid=(32, 32),
                    scale=8,
                    colors=spec["colors"],
                    key_mode="white",
                    source_padding=4,
                    logical_padding=1,
                    transparent_threshold=14,
                    opaque_threshold=82,
                    alpha_threshold=112,
                    contrast=1.06,
                    despill=True,
                )
                if (spec["group"], direction) in HORIZONTAL_FLIP_OUTPUTS:
                    for output_path in (logical, preview):
                        image = Image.open(output_path).convert("RGBA")
                        image.transpose(Image.Transpose.FLIP_LEFT_RIGHT).save(output_path, optimize=True)
                    report_data = json.loads(report.read_text(encoding="utf-8"))
                    report_data["postprocess"] = {"horizontal_flip": True}
                    report.write_text(
                        json.dumps(report_data, ensure_ascii=False, indent=2) + "\n",
                        encoding="utf-8",
                    )
                processed[(spec["group"], name, direction)] = logical

    runtime: dict[str, str] = {}
    for group, names in names_by_group.items():
        atlas = Image.new("RGBA", (8 * 32, 4 * 32), (0, 0, 0, 0))
        for column, name in enumerate(names):
            for row, direction in enumerate(DIRECTIONS):
                sprite = Image.open(processed[(group, name, direction)]).convert("RGBA")
                atlas.alpha_composite(sprite, (column * 32, row * 32))
        output = PUBLIC / f"verdant-directional-{group}.png"
        atlas.save(output, optimize=True)
        atlas.resize((atlas.width * 4, atlas.height * 4), Image.Resampling.NEAREST).save(
            PREVIEWS / f"verdant-directional-{group}.png",
            optimize=True,
        )
        runtime[group] = str(output.relative_to(ROOT))

    manifest = {
        "source_directory": str(RAW.relative_to(ROOT)),
        "source_grid": {"rows": 4, "columns": 4},
        "source_column_order": DIRECTIONS,
        "runtime_layout": {
            "cell": 32,
            "columns": names_by_group,
            "rows": DIRECTIONS,
        },
        "runtime_outputs": runtime,
        "postprocess": {
            "horizontal_flip": {
                "characters": ["west"],
                "monsters": [],
            },
        },
        "policy": {
            "raw_sources_are_immutable": True,
            "white_background_is_removed": True,
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
