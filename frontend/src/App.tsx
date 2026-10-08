import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import FilterBar from './components/FilterBar'
import GameDialog from './components/GameDialog'
import GameTable from './components/GameTable'
import { fetchGames, updateGame } from './lib/api'
import { EMPTY_FILTERS, filterGames, isFiltered, sortGames, summarize, type Sort, type SortKey } from './lib/games'
import type { Game, GameInput } from './lib/types'

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

  /** 표에서 바로 고치기: 먼저 화면에 반영하고, 저장에 실패하면 되돌린다 */
  async function editInline(game: Game, mine: NonNullable<GameInput['mine']>) {
    const optimistic: Game = { ...game, mine: { ...game.mine, ...(mine as Partial<Game['mine']>) } }
    replace(optimistic)
    try {
      replace(await updateGame(game.id, { mine }))
    } catch (e) {
      // 그 사이 다른 칸을 또 고쳤을 수 있으니, 이번에 바꾼 칸만 되돌린다
      setGames((list) =>
        list.map((g) => (g.id === game.id ? { ...g, mine: { ...g.mine, ...pick(game.mine, Object.keys(mine)) } } : g)),
      )
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
          <button type="button" className="primary" onClick={() => setDialog('new')}>
            + 게임 추가
          </button>
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
            onEdit={(g, mine) => void editInline(g, mine)}
          />
        </>
      )}

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

function pick<T extends object>(obj: T, keys: string[]): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([k]) => keys.includes(k))) as Partial<T>
}
