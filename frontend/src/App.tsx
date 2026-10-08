import { useEffect, useMemo, useState } from 'react'
import FilterBar from './components/FilterBar'
import GameTable from './components/GameTable'
import { fetchGames } from './lib/api'
import { EMPTY_FILTERS, filterGames, isFiltered, sortGames, summarize, type Sort, type SortKey } from './lib/games'
import type { Game } from './lib/types'

type Load = { kind: 'loading' } | { kind: 'ok'; games: Game[] } | { kind: 'error'; message: string }

// 숫자 칸은 큰 값부터 보는 일이 많아서 처음 누르면 내림차순
const DESC_FIRST: SortKey[] = ['quantity', 'played', 'rating']
const NO_GAMES: Game[] = []

export default function App() {
  const [load, setLoad] = useState<Load>({ kind: 'loading' })
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [sort, setSort] = useState<Sort>({ key: 'title', dir: 'asc' })

  useEffect(() => {
    fetchGames()
      .then((games) => setLoad({ kind: 'ok', games }))
      .catch((e: Error) => setLoad({ kind: 'error', message: e.message }))
  }, [])

  const all = load.kind === 'ok' ? load.games : NO_GAMES
  const shown = useMemo(() => sortGames(filterGames(all, filters), sort), [all, filters, sort])
  const summary = useMemo(() => summarize(all), [all])

  const onSort = (key: SortKey) =>
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: DESC_FIRST.includes(key) ? 'desc' : 'asc' },
    )

  return (
    <div className="app">
      <header className="app-header">
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
      </header>

      {load.kind === 'loading' && <p className="status">불러오는 중…</p>}
      {load.kind === 'error' && <p className="status bad">목록을 불러오지 못했습니다 ({load.message})</p>}
      {load.kind === 'ok' && (
        <>
          <FilterBar filters={filters} onChange={setFilters} />
          <GameTable games={shown} sort={sort} onSort={onSort} />
        </>
      )}
    </div>
  )
}
