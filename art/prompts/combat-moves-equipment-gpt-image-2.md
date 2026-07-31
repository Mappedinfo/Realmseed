# Realmseed combat move and equipment prompts

These prompts are for the next asset pass. Generate each sheet separately.
Realmseed will preserve the originals, remove the green background, normalize
each cell to 32×32, and keep equipment in the inventory UI rather than drawing
it on character bodies.

## Shared production contract

Append this block to every prompt:

> Original open-source game asset, no logos, no text, no letters, no numbers,
> no watermark, no UI frame, no copyrighted character or franchise reference.
> Orthographic 2D game asset, clear silhouette, upper-left light, hard readable
> edges, limited earthy palette with gold economy accents and cyan magic
> accents. Exactly 4 columns × 4 rows, equal cells, one centered isolated asset
> per cell, generous internal padding, no overlap across cells. Flat chroma-key
> background RGB #00FF66, no cast shadow touching the cell boundary.

## Sheet A — weapons and tools

> Create a coherent Realmseed equipment sprite sheet for a forest-frontier
> exploration RPG. Four columns by four rows:
>
> Row 1, melee physical: field knife, iron short sword, two-handed woodsman axe,
> mossbound war hammer.
>
> Row 2, ranged physical and firearm: ashwood hunting bow, compact crossbow,
> weathered frontier pistol, long-barrel ranger rifle.
>
> Row 3, magic: seedwood wand with cyan core, crooked grove staff, tideglass
> focus orb, ember rune grimoire.
>
> Row 4, explosives and defense: clay berry-bomb with fuse, iron fragmentation
> bomb, round bark-and-iron shield, stitched explorer coat folded as an inventory
> icon.
>
> Every item is shown alone at a three-quarter inventory-icon angle. Materials
> are practical, worn, repairable, and visually consistent with Verdant Relic.

## Sheet B — attack effects

> Create sixteen isolated combat-effect sprites for Realmseed, four columns by
> four rows:
>
> Row 1, melee physical: quick slash arc, heavy cleave arc, blunt impact burst,
> shield counter spark.
>
> Row 2, ranged physical/firearm: arrow streak, crossbow bolt streak, small
> muzzle flash with one projectile trail, rifle muzzle flash with longer trail.
>
> Row 3, magic: cyan seed bolt, branching root snare, pale-blue tide wave,
> orange ember burst.
>
> Row 4, explosives: small dirt-and-smoke pop, wide fragmentation burst, sticky
> alchemical flame patch, concussive dust ring.
>
> Effects must be readable at 32×32 and contain no weapon, hand, character,
> scenery, words, damage number, or UI element.

## Sheet C — equipment rarity variants

> Create sixteen inventory icons as four equipment families across four rarity
> rows. Columns: short sword, ranger rifle, grove staff, field bomb. Rows:
> common repaired gear, uncommon faction-crafted gear, rare relic gear,
> legendary seed-awakened gear. Preserve the exact silhouette within each
> column; rarity changes material, trim, glow intensity, and small attachments,
> never overall scale. Common uses iron, wood, leather. Uncommon adds faction
> color. Rare adds restrained cyan runes. Legendary adds a small gold-and-cyan
> seed core without excessive bloom.

## Optional single-item correction prompt

> Regenerate only one isolated Realmseed inventory item: [ITEM NAME]. Centered,
> full object visible, three-quarter inventory angle, no hand or character,
> readable at 32×32, 12 percent padding on every side, flat chroma-key background
> RGB #00FF66. Match the earthy Verdant Relic materials and the silhouette of
> the corresponding cell in the approved sheet.
