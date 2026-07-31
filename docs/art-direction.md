# Realmseed art direction

## Chosen production direction

The first production set uses **Verdant Relic**: an earthy green world with
muted teal water, warm human settlements, and cyan supernatural landmarks.
The palette is deliberately less saturated than the UI so people, coins,
monsters, and waystones remain readable on busy terrain.

Two alternate concept prompts are retained in `art/prompts/`:

- **Ember Frontier** — warmer, drier, more political and settlement-led.
- **Moonlit Tide** — cooler, stranger, more magical and exploration-led.

The three prompts are original production briefs rather than references to a
specific commercial game.

## Pixel contract

- Logical terrain and sprite cell: **16×16 px**.
- Runtime display cell: **32×32 px**, exact 2× nearest-neighbor scaling.
- Atlas: **128×48 px**, eight columns and three rows.
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
reference, redraw into the 16×16 contract, then regenerate the checked-in atlas:

```bash
python3 scripts/build_pixel_atlas.py
```

This separation prevents malformed AI sprite sheets, inconsistent cell sizes,
anti-aliased edges, and hidden gradients from reaching gameplay.

## Atlas layout

| Row | Cells 0–7 |
| --- | --- |
| 0 | meadow×2, forest×2, water×2, mountain×2 |
| 1 | marsh×2, sand×2, camp, village, ruin, waystone |
| 2 | player, wanderer, villager, follower, slime, boar, wisp, coin |

The TypeScript lookup is defined in `src/game/art.ts`. Changing the image
without changing that contract is safe; changing the layout requires updating
both the atlas builder and lookup.
