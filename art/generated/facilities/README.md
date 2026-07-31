# Generated settlement facilities

The source folder `raw/facility-set-2026-07-31/` was moved from the user's
`Downloads/设施x8` directory and is preserved as the immutable GPT Image source.

The green-screen production sheet is a 2×4 grid:

1. camp core;
2. traveler house;
3. forest farm;
4. watchtower;
5. tarp market;
6. repair workshop;
7. ember shrine;
8. road gate.

Run the deterministic intake:

```bash
python3 scripts/ingest_facility_assets.py
```

The script splits the source, removes the connected green background, fits each
facility to a transparent palette-limited 32×32 cell, writes per-item reports,
packs `public/assets/art/verdant-facilities.png`, and converts the supplied day
and night settlement scenes to deployable WebP references.

`manifest.json` is the authoritative source and runtime layout contract.
