import { describe, expect, it } from 'vitest'
import { clockOffset, farmNow, formatLeft, growthStage } from './farm'
import { objectParticle, type VillageState } from './state'

const state = (last: string, serverTime: string, rate = 10): VillageState => ({
  version: 1,
  coins: 0,
  crystals: 0,
  crop_level: 1,
  last_harvest: last,
  items: [],
  skins: { player: 'default', buildings: {} },
  player: null,
  farm: { rate_per_hour: rate, cap_hours: 12, pending: 0, full_at: '' },
  lab: null,
  shop: { cost: 100, names: {} },
  server_time: serverTime,
})

describe('farmNow', () => {
  const s = state('2026-10-09T09:00:00', '2026-10-09T10:30:00')
  // 이 컴퓨터 시계가 서버보다 5초 늦은 경우
  const client = Date.parse('2026-10-09T10:29:55')
  const offset = clockOffset(s, client)

  it('counts from the server clock, not the client clock', () => {
    expect(offset).toBe(5000)
    expect(farmNow(s, offset, client)).toMatchObject({ pending: 15, capCoins: 120 })
  })

  it('stops at the 12 hour cap', () => {
    const later = client + 20 * 3_600_000
    expect(farmNow(s, offset, later)).toEqual({ pending: 120, capCoins: 120, ratio: 1, fullInMs: 0 })
  })

  it('reads millisecond timestamps from harvest leftovers', () => {
    const left = state('2026-10-09T09:06:00.000', '2026-10-09T09:12:00')
    expect(farmNow(left, 0, Date.parse('2026-10-09T09:12:00')).pending).toBe(1)
  })
})

describe('formatLeft / growthStage', () => {
  it('formats remaining time', () => {
    expect(formatLeft(30_000)).toBe('1분 미만')
    expect(formatLeft(12 * 60_000)).toBe('12분')
    expect(formatLeft(3 * 3_600_000)).toBe('3시간')
    expect(formatLeft(3 * 3_600_000 + 12 * 60_000)).toBe('3시간 12분')
  })

  it('grows one stage per quarter of the cap', () => {
    expect([0, 0.24, 0.25, 0.5, 0.99, 1].map(growthStage)).toEqual([1, 1, 2, 3, 4, 4])
  })
})

describe('objectParticle', () => {
  it('picks 을/를 by the last syllable', () => {
    expect(objectParticle('서랍장')).toBe('을')
    expect(objectParticle('나무 의자')).toBe('를')
    expect(objectParticle('LV2')).toBe('을(를)')
  })
})
