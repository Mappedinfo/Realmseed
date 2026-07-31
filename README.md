# Realmseed

> 一粒种子，一方世界。

Realmseed is an open-source, static-first pixel exploration and settlement game
for the browser. A text seed and unbounded scene coordinates deterministically
generate connected regions, their terrain, travelers, factions, monsters,
coins, and ruins. Everything runs locally in the browser and can be deployed
directly to GitHub Pages.

## Playable prototype

- an unbounded scene grid: travel north, south, east, or west forever
- 40×40 quick scenes and 96×96 expedition scenes
- deterministic scene caching that preserves fog, villages, resources, and monsters
- four pixel-art waystone transport facilities in every scene
- deterministic procedural terrain and societies
- three-state fog of war: visible, explored, unseen
- villagers and followers provide persistent vision
- keyboard, button, and adjacent-tile movement
- stamina, coins, affection, recruitment, camps, and village income
- followers that actively trail the player on every world turn
- faction reputation, fealty oaths, oath breaking, and tribute-paying vassals
- three AI factions, wandering agents, followers, and monsters
- responsive pixel UI with a full-world minimap
- 32×32 terrain cells and higher-detail characters, monsters, buildings, and waystones
- optional CC0 music with a visible playback control

## Architecture

```text
src/
├── components/          React interface and Canvas views
├── game/
│   ├── rng.ts           deterministic seeded random utilities
│   ├── world.ts         terrain, society, monster, and fog generation
│   ├── simulation.ts    turns, scene travel/cache, economy, and social rules
│   └── types.ts         domain contracts
├── App.tsx              application composition
└── styles.css           responsive pixel-art design system
```

The simulation layer is kept free of React and browser rendering code. This
makes the rules deterministic, testable, and ready for future save files,
workers, multiplayer adapters, or richer AI policies.

The full product and system rationale is documented in
[`docs/game-design.md`](docs/game-design.md).

## Local development

```bash
npm install
npm run dev
```

Quality checks:

```bash
npm test
npm run build
```

## Controls

- Move: `WASD`, arrow keys, direction pad, or click an adjacent tile
- Talk: gain affection with an adjacent traveler and reputation with their faction
- Recruit: requires 3 affection and 5 gold
- Build camp: requires 8 gold
- Station: turn a follower into a villager at a camp; the village stays lit and
  produces 1 gold each rest
- Rest: restore stamina, collect village income, and advance the world
- Scene travel: spend 2 stamina to take a waystone route to the adjacent
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
