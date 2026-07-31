# Realmseed

> 一粒种子，一方世界。

Realmseed is an open-source, static-first pixel exploration and settlement game
for the browser. A text seed and unbounded scene coordinates deterministically
generate connected regions, their terrain, travelers, factions, monsters,
coins, and ruins. Everything runs locally in the browser and can be deployed
directly to GitHub Pages.

![Three selectable Realmseed art directions](docs/screenshots/art-direction-picker.png)

## Playable prototype

- an unbounded scene grid: travel north, south, east, or west forever
- 40×40 quick scenes and 96×96 expedition scenes
- deterministic scene caching that preserves fog, villages, resources, and monsters
- four pixel-art waystone transport facilities in every scene
- deterministic procedural terrain and societies
- three-state fog of war: visible, explored, unseen
- villagers and the abstracted traveling party provide persistent vision
- keyboard, button, and adjacent-tile movement
- stamina, coins, affection, recruitment, camps, buildings, roads, and settlement income
- recruited followers leave the crowded world canvas and move into a clickable
  party roster with switchable portraits
- camps with visible control ranges, population, defense, economy, buildings,
  construction progress, and automatic return paths
- automatic passable roads between same-scene camps with reduced movement fatigue
- faction reputation, fealty oaths, oath breaking, and tribute-paying vassals
- three AI factions, wandering agents, followers, and monsters
- four-direction characters, probabilistic monster alerts and pursuit
- persistent default plus per-encounter field/duel combat modes
- melee/ranged physical, magic, firearm, and explosive moves with equipment bonuses
- responsive pixel UI with a full-world minimap
- a hybrid Verdant art pack: detailed 32×32 terrain beneath processed pixel
  characters, monsters, buildings, resources, and waystones
- deterministic white/green-screen removal, grid splitting, object extraction,
  palette reduction, and strict 32×32 atlas packing
- original 16×16 source atlases as fallbacks for the Ember and Moonlit themes
- three selectable art directions that can be switched without restarting the world
- optional CC0 music with a visible playback control

## Architecture

```text
src/
├── components/          React interface and Canvas views
├── game/
│   ├── rng.ts           deterministic seeded random utilities
│   ├── world.ts         terrain, society, monster, and fog generation
│   ├── simulation.ts    turns, scene travel/cache, economy, and social rules
│   ├── combat.ts        moves, damage categories, and equipment values
│   ├── art.ts           canonical sprite-atlas contract
│   └── types.ts         domain contracts
├── App.tsx              application composition
└── styles.css           responsive pixel-art design system
```

The simulation layer is kept free of React and browser rendering code. This
makes the rules deterministic, testable, and ready for future save files,
workers, multiplayer adapters, or richer AI policies.

The full product and system rationale is documented in
[`docs/game-design.md`](docs/game-design.md).
The three visual directions, pixel contract, generation prompts, and
normalization pipeline are documented in
[`docs/art-direction.md`](docs/art-direction.md).

## Local development

```bash
npm install
npm run dev
```

Quality checks:

```bash
npm test
npm run build
python3 scripts/build_pixel_atlas.py
python3 scripts/ingest_generated_assets.py
python3 scripts/ingest_directional_assets.py
```

## Controls

- Move: `WASD`, arrow keys, direction pad, or click an adjacent tile
- Talk: gain affection with an adjacent traveler and reputation with their faction
- Interaction: adjacent people gain a speech bubble; click the bubble or person
  to open the lower-center dialogue and trade counter
- Inspect: click any visible person, monster, building, resource, road, or terrain
  tile to open its contextual detail card in the left column; element tiles are
  inspected before movement, while clicking an adjacent empty tile still moves
- Recruit: requires 3 affection and 5 gold
- Party: recruited followers are hidden from the world canvas; click the left
  roster to switch the top-left portrait, which defaults to the player
- Build camp: requires 8 gold and creates a highlighted control radius
- Construction: after founding a camp, each 100 successful movement steps grant
  one building tile; select a highlighted empty tile, then build a house,
  watchtower, or market
- Camp navigation: select a camp in the left list to inspect its attributes or
  auto-path home; same-scene camps automatically receive passable roads
- Roads: road tiles spend only 0.35 movement fatigue instead of 1
- Station: turn a follower into a villager at a camp; the village stays lit and
  produces 1 gold each rest
- Stamina: ordinary movement spends 1 point per 100 steps; combat steps count
  1.5×, and deterministic enemy hits cost only 0 or 1 point
- Berries: terrain-weighted pickups enter the left inventory; click to consume
  one berry and restore 1 stamina
- Trade: each nearby person offers a deterministic daily rate of 8–12 berries
  per gold, centered on the 10:1 world economy
- Combat growth: every victory raises maximum stamina by 1, capped at 30
- Rest: restore full stamina normally; at zero, manual or automatic exhausted
  rest recovers to 3, resets step fatigue, collects income, and advances the world
- Combat: choose map-direct or left/right duel as the persistent default, then
  temporarily override it per encounter; six moves cover melee/ranged and all
  four damage categories
- Equipment: equip numerical bonuses in the left panel without drawing gear on
  the character sprite
- Scene travel: accumulate 25 steps of fatigue to take a waystone route to the adjacent
  deterministic scene; followers travel with you while staffed villages remain
  behind and continue to preserve that scene's explored state
- Swear fealty: requires 15 faction reputation and grants 4 expedition gold
- Break oath: return to independent status at the cost of 3 gold and 20 reputation
- Establish a vassal: while independent, use one staffed village, 30 reputation,
  and 10 gold to make a faction pay 2 gold tribute each rest

## GitHub Pages

The included workflow builds and deploys the static `dist/` directory. In the
repository settings, choose **GitHub Actions** as the Pages source. The Vite base
path is automatically set to `/Realmseed/` in GitHub Actions.

## Roadmap

1. Persist the infinite scene cache and several seed worlds with IndexedDB.
2. Add faction wars, settlement ownership, and negotiated tribute rates.
3. Expand follower AI from trailing/guarding into gathering and combat jobs.
4. Add buildings, production chains, quests, and boss monsters.
5. Split world simulation into a Web Worker for maps larger than 256×256.
6. Add mod-friendly JSON content packs and localization.

## Licenses

- Code: MIT, see [LICENSE](LICENSE).
- Music and third-party credits: [THIRD_PARTY.md](THIRD_PARTY.md).
