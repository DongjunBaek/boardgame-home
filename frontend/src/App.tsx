import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ExcelImportDialog from './components/ExcelImportDialog'
import FilterBar from './components/FilterBar'
import GameDialog from './components/GameDialog'
import GameTable from './components/GameTable'
import { EXCEL_DOWNLOAD_URL, fetchGames, updateGame } from './lib/api'
import { applyGamePatch, currentValues, EMPTY_FILTERS, filterGames, isFiltered, sortGames, summarize, type Sort, type SortKey } from './lib/games'
import type { ExcelReport, Game, GameInput } from './lib/types'

type Load = { kind: 'loading' } | { kind: 'ok' } | { kind: 'error'; message: string }
type Notice = { kind: 'ok' | 'error'; text: string }
/** 열린 상세 창: 게임 하나, 새 게임('new'), 또는 닫힘(null) */
type DialogTarget = Game | 'new' | null

// 숫자 칸은 큰 값부터 보는 일이 많아서 처음 누르면 내림차순
const DESC_FIRST: SortKey[] = ['quantity', 'played', 'rating']

export default function App() {
  const [load, setLoad] = useState<Load>({ kind: 'loading' })
  const [games, setGames] = useState<Game[]>([])
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [sort, setSort] = useState<Sort>({ key: 'title', dir: 'asc' })
  const [dialog, setDialog] = useState<DialogTarget>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [upload, setUpload] = useState<File | null>(null)
  const noticeTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    fetchGames()
      .then((list) => {
        setGames(list)
        setLoad({ kind: 'ok' })
      })
      .catch((e: Error) => setLoad({ kind: 'error', message: e.message }))
  }, [])

  const notify = useCallback((n: Notice) => {
    window.clearTimeout(noticeTimer.current)
    setNotice(n)
    // 실패 알림은 사용자가 닫을 때까지 남긴다
    if (n.kind === 'ok') noticeTimer.current = window.setTimeout(() => setNotice(null), 3000)
  }, [])

  const replace = (game: Game) => setGames((list) => list.map((g) => (g.id === game.id ? game : g)))

  /** 표에서 바로 고치기: 먼저 화면에 반영하고, 저장에 실패하면 바꾼 칸만 되돌린다 */
  async function editInline(game: Game, patch: GameInput) {
    const before = currentValues(game, patch)
    replace(applyGamePatch(game, patch))
    try {
      replace(await updateGame(game.id, patch))
    } catch (e) {
      // 그 사이 다른 칸을 또 고쳤을 수 있으니, 이번에 바꾼 칸만 되돌린다
      setGames((list) => list.map((g) => (g.id === game.id ? applyGamePatch(g, before) : g)))
      notify({ kind: 'error', text: `'${game.title}' 저장 실패, 되돌렸습니다: ${(e as Error).message}` })
    }
  }

  const shown = useMemo(() => sortGames(filterGames(games, filters), sort), [games, filters, sort])
  const summary = useMemo(() => summarize(games), [games])

  const onSort = (key: SortKey) =>
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: DESC_FIRST.includes(key) ? 'desc' : 'asc' },
    )

  const closeDialog = useCallback(() => setDialog(null), [])
  const closeUpload = useCallback(() => setUpload(null), [])

  async function afterExcel(report: ExcelReport) {
    setUpload(null)
    const { new: added, updated } = report.counts
    try {
      setGames(await fetchGames())
      notify({ kind: 'ok', text: `엑셀 반영: 새 게임 ${added}개, 바뀐 게임 ${updated}개` })
    } catch (e) {
      notify({ kind: 'error', text: `엑셀은 반영했지만 목록을 다시 불러오지 못했습니다. 새로고침해 주세요 (${(e as Error).message})` })
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>내 보드게임</h1>
          {load.kind === 'ok' && (
            <p className="summary">
              총 <b>{summary.total}</b>개 · 머더미스터리 {summary.murder} · 보드게임 {summary.board} · 안 해봄{' '}
              {summary.unplayed}
              {isFiltered(filters) && (
                <span className="summary-filtered">
                  {' '}
                  → 거른 결과 <b>{shown.length}</b>개
                </span>
              )}
            </p>
          )}
        </div>
        {load.kind === 'ok' && (
          <div className="header-actions">
            <a className="btn" href={EXCEL_DOWNLOAD_URL} download>
              엑셀 내려받기
            </a>
            <label className="btn">
              엑셀 올리기
              <input
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                hidden
                onChange={(e) => {
                  setUpload(e.target.files?.[0] ?? null)
                  e.target.value = '' // 같은 파일을 다시 골라도 올라가게
                }}
              />
            </label>
            <button type="button" className="primary" onClick={() => setDialog('new')}>
              + 게임 추가
            </button>
          </div>
        )}
      </header>

      {notice && (
        <div className={`notice ${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>
          <span>{notice.text}</span>
          <button type="button" className="icon-btn" aria-label="알림 닫기" onClick={() => setNotice(null)}>
            ✕
          </button>
        </div>
      )}

      {load.kind === 'loading' && <p className="status">불러오는 중…</p>}
      {load.kind === 'error' && <p className="status bad">목록을 불러오지 못했습니다 ({load.message})</p>}
      {load.kind === 'ok' && (
        <>
          <FilterBar filters={filters} onChange={setFilters} />
          <GameTable
            games={shown}
            sort={sort}
            onSort={onSort}
            onOpen={setDialog}
            onEdit={(g, patch) => void editInline(g, patch)}
          />
        </>
      )}

      {upload && <ExcelImportDialog file={upload} onClose={closeUpload} onApplied={(r) => void afterExcel(r)} />}

      {dialog && (
        <GameDialog
          key={dialog === 'new' ? 'new' : dialog.id}
          game={dialog === 'new' ? null : dialog}
          onClose={closeDialog}
          onSaved={(game, isNew) => {
            setGames((list) => (isNew ? [...list, game] : list.map((g) => (g.id === game.id ? game : g))))
            setDialog(null)
            const hidden = filterGames([game], filters).length === 0
            notify({
              kind: 'ok',
              text: `'${game.title}' ${isNew ? '추가' : '저장'}했습니다${hidden ? ' (지금 거르기 조건 때문에 표에는 안 보입니다)' : ''}`,
            })
          }}
          onDeleted={(game) => {
            setGames((list) => list.filter((g) => g.id !== game.id))
            setDialog(null)
            notify({ kind: 'ok', text: `'${game.title}' 삭제했습니다` })
          }}
        />
      )}
    </div>
  )
}
