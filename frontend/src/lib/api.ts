// 서버 API 호출. 개발 중에는 Vite가 /api를 FastAPI로 넘겨준다 (vite.config.ts).
import type { Game, GameInput } from './types'

export type Health = { status: string; data_dir: string }

async function request<T>(method: string, path: string, body?: unknown, fetchFn: typeof fetch = fetch): Promise<T> {
  const res = await fetchFn(`/api${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).catch(() => {
    // 브라우저 오류는 "Failed to fetch" 같은 영어라서 바꿔 준다
    throw new Error('서버에 연결할 수 없습니다 (서버가 꺼져 있는지 확인해 주세요)')
  })
  if (!res.ok) {
    // 서버가 보낸 이유(예: "별점: ...", "같은 제목의 게임이 이미 있습니다")가 있으면 그것을 쓴다
    const detail = await res
      .json()
      .then((b: { detail?: unknown }) => (typeof b.detail === 'string' ? b.detail : ''))
      .catch(() => '')
    throw new Error(detail || `서버 오류 ${res.status}: ${method} ${path}`)
  }
  return (res.status === 204 ? undefined : await res.json()) as T
}

export const getJson = <T>(path: string, fetchFn?: typeof fetch) => request<T>('GET', path, undefined, fetchFn)

export const fetchHealth = (fetchFn?: typeof fetch) => getJson<Health>('/health', fetchFn)

export const fetchGames = (fetchFn?: typeof fetch) => getJson<Game[]>('/games', fetchFn)

const gamePath = (id: string) => `/games/${encodeURIComponent(id)}`

export const createGame = (input: GameInput, fetchFn?: typeof fetch) => request<Game>('POST', '/games', input, fetchFn)

export const updateGame = (id: string, patch: GameInput, fetchFn?: typeof fetch) =>
  request<Game>('PATCH', gamePath(id), patch, fetchFn)

export const deleteGame = (id: string, fetchFn?: typeof fetch) => request<void>('DELETE', gamePath(id), undefined, fetchFn)
