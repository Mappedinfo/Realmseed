import { campFoodDemand, campPopulation, effectiveCampStats } from './camps'
import { hashString } from './rng'
import { agentSkillIds } from './skills'
import type { Agent, Camp, GameState, Resident, ResidentOrigin, ResidentSex, SettlementEvent } from './types'

const givenNames = ['阿榛', '柏舟', '澄露', '黛禾', '恩野', '枫岚', '谷雨', '荷灯', '槿川', '岚歌', '麦芽', '宁枝', '蒲星', '青栎', '若苔', '松弦']
const familyNames = ['石', '苔', '林', '叶', '溪', '鹿', '榛', '风', '星', '谷', '舟', '松']

function residentName(seed: string): string {
  const hash = hashString(seed)
  return `${familyNames[hash % familyNames.length]}·${givenNames[Math.floor(hash / 17) % givenNames.length]}`
}

function nextChronicleId(state: GameState): number {
  return state.chronicle.reduce((maximum, entry) => Math.max(maximum, entry.id), 0) + 1
}

function recordEvent(
  state: GameState,
  campId: string,
  kind: SettlementEvent['kind'],
  residentIds: string[],
  text: string,
): GameState {
  const id = state.settlementEvents.reduce((maximum, event) => Math.max(maximum, event.id), 0) + 1
  return {
    ...state,
    settlementEvents: [{ id, campId, day: state.day, kind, residentIds, text }, ...state.settlementEvents].slice(0, 120),
    chronicle: [
      { id: nextChronicleId(state), day: state.day, text, tone: 'good' as const },
      ...state.chronicle,
    ].slice(0, 24),
  }
}

function makeAdult(
  state: Pick<GameState, 'gameId' | 'day'>,
  camp: Camp,
  key: string,
  sex: ResidentSex,
  origin: ResidentOrigin,
  name?: string,
  aptitude?: Agent['skill'],
): Resident {
  const hash = hashString(`${state.gameId}:${camp.id}:${key}`)
  return {
    id: `resident-${camp.id}-${key}`,
    name: name ?? residentName(`${state.gameId}:${camp.id}:${key}:name`),
    sex,
    stage: 'adult',
    birthDay: state.day - 60 - (hash % 240),
    settledDay: state.day,
    origin,
    campId: camp.id,
    parentIds: [],
    aptitude: aptitude ?? agentSkillIds[hash % agentSkillIds.length],
  }
}

export function createFoundingResidents(state: GameState, camp: Camp): Resident[] {
  return [
    makeAdult(state, camp, 'founder-f', 'female', 'founder'),
    makeAdult(state, camp, 'founder-m', 'male', 'founder'),
  ]
}

function related(a: Resident, b: Resident): boolean {
  if (a.parentIds.includes(b.id) || b.parentIds.includes(a.id)) return true
  return a.parentIds.some((parentId) => b.parentIds.includes(parentId))
}

function officialByOffice(camp: Camp, office: keyof Camp['offices']) {
  return camp.offices[office]
}

function advanceOneSettlementDay(input: GameState): GameState {
  let state = input

  for (const resident of state.residents) {
    if (resident.stage !== 'child' || state.day - resident.birthDay < 60) continue
    state = {
      ...state,
      residents: state.residents.map((item) => item.id === resident.id ? { ...item, stage: 'adult' } : item),
    }
    const camp = state.camps.find((item) => item.id === resident.campId)
    state = recordEvent(state, resident.campId, 'adulthood', [resident.id], `${resident.name} 在${camp?.name ?? '营地'}成年，开始参与聚落劳作。`)
  }

  for (const camp of state.camps) {
    if (state.day % 30 === 0) {
      const unmarriedWomen = state.residents.filter(
        (resident) => resident.campId === camp.id && resident.stage === 'adult' && resident.sex === 'female' && !resident.spouseId,
      )
      const unmarriedMen = state.residents.filter(
        (resident) => resident.campId === camp.id && resident.stage === 'adult' && resident.sex === 'male' && !resident.spouseId,
      )
      const used = new Set<string>()
      for (const woman of unmarriedWomen) {
        const man = unmarriedMen
          .filter((candidate) => !used.has(candidate.id) && !related(woman, candidate))
          .sort((a, b) => hashString(`${state.gameId}:${state.day}:pair:${woman.id}:${a.id}`) - hashString(`${state.gameId}:${state.day}:pair:${woman.id}:${b.id}`))[0]
        if (!man || hashString(`${state.gameId}:${state.day}:marry:${woman.id}:${man.id}`) % 100 >= 40) continue
        used.add(man.id)
        state = {
          ...state,
          residents: state.residents.map((resident) =>
            resident.id === woman.id ? { ...resident, spouseId: man.id }
              : resident.id === man.id ? { ...resident, spouseId: woman.id }
                : resident,
          ),
        }
        state = recordEvent(state, camp.id, 'marriage', [woman.id, man.id], `${woman.name} 与 ${man.name} 在${camp.name}结为伴侣。`)
      }

      const mothers = state.residents.filter(
        (resident) => resident.campId === camp.id && resident.stage === 'adult' && resident.sex === 'female' && resident.spouseId,
      )
      for (const mother of mothers) {
        if (mother.lastBirthDay !== undefined && state.day - mother.lastBirthDay < 60) continue
        const father = state.residents.find((resident) => resident.id === mother.spouseId)
        if (!father || campPopulation(state, camp.id) >= camp.housing) continue
        const stats = effectiveCampStats(state, camp)
        if (stats.food - campFoodDemand(state, camp.id) < 2) continue
        const production = officialByOffice(camp, 'production-steward')
        const chance = 35 + (production?.skill === 'medic' ? 10 : 0)
        const roll = hashString(`${state.gameId}:${state.day}:birth:${mother.id}:${father.id}`) % 100
        if (roll >= chance) continue
        const sex: ResidentSex = roll % 2 === 0 ? 'female' : 'male'
        const id = `resident-${camp.id}-born-${state.day}-${mother.id}`
        const child: Resident = {
          id,
          name: residentName(`${state.gameId}:${id}:name`),
          sex,
          stage: 'child',
          birthDay: state.day,
          settledDay: state.day,
          origin: 'born',
          campId: camp.id,
          parentIds: [mother.id, father.id],
          aptitude: agentSkillIds[hashString(`${state.gameId}:${id}:aptitude`) % agentSkillIds.length],
        }
        state = {
          ...state,
          residents: [
            ...state.residents.map((resident) => resident.id === mother.id ? { ...resident, lastBirthDay: state.day } : resident),
            child,
          ],
        }
        state = recordEvent(state, camp.id, 'birth', [mother.id, father.id, child.id], `${child.name} 在${camp.name}出生，家庭迎来新成员。`)
      }
    }

    const stats = effectiveCampStats(state, camp)
    const hasCapacity = campPopulation(state, camp.id) < camp.housing
    const hasSurplus = stats.food - campFoodDemand(state, camp.id) >= 1
    if (!hasCapacity || !hasSurplus || stats.morale < 3) continue

    const tradeOfficial = officialByOffice(camp, 'trade-steward')
    const migrationChance = 5 + (tradeOfficial?.skill === 'scout' ? 2 : 0)
    if (hashString(`${state.gameId}:${state.day}:migrant:${camp.id}`) % 100 < migrationChance) {
      const sex: ResidentSex = hashString(`${state.gameId}:${state.day}:migrant-sex:${camp.id}`) % 2 === 0 ? 'female' : 'male'
      const migrant = makeAdult(state, camp, `migrant-${state.day}`, sex, 'migrant')
      state = { ...state, residents: [...state.residents, migrant] }
      state = recordEvent(state, camp.id, 'migration', [migrant.id], `${migrant.name} 受到${camp.name}吸引，成为新的定居者。`)
    }

    if (campPopulation(state, camp.id) >= camp.housing) continue
    const familiar = state.agents.find((agent) =>
      agent.role === 'wanderer' &&
      agent.affection >= 3 &&
      camp.sceneX === state.world.sceneX &&
      camp.sceneY === state.world.sceneY &&
      Math.abs(agent.x - camp.x) + Math.abs(agent.y - camp.y) <= stats.controlRadius &&
      hashString(`${state.gameId}:${state.day}:familiar:${camp.id}:${agent.id}`) % 100 < 2,
    )
    if (!familiar) continue
    const sex: ResidentSex = hashString(`${state.gameId}:${familiar.id}:sex`) % 2 === 0 ? 'female' : 'male'
    const resident = makeAdult(state, camp, `familiar-${familiar.id}`, sex, 'familiar', familiar.name, familiar.skill)
    state = {
      ...state,
      residents: [...state.residents, resident],
      agents: state.agents.filter((agent) => agent.id !== familiar.id),
    }
    state = recordEvent(state, camp.id, 'migration', [resident.id], `${familiar.name} 决定结束漂泊，在${camp.name}定居。`)
  }
  return state
}

export function advanceCalendarDays(state: GameState, days = 1): GameState {
  let next = state
  for (let offset = 0; offset < days; offset += 1) {
    next = advanceOneSettlementDay({ ...next, day: next.day + 1 })
  }
  return next
}
