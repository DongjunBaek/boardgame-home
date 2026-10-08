// 표에 보여 줄 글자. 빈 값은 null을 돌려주고, 화면이 "—"로 흐리게 그린다.

export const formatPrice = (won: number | null) => (won === null ? null : `${won.toLocaleString('ko-KR')}원`)

export const formatMinutes = (minutes: number | null) => (minutes === null ? null : `${minutes}분`)

export const formatPlayers = (counts: readonly string[]) => (counts.length ? counts.join(', ') : null)

const SHORT_GENRE: Record<string, string> = { 보드게임: '보드', 머더미스터리: '머더' }
export const shortGenre = (genre: string) => SHORT_GENRE[genre] ?? genre

/** 입력한 금액 → 원. "45,000원"·" 45000 " 허용, 빈칸은 null, 숫자가 아니면 undefined. */
export function parseWon(text: string): number | null | undefined {
  const cleaned = text.replaceAll(',', '').trim().replace(/원$/, '').trim()
  if (cleaned === '') return null
  return /^\d+$/.test(cleaned) ? Number(cleaned) : undefined
}

/** 입력한 시간 → 분. "90", "90분" 허용, 빈칸은 null, 1 이상의 정수가 아니면 undefined. */
export function parseMinutes(text: string): number | null | undefined {
  const cleaned = text.trim().replace(/분$/, '').trim()
  if (cleaned === '') return null
  return /^\d+$/.test(cleaned) && Number(cleaned) >= 1 ? Number(cleaned) : undefined
}

/** 입력한 인원 → 표기 목록. "2-4인, 5+gm" 처럼 쉼표로 여러 개. 빈칸은 [], 숫자 없는 표기가 있으면 undefined.
 *  "4"처럼 '인'을 빼먹으면 붙여 준다. 합치기·정리는 서버가 한다 (players.py). */
export function parsePlayerInput(text: string): string[] | undefined {
  const parts = text
    .split(/[,、/]/)
    .map((p) => p.trim())
    .filter(Boolean)
  if (parts.some((p) => !/\d/.test(p))) return undefined
  return parts.map((p) => (/(인|gm)/i.test(p) ? p : `${p}인`))
}
