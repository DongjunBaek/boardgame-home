import { describe, expect, it } from 'vitest'
import type { Game } from '../types'
import { shelfOrder, spineColor } from './books'

const game = (title: string, genres: string[]): Game =>
  ({ id: title, title, genres, player_count: [], play_time_minutes: null, price: null, publisher: null, sale_link: null, images: [], tags: [], source: null, extra: {}, mine: {} }) as unknown as Game

describe('shelfOrder / spineColor', () => {
  it('groups by genre, then title', () => {
    const list = [game('하', ['머더미스터리']), game('나', []), game('다', ['보드게임']), game('가', ['보드게임'])]
    expect(shelfOrder(list).map((g) => g.title)).toEqual(['가', '다', '하', '나'])
  })

  it('uses the genre color family and alternates shades', () => {
    const g = game('가', ['보드게임'])
    expect(spineColor(g, 0)).toBe('#4c6634')
    expect(spineColor(g, 1)).not.toBe(spineColor(g, 0))
    expect(spineColor(game('나', []), 0)).toBe('#90625d')
  })
})
