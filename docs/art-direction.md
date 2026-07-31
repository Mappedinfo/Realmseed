# Realmseed art direction

## Production directions

Realmseed ships three comparable directions on the same pixel contract:

- **Verdant Relic** — earthy green, muted teal water, warm settlements, and
  cyan supernatural landmarks.
- **Ember Frontier** — ochre grass, iron-blue water, old-plum shadows, red
  travel scarves, camp pennants, and warmer settlement landmarks.
- **Moonlit Tide** — blue-green foliage, deep water, lavender stone, coral
  travel ribbons, bioluminescent flowers, and shrine moon-signs.

The start screen previews all three, and the in-game header can swap atlases
without regenerating the world. This keeps seed, terrain, agents, economy, and
fog identical while isolating the visual choice. The corresponding concept
prompts are retained in `art/prompts/`; they are original production briefs
rather than references to a specific commercial game.

## Pixel contract

- Logical terrain and sprite cell: **16×16 px**.
- Runtime display cell: **32×32 px**, exact 2× nearest-neighbor scaling.
- Atlas: **128×48 px**, eight columns and three rows, one file per direction.
- Hard palette cap for generated concepts: **24 colors** per processed image.
- No runtime smoothing, sub-pixel placement, blur, or CSS filtering.
- Terrain occupies the full cell; structures and actors use transparency.
- Actors reserve the bottom two rows for a consistent contact shadow.
- Light comes from the upper-left; shadows step down/right in whole pixels.
- Cyan is reserved for magic, gold for economy/selection, and ember for danger.

## Generation and normalization

The image-generation prompts live under `art/prompts/`. A generated image is
only a source concept; it is never shipped directly. Normalize a useful crop:

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

For production sprites, use the normalized concept as a color and silhouette
reference, redraw into the 16×16 contract, then regenerate all checked-in
atlases:

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
