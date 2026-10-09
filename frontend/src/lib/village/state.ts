// 서버가 저장하는 마을 상태 (backend/app/village.py와 같은 모양)
import type { PlayerSpot } from './scene'

export type VillageState = {
  version: number
  coins: number
  crystals: number
  crop_level: number
  last_harvest: string
  /** 뽑기로 얻은 가구 (같은 것은 개수로) */
  items: { id: string; count: number }[]
  /** 입은 스킨: 캐릭터는 고양이 id, 건물(house·shop·lab)은 지붕 id. 건물이 없으면 처음 지붕 */
  skins: { player: string; buildings: Partial<Record<BuildingKind, string>> }
  owned_skins: string[]
  player: (PlayerSpot & { map: MapName }) | null
  /** 서버가 지금 시각 기준으로 계산해 붙인다 (파일에는 없다) */
  farm: { rate_per_hour: number; cap_hours: number; pending: number; full_at: string }
  /** 다음 레벨 연구. 최고 레벨이면 null */
  lab: { next_level: number; cost: number; next_rate: number } | null
  /** 뽑기 한 번 값과 가구 이름 (id → 이름), 크리스탈 뽑기 값과 남은 스킨 수 */
  shop: { cost: number; names: Record<string, string>; skin_cost: number; skins_left: number }
  /** 스킨 이름과 가진 것 */
  wardrobe: {
    players: Record<string, string>
    roofs: Record<string, string>
    default_roofs: Record<BuildingKind, string>
    owned: { player: string[]; roof: string[] }
  }
  server_time: string
}

/** 지도: 마을, 집 안 (frontend/public/village/maps/<이름>.tmj) */
export type MapName = 'village' | 'house'

/** 들어가면 창이 열리는 곳. 마을의 집과 집 안의 나가는 문은 창 대신 지도를 바꾼다 */
export type PlaceKind = 'farm' | 'shop' | 'lab' | 'bookshelf' | 'wardrobe'

/** 지붕을 갈아입히는 건물 */
export type BuildingKind = 'house' | 'shop' | 'lab'
export const BUILDING_NAMES: Record<BuildingKind, string> = { house: '집', shop: '뽑기 상점', lab: '연구소' }

export const PLACES: Record<PlaceKind, { name: string; about: string }> = {
  farm: { name: '밭', about: '작물이 저절로 자라 코인을 만듭니다. 화면을 꺼 둔 동안에도 12시간까지 쌓입니다.' },
  shop: { name: '뽑기 상점', about: '코인으로 뽑기를 해서 가구나 코인·크리스탈을 얻습니다.' },
  lab: { name: '연구소', about: '코인을 써서 작물 레벨을 올립니다. 레벨이 오르면 밭이 더 많이 만듭니다.' },
  bookshelf: { name: '책장', about: '내 보드게임이 책으로 꽂혀 있습니다. 책을 누르면 그 게임 정보를 봅니다.' },
  wardrobe: { name: '옷장', about: '가진 스킨으로 캐릭터와 건물 지붕을 갈아입힙니다. 스킨은 상점의 크리스탈 뽑기에서 얻습니다.' },
}

export type GachaResult =
  | { kind: 'item'; id: string; name: string }
  /** id: "player:brown" · "roof:slate" */
  | { kind: 'skin'; id: string; name: string }
  | { kind: 'coins' | 'crystals'; amount: number }

export const playerSheetUrl = (skin: string) => `/village/sprites/player-${skin}.png`
export const buildingUrl = (kind: BuildingKind, roof: string) => `/village/buildings/${kind}-${roof}.png`

/** 건물이 지금 입은 지붕 */
export const roofOf = (state: VillageState, kind: BuildingKind) =>
  state.skins.buildings[kind] ?? state.wardrobe.default_roofs[kind]

/** 가구 그림 주소 */
export const itemUrl = (id: string) => `/village/items/${id}.png`

/** 받침이 있으면 '을', 없으면 '를' (한글이 아니면 '을(를)') */
export function objectParticle(word: string): string {
  const code = word.charCodeAt(word.length - 1) - 0xac00
  if (code < 0 || code > 11171) return '을(를)'
  return code % 28 ? '을' : '를'
}

export const isPlace = (kind: string): kind is PlaceKind => kind in PLACES
