import { describe, expect, it } from 'vitest'
import shared from '../../../shared/player_cases.json'
import { minPlayers, parsePlayerRange, supportsPlayerCount } from './players'

describe('supportsPlayerCount (서버와 공통 사례)', () => {
  it.each(shared.supports)('$counts, $n명 → $expected', ({ counts, n, expected }) => {
    expect(supportsPlayerCount(counts, n)).toBe(expected)
  })
})

describe('parsePlayerRange', () => {
  it.each([
    ['4인', [4, 4]],
    ['2-4인', [2, 4]],
    ['2~4인', [2, 4]],
    ['6-3인', [3, 6]],
    ['5+gm', [5, 5]],
    ['모름', null],
    ['', null],
  ] as const)('%s → %j', (text, expected) => {
    expect(parsePlayerRange(text)).toEqual(expected)
  })
})

describe('minPlayers', () => {
  it('여러 표기 중 가장 적은 인원', () => {
    expect(minPlayers(['4인', '2-3인'])).toBe(2)
  })
  it('정보가 없으면 null', () => {
    expect(minPlayers([])).toBeNull()
    expect(minPlayers(['모름'])).toBeNull()
  })
})
