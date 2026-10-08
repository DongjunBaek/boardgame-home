// 표에 보여 줄 글자. 빈 값은 null을 돌려주고, 화면이 "—"로 흐리게 그린다.

export const formatPrice = (won: number | null) => (won === null ? null : `${won.toLocaleString('ko-KR')}원`)

export const formatMinutes = (minutes: number | null) => (minutes === null ? null : `${minutes}분`)

export const formatPlayers = (counts: readonly string[]) => (counts.length ? counts.join(', ') : null)

const SHORT_GENRE: Record<string, string> = { 보드게임: '보드', 머더미스터리: '머더' }
export const shortGenre = (genre: string) => SHORT_GENRE[genre] ?? genre
