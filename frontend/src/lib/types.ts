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
