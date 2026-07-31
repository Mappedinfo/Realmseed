# Generated artwork intake

This directory keeps the seven user-provided GPT Image source images and every
deterministic derivative used to review or ship them.

## Directory contract

- `raw/`: immutable source images moved from `~/Downloads/素材/`.
- `cells/`: exact 2-row × 4-column source crops.
- `processed/`: keyed, cropped, palette-limited 32×32 logical sprites.
- `previews/`: nearest-neighbor enlargements for visual inspection.
- `reports/`: machine-readable processing reports.
- `detected/`: connected-component crops from the mixed concept board.
- `manifest.json`: runtime output paths, grid settings, and detected bounds.

The runtime uses the more detailed generated terrain as its 32×32 background,
then draws palette-limited pixel characters, monsters, buildings, and resources
over it. The original hand-built atlases remain the fallback and continue to
power the Ember and Moonlit themes.

## Rebuild

Pillow is the only Python dependency:

```bash
python3 scripts/ingest_generated_assets.py
```

The intake script splits all labeled grid sheets, removes white or green
backgrounds with border-connected flood filling, removes color spill, crops by
alpha, fits each object into a common cell, quantizes without dithering, and
exports runtime atlases. The operation is deterministic and never modifies
anything in `raw/`.

The mixed concept board uses lightweight connected-component detection rather
than a learned detector. Its flat dark background and separated objects make
this method both more reproducible and easier to audit.
