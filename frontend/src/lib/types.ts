// data/collection.json 레코드 모양 (scripts/migrate_from_danseo.py가 만든 것과 같다)

export const GENRES = ['보드게임', '머더미스터리'] as const
export type Genre = (typeof GENRES)[number]

export type Mine = {
  quantity: number
  played: boolean
  rating: number | null
  review: string | null
  notes: string | null
  added_at: string | null
  purchase: { date: string | null; paid: number | null; shop: string | null }
}

export type Game = {
  id: string
  title: string
  genres: string[]
  player_count: string[]
  play_time_minutes: number | null
  price: number | null
  publisher: string | null
  sale_link: string | null
  images: string[]
  tags: string[]
  source: string | null
  extra: Record<string, unknown>
  mine: Mine
}

/** 추가·수정 때 보내는 값. 보낸 칸만 바뀐다 (서버 backend/app/games.py의 GameIn). */
export type GameInput = Partial<
  Pick<Game, 'title' | 'genres' | 'player_count' | 'play_time_minutes' | 'price' | 'publisher' | 'sale_link'>
> & {
  mine?: Partial<Pick<Mine, 'quantity' | 'played' | 'rating' | 'review' | 'notes'>> & {
    purchase?: Partial<Mine['purchase']>
  }
}

/** 엑셀 올리기 미리보기 (서버 backend/app/excel.py의 plan_import 보고서) */
export type ExcelChange = {
  row: number
  id: string
  title: string
  kind: 'new' | 'update'
  fields: { field: string; before: string; after: string }[]
}

export type ExcelReport = {
  changes: ExcelChange[]
  errors: string[]
  counts: { new: number; updated: number; unchanged: number; not_in_file: number }
}

export type ExcelPreview = { base: string; report: ExcelReport }

/** 스토어 바로가기 (data/stores.json, 서버 backend/app/stores.py) */
export type Store = {
  id: string
  name: string
  url: string
  /** 묶음 이름. 예: "제작사 스토어". null이면 '기타' */
  group: string | null
  memo: string | null
}

/** 추가·수정 때 보내는 값. 보낸 칸만 바뀐다 */
export type StoreInput = Partial<Omit<Store, 'id'>>
