import { describe, expect, it } from 'vitest'
import { applyMinePatch, EMPTY_FILTERS, filterGames, hasBlanks, isFiltered, sortGames, summarize, type Filters } from './games'
import type { Game } from './types'

function game(id: string, over: Partial<Omit<Game, 'mine'>> & { mine?: Partial<Game['mine']> } = {}): Game {
  const { mine, ...rest } = over
  return {
    id,
    title: id,
    genres: ['보드게임'],
    player_count: ['2-4인'],
    play_time_minutes: 60,
    price: 30000,
    publisher: null,
    sale_link: null,
    images: [],
    tags: [],
    source: 'manual',
    extra: {},
    ...rest,
    mine: {
      quantity: 1,
      played: false,
      rating: null,
      review: null,
      notes: null,
      added_at: null,
      purchase: { date: null, paid: null, shop: null },
      ...mine,
    },
  }
}

const GAMES = [
  game('딕싯', { player_count: ['3-8인'], play_time_minutes: 30, publisher: '코리아보드게임즈', mine: { played: true, rating: 4 } }),
  game('망령 열차', { genres: ['머더미스터리'], player_count: ['5인'], play_time_minutes: 120, price: null }),
  game('카탄', { player_count: ['3-4인'], play_time_minutes: 75, mine: { quantity: 3 } }),
  game('크라임 퍼즐', { genres: ['머더미스터리', '보드게임'], player_count: [], play_time_minutes: null, price: 20000 }),
]
const ids = (games: Game[]) => games.map((g) => g.id)
const only = (f: Partial<Filters>) => ids(filterGames(GAMES, { ...EMPTY_FILTERS, ...f }))

describe('filterGames', () => {
  it('조건이 없으면 전부', () => {
    expect(only({})).toHaveLength(4)
  })
  it('제목·제작사 검색 (대소문자 무시, 앞뒤 공백 무시)', () => {
    expect(only({ q: ' 열차 ' })).toEqual(['망령 열차'])
    expect(only({ q: '코리아' })).toEqual(['딕싯'])
  })
  it('장르: 둘 다 해당하는 게임은 양쪽에 나온다', () => {
    expect(only({ genre: '머더미스터리' })).toEqual(['망령 열차', '크라임 퍼즐'])
    expect(only({ genre: '보드게임' })).toEqual(['딕싯', '카탄', '크라임 퍼즐'])
  })
  it('N명 가능: 범위 안이면 포함, 인원 모름은 빠짐', () => {
    expect(only({ players: 5 })).toEqual(['딕싯', '망령 열차'])
    expect(only({ players: 4 })).toEqual(['딕싯', '카탄'])
  })
  it('최대 시간: 이하만, 시간 모름은 빠짐', () => {
    expect(only({ maxTime: 75 })).toEqual(['딕싯', '카탄'])
  })
  it('해봤음 / 안 해봄', () => {
    expect(only({ played: 'played' })).toEqual(['딕싯'])
    expect(only({ played: 'unplayed' })).toEqual(['망령 열차', '카탄', '크라임 퍼즐'])
  })
  it('빈칸 있는 게임만', () => {
    expect(only({ blanksOnly: true })).toEqual(['망령 열차', '크라임 퍼즐'])
  })
  it('조건을 함께 쓰면 모두 만족해야 한다', () => {
    expect(only({ players: 5, genre: '머더미스터리' })).toEqual(['망령 열차'])
  })
})

describe('hasBlanks / isFiltered', () => {
  it('인원·시간·가격 중 하나라도 비면 빈칸', () => {
    expect(GAMES.map(hasBlanks)).toEqual([false, true, false, true])
  })
  it('공백만 있는 검색어는 거르기가 아니다', () => {
    expect(isFiltered(EMPTY_FILTERS)).toBe(false)
    expect(isFiltered({ ...EMPTY_FILTERS, q: '  ' })).toBe(false)
    expect(isFiltered({ ...EMPTY_FILTERS, players: 4 })).toBe(true)
  })
})

describe('sortGames', () => {
  it('제목 가나다순 / 역순', () => {
    expect(ids(sortGames(GAMES, { key: 'title', dir: 'asc' }))).toEqual(['딕싯', '망령 열차', '카탄', '크라임 퍼즐'])
    expect(ids(sortGames(GAMES, { key: 'title', dir: 'desc' }))).toEqual(['크라임 퍼즐', '카탄', '망령 열차', '딕싯'])
  })
  it('빈 값은 방향과 상관없이 맨 뒤', () => {
    expect(ids(sortGames(GAMES, { key: 'time', dir: 'asc' }))).toEqual(['딕싯', '카탄', '망령 열차', '크라임 퍼즐'])
    expect(ids(sortGames(GAMES, { key: 'time', dir: 'desc' }))).toEqual(['망령 열차', '카탄', '딕싯', '크라임 퍼즐'])
    expect(ids(sortGames(GAMES, { key: 'price', dir: 'asc' })).at(-1)).toBe('망령 열차')
  })
  it('인원은 가장 적은 인원 기준, 같으면 제목순', () => {
    expect(ids(sortGames(GAMES, { key: 'players', dir: 'asc' }))).toEqual(['딕싯', '카탄', '망령 열차', '크라임 퍼즐'])
  })
  it('숫자 칸: 개수, 별점', () => {
    expect(ids(sortGames(GAMES, { key: 'quantity', dir: 'desc' }))[0]).toBe('카탄')
    expect(ids(sortGames(GAMES, { key: 'rating', dir: 'desc' }))).toEqual(['딕싯', '망령 열차', '카탄', '크라임 퍼즐'])
  })
  it('원본 배열은 바꾸지 않는다', () => {
    const before = ids(GAMES)
    sortGames(GAMES, { key: 'title', dir: 'desc' })
    expect(ids(GAMES)).toEqual(before)
  })
})

describe('summarize', () => {
  it('장르는 둘 다 해당하면 양쪽에 센다', () => {
    expect(summarize(GAMES)).toEqual({ total: 4, murder: 2, board: 3, unplayed: 3 })
  })
})

describe('낸 가격', () => {
  const bought = [
    game('a', { mine: { purchase: { date: '2026-01-01', paid: 30000, shop: '보드엠' } } }),
    game('b'),
    game('c', { mine: { purchase: { date: null, paid: 12000, shop: null } } }),
  ]
  it('낸 가격 정렬, 기록 없는 게임은 맨 뒤', () => {
    expect(ids(sortGames(bought, { key: 'paid', dir: 'asc' }))).toEqual(['c', 'a', 'b'])
    expect(ids(sortGames(bought, { key: 'paid', dir: 'desc' }))).toEqual(['a', 'c', 'b'])
  })
  it('낸 가격만 바꾸면 구입일·산 곳은 그대로', () => {
    const next = applyMinePatch(bought[0], { purchase: { paid: 28000 } })
    expect(next.mine.purchase).toEqual({ date: '2026-01-01', paid: 28000, shop: '보드엠' })
    expect(bought[0].mine.purchase.paid).toBe(30000)
  })
  it('다른 내 정보는 한 단계만 합친다', () => {
    expect(applyMinePatch(bought[1], { rating: 3 }).mine).toMatchObject({ rating: 3, quantity: 1 })
  })
})
