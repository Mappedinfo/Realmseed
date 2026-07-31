# Realmseed combat-effects prompt pack for GPT Image 2

These prompts produce isolated source art for Realmseed's six combat moves. Keep
the generated source files unmodified; runtime processing should remove the key
background, reduce the palette, and pack every frame onto the 32×32 grid.

## Shared style block

Append this block to every prompt:

> Top-down 2D low-resolution pixel-art game effect, readable at 32×32 pixels,
> dark woodland frontier palette with warm brass highlights, crisp hard pixel
> clusters, no antialiasing, no gradients, no text, no UI, no characters, no
> hands, no scenery, no ground plane, no cast shadow outside the effect. Place
> the effect alone on a perfectly flat chroma-key green background #00FF66.
> Preserve at least 12% empty green padding around every frame. Use a strict
> 2-row × 4-column contact sheet with eight equal cells, showing animation
> frames from earliest at top-left to latest at bottom-right. Every frame must
> remain centered in its own cell and must not cross cell boundaries.

## 01 — Horizontal knife slash / 短刃快击

> Eight-frame animation of a fast horizontal short-blade slash traveling from
> left to right: tiny brass glint, thin ivory blade streak, widening pale-gold
> crescent, sharp center impact spark, then three rapidly fading fragments.
> Compact single-target effect, predominantly horizontal, no sword or wielder.

## 02 — Heavy diagonal cleave / 沉重劈砍

> Eight-frame animation of a heavy diagonal cleave from upper-left to
> lower-right: dark iron wind-up streak, thick ochre blade arc, broad amber
> crescent, square debris impact, orange shock crack, then smoke-dust fragments
> fading. Large single-target melee effect, visibly heavier than a quick slash.

## 03 — Bow arrow projectile / 猎弓穿叶

> Eight-frame animation of one woodland arrow flying from left to right: arrow
> enters, accelerates with two leaf-green speed trails, brass arrowhead glints,
> target impact creates a small ivory star and scattered leaves, then fades.
> Keep the arrow silhouette clear and horizontal; no bow and no archer.

## 04 — Teal seed magic bolt / 青种术弹

> Eight-frame animation of a teal seed-shaped magic projectile flying left to
> right: small cyan-green seed core, luminous square motes, short turquoise
> trail, circular rune at impact, mint energy petals opening and dissolving.
> Magical ranged effect with no wand, caster, letters, or readable symbols.

## 05 — Rifle shot, tracer and smoke / 游侠枪击

> Eight-frame animation of a firearm shot traveling left to right: compact
> amber muzzle flash without a gun, bright ivory tracer line, brass impact
> spark, two frames of grey-green pixel smoke, then small drifting soot blocks.
> Fast long-range single-target effect; no firearm and no character.

## 06 — Coloured field bomb / 野战炸弹

> Eight-frame animation of a small round field bomb following a shallow arc
> from left to right: olive bomb with red-orange fuse, fuse spark, two airborne
> positions, ground contact, large orange-yellow pixel explosion, dark brown
> smoke bloom, then grey-green smoke ring and embers. Area effect must be wider
> than the other attacks, but stay inside each frame.

## Supplemental bomb variants sheet

> A strict 2-row × 4-column inventory contact sheet of eight isolated round
> field bombs, one bomb per cell: ember-red explosive, teal frost bomb,
> moss-green spore bomb, violet mist bomb, brass shrapnel bomb, white smoke
> bomb, amber flash bomb, black powder bomb. Each has a unique fuse and two-tone
> pixel silhouette, viewed from a slightly elevated top-down angle. No
> explosion, no labels, no characters. Use the shared style and green-screen
> requirements, but show eight bomb variants rather than animation frames.

## Supplemental explosion and smoke sheet

> A strict 2-row × 4-column effect contact sheet: four isolated explosion
> stages in the top row from spark to full orange blast, and four isolated smoke
> stages in the bottom row from dense dark puff to thin transparent grey-green
> wisps. No bomb, no debris outside the cells, no characters. Use the shared
> style and green-screen requirements.

## Expected filenames

```text
combat-01-quick-strike.png
combat-02-heavy-cleave.png
combat-03-arrow-shot.png
combat-04-seed-bolt.png
combat-05-rifle-shot.png
combat-06-field-bomb.png
combat-07-bomb-variants.png
combat-08-explosion-smoke.png
```
