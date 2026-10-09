// 꾸미기: 집 안에 놓은 가구 배치 계산. 저장과 검사는 서버가 한다 (backend/app/village.py의 decorate).
import type { Tile } from './tiled'

export type Placed = { uid: string; item: string; x: number; y: number }

/** 놓을 수 있는 칸: 집 안 방(house.tmj). 위 벽 줄 0은 그림·시계용. 서버의 HOUSE_X·HOUSE_Y와 같다 */
export const ROOM = { x: [1, 12], y: [0, 7] } as const

export const inRoom = (t: Tile) => t.x >= ROOM.x[0] && t.x <= ROOM.x[1] && t.y >= ROOM.y[0] && t.y <= ROOM.y[1]

/** 가구마다 아직 놓지 않은 개수 */
export function remaining(items: readonly { id: string; count: number }[], placed: readonly Placed[]): Map<string, number> {
  const left = new Map(items.map((it) => [it.id, it.count]))
  for (const p of placed) left.set(p.item, (left.get(p.item) ?? 0) - 1)
  return left
}

/** 새로 놓을 가구의 uid (목록 안에서 겹치지 않게) */
export function newUid(item: string, placed: readonly Placed[]): string {
  const taken = new Set(placed.map((p) => p.uid))
  let n = placed.length + 1
  while (taken.has(`${item}-${n}`)) n++
  return `${item}-${n}`
}

/** 그리는 순서: 러그는 맨 아래, 나머지는 아래쪽 줄일수록 앞에 (같은 줄은 놓은 순서) */
export function drawOrder(placed: readonly Placed[]): Placed[] {
  const rug = (p: Placed) => (p.item.startsWith('rug') ? 0 : 1)
  return placed
    .map((p, i) => ({ p, i }))
    .sort((a, b) => rug(a.p) - rug(b.p) || a.p.y - b.p.y || a.i - b.i)
    .map(({ p }) => p)
}
