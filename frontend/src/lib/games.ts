// 보유 목록 거르기·정렬·요약. 화면 상태와 무관한 순수 함수만 둔다.
import { minPlayers, supportsPlayerCount } from './players'
import { storeKey } from './stores'
import { GENRES, type Game, type GameInput, type Genre } from './types'

export type PlayedFilter = 'all' | 'played' | 'unplayed'

/** 제작사 거르기에서 '제작사 없음'을 고를 때 쓰는 값 */
export const NO_PUBLISHER = '__none__'

/** 장르 탭에서 '미분류'(장르 없음)를 고를 때 쓰는 값 */
export const NO_GENRE = '__none__'
export type GenreTab = Genre | '' | typeof NO_GENRE

export type Filters = {
  q: string
  /** 장르 탭. ''이면 전체 */
  genre: GenreTab
  /** 제작사 묶음 키 (publisherKey). ''이면 전체 */
  publisher: string
  /** 스토어 열쇠 (storeKey). 판매 링크가 이 스토어인 게임만. ''이면 전체 */
  store: string
  players: number | null
  maxTime: number | null
  played: PlayedFilter
  blanksOnly: boolean
}

export const EMPTY_FILTERS: Filters = {
  q: '',
  genre: '',
  publisher: '',
  store: '',
  players: null,
  maxTime: null,
  played: 'all',
  blanksOnly: false,
}

export function isFiltered(f: Filters): boolean {
  return (Object.keys(EMPTY_FILTERS) as (keyof Filters)[]).some((k) =>
    k === 'q' ? f.q.trim() !== '' : f[k] !== EMPTY_FILTERS[k],
  )
}

/** 인원·시간·가격 중 빈칸이 있는지 */
export function hasBlanks(g: Game): boolean {
  return g.player_count.length === 0 || g.play_time_minutes === null || g.price === null
}

export function filterGames(games: readonly Game[], f: Filters): Game[] {
  const q = f.q.trim().toLowerCase()
  return games.filter((g) => {
    if (q && !`${g.title}\n${g.publisher ?? ''}`.toLowerCase().includes(q)) return false
    if (f.genre === NO_GENRE ? g.genres.length > 0 : f.genre && !g.genres.includes(f.genre)) return false
    if (f.publisher && publisherKey(g.publisher) !== f.publisher) return false
    if (f.store && storeKey(g.sale_link) !== f.store) return false
    // 인원·시간 조건이 있으면 그 정보가 빈 게임은 뺀다 (맞는지 알 수 없으므로)
    if (f.players !== null && !supportsPlayerCount(g.player_count, f.players)) return false
    if (f.maxTime !== null && (g.play_time_minutes === null || g.play_time_minutes > f.maxTime)) return false
    if (f.played === 'played' && !g.mine.played) return false
    if (f.played === 'unplayed' && g.mine.played) return false
    if (f.blanksOnly && !hasBlanks(g)) return false
    return true
  })
}

export type SortKey = 'title' | 'publisher' | 'genre' | 'players' | 'time' | 'price' | 'paid' | 'quantity' | 'played' | 'rating'
export type SortDir = 'asc' | 'desc'
export type Sort = { key: SortKey; dir: SortDir }

const collator = new Intl.Collator('ko', { numeric: true, sensitivity: 'base' })

function sortValue(g: Game, key: SortKey): string | number | null {
  switch (key) {
    case 'title':
      return g.title
    case 'publisher':
      return g.publisher?.trim() || null
    case 'genre':
      return g.genres.join(',') || null
    case 'players':
      return minPlayers(g.player_count)
    case 'time':
      return g.play_time_minutes
    case 'price':
      return g.price
    case 'paid':
      return g.mine.purchase.paid
    case 'quantity':
      return g.mine.quantity
    case 'played':
      return g.mine.played ? 1 : 0
    case 'rating':
      return g.mine.rating
  }
}

function compare(a: string | number, b: string | number): number {
  return typeof a === 'string' && typeof b === 'string' ? collator.compare(a, b) : Number(a) - Number(b)
}

/** 빈 값은 방향과 상관없이 맨 뒤. 값이 같으면 제목순. */
export function sortGames(games: readonly Game[], { key, dir }: Sort): Game[] {
  const sign = dir === 'asc' ? 1 : -1
  return [...games].sort((a, b) => {
    const va = sortValue(a, key)
    const vb = sortValue(b, key)
    if (va === null || vb === null) {
      if (va !== vb) return va === null ? 1 : -1
    } else {
      const c = compare(va, vb)
      if (c !== 0) return c * sign
    }
    return collator.compare(a.title, b.title)
  })
}

export type Summary = { total: number; murder: number; board: number; unplayed: number }

export function summarize(games: readonly Game[]): Summary {
  return {
    total: games.length,
    murder: games.filter((g) => g.genres.includes('머더미스터리')).length,
    board: games.filter((g) => g.genres.includes('보드게임')).length,
    unplayed: games.filter((g) => !g.mine.played).length,
  }
}

/** 내 정보 수정 값을 게임에 반영한 새 게임 (구입 정보는 보낸 칸만 바꾼다). 서버의 합치기와 같다. */
export function applyMinePatch(game: Game, mine: NonNullable<GameInput['mine']>): Game {
  const { purchase, ...rest } = mine
  return {
    ...game,
    mine: { ...game.mine, ...rest, purchase: { ...game.mine.purchase, ...purchase } },
  }
}

/** 수정 값(게임 정보 + 내 정보)을 반영한 새 게임. 서버의 합치기와 같다. */
export function applyGamePatch(game: Game, patch: GameInput): Game {
  const { mine, ...rest } = patch
  const next: Game = { ...game, ...rest }
  return mine ? applyMinePatch(next, mine) : next
}

/** patch가 바꾸는 칸들의 지금 값 (저장에 실패했을 때 그 칸만 되돌리는 데 쓴다) */
export function currentValues(game: Game, patch: GameInput): GameInput {
  const { mine, ...rest } = patch
  const out: GameInput = Object.fromEntries(
    Object.keys(rest).map((k) => [k, game[k as keyof typeof rest]]),
  ) as GameInput
  if (mine) {
    const { purchase, ...mineRest } = mine
    out.mine = Object.fromEntries(Object.keys(mineRest).map((k) => [k, game.mine[k as keyof typeof mineRest]]))
    if (purchase) {
      out.mine.purchase = Object.fromEntries(
        Object.keys(purchase).map((k) => [k, game.mine.purchase[k as keyof typeof purchase]]),
      )
    }
  }
  return out
}

/** 제작사 묶음 키: 띄어쓰기·대소문자가 달라도 같은 제작사로 본다 ("사월 게임즈" = "사월게임즈") */
export function publisherKey(publisher: string | null): string {
  const key = (publisher ?? '').replace(/\s+/g, '').toLowerCase()
  return key || NO_PUBLISHER
}

export type PublisherOption = { key: string; name: string; count: number }

/** 제작사 거르기 목록: 게임이 많은 순, 같으면 이름순. 표기가 여럿이면 가장 많이 쓴 표기(같으면 먼저 나온 것)로 보여 준다. '제작사 없음'은 맨 뒤. */
export function publisherOptions(games: readonly Game[]): PublisherOption[] {
  const groups = new Map<string, Map<string, number>>()
  for (const g of games) {
    const key = publisherKey(g.publisher)
    const names = groups.get(key) ?? new Map<string, number>()
    const name = g.publisher?.trim() || '(제작사 없음)'
    names.set(name, (names.get(name) ?? 0) + 1)
    groups.set(key, names)
  }
  const options = [...groups].map(([key, names]) => {
    // 가장 많이 쓴 표기, 같으면 먼저 나온 표기 (sort는 순서를 유지한다)
    const [name] = [...names].sort((a, b) => b[1] - a[1])[0]
    return { key, name, count: [...names.values()].reduce((a, b) => a + b, 0) }
  })
  return options.sort(
    (a, b) =>
      Number(a.key === NO_PUBLISHER) - Number(b.key === NO_PUBLISHER) ||
      b.count - a.count ||
      collator.compare(a.name, b.name),
  )
}

export type GenreTabInfo = { key: GenreTab; label: string; count: number }

/** 장르 탭: 전체, 장르별, 장르 없는 게임이 있으면 '미분류'. 둘 다인 게임은 양쪽 탭에 센다. */
export function genreTabs(games: readonly Game[]): GenreTabInfo[] {
  const tabs: GenreTabInfo[] = [
    { key: '', label: '전체', count: games.length },
    ...GENRES.map((genre) => ({ key: genre, label: genre, count: games.filter((g) => g.genres.includes(genre)).length })),
  ]
  const none = games.filter((g) => g.genres.length === 0).length
  return none ? [...tabs, { key: NO_GENRE, label: '미분류', count: none }] : tabs
}
