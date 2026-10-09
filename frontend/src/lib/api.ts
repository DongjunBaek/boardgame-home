// 서버 API 호출. 개발 중에는 Vite가 /api를 FastAPI로 넘겨준다 (vite.config.ts).
import type { Club, Member, MemberInput, Payment, PaymentInput, Tier, TierInput } from './club'
import type { EntryInput, LedgerEntry } from './ledger'
import type { Placed } from './village/decor'
import type { PlayerSpot } from './village/scene'
import type { BuildingKind, GachaResult, MapName, VillageState } from './village/state'
import type { ExcelPreview, ExcelReport, Game, GameInput, Store, StoreInput } from './types'

export type Health = { status: string; data_dir: string }

async function request<T>(method: string, path: string, body?: unknown, fetchFn: typeof fetch = fetch): Promise<T> {
  // 파일(Blob)은 그대로, 나머지는 JSON으로 보낸다
  const isFile = body instanceof Blob
  const res = await fetchFn(`/api${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': isFile ? 'application/octet-stream' : 'application/json' },
    body: body === undefined ? undefined : isFile ? body : JSON.stringify(body),
  }).catch(() => {
    // 브라우저 오류는 "Failed to fetch" 같은 영어라서 바꿔 준다
    throw new Error('서버에 연결할 수 없습니다 (서버가 꺼져 있는지 확인해 주세요)')
  })
  if (!res.ok) {
    // 서버가 보낸 이유(예: "별점: ...", "같은 제목의 게임이 이미 있습니다")가 있으면 그것을 쓴다
    const detail = await res
      .json()
      .then((b: { detail?: unknown }) => (typeof b.detail === 'string' ? b.detail : ''))
      .catch(() => '')
    throw new Error(detail || `서버 오류 ${res.status}: ${method} ${path}`)
  }
  return (res.status === 204 ? undefined : await res.json()) as T
}

export const getJson = <T>(path: string, fetchFn?: typeof fetch) => request<T>('GET', path, undefined, fetchFn)

export const fetchHealth = (fetchFn?: typeof fetch) => getJson<Health>('/health', fetchFn)

export const fetchGames = (fetchFn?: typeof fetch) => getJson<Game[]>('/games', fetchFn)

const gamePath = (id: string) => `/games/${encodeURIComponent(id)}`

export const createGame = (input: GameInput, fetchFn?: typeof fetch) => request<Game>('POST', '/games', input, fetchFn)

export const updateGame = (id: string, patch: GameInput, fetchFn?: typeof fetch) =>
  request<Game>('PATCH', gamePath(id), patch, fetchFn)

export const deleteGame = (id: string, fetchFn?: typeof fetch) => request<void>('DELETE', gamePath(id), undefined, fetchFn)

export const fetchStores = (fetchFn?: typeof fetch) => getJson<Store[]>('/stores', fetchFn)

const storePath = (id: string) => `/stores/${encodeURIComponent(id)}`

export const createStore = (input: StoreInput, fetchFn?: typeof fetch) => request<Store>('POST', '/stores', input, fetchFn)

export const updateStore = (id: string, patch: StoreInput, fetchFn?: typeof fetch) =>
  request<Store>('PATCH', storePath(id), patch, fetchFn)

export const deleteStore = (id: string, fetchFn?: typeof fetch) => request<void>('DELETE', storePath(id), undefined, fetchFn)

export const EXCEL_DOWNLOAD_URL = '/api/excel'
/** 인원·시간·정가 중 빈칸이 있는 게임만, 빈칸을 표시해서 */
export const EXCEL_BLANKS_URL = '/api/excel?only=blanks'

export const previewExcel = (file: Blob, fetchFn?: typeof fetch) =>
  request<ExcelPreview>('POST', '/excel/preview', file, fetchFn)

export const applyExcel = (file: Blob, base: string, fetchFn?: typeof fetch) =>
  request<{ report: ExcelReport }>('POST', `/excel/apply?base=${encodeURIComponent(base)}`, file, fetchFn)

// ---------- 동아리 회비 ----------

/** 회비 장부 전체 + 회계록 (직접 적은 입출금) */
export const fetchClub = (fetchFn?: typeof fetch) => getJson<Club & { ledger: LedgerEntry[] }>('/club', fetchFn)

const tierPath = (id: string) => `/club/tiers/${encodeURIComponent(id)}`
const memberPath = (id: string) => `/club/members/${encodeURIComponent(id)}`
const paymentPath = (memberId: string, month: string) => `/club/payments/${encodeURIComponent(memberId)}/${month}`

export const createTier = (input: TierInput) => request<Tier>('POST', '/club/tiers', input)
export const updateTier = (id: string, patch: TierInput) => request<Tier>('PATCH', tierPath(id), patch)
export const deleteTier = (id: string) => request<void>('DELETE', tierPath(id))

export const createMember = (input: MemberInput) => request<Member>('POST', '/club/members', input)
export const updateMember = (id: string, patch: MemberInput) => request<Member>('PATCH', memberPath(id), patch)
export const deleteMember = (id: string) => request<void>('DELETE', memberPath(id))

/** 한 칸 기록. months가 2 이상이면 이어지는 여러 달을 함께 적고, 적은 기록들을 돌려준다 */
export const putPayment = (memberId: string, month: string, input: PaymentInput) =>
  request<Payment[]>('PUT', paymentPath(memberId, month), input)
export const deletePayment = (memberId: string, month: string) => request<void>('DELETE', paymentPath(memberId, month))

// ---------- 회계록 ----------

const entryPath = (id: string) => `/club/ledger/${encodeURIComponent(id)}`

export const createEntry = (input: EntryInput) => request<LedgerEntry>('POST', '/club/ledger', input)
export const updateEntry = (id: string, patch: EntryInput) => request<LedgerEntry>('PATCH', entryPath(id), patch)
export const deleteEntry = (id: string) => request<void>('DELETE', entryPath(id))

// ---------- 대시보드 마을 ----------

/** 처음 부르면 서버가 기본 상태를 만들어 저장한다 */
export const fetchVillage = (fetchFn?: typeof fetch) => getJson<VillageState>('/village', fetchFn)

export const saveVillagePlayer = (map: MapName, spot: PlayerSpot) => request<VillageState>('PUT', '/village/player', { map, ...spot })

/** 밭에 쌓인 코인 거두기. 거둘 것이 없으면 harvested가 0이다 */
export const harvestVillage = () => request<{ harvested: number; village: VillageState }>('POST', '/village/harvest')

/** 작물 레벨 올리기. 밭에 쌓인 코인은 서버가 옛 레벨로 먼저 거둔다 (harvested). 못 올리면 이유를 담은 오류 */
export const researchVillage = () =>
  request<{ harvested: number; cost: number; village: VillageState }>('POST', '/village/research')

/** 상점 뽑기 한 번. 결과는 서버가 정한다. 코인이 모자라면 이유를 담은 오류 */
export const gachaVillage = () => request<{ result: GachaResult; village: VillageState }>('POST', '/village/gacha')

/** 크리스탈 뽑기 한 번: 아직 없는 스킨 하나 */
export const skinGachaVillage = () => request<{ result: GachaResult; village: VillageState }>('POST', '/village/gacha/skin')

/** 가진 스킨 입히기. target: player(고양이) 또는 house·shop·lab(지붕) */
export const wearSkin = (target: 'player' | BuildingKind, skin: string) =>
  request<VillageState>('PUT', '/village/skins', { target, skin })

/** 집 안 가구 배치 저장 (통째로 바꾼다). 가진 것보다 많거나 방 밖이면 이유를 담은 오류 */
export const saveDecor = (placed: Placed[]) => request<VillageState>('PUT', '/village/decor', { placed })

/** 화면을 떠날 때: 페이지가 닫혀도 요청이 끝까지 가도록 keepalive로 보낸다 */
export function saveVillagePlayerOnLeave(map: MapName, spot: PlayerSpot) {
  void fetch('/api/village/player', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ map, ...spot }),
    keepalive: true,
  }).catch(() => {})
}
