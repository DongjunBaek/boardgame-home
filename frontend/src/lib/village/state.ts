// 서버가 저장하는 마을 상태 (backend/app/village.py와 같은 모양)
import type { PlayerSpot } from './scene'

export type VillageState = {
  version: number
  coins: number
  crystals: number
  crop_level: number
  last_harvest: string
  items: unknown[]
  skins: { player: string; buildings: Record<string, string> }
  player: (PlayerSpot & { map: 'village' }) | null
  /** 서버가 지금 시각 기준으로 계산해 붙인다 (파일에는 없다) */
  farm: { rate_per_hour: number; cap_hours: number; pending: number; full_at: string }
  /** 다음 레벨 연구. 최고 레벨이면 null */
  lab: { next_level: number; cost: number; next_rate: number } | null
  server_time: string
}

/** 지도에서 눌러 들어가는 곳 */
export type PlaceKind = 'farm' | 'house' | 'shop' | 'lab'

/** stage: 아직 기능이 없는 곳은 몇 단계에서 열리는지 */
export const PLACES: Record<PlaceKind, { name: string; about: string; stage?: string }> = {
  farm: { name: '밭', about: '작물이 저절로 자라 코인을 만듭니다. 화면을 꺼 둔 동안에도 12시간까지 쌓입니다.' },
  house: { name: '집', about: '들어가서 방을 꾸미고, 내 보드게임을 책장에 꽂힌 책으로 둘러봅니다.', stage: '5단계' },
  shop: { name: '뽑기 상점', about: '재화로 뽑기를 해서 가구·스킨·꾸미기·재화를 얻습니다.', stage: '4단계' },
  lab: { name: '연구소', about: '코인을 써서 작물 레벨을 올립니다. 레벨이 오르면 밭이 더 많이 만듭니다.' },
}

export const isPlace = (kind: string): kind is PlaceKind => kind in PLACES
