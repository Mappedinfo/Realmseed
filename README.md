# Realmseed

> 一粒种子，一方世界。

Realmseed is an open-source, static-first pixel exploration and settlement game
for the browser. A text seed deterministically generates a small or large world,
its terrain, travelers, factions, monsters, coins, and ruins. Everything runs
locally in the browser and can be deployed directly to GitHub Pages.

## Playable prototype

- 40×40 quick worlds and 96×96 expedition worlds
- deterministic procedural terrain and societies
- three-state fog of war: visible, explored, unseen
- villagers and followers provide persistent vision
- keyboard, button, and adjacent-tile movement
- stamina, coins, affection, recruitment, camps, and village income
- three AI factions, wandering agents, followers, and monsters
- responsive pixel UI with a full-world minimap
- optional CC0 music with a visible playback control

## Architecture

```text
src/
├── components/          React interface and Canvas views
├── game/
│   ├── rng.ts           deterministic seeded random utilities
│   ├── world.ts         terrain, society, monster, and fog generation
│   ├── simulation.ts    pure turn reducer and economy/social rules
│   └── types.ts         domain contracts
├── App.tsx              application composition
└── styles.css           responsive pixel-art design system
```

The simulation layer is kept free of React and browser rendering code. This
makes the rules deterministic, testable, and ready for future save files,
workers, multiplayer adapters, or richer AI policies.

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

## GitHub Pages

The included workflow builds and deploys the static `dist/` directory. In the
repository settings, choose **GitHub Actions** as the Pages source. The Vite base
path is automatically set to `/Realmseed/` in GitHub Actions.

## Roadmap

1. Save/load several seed worlds with IndexedDB.
2. Add faction diplomacy, oaths, vassalage, and settlement ownership.
3. Give followers distinct AI jobs and combat traits.
4. Add buildings, production chains, quests, and boss monsters.
5. Split world simulation into a Web Worker for maps larger than 256×256.
6. Add mod-friendly JSON content packs and localization.

## Licenses

- Code: MIT, see [LICENSE](LICENSE).
- Music and third-party credits: [THIRD_PARTY.md](THIRD_PARTY.md).
