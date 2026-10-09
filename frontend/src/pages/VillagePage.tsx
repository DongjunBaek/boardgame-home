import { ArrowLeft, Paintbrush, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import '../village-fonts.css'
import {
  fetchGames,
  fetchVillage,
  gachaVillage,
  harvestVillage,
  researchVillage,
  saveDecor,
  saveVillagePlayer,
  saveVillagePlayerOnLeave,
  skinGachaVillage,
  wearSkin,
} from '../lib/api'
import { formatMinutes, formatPlayers, formatPrice } from '../lib/format'
import type { Game } from '../lib/types'
import { shelfOrder, spineColor } from '../lib/village/books'
import { inRoom, newUid, remaining, type Placed } from '../lib/village/decor'
import { clockOffset, farmNow, formatLeft, growthStage, type FarmNow } from '../lib/village/farm'
import { createVillageScene, type PlayerSpot, type VillageScene } from '../lib/village/scene'
import type { Tile } from '../lib/village/tiled'
import {
  BUILDING_NAMES,
  buildingUrl,
  isPlace,
  itemUrl,
  objectParticle,
  playerSheetUrl,
  PLACES,
  roofOf,
  type BuildingKind,
  type GachaResult,
  type MapName,
  type PlaceKind,
  type VillageState,
} from '../lib/village/state'

const COIN_URL = '/village/icons/coin.png'
const CRYSTAL_URL = '/village/icons/crystal.png'
const CHEST_CLOSED_URL = '/village/icons/chest-closed.png'
const CHEST_OPEN_URL = '/village/icons/chest-open.png'

/** 지금 그리는 지도와 시작 자리. 바뀔 때마다 캔버스를 새로 만든다 */
type Where = { map: MapName; start: PlayerSpot | null; startAt?: string }

const HINTS: Record<MapName, string> = {
  village: '건물을 누르거나 문 앞에서 위로 걸으면 들어가기',
  house: '책장·옷장을 누르면 열기 · 아래 문으로 나가기',
}

/** 대시보드: 픽셀아트 마을. 지도·캐릭터는 PixiJS 캔버스, 건물 패널은 그 위에 React로 띄운다 */
export default function VillagePage() {
  const hostRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<VillageScene | null>(null)
  const [state, setState] = useState<VillageState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<PlaceKind | null>(null)
  // undefined = 아직 못 불러옴
  const [where, setWhere] = useState<Where | undefined>(undefined)
  const loaded = where !== undefined
  // 밭은 서버 시각 기준으로 센다. offset = 서버 시각 - 이 컴퓨터 시각
  const [offset, setOffset] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  // 책장: 집에 처음 들어갈 때 게임 목록을 불러온다
  const [games, setGames] = useState<Game[] | null>(null)
  const [gamesError, setGamesError] = useState<string | null>(null)
  // 꾸미기: 저장 전 배치(null = 꾸미기 아님)와 들고 있는 가구 (uid가 있으면 옮기는 중)
  const [draft, setDraft] = useState<Placed[] | null>(null)
  const [holding, setHolding] = useState<{ item: string; uid?: string } | null>(null)
  const [decorNote, setDecorNote] = useState<string | null>(null)

  const apply = useCallback((s: VillageState) => {
    setState(s)
    setOffset(clockOffset(s))
  }, [])

  useEffect(() => {
    fetchVillage()
      .then((s) => {
        apply(s)
        setWhere({ map: s.player?.map ?? 'village', start: s.player })
      })
      .catch((e: Error) => setError(e.message))
  }, [apply])

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const inHouse = where?.map === 'house'
  useEffect(() => {
    if (!inHouse || games) return
    fetchGames()
      .then(setGames)
      .catch((e: Error) => setGamesError(e.message))
  }, [inHouse, games])

  const books = useMemo(() => (games ? shelfOrder(games) : []), [games])
  const bookColors = useMemo(() => books.map((g, i) => spineColor(g, i)), [books])

  const farm = state ? farmNow(state, offset, now) : null
  const stage = farm ? growthStage(farm.ratio) : 1
  const level = state?.crop_level ?? 1
  // 입은 스킨 (바뀔 때만 그림을 다시 불러온다)
  const playerSkin = state?.skins.player ?? 'default'
  const roofs = state ? (['house', 'shop', 'lab'] as const).map((k) => roofOf(state, k)).join(',') : 'wood,rose,teal'
  // 놓은 가구는 집 안 좌표라서 집 안에서만 그린다
  const placed = useMemo(() => (inHouse ? (draft ?? state?.placed ?? []) : []), [inHouse, draft, state?.placed])
  // 캔버스가 늦게 만들어져도 지금 작물·책·스킨·가구로 시작하게 기억해 둔다
  const paintRef = useRef({ level, stage, bookColors, playerSkin, roofs, placed })
  useEffect(() => {
    paintRef.current = { level, stage, bookColors, playerSkin, roofs, placed }
    sceneRef.current?.setCrop(level, stage)
    sceneRef.current?.setBooks(bookColors)
  }, [level, stage, bookColors, playerSkin, roofs, placed])
  useEffect(() => {
    const scene = sceneRef.current
    if (scene) void paintSkins(scene, playerSkin, roofs)
  }, [playerSkin, roofs])
  useEffect(() => {
    void sceneRef.current?.setDecor(placed, itemUrl)
  }, [placed])

  // 꾸미기 모드: 칸을 누르면 들고 있는 가구를 놓고, 빈손이면 그 자리 가구를 집어 든다
  const onDecorTap = useCallback(
    (tile: Tile, uid: string | null) => {
      if (!draft || !state) return
      if (holding) {
        if (!inRoom(tile)) return setDecorNote('방 안에만 놓을 수 있습니다')
        const next = [...draft, { uid: holding.uid ?? newUid(holding.item, draft), item: holding.item, x: tile.x, y: tile.y }]
        setDraft(next)
        setDecorNote(null)
        // 같은 가구가 더 남았으면 계속 들고 있는다
        setHolding((remaining(state.items, next).get(holding.item) ?? 0) > 0 ? { item: holding.item } : null)
      } else if (uid) {
        const picked = draft.find((p) => p.uid === uid)
        if (!picked) return
        setDraft(draft.filter((p) => p.uid !== uid))
        setHolding({ item: picked.item, uid })
        setDecorNote(null)
      }
    },
    [draft, holding, state],
  )
  useEffect(() => {
    sceneRef.current?.setEditor(draft ? onDecorTap : null, holding ? itemUrl(holding.item) : null)
  }, [draft, holding, onDecorTap])

  useEffect(() => {
    const host = hostRef.current
    if (!where || !host) return
    let cancelled = false
    let scene: VillageScene | null = null
    const leave = () => scene && saveVillagePlayerOnLeave(where.map, scene.player())

    createVillageScene(host, {
      mapUrl: `/village/maps/${where.map}.tmj`,
      playerSheetUrl: playerSheetUrl(paintRef.current.playerSkin),
      start: where.start,
      startAt: where.startAt,
      onEnter: (kind, at) => {
        // 집 문과 나가는 문은 창 대신 지도를 바꾼다 (이 캔버스를 치울 때 지금 자리를 저장한다)
        if (kind === 'house') return setWhere({ map: 'house', start: null })
        if (kind === 'exit') return setWhere({ map: 'village', start: null, startAt: 'house' })
        if (!isPlace(kind)) return
        scene?.setPaused(true)
        setOpen(kind)
        saveVillagePlayer(where.map, at)
          .then(apply)
          .catch((e: Error) => setError(`자리를 저장하지 못했습니다: ${e.message}`))
      },
    })
      .then((s) => {
        // React 개발 모드는 효과를 두 번 돌린다. 먼저 것이 늦게 끝나면 바로 치운다
        if (cancelled) return s.destroy()
        scene = s
        sceneRef.current = s
        s.setCrop(paintRef.current.level, paintRef.current.stage)
        s.setBooks(paintRef.current.bookColors)
        void paintSkins(s, paintRef.current.playerSkin, paintRef.current.roofs)
        void s.setDecor(paintRef.current.placed, itemUrl)
      })
      .catch((e: Error) => !cancelled && setError(e.message))

    window.addEventListener('pagehide', leave)
    return () => {
      cancelled = true
      window.removeEventListener('pagehide', leave)
      if (scene) {
        leave()
        scene.destroy()
      }
      sceneRef.current = null
    }
  }, [where, apply])

  const close = useCallback(() => {
    setOpen(null)
    sceneRef.current?.setPaused(false)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  return (
    <>
      <header className="page-head">
        <h1>대시보드</h1>
        <p className="summary village-hints">
          <span className="summary-pill village-keys">방향키·WASD로 걷기</span>
          <span className="summary-pill">땅을 누르면 그 자리로</span>
          <span className="summary-pill">{HINTS[where?.map ?? 'village']}</span>
        </p>
      </header>
      <div className="content">
        {error && <p className="status bad">{error}</p>}
        <div className="village">
          <div className="village-canvas" ref={hostRef} />
          {!loaded && !error && <p className="village-loading">마을을 불러오는 중…</p>}
          {state && (
            <div className="village-bar">
              <span className="village-res" aria-label={`코인 ${state.coins}`}>
                <img src={COIN_URL} alt="" width={32} height={32} />
                {state.coins.toLocaleString('ko-KR')}
              </span>
              <span className="village-res" aria-label={`크리스탈 ${state.crystals}`}>
                <img src={CRYSTAL_URL} alt="" width={32} height={32} />
                {state.crystals.toLocaleString('ko-KR')}
              </span>
            </div>
          )}
          {inHouse && state && !open && !draft && (
            <div className="village-tools">
              <button type="button" className="village-button" onClick={() => setDraft(state.placed)}>
                <Paintbrush size={14} aria-hidden="true" /> 꾸미기
              </button>
            </div>
          )}
          {draft && state && (
            <DecorPanel
              state={state}
              draft={draft}
              holding={holding}
              note={decorNote}
              onHold={(item) => {
                setHolding(item ? { item } : null)
                setDecorNote(null)
              }}
              onClear={() => {
                setDraft([])
                setHolding(null)
              }}
              onCancel={() => {
                setDraft(null)
                setHolding(null)
                setDecorNote(null)
              }}
              onSave={async () => {
                try {
                  apply(await saveDecor(draft))
                  setDraft(null)
                  setHolding(null)
                  setDecorNote(null)
                } catch (e) {
                  setDecorNote(`저장하지 못했습니다: ${(e as Error).message}`)
                }
              }}
            />
          )}
          {open === 'bookshelf' ? (
            <BookshelfPanel books={books} colors={bookColors} error={gamesError} onClose={close} />
          ) : open === 'wardrobe' ? (
            state && <WardrobePanel state={state} onClose={close} onChanged={apply} />
          ) : (
            open &&
            state &&
            farm && <PlacePanel kind={open} state={state} farm={farm} onClose={close} onHarvested={apply} />
          )}
        </div>
      </div>
    </>
  )
}

/** 입은 스킨을 캔버스에 입힌다. roofs = "집,상점,연구소" 지붕 id */
async function paintSkins(scene: VillageScene, playerSkin: string, roofs: string) {
  const [house, shop, lab] = roofs.split(',')
  await Promise.all([
    scene.setPlayerSheet(playerSheetUrl(playerSkin)),
    scene.setBuildingImage('house', buildingUrl('house', house)),
    scene.setBuildingImage('shop', buildingUrl('shop', shop)),
    scene.setBuildingImage('lab', buildingUrl('lab', lab)),
  ])
}

type PanelProps = {
  kind: Exclude<PlaceKind, 'bookshelf' | 'wardrobe'>
  state: VillageState
  farm: FarmNow
  onClose: () => void
  /** 서버가 새 상태를 돌려줬을 때 (거두기·연구·뽑기) */
  onHarvested: (s: VillageState) => void
}

function PlacePanel({ kind, state, farm, onClose, onHarvested }: PanelProps) {
  const place = PLACES[kind]
  return (
    <section className="village-panel" role="dialog" aria-label={place.name}>
      <header>
        <h2>{place.name}</h2>
        <button type="button" className="village-close" onClick={onClose} aria-label="닫기" autoFocus>
          <X size={16} aria-hidden="true" />
        </button>
      </header>
      <p>{place.about}</p>
      {kind === 'farm' ? (
        <FarmBody state={state} farm={farm} onHarvested={onHarvested} />
      ) : kind === 'lab' ? (
        <LabBody state={state} farm={farm} onResearched={onHarvested} />
      ) : (
        <ShopBody state={state} onPulled={onHarvested} />
      )}
    </section>
  )
}

function FarmBody({ state, farm, onHarvested }: { state: VillageState; farm: FarmNow; onHarvested: (s: VillageState) => void }) {
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null)

  async function harvest() {
    setBusy(true)
    try {
      const res = await harvestVillage()
      onHarvested(res.village)
      setNote(res.harvested ? { ok: true, text: `코인 ${res.harvested}개를 거뒀습니다` } : { ok: false, text: '아직 거둘 코인이 없습니다' })
    } catch (e) {
      setNote({ ok: false, text: `거두지 못했습니다: ${(e as Error).message}` })
    } finally {
      setBusy(false)
    }
  }

  const full = farm.fullInMs === 0
  return (
    <>
      <p className="village-stat">
        작물 LV{state.crop_level} · 시간당 코인 {state.farm.rate_per_hour}
      </p>
      <div className="village-meter" role="meter" aria-label="쌓인 코인" aria-valuemin={0} aria-valuemax={farm.capCoins} aria-valuenow={farm.pending}>
        <span style={{ width: `${Math.round(farm.ratio * 100)}%` }} />
      </div>
      <p className="village-meter-text">
        <img src={COIN_URL} alt="" width={16} height={16} />
        {farm.pending} / {farm.capCoins}
        <span>{full ? '가득 찼습니다. 거둬야 다시 쌓입니다' : `가득 차기까지 ${formatLeft(farm.fullInMs)}`}</span>
      </p>
      <button type="button" className="village-button" onClick={() => void harvest()} disabled={busy || farm.pending === 0}>
        거두기
      </button>
      {note && <p className={`village-note${note.ok ? '' : ' muted'}`}>{note.text}</p>}
    </>
  )
}

function LabBody({ state, farm, onResearched }: { state: VillageState; farm: FarmNow; onResearched: (s: VillageState) => void }) {
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null)
  const next = state.lab
  // 올릴 때 밭에 쌓인 코인을 먼저 거두므로 그것까지 쳐서 본다 (최종 판단은 서버가 한다)
  const usable = state.coins + farm.pending
  const short = next ? Math.max(0, next.cost - usable) : 0

  async function research() {
    setBusy(true)
    try {
      const res = await researchVillage()
      onResearched(res.village)
      const got = res.harvested ? ` 밭에서 코인 ${res.harvested}개를 먼저 거뒀습니다.` : ''
      setNote({ ok: true, text: `작물 레벨이 LV${res.village.crop_level}로 올랐습니다.${got}` })
    } catch (e) {
      setNote({ ok: false, text: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <p className="village-stat">
        지금 작물 LV{state.crop_level} · 시간당 코인 {state.farm.rate_per_hour}
      </p>
      {next ? (
        <>
          <p className="village-lab-next">
            다음 LV{next.next_level} · 시간당 코인 <b>{next.next_rate}</b>
          </p>
          <p className="village-meter-text">
            <img src={COIN_URL} alt="" width={16} height={16} />
            {next.cost.toLocaleString('ko-KR')}
            <span>{short ? `코인 ${short.toLocaleString('ko-KR')}개 더 필요합니다` : '올릴 수 있습니다'}</span>
          </p>
          {farm.pending > 0 && <p className="village-soon">밭에 쌓인 코인 {farm.pending}개는 지금 레벨로 먼저 거둡니다</p>}
          <button type="button" className="village-button" onClick={() => void research()} disabled={busy || short > 0}>
            LV{next.next_level}로 올리기
          </button>
        </>
      ) : (
        <p className="village-soon">최고 레벨입니다</p>
      )}
      {note && <p className={`village-note${note.ok ? '' : ' muted'}`}>{note.text}</p>}
    </>
  )
}

function ShopBody({ state, onPulled }: { state: VillageState; onPulled: (s: VillageState) => void }) {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<GachaResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { cost, names, skin_cost: skinCost, skins_left: skinsLeft } = state.shop
  const short = Math.max(0, cost - state.coins)
  const skinShort = Math.max(0, skinCost - state.crystals)

  async function pull(kind: 'coins' | 'crystals') {
    setBusy(true)
    setError(null)
    try {
      const res = await (kind === 'coins' ? gachaVillage() : skinGachaVillage())
      onPulled(res.village)
      setResult(res.result)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="village-gacha">
        <img src={result ? CHEST_OPEN_URL : CHEST_CLOSED_URL} alt="" width={54} height={63} />
        {result && <GachaPrize key={JSON.stringify(result) + state.coins} result={result} />}
      </div>
      <p className="village-meter-text">
        <img src={COIN_URL} alt="" width={16} height={16} />
        {cost} / 번<span>{short ? `코인 ${short}개 더 필요합니다` : `가진 코인 ${state.coins.toLocaleString('ko-KR')}`}</span>
      </p>
      <button type="button" className="village-button" onClick={() => void pull('coins')} disabled={busy || short > 0}>
        뽑기
      </button>
      <p className="village-meter-text village-skin-cost">
        <img src={CRYSTAL_URL} alt="" width={16} height={16} />
        {skinCost} / 번 · 스킨
        <span>
          {skinsLeft === 0
            ? '모든 스킨을 가졌습니다'
            : skinShort
              ? `크리스탈 ${skinShort}개 더 필요합니다`
              : `남은 스킨 ${skinsLeft}개`}
        </span>
      </p>
      <button
        type="button"
        className="village-button alt"
        onClick={() => void pull('crystals')}
        disabled={busy || skinShort > 0 || skinsLeft === 0}
      >
        크리스탈 뽑기
      </button>
      {error && <p className="village-note muted">{error}</p>}
      <h3 className="village-sub">가진 물건 {state.items.length ? `${state.items.length}종` : ''}</h3>
      {state.items.length ? (
        <ul className="village-items">
          {state.items.map((it) => (
            <li key={it.id} title={names[it.id] ?? it.id}>
              <img src={itemUrl(it.id)} alt={names[it.id] ?? it.id} />
              {it.count > 1 && <span>×{it.count}</span>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="village-soon">아직 없습니다. 뽑기로 가구를 모아 보세요</p>
      )}
    </>
  )
}

function GachaPrize({ result }: { result: GachaResult }) {
  if (result.kind === 'skin') {
    const [group, id] = result.id.split(':')
    return (
      <p className="village-prize">
        {group === 'player' ? <PlayerFace skin={id} /> : <img src={buildingUrl('house', id)} alt="" />}
        스킨 '{result.name}'{objectParticle(result.name)} 얻었습니다
      </p>
    )
  }
  if (result.kind === 'item') {
    return (
      <p className="village-prize">
        <img src={itemUrl(result.id)} alt="" />
        {result.name}
        {objectParticle(result.name)} 얻었습니다
      </p>
    )
  }
  const coin = result.kind === 'coins'
  return (
    <p className="village-prize">
      <img src={coin ? COIN_URL : CRYSTAL_URL} alt="" />
      {coin ? '코인' : '크리스탈'} {result.amount}개를 얻었습니다
    </p>
  )
}

type ShelfProps = { books: Game[]; colors: string[]; error: string | null; onClose: () => void }

/** 책장 창: 책 등을 누르면 그 게임 정보 (보기 전용. 고치기는 '내 보드게임 목록'에서) */
function BookshelfPanel({ books, colors, error, onClose }: ShelfProps) {
  const [picked, setPicked] = useState<Game | null>(null)
  const place = PLACES.bookshelf
  return (
    <section className="village-panel wide" role="dialog" aria-label={place.name}>
      <header>
        <h2>{picked ? picked.title : `${place.name} · ${books.length}권`}</h2>
        <button type="button" className="village-close" onClick={onClose} aria-label="닫기" autoFocus>
          <X size={16} aria-hidden="true" />
        </button>
      </header>
      {error ? (
        <p className="village-note muted">게임 목록을 불러오지 못했습니다: {error}</p>
      ) : picked ? (
        <BookDetail game={picked} onBack={() => setPicked(null)} />
      ) : (
        <>
          <p>{place.about}</p>
          <ul className="village-shelf">
            {books.map((g, i) => (
              <li key={g.id}>
                <button
                  type="button"
                  className="village-book"
                  style={{ background: colors[i], height: 84 + ((i * 7) % 4) * 4 }}
                  title={g.title}
                  onClick={() => setPicked(g)}
                >
                  {g.title}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

function BookDetail({ game, onBack }: { game: Game; onBack: () => void }) {
  const { mine } = game
  const rows: [string, string | null][] = [
    ['장르', game.genres.join(', ') || null],
    ['인원', formatPlayers(game.player_count)],
    ['시간', formatMinutes(game.play_time_minutes)],
    ['제작사', game.publisher],
    ['정가', formatPrice(game.price)],
    ['해봤음', mine.played ? '해봤음' : '안 해봄'],
    ['별점', mine.rating === null ? null : `${mine.rating} / 5`],
    ['개수', `${mine.quantity}개`],
    ['메모', mine.notes],
  ]
  return (
    <>
      <dl className="village-facts">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v ?? '없음'}</dd>
          </div>
        ))}
      </dl>
      <p className="village-soon">고치기는 '내 보드게임 목록'에서 합니다</p>
      <button type="button" className="village-button" onClick={onBack}>
        <ArrowLeft size={14} aria-hidden="true" /> 책장으로
      </button>
    </>
  )
}

/** 고양이 얼굴: 시트 첫 칸(아래를 보고 선 모습)을 2배로 */
function PlayerFace({ skin }: { skin: string }) {
  return <span className="village-face" style={{ backgroundImage: `url(${playerSheetUrl(skin)})` }} aria-hidden="true" />
}

type WardrobeProps = { state: VillageState; onClose: () => void; onChanged: (s: VillageState) => void }

/** 옷장 창: 가진 스킨을 골라 바로 입힌다 */
function WardrobePanel({ state, onClose, onChanged }: WardrobeProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { players, roofs, owned } = state.wardrobe
  const place = PLACES.wardrobe

  async function put(target: 'player' | BuildingKind, skin: string) {
    setBusy(true)
    setError(null)
    try {
      onChanged(await wearSkin(target, skin))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="village-panel wide" role="dialog" aria-label={place.name}>
      <header>
        <h2>{place.name}</h2>
        <button type="button" className="village-close" onClick={onClose} aria-label="닫기" autoFocus>
          <X size={16} aria-hidden="true" />
        </button>
      </header>
      <p>{place.about}</p>
      <h3 className="village-sub">
        캐릭터 · {owned.player.length} / {Object.keys(players).length}벌
      </h3>
      <div className="village-swatches">
        {owned.player.map((id) => (
          <button
            key={id}
            type="button"
            className="village-swatch"
            aria-pressed={state.skins.player === id}
            disabled={busy}
            onClick={() => void put('player', id)}
          >
            <PlayerFace skin={id} />
            {players[id]}
          </button>
        ))}
      </div>
      {(['house', 'shop', 'lab'] as const).map((kind) => (
        <div key={kind}>
          <h3 className="village-sub">
            {BUILDING_NAMES[kind]} 지붕 · {owned.roof.length} / {Object.keys(roofs).length}색
          </h3>
          <div className="village-swatches">
            {owned.roof.map((id) => (
              <button
                key={id}
                type="button"
                className="village-swatch"
                aria-pressed={roofOf(state, kind) === id}
                disabled={busy}
                onClick={() => void put(kind, id)}
              >
                <img src={buildingUrl(kind, id)} alt="" />
                {roofs[id]}
              </button>
            ))}
          </div>
        </div>
      ))}
      {error && <p className="village-note muted">{error}</p>}
    </section>
  )
}

type DecorProps = {
  state: VillageState
  draft: Placed[]
  holding: { item: string; uid?: string } | null
  note: string | null
  onHold: (item: string | null) => void
  onClear: () => void
  onCancel: () => void
  onSave: () => Promise<void>
}

/** 꾸미기 창: 가진 가구를 골라 방의 칸을 누르면 놓인다. 저장해야 남는다 */
function DecorPanel({ state, draft, holding, note, onHold, onClear, onCancel, onSave }: DecorProps) {
  const [busy, setBusy] = useState(false)
  const left = remaining(state.items, draft)
  const names = state.shop.names
  const moving = holding?.uid !== undefined

  return (
    <section className="village-panel" role="dialog" aria-label="꾸미기">
      <header>
        <h2>꾸미기</h2>
      </header>
      <p className="village-soon">
        {holding
          ? `${names[holding.item]}${moving ? ' 옮기는 중' : ''} · 놓을 칸을 누르세요`
          : '가구를 고르고 방의 칸을 누르면 놓입니다. 놓인 가구를 누르면 다시 집어 듭니다'}
      </p>
      {state.items.length ? (
        <ul className="village-items">
          {state.items.map((it) => {
            const n = left.get(it.id) ?? 0
            const picked = holding?.item === it.id && !moving
            return (
              <li key={it.id}>
                <button
                  type="button"
                  className="village-pick"
                  aria-pressed={picked}
                  disabled={n === 0 || moving}
                  title={names[it.id]}
                  onClick={() => onHold(picked ? null : it.id)}
                >
                  <img src={itemUrl(it.id)} alt={names[it.id]} />
                  <span>×{n}</span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="village-soon">아직 가구가 없습니다. 상점 뽑기로 모아 보세요</p>
      )}
      {note && <p className="village-note muted">{note}</p>}
      <div className="village-actions">
        <button
          type="button"
          className="village-button"
          disabled={busy || moving}
          onClick={async () => {
            setBusy(true)
            await onSave()
            setBusy(false)
          }}
        >
          저장
        </button>
        <button type="button" className="village-button quiet" disabled={busy} onClick={onCancel}>
          취소
        </button>
        <button type="button" className="village-button quiet" disabled={busy || draft.length === 0} onClick={onClear}>
          모두 치우기
        </button>
      </div>
    </section>
  )
}
