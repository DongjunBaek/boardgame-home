import { describe, expect, it } from 'vitest'
import { drawOrder, inRoom, newUid, remaining, type Placed } from './decor'

const p = (uid: string, item: string, x: number, y: number): Placed => ({ uid, item, x, y })

describe('decor', () => {
  it('counts what is left to place', () => {
    const left = remaining([{ id: 'rug-blue', count: 2 }, { id: 'lamp-pink', count: 1 }], [p('a', 'rug-blue', 2, 2)])
    expect(left.get('rug-blue')).toBe(1)
    expect(left.get('lamp-pink')).toBe(1)
  })

  it('makes unique uids', () => {
    expect(newUid('rug-blue', [])).toBe('rug-blue-1')
    expect(newUid('rug-blue', [p('rug-blue-2', 'rug-blue', 1, 1)])).toBe('rug-blue-3')
  })

  it('keeps rugs at the bottom and sorts the rest by row', () => {
    const list = [p('a', 'lamp-pink', 3, 5), p('b', 'rug-blue', 3, 6), p('c', 'clock-cat', 4, 0)]
    expect(drawOrder(list).map((x) => x.uid)).toEqual(['b', 'c', 'a'])
  })

  it('knows the room bounds', () => {
    expect(inRoom({ x: 1, y: 0 })).toBe(true)
    expect(inRoom({ x: 12, y: 7 })).toBe(true)
    expect(inRoom({ x: 0, y: 3 })).toBe(false)
    expect(inRoom({ x: 5, y: 8 })).toBe(false)
  })
})
