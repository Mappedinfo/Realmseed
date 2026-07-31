# Realmseed art direction

## Production directions

Realmseed ships three comparable directions. Verdant Relic now demonstrates a
hybrid production direction; Ember Frontier and Moonlit Tide retain the
original compact atlas contract:

- **Verdant Relic** — relatively detailed 32×32 generated terrain under
  palette-limited pixel characters, monsters, resources, and buildings.
- **Ember Frontier** — ochre grass, iron-blue water, old-plum shadows, red
  travel scarves, camp pennants, and warmer settlement landmarks.
- **Moonlit Tide** — blue-green foliage, deep water, lavender stone, coral
  travel ribbons, bioluminescent flowers, and shrine moon-signs.

The start screen previews all three, and the in-game header can swap art packs
without regenerating the world. This keeps seed, terrain, agents, economy, and
fog identical while isolating the visual choice. Verdant also uses the supplied
full-world scene as its title backdrop. The corresponding concept prompts are
retained in `art/prompts/`; they are original production briefs rather than
references to a specific commercial game.

## Pixel contract

- Original logical terrain and sprite cell: **16×16 px**.
- Generated Verdant terrain and sprite cell: **32×32 px**.
- Runtime display cell: **32×32 px**, with image smoothing disabled.
- Atlas: **128×48 px**, eight columns and three rows, one file per direction.
- Generated terrain atlas: **256×64 px**; generated object atlas:
  **256×128 px**; generated character atlas: **256×32 px**.
- Four-direction character and monster atlases: **256×128 px**, eight
  identities across columns and south/north/west/east across rows.
- Character `west` source poses are normalized with a horizontal flip after
  extraction because the generated source faces screen-right. Raw cells remain
  immutable, and monster directions are not flipped.
- Palette caps: **64 colors** per generated terrain tile and **24–32 colors**
  per generated sprite.
- No runtime smoothing, sub-pixel placement, blur, or CSS filtering.
- Terrain occupies the full cell; structures and actors use transparency.
- Actors reserve the bottom two rows for a consistent contact shadow.
- Light comes from the upper-left; shadows step down/right in whole pixels.
- Cyan is reserved for magic, gold for economy/selection, and ember for danger.

## Generation and normalization

The image-generation prompts live under `art/prompts/`. Supplied source images
are preserved under `art/generated/raw/` and are never edited in place. To
reproduce the currently shipped Verdant pack:

```bash
python3 scripts/ingest_generated_assets.py
```

The intake performs exact grid splitting, border-connected white/green
background removal, chroma spill cleanup, alpha cropping, palette reduction,
and deterministic atlas packing. It also extracts review crops from the mixed
concept board with connected-component detection. Intermediate cells, previews,
reports, and the build manifest live under `art/generated/`.

Four-direction source sheets have their own reproducible intake:

```bash
python3 scripts/ingest_directional_assets.py
```

Its source, cells, processed sprites, enlarged review previews, reports, and
layout manifest live under `art/generated/directional/`. The checked-in runtime
outputs are `verdant-directional-characters.png` and
`verdant-directional-monsters.png`. The associated combat-move and equipment
generation brief is retained in
`art/prompts/combat-moves-equipment-gpt-image-2.md`.

The isolated 2×4-frame effect sheets for horizontal slash, diagonal cleave,
arrow, seed bolt, rifle tracer/smoke, colored bombs, explosions, and smoke use a
strict `#00FF66` key background and are specified in
`art/prompts/combat-effects-gpt-image-2.md`. Runtime CSS effects currently honor
the same timing contract, so generated sheets can replace them without moving
character sprites or changing combat simulation code.

For one-off concept normalization, use:

```bash
python3 scripts/pixelize_concept.py concept.png \
  public/assets/art/concepts/verdant-scene.png \
  --crop 0,0,1024,1024 --grid 128x128 --scale 4 --colors 24
```

The process is deterministic:

1. crop a semantically coherent region;
2. composite transparency over the Realmseed ink color;
3. reduce to the requested logical grid with Lanczos;
4. quantize without dithering;
5. upscale with nearest-neighbor only.

The original hand-built 16×16 atlases can still be regenerated independently:

```bash
python3 scripts/build_pixel_atlas.py
```

This separation prevents malformed AI sprite sheets, inconsistent cell sizes,
anti-aliased edges, and hidden gradients from reaching gameplay. It also means
an unavailable generation service never becomes a runtime or build dependency.

## Atlas layout

| Row | Cells 0–7 |
| --- | --- |
| 0 | meadow×2, forest×2, water×2, mountain×2 |
| 1 | marsh×2, sand×2, camp, village, ruin, waystone |
| 2 | player, wanderer, villager, follower, slime, boar, wisp, coin |

The TypeScript lookup and theme metadata are defined in `src/game/art.ts`.
Changing an image without changing that contract is safe; changing the layout
requires updating both the atlas builder and lookup.
