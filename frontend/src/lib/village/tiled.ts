// Tiled 지도(.tmj)와 타일셋(.tsj) 읽기. 그리기(PixiJS)와 나눠서 계산만 한다.
// 지도 만드는 법: docs/plan/v3-village.md "지도 고치기"

export type TiledProperty = { name: string; type: string; value: string | number | boolean }

export type TiledTileLayer = {
  type: 'tilelayer'
  name: string
  width: number
  height: number
  visible: boolean
  data: number[]
}

export type TiledObject = {
  id: number
  name: string
  type?: string
  gid?: number
  x: number
  y: number
  width: number
  height: number
  point?: boolean
  properties?: TiledProperty[]
}

export type TiledObjectLayer = { type: 'objectgroup'; name: string; visible: boolean; objects: TiledObject[] }

export type TiledMap = {
  width: number
  height: number
  tilewidth: number
  tileheight: number
  layers: (TiledTileLayer | TiledObjectLayer)[]
  tilesets: { firstgid: number; source: string }[]
}

export type TiledTileset = {
  name: string
  tilewidth: number
  tileheight: number
  columns: number
  tilecount: number
  /** 격자 타일셋은 그림 한 장, 그림 모음 타일셋(건물)은 없다 */
  image?: string
  tiles?: {
    id: number
    image?: string
    imagewidth?: number
    imageheight?: number
    animation?: { tileid: number; duration: number }[]
    properties?: TiledProperty[]
  }[]
}

/** 지도가 쓰는 타일셋 하나 (firstgid와 .tsj 내용, 그림 경로의 기준 주소) */
export type LoadedTileset = { firstgid: number; tileset: TiledTileset; base: string }

/** Tiled는 gid 위쪽 비트에 뒤집기 표시를 넣는다. 이 지도는 뒤집기를 쓰지 않으므로 지운다 */
const GID_MASK = 0x1fffffff

/** gid가 어느 타일셋의 몇 번 타일인지. 0(빈칸)이면 null */
export function resolveGid(gid: number, tilesets: LoadedTileset[]): { ts: LoadedTileset; id: number } | null {
  const g = gid & GID_MASK
  if (g === 0) return null
  let found: LoadedTileset | null = null
  for (const ts of tilesets) if (ts.firstgid <= g && (!found || ts.firstgid > found.firstgid)) found = ts
  return found ? { ts: found, id: g - found.firstgid } : null
}

/** 격자 타일셋에서 id번 타일의 자리(px) */
export function tileFrame(ts: TiledTileset, id: number) {
  return {
    x: (id % ts.columns) * ts.tilewidth,
    y: Math.floor(id / ts.columns) * ts.tileheight,
    width: ts.tilewidth,
    height: ts.tileheight,
  }
}

export function tileLayer(map: TiledMap, name: string): TiledTileLayer | undefined {
  return map.layers.find((l): l is TiledTileLayer => l.type === 'tilelayer' && l.name === name)
}

export function objectLayers(map: TiledMap): TiledObjectLayer[] {
  return map.layers.filter((l): l is TiledObjectLayer => l.type === 'objectgroup')
}

export function prop<T extends TiledProperty['value']>(obj: { properties?: TiledProperty[] }, name: string): T | undefined {
  return obj.properties?.find((p) => p.name === name)?.value as T | undefined
}

/** 걸을 수 없는 칸: 'collision' 층에 무엇이든 놓인 칸. 지도 밖도 막힌 것으로 본다 */
export type Grid = { width: number; height: number; blocked: Uint8Array }

export function collisionGrid(map: TiledMap): Grid {
  const layer = tileLayer(map, 'collision')
  const blocked = new Uint8Array(map.width * map.height)
  if (layer) layer.data.forEach((g, i) => (blocked[i] = g ? 1 : 0))
  return { width: map.width, height: map.height, blocked }
}

export function isBlocked(grid: Grid, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) return true
  return grid.blocked[y * grid.width + x] === 1
}

export type Tile = { x: number; y: number }

/** 눌러서 들어가는 곳(건물·밭): 그림이 차지하는 칸 범위와 들어가는 칸 */
export type Spot = { kind: string; area: { x: number; y: number; width: number; height: number }; entry: Tile }

export function spots(map: TiledMap): Spot[] {
  const out: Spot[] = []
  for (const layer of objectLayers(map)) {
    for (const o of layer.objects) {
      const kind = prop<string>(o, 'kind')
      const entryX = prop<number>(o, 'entryX')
      const entryY = prop<number>(o, 'entryY')
      if (!kind || entryX === undefined || entryY === undefined) continue
      // 그림 타일 오브젝트(gid 있음)는 y가 아래 변이다
      const top = o.gid ? o.y - o.height : o.y
      out.push({ kind, area: { x: o.x, y: top, width: o.width, height: o.height }, entry: { x: entryX, y: entryY } })
    }
  }
  return out
}

/** 지도의 시작점(spawn) 칸. 없으면 가운데 */
export function spawnTile(map: TiledMap): Tile {
  for (const layer of objectLayers(map)) {
    const o = layer.objects.find((obj) => obj.type === 'spawn' || obj.name === 'spawn')
    if (o) return { x: Math.floor(o.x / map.tilewidth), y: Math.floor(o.y / map.tileheight) }
  }
  return { x: Math.floor(map.width / 2), y: Math.floor(map.height / 2) }
}

/** 지도 위 한 점(px)을 누르면 들어갈 곳. 그림 범위 안이면 그 건물 */
export function spotAt(list: Spot[], px: number, py: number): Spot | undefined {
  return list.find((s) => px >= s.area.x && px < s.area.x + s.area.width && py >= s.area.y && py < s.area.y + s.area.height)
}
