import { describe, expect, it } from 'vitest'
import { deleteGame, fetchHealth, updateGame } from './api'

type Call = { url: string; init?: RequestInit }

function fakeFetch(status: number, body: unknown, calls: Call[] = []) {
  return (async (url: string, init?: RequestInit) => {
    calls.push({ url, init })
    return new Response(status === 204 ? null : JSON.stringify(body), { status })
  }) as typeof fetch
}

describe('request', () => {
  it('서버 응답을 그대로 돌려준다', async () => {
    const body = { status: 'ok', data_dir: 'D:/x' }
    await expect(fetchHealth(fakeFetch(200, body))).resolves.toEqual(body)
  })

  it('실패 응답이고 이유가 없으면 상태 코드를 알려 준다', async () => {
    await expect(fetchHealth(fakeFetch(500, {}))).rejects.toThrow('서버 오류 500: GET /health')
  })

  it('서버가 보낸 이유가 있으면 그것을 오류로 쓴다', async () => {
    await expect(fetchHealth(fakeFetch(422, { detail: '별점: 너무 큼' }))).rejects.toThrow(/^별점: 너무 큼$/)
  })

  it('PATCH는 JSON 본문을 보내고 ID의 특수문자를 주소용으로 바꾼다', async () => {
    const calls: Call[] = []
    await updateGame('manual:ab/c', { mine: { rating: 3 } }, fakeFetch(200, {}, calls))
    expect(calls[0].url).toBe('/api/games/manual%3Aab%2Fc')
    expect(calls[0].init?.method).toBe('PATCH')
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ mine: { rating: 3 } })
  })

  it('서버에 닿지 못하면 알아듣기 쉬운 오류', async () => {
    const down = (async () => {
      throw new TypeError('Failed to fetch')
    }) as typeof fetch
    await expect(fetchHealth(down)).rejects.toThrow('서버에 연결할 수 없습니다')
  })

  it('204 응답은 본문 없이 끝난다', async () => {
    await expect(deleteGame('manual:a', fakeFetch(204, null))).resolves.toBeUndefined()
  })
})
