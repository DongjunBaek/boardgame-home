// 게임 상세 창의 입력값 ↔ 저장할 값. 화면 상태와 무관한 순수 함수만 둔다.
import { parsePlayerRange } from './players'
import type { Game, GameInput } from './types'

/** 인원 한 줄: 고정(4인) / 범위(2-4인) / GM(5+gm) */
export type PlayerMode = 'fixed' | 'range' | 'gm'
export type PlayerRow = { mode: PlayerMode; min: string; max: string }

export function rowsFromCounts(counts: readonly string[]): PlayerRow[] {
  return counts.flatMap((text): PlayerRow[] => {
    const range = parsePlayerRange(text)
    if (!range) return []
    const [min, max] = range.map(String)
    if (/gm/i.test(text)) return [{ mode: 'gm', min, max: '' }]
    return min === max ? [{ mode: 'fixed', min, max: '' }] : [{ mode: 'range', min, max }]
  })
}

/** 입력 줄 → 표기 목록. 잘못된 줄이 있으면 오류 글자. */
export function countsFromRows(rows: readonly PlayerRow[]): string[] | string {
  const counts: string[] = []
  for (const row of rows) {
    const min = toInt(row.min)
    if (min === null || min < 1) return '인원은 1 이상의 숫자로 적어 주세요'
    if (row.mode === 'range') {
      const max = toInt(row.max)
      if (max === null || max <= min) return '범위는 "2-4"처럼 뒤의 숫자가 더 커야 합니다'
      counts.push(`${min}-${max}인`)
    } else {
      counts.push(row.mode === 'gm' ? `${min}+gm` : `${min}인`)
    }
  }
  return counts
}

export type GameForm = {
  title: string
  genres: string[]
  players: PlayerRow[]
  time: string
  price: string
  publisher: string
  saleLink: string
  quantity: string
  played: boolean
  rating: number | null
  review: string
  notes: string
  purchaseDate: string
  purchasePaid: string
  purchaseShop: string
}

const text = (v: string | null) => v ?? ''
const num = (v: number | null) => (v === null ? '' : String(v))

export function formFromGame(g: Game): GameForm {
  return {
    title: g.title,
    genres: [...g.genres],
    players: rowsFromCounts(g.player_count),
    time: num(g.play_time_minutes),
    price: num(g.price),
    publisher: text(g.publisher),
    saleLink: text(g.sale_link),
    quantity: String(g.mine.quantity),
    played: g.mine.played,
    rating: g.mine.rating,
    review: text(g.mine.review),
    notes: text(g.mine.notes),
    purchaseDate: text(g.mine.purchase.date),
    purchasePaid: num(g.mine.purchase.paid),
    purchaseShop: text(g.mine.purchase.shop),
  }
}

export const EMPTY_FORM: GameForm = {
  title: '',
  genres: [],
  players: [],
  time: '',
  price: '',
  publisher: '',
  saleLink: '',
  quantity: '1',
  played: false,
  rating: null,
  review: '',
  notes: '',
  purchaseDate: '',
  purchasePaid: '',
  purchaseShop: '',
}

/** "59,000" 같은 쉼표는 허용. 빈칸은 null, 정수가 아니면 NaN. */
function toInt(value: string): number | null {
  const cleaned = value.replaceAll(',', '').trim()
  if (cleaned === '') return null
  return /^-?\d+$/.test(cleaned) ? Number(cleaned) : Number.NaN
}

type Full = Required<Omit<GameInput, 'mine'>> & {
  mine: Required<Omit<NonNullable<GameInput['mine']>, 'purchase'>> & { purchase: Required<Game['mine']['purchase']> }
}

/** 입력값을 검사해서 저장할 값 전체로. 문제가 있으면 { errors }. 서버도 같은 검사를 한 번 더 한다. */
export function inputFromForm(f: GameForm): { input: Full } | { errors: string[] } {
  const errors: string[] = []
  const title = f.title.trim()
  if (!title) errors.push('제목을 입력해 주세요')

  const counts = countsFromRows(f.players)
  if (typeof counts === 'string') errors.push(counts)

  const int = (value: string, min: number, message: string) => {
    const n = toInt(value)
    if (n !== null && (Number.isNaN(n) || n < min)) errors.push(message)
    return n
  }
  const time = int(f.time, 1, '시간은 1분 이상의 정수로 적어 주세요')
  const price = int(f.price, 0, '정가는 0원 이상의 정수로 적어 주세요')
  const paid = int(f.purchasePaid, 0, '낸 가격은 0원 이상의 정수로 적어 주세요')
  const quantity = toInt(f.quantity)
  if (quantity === null || Number.isNaN(quantity) || quantity < 1) errors.push('개수는 1 이상이어야 합니다')

  const saleLink = f.saleLink.trim() || null
  if (saleLink && !/^https?:\/\//.test(saleLink)) errors.push('판매 링크는 http:// 또는 https://로 시작해야 합니다')

  if (errors.length) return { errors }
  const orNull = (s: string) => s.trim() || null
  return {
    input: {
      title,
      genres: f.genres,
      player_count: counts as string[],
      play_time_minutes: time,
      price,
      publisher: orNull(f.publisher),
      sale_link: saleLink,
      mine: {
        quantity: quantity as number,
        played: f.played,
        rating: f.rating,
        review: orNull(f.review),
        notes: orNull(f.notes),
        purchase: { date: orNull(f.purchaseDate), paid, shop: orNull(f.purchaseShop) },
      },
    },
  }
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** 바뀐 칸만 담은 수정 값. 바뀐 것이 없으면 빈 객체. */
export function diffInput(before: Full, after: Full): GameInput {
  const patch: GameInput = {}
  const { mine: bMine, ...bGame } = before
  const { mine: aMine, ...aGame } = after
  for (const key of Object.keys(aGame) as (keyof typeof aGame)[]) {
    if (!same(bGame[key], aGame[key])) Object.assign(patch, { [key]: aGame[key] })
  }
  const mine: NonNullable<GameInput['mine']> = {}
  const { purchase: bBuy, ...bRest } = bMine
  const { purchase: aBuy, ...aRest } = aMine
  for (const key of Object.keys(aRest) as (keyof typeof aRest)[]) {
    if (!same(bRest[key], aRest[key])) Object.assign(mine, { [key]: aRest[key] })
  }
  const purchase: Partial<Game['mine']['purchase']> = {}
  for (const key of Object.keys(aBuy) as (keyof typeof aBuy)[]) {
    if (!same(bBuy[key], aBuy[key])) Object.assign(purchase, { [key]: aBuy[key] })
  }
  if (Object.keys(purchase).length) mine.purchase = purchase
  if (Object.keys(mine).length) patch.mine = mine
  return patch
}

export const isEmptyPatch = (p: GameInput) => Object.keys(p).length === 0
