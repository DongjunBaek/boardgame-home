import { X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import '../village-fonts.css'
import { fetchVillage, harvestVillage, saveVillagePlayer, saveVillagePlayerOnLeave } from '../lib/api'
import { clockOffset, farmNow, formatLeft, growthStage, type FarmNow } from '../lib/village/farm'
import { createVillageScene, type VillageScene } from '../lib/village/scene'
import { isPlace, PLACES, type PlaceKind, type VillageState } from '../lib/village/state'

const MAP_URL = '/village/maps/village.tmj'
const PLAYER_URL = '/village/sprites/player-default.png'
const COIN_URL = '/village/icons/coin.png'
const CRYSTAL_URL = '/village/icons/crystal.png'

/** 대시보드: 픽셀아트 마을. 지도·캐릭터는 PixiJS 캔버스, 건물 패널은 그 위에 React로 띄운다 */
export default function VillagePage() {
  const hostRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<VillageScene | null>(null)
  const [state, setState] = useState<VillageState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<PlaceKind | null>(null)
  // 캔버스는 처음 불러온 자리에서 한 번만 만든다 (undefined = 아직 못 불러옴, null = 지도 시작점)
  const [start, setStart] = useState<VillageState['player'] | undefined>(undefined)
  const loaded = start !== undefined
  // 밭은 서버 시각 기준으로 센다. offset = 서버 시각 - 이 컴퓨터 시각
  const [offset, setOffset] = useState(0)
  const [now, setNow] = useState(() => Date.now())

  const apply = useCallback((s: VillageState) => {
    setState(s)
    setOffset(clockOffset(s))
  }, [])

  useEffect(() => {
    fetchVillage()
      .then((s) => {
        apply(s)
        setStart(s.player)
      })
      .catch((e: Error) => setError(e.message))
  }, [apply])

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const farm = state ? farmNow(state, offset, now) : null
  const stage = farm ? growthStage(farm.ratio) : 1
  // 캔버스가 늦게 만들어져도 지금 단계로 시작하게 기억해 둔다
  const stageRef = useRef(stage)
  useEffect(() => {
    stageRef.current = stage
    sceneRef.current?.setGrowth(stage)
  }, [stage])

  useEffect(() => {
    const host = hostRef.current
    if (start === undefined || !host) return
    let cancelled = false
    let scene: VillageScene | null = null
    const leave = () => scene && saveVillagePlayerOnLeave(scene.player())

    createVillageScene(host, {
      mapUrl: MAP_URL,
      playerSheetUrl: PLAYER_URL,
      start,
      onEnter: (kind, at) => {
        if (!isPlace(kind)) return
        scene?.setPaused(true)
        setOpen(kind)
        saveVillagePlayer(at)
          .then(apply)
          .catch((e: Error) => setError(`자리를 저장하지 못했습니다: ${e.message}`))
      },
    })
      .then((s) => {
        // React 개발 모드는 효과를 두 번 돌린다. 먼저 것이 늦게 끝나면 바로 치운다
        if (cancelled) return s.destroy()
        scene = s
        sceneRef.current = s
        s.setGrowth(stageRef.current)
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
  }, [start, apply])

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
          <span className="summary-pill">건물을 누르거나 문 앞에서 위로 걸으면 들어가기</span>
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
          {open && state && farm && (
            <PlacePanel kind={open} state={state} farm={farm} onClose={close} onHarvested={apply} />
          )}
        </div>
      </div>
    </>
  )
}

type PanelProps = {
  kind: PlaceKind
  state: VillageState
  farm: FarmNow
  onClose: () => void
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
      ) : (
        <p className="village-soon">준비 중 · {place.stage}에서 열립니다</p>
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
