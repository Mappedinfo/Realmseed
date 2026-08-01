# Realmseed game design

## One-line pitch

Realmseed is a static-first, open-source, top-down pixel world where one text
seed unfolds an unbounded chain of explorable scenes. The player starts as a
free traveler, builds lit settlements in the fog, recruits companions, and
chooses whether to serve a faction or become the overlord of several.

## Design pillars

1. **The seed is the world.** A total seed plus integer scene coordinates
   deterministically generates every region. Sharing those values shares the
   same geography and initial society.
2. **Exploration leaves a trace.** Active villagers keep territory visible;
   explored empty land becomes dim; unknown tiles remain fully hidden. Leaving
   a scene stores its changed tiles, fog, residents, resources, and monsters.
3. **Relationships become institutions.** Affection recruits individual
   followers. Reputation enables faction oaths. Staffed settlements and trust
   enable vassal contracts.
4. **Static deployment is a feature.** The core game requires no login,
   database, server, API key, or proprietary asset. GitHub Pages is a complete
   runtime, not a marketing shell.

## Infinite-world model

Realmseed uses a Pokémon-like connected-scene model rather than allocating one
enormous array.

```text
                 [x, y-1]
                     ▲
                     │
        [x-1, y] ◀ [x, y] ▶ [x+1, y]
                     │
                     ▼
                 [x, y+1]
```

Each scene is either 40×40 or 96×96 tiles. Four waystones identify its routes.
Travel accumulates 25 steps of fatigue and changes one coordinate. Scene
generation has no authored outer boundary; practical limits are browser memory
and JavaScript's safe integer range. The prototype keeps visited scenes in
memory. A versioned localStorage snapshot now restores active games and dungeon
runs after refresh; IndexedDB serialization and cache eviction are the next
persistence milestone.

This model keeps rendering and AI work bounded to one active region while
retaining the feeling that the world can continue in every direction.

## Visual standard

- Top-down, nearest-neighbor Canvas rendering.
- 32×32 terrain cells rather than icon-sized placeholder tiles.
- Characters occupy roughly 16×28 pixels, comparable to classic handheld RPG
  overworld sprites.
- Terrain must contain material-specific secondary detail: waves, reeds,
  flowers, tree trunks/canopies, rock faces, shadows, and snow caps.
- Structures and monsters use multi-tone silhouettes with readable doors,
  eyes, highlights, and ground shadows.
- UI uses the same hard-edged pixel grammar but never shrinks gameplay controls
  below touchable sizes on mobile.

Future art packs may replace the procedural primitives, but must preserve the
32×32 grid contract and use redistributable licenses.

## Current playable loop

1. Choose a total seed and per-scene size.
2. Reveal land by walking; every 10 successful tiles advance one calendar day,
   while every 100 ordinary steps spend one stamina. Rest and scene travel each
   advance a day without discarding partial movement progress.
3. Find coins, berry patches, renewable timber and stone, ruins, caves, and
   nests; meet travelers and fight monsters.
   Terrain and regional patches make berry abundance uneven; combat steps
   accumulate fatigue 1.5× faster.
4. Click the bubble over a traveler in any of the eight surrounding tiles,
   including diagonal neighbors, to talk or trade.
   Berries enter the left inventory, restore one stamina when eaten, and trade
   at a deterministic daily rate of 8–12 berries per gold.
   Clicking any map element also updates a persistent left-side inspection card
   with its identity, attributes, coordinates, usage, and interaction hint.
   The same top-left window is reused by five compact tabs for inventory,
   equipment, party, camps, and territory; detailed rows are not all expanded
   simultaneously. Cross-scene navigation stays collapsed until explicitly
   opened because it is an advanced world mechanism.
5. Each traveler owns a seeded level 1–3 specialty: scout, forager, guard,
   medic, trader, or duelist. A one-time specialty challenge displays its real
   success chance. Winning grants trust, reputation, gold, and a permanent
   matching mastery mark. Recruit a trusted traveler; the follower moves into the left party roster
   instead of occupying a world tile, while still contributing combat strength
   plus their specialty bonus. Click roster entries to switch the top-left portrait.
6. Challenge a deterministic three-floor cave or nest. Floors one and two hold
   normal packs, chests, and a stair-locking elite; floor three holds a two-phase
   Boss and its reward chest. Retreat preserves opened loot and the entrance
   resets on the following game day. Water banks support a short timing-based
   fishing action whose four fish restore 1–3 stamina.
7. Spend 8 timber and 5 stone to build a camp, creating a highlighted control radius and inspect population
   versus housing, food, defense, economy, morale, buildings, daily output, and
   range from the left camp list. The entire
   control radius remains permanently visible after the party leaves, and a
   watchtower expands that live vision together with the control range.
   A new camp begins with two adult founders. Suitable adults marry at 30-day
   checkpoints, children mature after 60 days, and housing, food, morale, and
   seeded migration rolls govern further growth. Trusted nearby travelers may
   also choose to settle.
8. Walk 100 successful steps after founding a camp to earn one building tile.
   Select a controlled empty tile for one of six functional facilities: lodge,
   farm, watchtower, market, workshop, or shrine. Lodges gate resident capacity;
   farms create food surplus; defense suppresses local ambush; economy settles
   gold; workshops grant local combat damage; morale improves exhausted rest.
   From the camp core, followers can be appointed and recalled as mayor, guard
   captain, production steward, or trade steward. These offices use dynamic
   skill bonuses rather than permanently modifying building attributes.
   Same-scene
   camps automatically connect by passable roads; roads use 0.35 movement fatigue,
   and the camp list can run shortest-path return navigation.
9. Swear fealty to a trusted faction for expedition support, or remain
   independent and establish tribute-paying vassals.
10. Take a waystone route into another deterministic scene and continue.

## System boundaries

| System | Prototype rule | Planned depth |
|---|---|---|
| Coins | sparse pickups, berry trading, recruitment/building costs, taxes, tribute | markets and production chains |
| Inventory | berries, timber, stone, four edible fish; person-to-person berry exchange | weight, tools, bait, crafting |
| Stamina | 100-step cost, 1.5× combat fatigue, 0/1 hit loss, berry recovery, exhausted rest to 3 | equipment and biome modifiers |
| Affection | 0–5 per traveler; 3 enables recruitment | memories, preferences, conflicts |
| Traveler skills | six seeded specialties, level/difficulty, one-time deterministic challenge, permanent mastery marks | challenge stories and training |
| Followers | hidden roster; specialty aggregation into vision, forage, guard, recovery, trade, and damage | selectable jobs and field actions |
| Camps | housing, population, food, defense, economy, morale, six functional buildings, daily output, radius, roads, auto-path | production queues and sieges |
| Red-name combat | player-centered 1–6 cell reach, direct people/structure/monster damage, witness fear and hostility | crimes, warrants, faction guards |
| Encounters | tactical-bar/duel presentation for monsters and rare elite retaliation | status effects and tactical positioning |
| Factions | reputation, fealty, oath breaking, vassalage | diplomacy, war, borders |
| Monsters | normal/elite/Boss ranks, phase change, chests, victory growth | more species, status effects, Boss families |
| Dungeons | repeatable deterministic three-floor cave/nest runs | procedural layouts, quests, biome-specific Bosses |
| Fog | visible / explored / unseen per scene | line of sight and watchtowers |
| Scenes | deterministic four-way unbounded graph | portals, boats, biomes, cache eviction |

## Open-source and asset policy

- Code is MIT licensed.
- Bundled music must be CC0 or otherwise explicitly redistributable, with source
  and license recorded in `THIRD_PARTY.md`.
- Exploration and battle use separate CC0 loops. The single user-controlled
  audio channel changes source with encounter state and returns after combat.
- No private simulation replay, user record, or server credential belongs in a
  public build.
- New data packs should be browser-readable JSON and independently removable.
