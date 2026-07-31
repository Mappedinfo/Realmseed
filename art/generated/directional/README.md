# Four-direction characters and monsters

The source sheets in `raw/` are project-provided GPT Image outputs. The first
four sheets are strict 4×4 layouts:

- rows: four different identities;
- columns: south/front, north/back, west/left, east/right.

`new-roles-characters-monsters-2026-07-31.png` is a combined 2×2 presentation
board with headings and row labels. The intake script records explicit pixel
grid areas for its two upper character panels and currently extracts:

- explorer, swordsman, mystic, priest;
- ranger, engineer, caravan merchant, bard.

The two lower monster panels remain preserved in the immutable source but are
not yet ingested because their horizontal facing convention needs a separate
normalization decision.

Run the deterministic intake:

```bash
python3 scripts/ingest_directional_assets.py
```

The script preserves the source files, removes their connected white
background, converts each subject to a palette-limited transparent 32×32
sprite, and packs two runtime atlases. Runtime atlas columns are identities and
rows are directions. `manifest.json` is the authoritative layout contract.

The generated character sheets, including the combined board, contain a
screen-right-facing pose in the source `west` column. The ingestion pipeline
preserves the immutable source crop and horizontally mirrors only the derived
character `west` sprites.
Monster left/right source poses are already correct and are not mirrored.

The source drawings are direction references rather than final animation
frames. Movement animation currently comes from whole-pixel bobbing; later
walk-cycle sheets can extend each direction without changing game state.
