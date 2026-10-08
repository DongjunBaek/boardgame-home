// 보유 목록 거르기·정렬·요약. 화면 상태와 무관한 순수 함수만 둔다.
import { minPlayers, supportsPlayerCount } from './players'
import type { Game, GameInput, Genre } from './types'

export type PlayedFilter = 'all' | 'played' | 'unplayed'

export type Filters = {
  q: string
  genre: Genre | ''
  players: number | null
  maxTime: number | null
  played: PlayedFilter
  blanksOnly: boolean
}

export const EMPTY_FILTERS: Filters = {
  q: '',
  genre: '',
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
    if (f.genre && !g.genres.includes(f.genre)) return false
    // 인원·시간 조건이 있으면 그 정보가 빈 게임은 뺀다 (맞는지 알 수 없으므로)
    if (f.players !== null && !supportsPlayerCount(g.player_count, f.players)) return false
    if (f.maxTime !== null && (g.play_time_minutes === null || g.play_time_minutes > f.maxTime)) return false
    if (f.played === 'played' && !g.mine.played) return false
    if (f.played === 'unplayed' && g.mine.played) return false
    if (f.blanksOnly && !hasBlanks(g)) return false
    return true
  })
}

export type SortKey = 'title' | 'genre' | 'players' | 'time' | 'price' | 'paid' | 'quantity' | 'played' | 'rating'
export type SortDir = 'asc' | 'desc'
export type Sort = { key: SortKey; dir: SortDir }

const collator = new Intl.Collator('ko', { numeric: true, sensitivity: 'base' })

function sortValue(g: Game, key: SortKey): string | number | null {
  switch (key) {
    case 'title':
      return g.title
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
