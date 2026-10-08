// 서버 API 호출. 개발 중에는 Vite가 /api를 FastAPI로 넘겨준다 (vite.config.ts).

export type Health = { status: string; data_dir: string }

export async function getJson<T>(path: string, fetchFn: typeof fetch = fetch): Promise<T> {
  const res = await fetchFn(`/api${path}`)
  if (!res.ok) throw new Error(`서버 오류 ${res.status}: ${path}`)
  return (await res.json()) as T
}

export const fetchHealth = (fetchFn?: typeof fetch) => getJson<Health>('/health', fetchFn)
