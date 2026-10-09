// 집 책장: 내 보드게임을 책으로 꽂는다. 게임 목록(/api/games)을 그대로 읽고, 마을 상태에 복사하지 않는다.
import type { Game } from '../types'

// 책 등 색: 장르 색(보드게임 이끼색, 머더미스터리 와인색)을 세 단계로 번갈아 쓴다. 장르가 없으면 나무색
const SPINES: Record<string, string[]> = {
  보드게임: ['#4c6634', '#67835c', '#78a158'],
  머더미스터리: ['#973446', '#7b2f45', '#b8697a'],
}
const PLAIN = ['#90625d', '#aa7959', '#754c60']

export function spineColor(game: Game, index: number): string {
  const set = SPINES[game.genres[0] ?? ''] ?? PLAIN
  return set[index % set.length]
}

/** 꽂는 순서: 장르(보드게임 → 머더미스터리 → 나머지) 안에서 제목순 */
export function shelfOrder(games: readonly Game[]): Game[] {
  const rank = (g: Game) => {
    const i = Object.keys(SPINES).indexOf(g.genres[0] ?? '')
    return i < 0 ? 99 : i
  }
  return [...games].sort((a, b) => rank(a) - rank(b) || a.title.localeCompare(b.title, 'ko'))
}
