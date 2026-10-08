// 서버 API 호출. 개발 중에는 Vite가 /api를 FastAPI로 넘겨준다 (vite.config.ts).
import type { Game } from './types'

export type Health = { status: string; data_dir: string }

export async function getJson<T>(path: string, fetchFn: typeof fetch = fetch): Promise<T> {
  const res = await fetchFn(`/api${path}`)
  if (!res.ok) {
    // 서버가 보낸 이유(예: "데이터 파일이 손상되었습니다")가 있으면 같이 보여 준다
    const detail = await res
      .json()
      .then((body: { detail?: unknown }) => (typeof body.detail === 'string' ? ` - ${body.detail}` : ''))
      .catch(() => '')
    throw new Error(`서버 오류 ${res.status}: ${path}${detail}`)
  }
  return (await res.json()) as T
}

export const fetchHealth = (fetchFn?: typeof fetch) => getJson<Health>('/health', fetchFn)

export const fetchGames = (fetchFn?: typeof fetch) => getJson<Game[]>('/games', fetchFn)
