// 스토어 바로가기. 서버 backend/app/stores.py와 같은 열쇠 규칙이다 (shared/store_key_cases.json으로 둘 다 검사).
import type { Game, Store } from './types'

/** 이 순서로 먼저 보여 주고, 나머지 묶음은 이름순, '기타'는 맨 뒤 */
export const GROUP_ORDER = ['제작사 스토어', '보드게임 쇼핑몰', '펀딩']
export const OTHER_GROUP = '기타'

// 스토어 아이디를 첫 경로에 두는 곳
const PATH_HOSTS = ['smartstore.naver.com', 'brand.naver.com']

/** 'https://m.smartstore.naver.com/udg/products/1' → 'smartstore.naver.com/udg'. 주소가 아니면 null */
export function storeKey(url: string | null | undefined): string | null {
  if (!url) return null
  let parts: URL
  try {
    parts = new URL(url.trim())
  } catch {
    return null
  }
  if ((parts.protocol !== 'http:' && parts.protocol !== 'https:') || !parts.hostname) return null
  let host = parts.hostname.toLowerCase()
  for (const prefix of ['www.', 'm.']) if (host.startsWith(prefix)) host = host.slice(prefix.length)
  if (PATH_HOSTS.includes(host)) {
    const first = parts.pathname.split('/').find((p) => p) ?? ''
    return first ? `${host}/${first.toLowerCase()}` : host
  }
  return host
}

export type StoreRow = { store: Store; key: string | null; count: number }
export type StoreGroup = { name: string; rows: StoreRow[] }

/** 묶음별로 나누고, 스토어마다 판매 링크가 그 스토어인 내 게임 수를 센다 */
export function groupStores(stores: readonly Store[], games: readonly Game[]): StoreGroup[] {
  const counts = new Map<string, number>()
  for (const g of games) {
    const key = storeKey(g.sale_link)
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const groups = new Map<string, StoreRow[]>()
  for (const store of stores) {
    const name = store.group?.trim() || OTHER_GROUP
    const key = storeKey(store.url)
    const rows = groups.get(name) ?? []
    rows.push({ store, key, count: key ? (counts.get(key) ?? 0) : 0 })
    groups.set(name, rows)
  }
  const rank = (name: string) => {
    const i = GROUP_ORDER.indexOf(name)
    return i >= 0 ? i : name === OTHER_GROUP ? GROUP_ORDER.length + 1 : GROUP_ORDER.length
  }
  return [...groups.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b, 'ko'))
    .map(([name, rows]) => ({ name, rows: rows.sort((a, b) => a.store.name.localeCompare(b.store.name, 'ko')) }))
}

/** 스토어 추가·수정 창에서 고를 묶음 이름들 (기본 묶음 + 지금 쓰는 묶음) */
export function groupNames(stores: readonly Store[]): string[] {
  const used = stores.map((s) => s.group?.trim()).filter((g): g is string => !!g)
  return [...new Set([...GROUP_ORDER, ...used])]
}
