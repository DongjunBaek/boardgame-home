// 표에 보여 줄 글자. 빈 값은 null을 돌려주고, 화면이 "—"로 흐리게 그린다.

export const formatPrice = (won: number | null) => (won === null ? null : `${won.toLocaleString('ko-KR')}원`)

export const formatMinutes = (minutes: number | null) => (minutes === null ? null : `${minutes}분`)

export const formatPlayers = (counts: readonly string[]) => (counts.length ? counts.join(', ') : null)

const SHORT_GENRE: Record<string, string> = { 보드게임: '보드', 머더미스터리: '머더' }
export const shortGenre = (genre: string) => SHORT_GENRE[genre] ?? genre

/** 입력한 금액 → 원. "45,000원"·" 45000 " 허용, 빈칸은 null, 숫자가 아니면 undefined. */
export function parseWon(text: string): number | null | undefined {
  const cleaned = text.replaceAll(',', '').replace(/원$/, '').trim()
  if (cleaned === '') return null
  return /^\d+$/.test(cleaned) ? Number(cleaned) : undefined
}
