// 칸 위 길찾기(A*)와 걸을 때 부딪힘 계산. 그리기와 나눠서 테스트한다.
import { isBlocked, type Grid, type Tile } from './tiled'

const DIRS: Tile[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
]

const key = (t: Tile, w: number) => t.y * w + t.x

/** start에서 goal까지 4방향으로 걷는 칸 목록 (start는 빼고 goal은 넣는다). 못 가면 null */
export function findPath(grid: Grid, start: Tile, goal: Tile): Tile[] | null {
  if (isBlocked(grid, goal.x, goal.y)) return null
  if (start.x === goal.x && start.y === goal.y) return []
  const w = grid.width
  const h = (t: Tile) => Math.abs(t.x - goal.x) + Math.abs(t.y - goal.y)
  const cost = new Map<number, number>([[key(start, w), 0]])
  const from = new Map<number, number>()
  // 칸이 640개 정도라 정렬된 배열로 충분하다
  let open: { t: Tile; f: number }[] = [{ t: start, f: h(start) }]
  const closed = new Set<number>()
  while (open.length) {
    open.sort((a, b) => a.f - b.f)
    const { t } = open.shift()!
    const k = key(t, w)
    if (closed.has(k)) continue
    if (t.x === goal.x && t.y === goal.y) return rebuild(from, k, w, key(start, w))
    closed.add(k)
    for (const d of DIRS) {
      const n = { x: t.x + d.x, y: t.y + d.y }
      if (isBlocked(grid, n.x, n.y)) continue
      const nk = key(n, w)
      const c = cost.get(k)! + 1
      if (c < (cost.get(nk) ?? Infinity)) {
        cost.set(nk, c)
        from.set(nk, k)
        open = open.filter((o) => key(o.t, w) !== nk)
        open.push({ t: n, f: c + h(n) })
      }
    }
  }
  return null
}

function rebuild(from: Map<number, number>, end: number, w: number, start: number): Tile[] {
  const out: Tile[] = []
  for (let k: number | undefined = end; k !== undefined && k !== start; k = from.get(k)) {
    out.push({ x: k % w, y: Math.floor(k / w) })
  }
  return out.reverse()
}

/** 막힌 칸을 눌렀을 때 대신 갈 가장 가까운 빈칸 (넓이 우선). 없으면 null */
export function nearestOpen(grid: Grid, t: Tile, maxSteps = 6): Tile | null {
  const seen = new Set<number>([key(t, grid.width)])
  let ring: Tile[] = [t]
  for (let step = 0; step <= maxSteps; step++) {
    for (const c of ring) if (!isBlocked(grid, c.x, c.y)) return c
    const next: Tile[] = []
    for (const c of ring) {
      for (const d of DIRS) {
        const n = { x: c.x + d.x, y: c.y + d.y }
        if (n.x < 0 || n.y < 0 || n.x >= grid.width || n.y >= grid.height) continue
        const k = key(n, grid.width)
        if (!seen.has(k)) {
          seen.add(k)
          next.push(n)
        }
      }
    }
    ring = next
  }
  return null
}

/** 캐릭터 발밑 상자 (발 위치 기준, px). 머리는 막힌 칸에 겹쳐도 된다 */
export const FEET = { halfWidth: 5, height: 6 }

function feetHit(grid: Grid, x: number, y: number, tileSize: number): boolean {
  const left = Math.floor((x - FEET.halfWidth) / tileSize)
  const right = Math.floor((x + FEET.halfWidth - 0.01) / tileSize)
  const top = Math.floor((y - FEET.height) / tileSize)
  const bottom = Math.floor((y - 0.01) / tileSize)
  for (let ty = top; ty <= bottom; ty++) for (let tx = left; tx <= right; tx++) if (isBlocked(grid, tx, ty)) return true
  return false
}

/** 발 위치를 (dx, dy)만큼 옮긴다. 가로·세로를 따로 막아서 벽을 따라 미끄러지게 한다 */
export function moveFeet(grid: Grid, pos: { x: number; y: number }, dx: number, dy: number, tileSize: number) {
  let { x, y } = pos
  if (dx && !feetHit(grid, x + dx, y, tileSize)) x += dx
  if (dy && !feetHit(grid, x, y + dy, tileSize)) y += dy
  return { x, y }
}
