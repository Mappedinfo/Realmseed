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
Travel costs two stamina and changes one coordinate. Scene generation has no
authored outer boundary; practical limits are browser memory and JavaScript's
safe integer range. The prototype keeps visited scenes in memory. IndexedDB
serialization and cache eviction are the next persistence milestone.

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
2. Reveal land by walking; spend more stamina in marshes.
3. Find coins and ruins, meet travelers, and fight monsters.
4. Talk to increase affection and faction reputation.
5. Recruit a trusted traveler; follower AI trails the player and contributes
   combat strength and vision.
6. Build a camp, station a follower as a villager, and create permanent light
   plus daily tax income.
7. Swear fealty to a trusted faction for expedition support, or remain
   independent and establish tribute-paying vassals.
8. Take a waystone route into another deterministic scene and continue.

## System boundaries

| System | Prototype rule | Planned depth |
|---|---|---|
| Coins | pickups, recruitment/building costs, taxes, tribute | markets and production chains |
| Stamina | movement, marsh cost, conversation, travel, rest | food and equipment modifiers |
| Affection | 0–5 per traveler; 3 enables recruitment | memories, preferences, conflicts |
| Followers | trail, reveal, fight, or become villagers | gather, guard, scout, craft |
| Factions | reputation, fealty, oath breaking, vassalage | diplomacy, war, borders |
| Monsters | three seeded species with simple HP | behaviors, drops, bosses |
| Fog | visible / explored / unseen per scene | line of sight and watchtowers |
| Scenes | deterministic four-way unbounded graph | portals, boats, biomes, cache eviction |

## Open-source and asset policy

- Code is MIT licensed.
- Bundled music must be CC0 or otherwise explicitly redistributable, with source
  and license recorded in `THIRD_PARTY.md`.
- No private simulation replay, user record, or server credential belongs in a
  public build.
- New data packs should be browser-readable JSON and independently removable.
