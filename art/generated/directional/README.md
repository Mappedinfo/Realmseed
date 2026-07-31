# Four-direction characters and monsters

The four source sheets in `raw/` are project-provided GPT Image outputs. Each
sheet is a strict 4×4 layout:

- rows: four different identities;
- columns: south/front, north/back, west/left, east/right.

Run the deterministic intake:

```bash
python3 scripts/ingest_directional_assets.py
```

The script preserves the source files, removes their connected white
background, converts each subject to a palette-limited transparent 32×32
sprite, and packs two runtime atlases. Runtime atlas columns are identities and
rows are directions. `manifest.json` is the authoritative layout contract.

The source drawings are direction references rather than final animation
frames. Movement animation currently comes from whole-pixel bobbing; later
walk-cycle sheets can extend each direction without changing game state.
