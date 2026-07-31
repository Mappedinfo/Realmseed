#!/usr/bin/env python3
"""Normalize generated concept art into a strict low-resolution pixel grid."""

import argparse
from pathlib import Path
from PIL import Image, ImageEnhance


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Crop, reduce, quantize and nearest-neighbor upscale a concept image."
    )
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--crop", default=None, help="left,top,right,bottom")
    parser.add_argument("--grid", default="128x128", help="canonical low-res grid, e.g. 128x128")
    parser.add_argument("--scale", type=int, default=4)
    parser.add_argument("--colors", type=int, default=24)
    parser.add_argument("--contrast", type=float, default=1.08)
    args = parser.parse_args()

    image = Image.open(args.input).convert("RGBA")
    if args.crop:
        image = image.crop(tuple(int(value) for value in args.crop.split(",")))
    width, height = (int(value) for value in args.grid.lower().split("x"))
    rgb = Image.new("RGB", image.size, "#17201d")
    rgb.paste(image, mask=image.getchannel("A"))
    rgb = ImageEnhance.Contrast(rgb).enhance(args.contrast)
    low = rgb.resize((width, height), Image.Resampling.LANCZOS)
    low = low.quantize(colors=args.colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB")
    output = low.resize((width * args.scale, height * args.scale), Image.Resampling.NEAREST)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    output.save(args.output, optimize=True)
    print(f"Wrote {args.output} from {width}x{height}, {args.colors} colors, {args.scale}x nearest-neighbor")


if __name__ == "__main__":
    main()
