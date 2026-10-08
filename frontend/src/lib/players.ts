// 인원 표기 해석. 서버 backend/app/players.py와 같은 규칙이다 (shared/player_cases.json으로 둘 다 검사).

const NUMBERS = /(\d+)(?:\s*[-~]\s*(\d+))?/

/** 표기 하나 → [최소, 최대]. 숫자가 없으면 null. "6-3인"처럼 거꾸로 적어도 [3, 6]. */
export function parsePlayerRange(text: string | null | undefined): [number, number] | null {
  const match = NUMBERS.exec(text ?? '')
  if (!match) return null
  const first = Number(match[1])
  const second = match[2] ? Number(match[2]) : first
  return [Math.min(first, second), Math.max(first, second)]
}

/** 표기 중 하나라도 n명을 포함하면 true. 인원 정보가 없으면 false. */
export function supportsPlayerCount(counts: readonly string[] | null | undefined, n: number): boolean {
  return (counts ?? []).some((text) => {
    const range = parsePlayerRange(text)
    return range !== null && range[0] <= n && n <= range[1]
  })
}

/** 정렬용: 가장 적은 인원. 인원 정보가 없으면 null. */
export function minPlayers(counts: readonly string[] | null | undefined): number | null {
  const mins = (counts ?? []).map(parsePlayerRange).flatMap((r) => (r ? [r[0]] : []))
  return mins.length ? Math.min(...mins) : null
}
