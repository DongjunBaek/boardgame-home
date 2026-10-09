import { X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import '../village-fonts.css'
import { fetchVillage, saveVillagePlayer, saveVillagePlayerOnLeave } from '../lib/api'
import { createVillageScene, type VillageScene } from '../lib/village/scene'
import { isPlace, PLACES, type PlaceKind, type VillageState } from '../lib/village/state'

const MAP_URL = '/village/maps/village.tmj'
const PLAYER_URL = '/village/sprites/player-default.png'

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

  useEffect(() => {
    fetchVillage()
      .then((s) => {
        setState(s)
        setStart(s.player)
      })
      .catch((e: Error) => setError(e.message))
  }, [])

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
          .then(setState)
          .catch((e: Error) => setError(`자리를 저장하지 못했습니다: ${e.message}`))
      },
    })
      .then((s) => {
        // React 개발 모드는 효과를 두 번 돌린다. 먼저 것이 늦게 끝나면 바로 치운다
        if (cancelled) return s.destroy()
        scene = s
        sceneRef.current = s
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
  }, [start])

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
          {open && state && <PlacePanel kind={open} state={state} onClose={close} />}
        </div>
      </div>
    </>
  )
}

function PlacePanel({ kind, state, onClose }: { kind: PlaceKind; state: VillageState; onClose: () => void }) {
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
      {kind === 'farm' && <p className="village-stat">작물 LV{state.crop_level}</p>}
      <p className="village-soon">준비 중 · {place.stage}에서 열립니다</p>
    </section>
  )
}
