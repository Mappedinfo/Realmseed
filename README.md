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
- six functional camp buildings with housing, food, defense, economy, morale,
  control range, daily yields, construction progress, and automatic return paths
- deterministic settlement households with marriage, children, 60-day growth,
  generated migrants, and trusted travelers who may settle from the live map
- four building-gated camp offices that move elite followers into reversible
  mayor, guard, production, and trade appointments
- an eight-cell generated facility pack covering the camp core, six buildings,
  and road gate, plus settlement key art for later scene transitions
- one-shot seeded ruin events: monsters, coins, food, full recovery, relic
  equipment, or a rescued follower
- automatic passable roads between same-scene camps with reduced movement fatigue
- faction reputation, fealty oaths, oath breaking, and tribute-paying vassals
- three AI factions, wandering agents with six seeded specialties, followers,
  skill challenges, and monsters
- four-direction characters, probabilistic monster alerts and pursuit
- a persistent top-right red-name mode with player-centered attack-range cells,
  direct map damage against neutral/enemy people, structures, and monsters
- deterministic witnesses who show warning marks, flee, refuse friendly trade,
  and occasionally initiate a real encounter when an elite decides to retaliate
- six distinct no-character-motion combat effects for slash, cleave, arrow,
  seed magic, rifle smoke, and bomb explosion
- melee/ranged physical, magic, firearm, and explosive moves with explicit
  range, accuracy, critical, equipment, and area-splash values
- responsive pixel UI with a full-world minimap
- a hybrid Verdant art pack: detailed 32×32 terrain beneath processed pixel
  characters, monsters, buildings, resources, and waystones
- deterministic white/green-screen removal, grid splitting, object extraction,
  palette reduction, and strict 32×32 atlas packing
- original 16×16 source atlases as fallbacks for the Ember and Moonlit themes
- three selectable art directions that can be switched without restarting the world
- optional CC0 exploration and chiptune battle music with automatic encounter switching

## Architecture

```text
src/
├── components/          React interface and Canvas views
├── game/
│   ├── rng.ts           deterministic seeded random utilities
│   ├── world.ts         terrain, society, monster, and fog generation
│   ├── simulation.ts    turns, scene travel/cache, economy, and social rules
│   ├── combat.ts        moves, damage categories, and equipment values
│   ├── redName.ts       direct-map target classification and structure durability
│   ├── camps.ts         building definitions, yields, and recovery
│   ├── facilities.ts    seeded facility events and outcome definitions
│   ├── settlements.ts   residents, families, migration, growth, and calendar ticks
│   ├── skills.ts        traveler challenges and party bonus aggregation
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
The production prompt for the settlement heart, six facilities, road gate, and
settlement key art is in
[`art/prompts/camp-settlement-gpt-image-2.md`](art/prompts/camp-settlement-gpt-image-2.md).
The green-screen 2×4 frame prompts for all combat effects, colored bombs,
explosions, and smoke are in
[`art/prompts/combat-effects-gpt-image-2.md`](art/prompts/combat-effects-gpt-image-2.md).

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
python3 scripts/ingest_facility_assets.py
```

## Controls

- Move: `WASD`, arrow keys, direction pad, or click an adjacent tile
- Talk: gain affection with an adjacent traveler and reputation with their faction
- Interaction: adjacent people gain a speech bubble; click the bubble or person
  to open the lower-center dialogue and trade counter. Adjacency uses all eight
  surrounding tiles, including diagonals.
- Explorer UI: inventory, equipment, party, camps, and territory use five
  compact tabs. Their rows feed one reusable top-left detail window instead of
  expanding every dataset at once.
- Action UI: founding, stationing, and resting share one consistent button
  grammar with icon, action name, and cost/state caption.
- Scene navigation: the cross-scene `INFINITE FRONTIER` mechanism is treated as
  an advanced control and remains collapsed by default.
- Inspect: click any visible person, monster, building, resource, road, or terrain
  tile to open its contextual detail card in the left column; element tiles are
  inspected before movement, while clicking an adjacent empty tile still moves
- Recruit: requires 3 affection and 5 gold
- Party: recruited followers are hidden from the world canvas; click the left
  roster to switch the top-left portrait, which defaults to the player. Scout,
  forager, guard, medic, trader, and duelist levels respectively improve vision,
  gathering, block chance, exhausted recovery, berry rates, and damage.
- Challenge: every wanderer presents a specialty-matched one-time trial.
  Displayed odds derive from stamina capacity, combat wins, matching mastery
  marks, and NPC skill level. Victory costs 1 stamina and grants 2 affection,
  8 faction reputation, one permanent mastery mark, and skill-level gold.
- Build camp: requires 8 gold and creates a highlighted, permanently visible
  control radius; watchtowers expand both control and permanent vision in real time
- Construction: after founding a camp, each 100 successful movement steps grant
  one building tile; select a highlighted empty tile, then build a traveler
  lodge, forest farm, watchtower, market, workshop, or ember shrine. Each also
  has a 1–4 gold cost and a documented operational effect.
- Building touch: farms yield a berry, lodges restore 1 stamina, and shrines
  fully restore stamina on a 20-turn cooldown; the remaining buildings retain
  their passive settlement, defense, economy, sight, and combat effects.
- Ruins: entering an unexplored ruin resolves one deterministic seeded event
  exactly once. The result is shown below the map and the searched ruin is
  visibly dimmed and marked in its detail card.
- Camp navigation: select a camp in the left list to inspect its attributes or
  auto-path home; same-scene camps automatically receive passable roads
- Roads: road tiles spend only 0.35 movement fatigue instead of 1
- Governance: when housing is available, assign followers to four reversible offices from the
  camp core. Specialist offices require a watchtower, farm/workshop, or market.
- Population: camps begin with two founders. Adults can marry every 30 days,
  families can have children when housing and food permit, children mature in
  60 days, and suitable camps attract generated or familiar migrants.
- Calendar: every 10 successful movement tiles advance one day. Rest and scene
  travel each advance one day while preserving partial movement progress; AI
  continues to act on an independent turn counter.
- Stamina: ordinary movement spends 1 point per 100 steps; combat steps count
  1.5×, and deterministic enemy hits cost only 0 or 1 point
- Berries: terrain-weighted pickups enter the left inventory; click to consume
  one berry and restore 1 stamina
- Trade: each nearby person offers a deterministic daily rate of 8–12 berries
  per gold, centered on the 10:1 world economy; trader followers improve buying
  and selling in opposite directions.
- Combat growth: every victory raises maximum stamina by 1, capped at 30
- NPC health and loot: people use independent health instead of stamina as
  combat HP. Defeated NPCs leave the map, drop their carried gold and a small
  amount of food, and have a deterministic equipment chance that rises with
  skill level; staffed camp offices are cleared if their official is defeated.
- Rest: restore full stamina normally; at zero, manual or automatic exhausted
  rest recovers to 3, resets step fatigue, collects income, and advances the world
- Red-name mode: the persistent top-right `红名模式` switch draws melee and
  ranged reach around the controlled character. Select any non-party person,
  neutral/enemy structure, or monster and use the six-map attack strip; damage
  lands after the effect animation. Directly attacking a person immediately
  activates persistent pursuit for both that NPC and their faction, including
  members restored from other scene caches; pursuers chase the player and open
  a normal encounter when adjacent. Other witnesses gain hostility, display an
  exclamation mark, and move away. The only way to revoke a faction pursuit is
  a nearby 100-gold ransom trade with one of its members, which clears the
  entire faction and its cached NPCs. Hostile conversations disable friendly
  recruitment, challenges, and ordinary trade.
- Combat: normal encounters and elite retaliation retain tactical-bar and
  left/right presentation. Six moves expose range, hit rate, critical rate,
  power, stamina cost, and bomb radius. Enabling game music automatically
  switches to the CC0 chiptune battle loop for an encounter.
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
3. Expand follower specialties into selectable jobs and individual field actions.
4. Add production queues, quests, and boss monsters.
5. Split world simulation into a Web Worker for maps larger than 256×256.
6. Add mod-friendly JSON content packs and localization.

## Licenses

- Code: MIT, see [LICENSE](LICENSE).
- Music and third-party credits: [THIRD_PARTY.md](THIRD_PARTY.md).
