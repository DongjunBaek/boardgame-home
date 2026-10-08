import { describe, expect, it } from 'vitest'
import { formatMinutes, formatPlayers, formatPrice, parseWon, shortGenre } from './format'

describe('format', () => {
  it('가격은 천 단위 쉼표 + 원', () => {
    expect(formatPrice(59000)).toBe('59,000원')
    expect(formatPrice(null)).toBeNull()
  })
  it('시간·인원', () => {
    expect(formatMinutes(30)).toBe('30분')
    expect(formatMinutes(null)).toBeNull()
    expect(formatPlayers(['2인', '4인'])).toBe('2인, 4인')
    expect(formatPlayers([])).toBeNull()
  })
  it('장르 줄임말, 모르는 장르는 그대로', () => {
    expect(shortGenre('머더미스터리')).toBe('머더')
    expect(shortGenre('파티')).toBe('파티')
  })
  it('입력한 금액 읽기', () => {
    expect(parseWon('45,000원')).toBe(45000)
    expect(parseWon(' 45000 ')).toBe(45000)
    expect(parseWon('0')).toBe(0)
    expect(parseWon('  ')).toBeNull()
    expect(parseWon('-1')).toBeUndefined()
    expect(parseWon('4.5')).toBeUndefined()
    expect(parseWon('사만원')).toBeUndefined()
  })
})
