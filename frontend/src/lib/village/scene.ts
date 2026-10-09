// 마을 캔버스(PixiJS). 지도·캐릭터·걷기·카메라만 맡는다. 패널은 React(VillagePage)가 그린다.
import { Application, Assets, Container, Rectangle, Sprite, Texture, TextureStyle, type Ticker } from 'pixi.js'
import { findPath, moveFeet, nearestOpen } from './path'
import {
  collisionGrid,
  isBlocked,
  resolveGid,
  spawnTile,
  spotAt,
  spots,
  tileFrame,
  type LoadedTileset,
  type Spot,
  type Tile,
  type TiledMap,
  type TiledTileset,
} from './tiled'

export type Facing = 'down' | 'up' | 'left' | 'right'
export type PlayerSpot = { x: number; y: number; facing: Facing }

export type SceneOptions = {
  mapUrl: string
  playerSheetUrl: string
  /** 저장된 자리. 없으면 지도 시작점 */
  start: PlayerSpot | null
  /** 건물 문 앞(들어가는 칸)에 닿았을 때 */
  onEnter: (kind: string, at: PlayerSpot) => void
}

export type VillageScene = {
  /** 패널이 열려 있는 동안 걷기를 멈춘다 */
  setPaused: (paused: boolean) => void
  /** 밭 작물 그림 단계 1~4 ('crops' 층의 타일을 같은 줄의 다른 단계로 바꾼다) */
  setGrowth: (stage: number) => void
  player: () => PlayerSpot
  destroy: () => void
}

// 픽셀아트는 확대해도 흐려지지 않게 가장 가까운 픽셀로 늘린다
TextureStyle.defaultOptions.scaleMode = 'nearest'

const SPEED = 64 // px/초 (16px 칸 기준 초당 4칸)
const WALK_FPS = 6
// 캐릭터 그림: 48×48 칸, 줄 = 아래·위·왼쪽·오른쪽, 칸 = 서 있기 2 + 걷기 2
const FRAME = 48
const FEET_Y = 30 // 칸 안에서 발이 닿는 높이
const ROWS: Record<Facing, number> = { down: 0, up: 1, left: 2, right: 3 }
const KEYS: Record<string, Facing> = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
}

async function loadJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`마을 지도를 불러오지 못했습니다: ${url} (${res.status})`)
  return (await res.json()) as T
}

/** 화면 크기에 맞는 정수 배율. 가로 24칸·세로 15칸쯤 보이게 하고 2~4배 안에서 고른다 */
export function pickScale(width: number, height: number, tile = 16): number {
  const s = Math.floor(Math.min(width / (24 * tile), height / (15 * tile)))
  return Math.max(2, Math.min(4, s))
}

export async function createVillageScene(host: HTMLElement, opts: SceneOptions): Promise<VillageScene> {
  const mapUrl = new URL(opts.mapUrl, window.location.href).href
  const map = await loadJson<TiledMap>(mapUrl)
  const tilesets: LoadedTileset[] = await Promise.all(
    map.tilesets.map(async (ref) => {
      const url = new URL(ref.source, mapUrl).href
      return { firstgid: ref.firstgid, tileset: await loadJson<TiledTileset>(url), base: url }
    }),
  )

  // 그림 불러오기: 격자 타일셋은 한 장, 그림 모음(건물)은 타일마다 한 장
  const images = new Set<string>()
  for (const { tileset, base } of tilesets) {
    if (tileset.image) images.add(new URL(tileset.image, base).href)
    for (const t of tileset.tiles ?? []) if (t.image) images.add(new URL(t.image, base).href)
  }
  const playerUrl = new URL(opts.playerSheetUrl, window.location.href).href
  const textures = (await Assets.load([...images, playerUrl])) as Record<string, Texture>

  const T = map.tilewidth
  const frameCache = new Map<number, Texture>()
  /** gid → 그릴 그림 (격자 타일은 잘라 쓰고, 그림 모음은 통째로) */
  function textureOf(gid: number): Texture | null {
    const hit = resolveGid(gid, tilesets)
    if (!hit) return null
    const { ts, id } = hit
    const key = ts.firstgid + id
    const cached = frameCache.get(key)
    if (cached) return cached
    let tex: Texture
    if (ts.tileset.image) {
      const f = tileFrame(ts.tileset, id)
      tex = new Texture({ source: textures[new URL(ts.tileset.image, ts.base).href].source, frame: new Rectangle(f.x, f.y, f.width, f.height) })
    } else {
      const tile = ts.tileset.tiles?.find((t) => t.id === id)
      if (!tile?.image) return null
      tex = textures[new URL(tile.image, ts.base).href]
    }
    frameCache.set(key, tex)
    return tex
  }

  /** 밭 작물: 작물 그림 한 줄 = 씨앗 봉투 · 자라는 단계 1~4 · 거둔 열매 */
  const crops: { sprite: Sprite; firstgid: number; row: number; columns: number }[] = []

  /** 움직이는 타일(물결): 같은 시계로 모두 함께 넘긴다 */
  const animated: { sprite: Sprite; frames: { gid: number; until: number }[]; total: number }[] = []
  function animationOf(gid: number) {
    const hit = resolveGid(gid, tilesets)
    const anim = hit?.ts.tileset.tiles?.find((t) => t.id === hit.id)?.animation
    if (!hit || !anim) return null
    let acc = 0
    const frames = anim.map((a) => ({ gid: hit.ts.firstgid + a.tileid, until: (acc += a.duration) }))
    return { frames, total: acc }
  }

  const app = new Application()
  await app.init({ resizeTo: host, background: '#9bd4c3', antialias: false, roundPixels: true, autoDensity: true, resolution: window.devicePixelRatio || 1 })
  host.appendChild(app.canvas)
  app.canvas.style.imageRendering = 'pixelated'

  const world = new Container()
  app.stage.addChild(world)

  // 층 순서: 바닥 층들 → 건물 → 캐릭터 → 'above'(나무 윗부분) / 'collision'은 그리지 않는다
  const front = new Container() // 캐릭터보다 위에 그릴 층
  const actors = new Container()
  for (const layer of map.layers) {
    if (layer.type === 'tilelayer') {
      if (!layer.visible || layer.name === 'collision') continue
      const target = layer.name === 'above' ? front : world
      const box = new Container({ label: layer.name })
      layer.data.forEach((gid, i) => {
        const tex = textureOf(gid)
        if (!tex) return
        const sprite = new Sprite(tex)
        sprite.position.set((i % layer.width) * T, Math.floor(i / layer.width) * T)
        box.addChild(sprite)
        const anim = animationOf(gid)
        if (anim) animated.push({ sprite, ...anim })
        const hit = layer.name === 'crops' ? resolveGid(gid, tilesets) : null
        if (hit) {
          const { columns } = hit.ts.tileset
          crops.push({ sprite, firstgid: hit.ts.firstgid, row: Math.floor(hit.id / columns), columns })
        }
      })
      target.addChild(box)
    } else if (layer.visible) {
      const box = new Container({ label: layer.name })
      for (const o of layer.objects) {
        const tex = o.gid ? textureOf(o.gid) : null
        if (!tex) continue
        const sprite = new Sprite(tex)
        // 그림 타일 오브젝트는 (x, y)가 왼쪽 아래 모서리다
        sprite.position.set(o.x, o.y - o.height)
        box.addChild(sprite)
      }
      world.addChild(box)
    }
  }
  world.addChild(actors, front)

  // 캐릭터
  const sheet = textures[playerUrl]
  const frames: Record<Facing, Texture[]> = { down: [], up: [], left: [], right: [] }
  for (const facing of Object.keys(ROWS) as Facing[]) {
    for (let c = 0; c < 4; c++) {
      frames[facing].push(new Texture({ source: sheet.source, frame: new Rectangle(c * FRAME, ROWS[facing] * FRAME, FRAME, FRAME) }))
    }
  }
  const grid = collisionGrid(map)
  const places = spots(map)
  const startTile = opts.start && !isBlocked(grid, opts.start.x, opts.start.y) ? opts.start : spawnTile(map)
  const player = {
    x: startTile.x * T + T / 2,
    y: startTile.y * T + T - 2,
    facing: (opts.start?.facing ?? 'down') as Facing,
    walking: false,
    clock: 0,
  }
  const body = new Sprite(frames[player.facing][0])
  body.anchor.set(0.5, FEET_Y / FRAME)
  actors.addChild(body)

  const tileOfPlayer = (): Tile => ({ x: Math.floor(player.x / T), y: Math.floor((player.y - 1) / T) })
  let paused = false
  let path: Tile[] = []
  /** 건물을 눌러서 가는 중이면 그 건물 (도착하면 들어간다) */
  let heading: Spot | null = null
  const held: Facing[] = []

  const snapshot = (): PlayerSpot => ({ ...tileOfPlayer(), facing: player.facing })

  function enter(spot: Spot) {
    path = []
    heading = null
    player.facing = 'up'
    opts.onEnter(spot.kind, snapshot())
  }

  // ---------- 입력 ----------
  const typing = (e: KeyboardEvent) => {
    const el = e.target as HTMLElement | null
    return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(el.tagName))
  }
  function onKeyDown(e: KeyboardEvent) {
    const dir = KEYS[e.code]
    if (!dir || paused || typing(e) || e.altKey || e.ctrlKey || e.metaKey) return
    e.preventDefault() // 방향키로 화면이 스크롤되지 않게
    if (!held.includes(dir)) held.push(dir)
    path = []
    heading = null
  }
  function onKeyUp(e: KeyboardEvent) {
    const dir = KEYS[e.code]
    if (!dir) return
    const i = held.indexOf(dir)
    if (i >= 0) held.splice(i, 1)
  }
  const onBlur = () => (held.length = 0)

  let scale = pickScale(app.screen.width, app.screen.height, T)
  function toWorld(sx: number, sy: number) {
    return { x: (sx - world.x) / scale, y: (sy - world.y) / scale }
  }
  app.stage.eventMode = 'static'
  app.stage.hitArea = app.screen
  app.stage.on('pointertap', (e) => {
    if (paused) return
    const p = toWorld(e.global.x, e.global.y)
    const spot = spotAt(places, p.x, p.y)
    const here = tileOfPlayer()
    let goal: Tile | null
    if (spot) {
      goal = spot.entry
    } else {
      goal = nearestOpen(grid, { x: Math.floor(p.x / T), y: Math.floor(p.y / T) })
    }
    if (!goal) return
    const route = findPath(grid, here, goal)
    if (!route) return
    if (spot && route.length === 0) return enter(spot)
    // 칸 가운데를 먼저 거쳐서, 비스듬히 걷다가 막힌 칸 모서리를 지나지 않게 한다
    path = [here, ...route]
    heading = spot ?? null
  })

  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', onBlur)

  // ---------- 매 장면 ----------
  let elapsed = 0
  function tick(ticker: Ticker) {
    const dt = Math.min(ticker.deltaMS, 50) / 1000
    elapsed += ticker.deltaMS
    for (const a of animated) {
      const t = elapsed % a.total
      const f = a.frames.find((fr) => t < fr.until) ?? a.frames[0]
      const tex = textureOf(f.gid)
      if (tex && a.sprite.texture !== tex) a.sprite.texture = tex
    }

    let dx = 0
    let dy = 0
    if (!paused) {
      const dir = held[held.length - 1]
      if (dir) {
        dx = dir === 'left' ? -1 : dir === 'right' ? 1 : 0
        dy = dir === 'up' ? -1 : dir === 'down' ? 1 : 0
        player.facing = dir
      } else if (path.length) {
        const next = path[0]
        const tx = next.x * T + T / 2
        const ty = next.y * T + T - 2
        const ddx = tx - player.x
        const ddy = ty - player.y
        const dist = Math.hypot(ddx, ddy)
        const step = SPEED * dt
        if (dist <= step) {
          player.x = tx
          player.y = ty
          path.shift()
        } else {
          dx = ddx / dist
          dy = ddy / dist
        }
        if (Math.abs(ddx) > Math.abs(ddy)) player.facing = ddx < 0 ? 'left' : 'right'
        else if (ddy) player.facing = ddy < 0 ? 'up' : 'down'
      }
    }
    const moving = dx !== 0 || dy !== 0
    if (moving) {
      const next = held.length
        ? moveFeet(grid, player, dx * SPEED * dt, dy * SPEED * dt, T)
        : { x: player.x + dx * SPEED * dt, y: player.y + dy * SPEED * dt } // 길찾기 길은 이미 빈칸이다
      player.x = next.x
      player.y = next.y
    }
    player.walking = moving || path.length > 0
    player.clock = player.walking ? player.clock + dt : 0
    const frame = player.walking ? 2 + (Math.floor(player.clock * WALK_FPS) % 2) : Math.floor(elapsed / 500) % 2
    body.texture = frames[player.facing][frame]
    body.position.set(Math.round(player.x), Math.round(player.y))

    // 들어가기: 문 앞 칸에서 위(문 쪽)로 걷거나, 건물을 눌러서 문 앞에 도착했을 때
    if (!paused) {
      const t = tileOfPlayer()
      if (heading && path.length === 0 && t.x === heading.entry.x && t.y === heading.entry.y) {
        enter(heading)
      } else if (held[held.length - 1] === 'up') {
        const door = places.find((s) => s.entry.x === t.x && s.entry.y === t.y)
        if (door) enter(door)
      }
    }

    // 카메라: 캐릭터를 가운데에 두되 지도 밖은 보이지 않게
    scale = pickScale(app.screen.width, app.screen.height, T)
    world.scale.set(scale)
    const mapW = map.width * T * scale
    const mapH = map.height * T * scale
    const cx = mapW <= app.screen.width ? (app.screen.width - mapW) / 2 : clamp(app.screen.width / 2 - player.x * scale, app.screen.width - mapW, 0)
    const cy = mapH <= app.screen.height ? (app.screen.height - mapH) / 2 : clamp(app.screen.height / 2 - player.y * scale, app.screen.height - mapH, 0)
    world.position.set(Math.round(cx), Math.round(cy))
  }
  app.ticker.add(tick)

  return {
    setPaused(p) {
      paused = p
      held.length = 0
      if (p) path = []
    },
    player: snapshot,
    setGrowth(stage) {
      for (const c of crops) {
        const tex = textureOf(c.firstgid + c.row * c.columns + stage)
        if (tex) c.sprite.texture = tex
      }
    },
    destroy() {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      app.destroy(true, { children: true })
    },
  }
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}
