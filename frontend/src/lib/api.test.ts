import { describe, expect, it } from 'vitest'
import { fetchHealth } from './api'

const fakeFetch = (status: number, body: unknown) =>
  (async () => new Response(JSON.stringify(body), { status })) as typeof fetch

describe('fetchHealth', () => {
  it('서버 응답을 그대로 돌려준다', async () => {
    const body = { status: 'ok', data_dir: 'D:/x' }
    await expect(fetchHealth(fakeFetch(200, body))).resolves.toEqual(body)
  })

  it('실패 응답이면 오류를 던진다', async () => {
    await expect(fetchHealth(fakeFetch(500, {}))).rejects.toThrow('서버 오류 500')
  })

  it('서버가 보낸 이유를 오류에 붙인다', async () => {
    await expect(fetchHealth(fakeFetch(500, { detail: '파일 손상' }))).rejects.toThrow('서버 오류 500: /health - 파일 손상')
  })
})
