#!/usr/bin/env python3
"""Turn a generated image into a deterministic, grid-aligned pixel asset.

The processor is intentionally independent from image generation. It supports
opaque scene art, white backgrounds, and flat chroma-key backgrounds. Background
removal floods inward from the border, so enclosed highlights matching the key
color are preserved.
"""

from __future__ import annotations

import argparse
import json
import math
from collections import deque
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageColor, ImageEnhance, ImageStat


@dataclass(frozen=True)
class ProcessReport:
    input: str
    logical_output: str
    preview_output: str
    source_size: tuple[int, int]
    foreground_bbox: tuple[int, int, int, int]
    grid_size: tuple[int, int]
    preview_scale: int
    requested_colors: int
    actual_colors: int
    key_mode: str
    key_color: tuple[int, int, int] | None
    foreground_pixels: int
    transparent_pixels: int
    alpha_values: tuple[int, ...]


def parse_size(value: str) -> tuple[int, int]:
    width, height = (int(part) for part in value.lower().split("x", maxsplit=1))
    if width <= 0 or height <= 0:
        raise ValueError("grid dimensions must be positive")
    return width, height


def border_pixels(image: Image.Image) -> list[tuple[int, int, int]]:
    rgb = image.convert("RGB")
    width, height = rgb.size
    pixels: list[tuple[int, int, int]] = []
    for x in range(width):
        pixels.append(rgb.getpixel((x, 0)))
        if height > 1:
            pixels.append(rgb.getpixel((x, height - 1)))
    for y in range(1, max(1, height - 1)):
        pixels.append(rgb.getpixel((0, y)))
        if width > 1:
            pixels.append(rgb.getpixel((width - 1, y)))
    return pixels


def median_key(image: Image.Image) -> tuple[int, int, int]:
    pixels = border_pixels(image)
    strip = Image.new("RGB", (len(pixels), 1))
    strip.putdata(pixels)
    median = ImageStat.Stat(strip).median
    return tuple(int(channel) for channel in median[:3])


def color_distance(left: tuple[int, int, int], right: tuple[int, int, int]) -> float:
    # Weighted RGB distance is stable, cheap, and less sensitive to green noise.
    return math.sqrt(
        0.30 * (left[0] - right[0]) ** 2
        + 0.59 * (left[1] - right[1]) ** 2
        + 0.11 * (left[2] - right[2]) ** 2
    )


def remove_connected_background(
    source: Image.Image,
    key: tuple[int, int, int],
    transparent_threshold: float,
    opaque_threshold: float,
    despill: bool,
) -> Image.Image:
    if opaque_threshold <= transparent_threshold:
        raise ValueError("opaque threshold must be larger than transparent threshold")

    image = source.convert("RGBA")
    width, height = image.size
    rgba = list(image.getdata())
    distances = [color_distance(pixel[:3], key) for pixel in rgba]
    visited = bytearray(width * height)
    queue: deque[int] = deque()

    def enqueue(index: int) -> None:
        if not visited[index] and distances[index] < opaque_threshold:
            visited[index] = 1
            queue.append(index)

    for x in range(width):
        enqueue(x)
        enqueue((height - 1) * width + x)
    for y in range(height):
        enqueue(y * width)
        enqueue(y * width + width - 1)

    while queue:
        index = queue.popleft()
        x = index % width
        y = index // width
        if x > 0:
            enqueue(index - 1)
        if x + 1 < width:
            enqueue(index + 1)
        if y > 0:
            enqueue(index - width)
        if y + 1 < height:
            enqueue(index + width)

    key_channel = max(range(3), key=lambda channel: key[channel])
    output: list[tuple[int, int, int, int]] = []
    for index, pixel in enumerate(rgba):
        red, green, blue, original_alpha = pixel
        if not visited[index]:
            output.append(pixel)
            continue
        distance = distances[index]
        matte = max(0.0, min(1.0, (distance - transparent_threshold) / (opaque_threshold - transparent_threshold)))
        alpha = round(original_alpha * matte)
        channels = [red, green, blue]
        if despill and 0 < alpha < 255:
            other_max = max(channels[(key_channel + 1) % 3], channels[(key_channel + 2) % 3])
            channels[key_channel] = min(channels[key_channel], other_max + 8)
        output.append((*channels, alpha))

    result = Image.new("RGBA", image.size)
    result.putdata(output)
    return result


def expanded_bbox(alpha: Image.Image, padding: int) -> tuple[int, int, int, int]:
    bbox = alpha.getbbox()
    if bbox is None:
        raise ValueError("background removal produced an empty image")
    left, top, right, bottom = bbox
    return (
        max(0, left - padding),
        max(0, top - padding),
        min(alpha.width, right + padding),
        min(alpha.height, bottom + padding),
    )


def fit_to_grid(image: Image.Image, size: tuple[int, int], padding: int) -> Image.Image:
    width, height = size
    if padding * 2 >= width or padding * 2 >= height:
        raise ValueError("logical padding leaves no room for the subject")
    content_width = width - padding * 2
    content_height = height - padding * 2
    ratio = min(content_width / image.width, content_height / image.height)
    resized_size = (
        max(1, round(image.width * ratio)),
        max(1, round(image.height * ratio)),
    )
    resized = image.resize(resized_size, Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    offset = ((width - resized.width) // 2, (height - resized.height) // 2)
    canvas.alpha_composite(resized, offset)
    return canvas


def build_palette(pixels: Iterable[tuple[int, int, int]], colors: int) -> list[tuple[int, int, int]]:
    values = list(pixels)
    if not values:
        raise ValueError("no opaque pixels remain for palette generation")
    strip = Image.new("RGB", (len(values), 1))
    strip.putdata(values)
    quantized = strip.quantize(
        colors=min(colors, len(set(values))),
        method=Image.Quantize.MEDIANCUT,
        dither=Image.Dither.NONE,
    ).convert("RGB")
    return sorted(set(quantized.getdata()))


def nearest_color(color: tuple[int, int, int], palette: list[tuple[int, int, int]]) -> tuple[int, int, int]:
    return min(
        palette,
        key=lambda candidate: (
            (color[0] - candidate[0]) ** 2
            + (color[1] - candidate[1]) ** 2
            + (color[2] - candidate[2]) ** 2
        ),
    )


def quantize_rgba(image: Image.Image, colors: int, alpha_threshold: int) -> Image.Image:
    rgba = image.convert("RGBA")
    source = list(rgba.getdata())
    opaque_rgb = [pixel[:3] for pixel in source if pixel[3] >= alpha_threshold]
    palette = build_palette(opaque_rgb, colors)
    cache: dict[tuple[int, int, int], tuple[int, int, int]] = {}
    output: list[tuple[int, int, int, int]] = []
    for red, green, blue, alpha in source:
        if alpha < alpha_threshold:
            output.append((0, 0, 0, 0))
            continue
        rgb = (red, green, blue)
        mapped = cache.setdefault(rgb, nearest_color(rgb, palette))
        output.append((*mapped, 255))
    result = Image.new("RGBA", rgba.size)
    result.putdata(output)
    return result


def resolve_key(image: Image.Image, mode: str) -> tuple[int, int, int] | None:
    normalized = mode.strip().lower()
    if normalized == "none":
        return None
    if normalized == "auto":
        return median_key(image)
    if normalized == "white":
        return (255, 255, 255)
    return ImageColor.getrgb(mode)


def process_asset(
    input_path: Path,
    logical_output: Path,
    preview_output: Path,
    report_output: Path,
    *,
    grid: tuple[int, int],
    scale: int,
    colors: int,
    key_mode: str,
    source_padding: int,
    logical_padding: int,
    transparent_threshold: float,
    opaque_threshold: float,
    alpha_threshold: int,
    contrast: float,
    despill: bool,
) -> ProcessReport:
    source = Image.open(input_path).convert("RGBA")
    key = resolve_key(source, key_mode)
    extracted = (
        remove_connected_background(
            source,
            key,
            transparent_threshold=transparent_threshold,
            opaque_threshold=opaque_threshold,
            despill=despill,
        )
        if key is not None
        else source
    )
    bbox = expanded_bbox(extracted.getchannel("A"), source_padding)
    cropped = extracted.crop(bbox)
    fitted = fit_to_grid(cropped, grid, logical_padding)
    fitted = ImageEnhance.Contrast(fitted).enhance(contrast)
    logical = quantize_rgba(fitted, colors, alpha_threshold)
    preview = logical.resize(
        (logical.width * scale, logical.height * scale),
        Image.Resampling.NEAREST,
    )

    logical_output.parent.mkdir(parents=True, exist_ok=True)
    preview_output.parent.mkdir(parents=True, exist_ok=True)
    report_output.parent.mkdir(parents=True, exist_ok=True)
    logical.save(logical_output, optimize=True)
    preview.save(preview_output, optimize=True)

    pixels = list(logical.getdata())
    report = ProcessReport(
        input=str(input_path),
        logical_output=str(logical_output),
        preview_output=str(preview_output),
        source_size=source.size,
        foreground_bbox=bbox,
        grid_size=grid,
        preview_scale=scale,
        requested_colors=colors,
        actual_colors=len({pixel[:3] for pixel in pixels if pixel[3] > 0}),
        key_mode=key_mode,
        key_color=key,
        foreground_pixels=sum(pixel[3] > 0 for pixel in pixels),
        transparent_pixels=sum(pixel[3] == 0 for pixel in pixels),
        alpha_values=tuple(sorted({pixel[3] for pixel in pixels})),
    )
    report_output.write_text(
        json.dumps(asdict(report), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return report


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Remove a flat background and normalize generated art to a strict pixel grid."
    )
    parser.add_argument("input", type=Path)
    parser.add_argument("--logical-out", type=Path, required=True)
    parser.add_argument("--preview-out", type=Path, required=True)
    parser.add_argument("--report-out", type=Path, required=True)
    parser.add_argument("--grid", default="32x32")
    parser.add_argument("--scale", type=int, default=8)
    parser.add_argument("--colors", type=int, default=16)
    parser.add_argument("--key", default="auto", help="auto, white, none, or a CSS hex color")
    parser.add_argument("--source-padding", type=int, default=8)
    parser.add_argument("--logical-padding", type=int, default=2)
    parser.add_argument("--transparent-threshold", type=float, default=18)
    parser.add_argument("--opaque-threshold", type=float, default=92)
    parser.add_argument("--alpha-threshold", type=int, default=128)
    parser.add_argument("--contrast", type=float, default=1.08)
    parser.add_argument("--no-despill", action="store_true")
    args = parser.parse_args()

    report = process_asset(
        args.input,
        args.logical_out,
        args.preview_out,
        args.report_out,
        grid=parse_size(args.grid),
        scale=args.scale,
        colors=args.colors,
        key_mode=args.key,
        source_padding=args.source_padding,
        logical_padding=args.logical_padding,
        transparent_threshold=args.transparent_threshold,
        opaque_threshold=args.opaque_threshold,
        alpha_threshold=args.alpha_threshold,
        contrast=args.contrast,
        despill=not args.no_despill,
    )
    print(json.dumps(asdict(report), ensure_ascii=False))


if __name__ == "__main__":
    main()
