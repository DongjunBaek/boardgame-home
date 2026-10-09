import { describe, expect, it } from 'vitest'
import { findPath, moveFeet, nearestOpen } from './path'
import { pickScale } from './scene'
import houseText from '../../../public/village/maps/house.tmj?raw'
import mapText from '../../../public/village/maps/village.tmj?raw'
import { collisionGrid, isBlocked, resolveGid, spawnTile, spotAt, spots, tileFrame, type Grid, type LoadedTileset, type TiledMap } from './tiled'

/** '#'는 막힌 칸, '.'는 빈칸 */
function grid(rows: string[]): Grid {
  const width = rows[0].length
  const blocked = new Uint8Array(rows.join('').split('').map((c) => (c === '#' ? 1 : 0)))
  return { width, height: rows.length, blocked }
}

describe('resolveGid', () => {
  const ts = (firstgid: number, name: string): LoadedTileset => ({
    firstgid,
    base: '',
    tileset: { name, tilewidth: 16, tileheight: 16, columns: 4, tilecount: 8 },
  })
  const sets = [ts(1, 'a'), ts(9, 'b')]

  it('finds the tileset with the largest firstgid not above gid', () => {
    expect(resolveGid(0, sets)).toBeNull()
    expect(resolveGid(1, sets)).toMatchObject({ id: 0, ts: { tileset: { name: 'a' } } })
    expect(resolveGid(9, sets)).toMatchObject({ id: 0, ts: { tileset: { name: 'b' } } })
    expect(resolveGid(12, sets)?.id).toBe(3)
  })

  it('ignores flip flags', () => {
    expect(resolveGid(0x80000000 | 10, sets)?.id).toBe(1)
  })

  it('computes frame position from columns', () => {
    expect(tileFrame(sets[0].tileset, 5)).toEqual({ x: 16, y: 16, width: 16, height: 16 })
  })
})

describe('findPath', () => {
  const g = grid([
    '.....', //
    '.###.',
    '...#.',
    '.#...',
  ])

  it('walks around walls with the shortest path', () => {
    const path = findPath(g, { x: 0, y: 0 }, { x: 2, y: 2 })
    expect(path).toEqual([
      { x: 0, y: 1 },
      { x: 0, y: 2 },
      { x: 1, y: 2 },
      { x: 2, y: 2 },
    ])
  })

  it('returns empty when already there and null when blocked or unreachable', () => {
    expect(findPath(g, { x: 0, y: 0 }, { x: 0, y: 0 })).toEqual([])
    expect(findPath(g, { x: 0, y: 0 }, { x: 1, y: 1 })).toBeNull()
    const closed = grid(['.#.', '##.', '...'])
    expect(findPath(closed, { x: 0, y: 0 }, { x: 2, y: 2 })).toBeNull()
  })
})

describe('nearestOpen', () => {
  it('returns the tile itself if open, otherwise the closest open tile', () => {
    const g = grid(['....', '.##.', '.##.', '....'])
    expect(nearestOpen(g, { x: 0, y: 0 })).toEqual({ x: 0, y: 0 })
    const near = nearestOpen(g, { x: 1, y: 1 })!
    expect(isBlocked(g, near.x, near.y)).toBe(false)
    expect(Math.abs(near.x - 1) + Math.abs(near.y - 1)).toBe(1)
  })
})

describe('moveFeet', () => {
  const g = grid(['...', '.#.', '...'])

  it('stops at walls but slides along the free axis', () => {
    // 막힌 칸(1,1) 바로 왼쪽에서 오른쪽으로 걸으면 멈춘다
    expect(moveFeet(g, { x: 10, y: 28 }, 4, 0, 16)).toEqual({ x: 10, y: 28 })
    // 오른쪽은 막혀도 아래로는 간다
    expect(moveFeet(g, { x: 10, y: 28 }, 4, 3, 16)).toEqual({ x: 10, y: 31 })
    // 열린 곳은 그대로 간다
    expect(moveFeet(g, { x: 8, y: 10 }, 3, 2, 16)).toEqual({ x: 11, y: 12 })
  })

  it('treats outside the map as blocked', () => {
    expect(moveFeet(g, { x: 6, y: 10 }, -3, 0, 16)).toEqual({ x: 6, y: 10 })
  })
})

describe('village.tmj (실제 지도)', () => {
  const map = JSON.parse(mapText) as TiledMap
  const g = collisionGrid(map)
  const start = spawnTile(map)

  it('has the four places and the spawn on open ground', () => {
    expect(spots(map).map((s) => s.kind).sort()).toEqual(['farm', 'house', 'lab', 'shop'])
    expect(isBlocked(g, start.x, start.y)).toBe(false)
  })

  it('can walk from the spawn to every entry', () => {
    for (const s of spots(map)) {
      expect(findPath(g, start, s.entry), s.kind).not.toBeNull()
    }
  })

  it('finds a building by clicking on its picture', () => {
    const house = spots(map).find((s) => s.kind === 'house')!
    const cx = house.area.x + house.area.width / 2
    const cy = house.area.y + house.area.height / 2
    expect(spotAt(spots(map), cx, cy)?.kind).toBe('house')
    expect(spotAt(spots(map), 0, 0)).toBeUndefined()
  })
})

describe('house.tmj (집 안 지도)', () => {
  const map = JSON.parse(houseText) as TiledMap
  const g = collisionGrid(map)
  const start = spawnTile(map)

  it('has a bookshelf and an exit you walk down into', () => {
    const list = spots(map)
    expect(list.map((s) => s.kind).sort()).toEqual(['bookshelf', 'exit', 'wardrobe'])
    expect(list.find((s) => s.kind === 'exit')?.facing).toBe('down')
    expect(list.find((s) => s.kind === 'bookshelf')?.facing).toBe('up')
    expect(map.backgroundcolor).toBeTruthy()
  })

  it('can walk from the spawn to every spot in the house', () => {
    for (const s of spots(map)) expect(findPath(g, start, s.entry), s.kind).not.toBeNull()
  })
})

describe('pickScale', () => {
  it('shows about 24×15 tiles, and fills the view with small maps', () => {
    expect(pickScale(1200, 760)).toBe(3)
    expect(pickScale(1200, 760, 16, 14, 10)).toBe(4)
    expect(pickScale(375, 500)).toBe(2)
  })
})
