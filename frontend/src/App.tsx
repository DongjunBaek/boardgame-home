import { CircleAlert, CircleCheck, Dices, FileDown, FileUp, Plus, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ExcelImportDialog from './components/ExcelImportDialog'
import FilterBar from './components/FilterBar'
import GenreTabs from './components/GenreTabs'
import GameDialog from './components/GameDialog'
import GameTable from './components/GameTable'
import StoreDialog from './components/StoreDialog'
import StoreSidebar from './components/StoreSidebar'
import { deleteStore, EXCEL_DOWNLOAD_URL, fetchGames, fetchStores, updateGame } from './lib/api'
import { applyGamePatch, currentValues, EMPTY_FILTERS, filterGames, genreTabs, publisherOptions, sortGames, summarize, type Sort, type SortKey } from './lib/games'
import { groupNames, groupStores, storeKey } from './lib/stores'
import type { ExcelReport, Game, GameInput, Store } from './lib/types'

type Load = { kind: 'loading' } | { kind: 'ok' } | { kind: 'error'; message: string }
type Notice = { kind: 'ok' | 'error'; text: string }
/** 열린 상세 창: 게임 하나, 새 게임('new'), 또는 닫힘(null) */
type DialogTarget = Game | 'new' | null
type StoreDialogTarget = Store | 'new' | null

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
  const [stores, setStores] = useState<Store[] | null>(null)
  const [storesError, setStoresError] = useState<string | null>(null)
  const [storeDialog, setStoreDialog] = useState<StoreDialogTarget>(null)
  const noticeTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    fetchGames()
      .then((list) => {
        setGames(list)
        setLoad({ kind: 'ok' })
      })
      .catch((e: Error) => setLoad({ kind: 'error', message: e.message }))
    // 스토어를 못 불러와도 게임 표는 그대로 쓴다
    fetchStores()
      .then(setStores)
      .catch((e: Error) => setStoresError(e.message))
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
  const publishers = useMemo(() => publisherOptions(games), [games])
  const tabs = useMemo(() => genreTabs(games), [games])
  const storeGroups = useMemo(() => (stores ? groupStores(stores, games) : null), [stores, games])
  const activeStore = filters.store ? stores?.find((s) => storeKey(s.url) === filters.store) : undefined

  async function removeStore(store: Store) {
    try {
      await deleteStore(store.id)
    } catch (e) {
      notify({ kind: 'error', text: `'${store.name}' 삭제 실패: ${(e as Error).message}` })
      return
    }
    setStores((list) => list?.filter((s) => s.id !== store.id) ?? null)
    if (storeKey(store.url) === filters.store) setFilters((f) => ({ ...f, store: '' }))
    notify({ kind: 'ok', text: `스토어 '${store.name}' 삭제했습니다` })
  }

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

  const tabLabel = tabs.find((t) => t.key === filters.genre)?.label ?? '전체'

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <Dices size={18} />
          </span>
          <span className="brand-name">내 보드게임</span>
        </div>

        {load.kind === 'ok' && (
          <button type="button" className="new-btn" onClick={() => setDialog('new')}>
            <Plus size={16} aria-hidden="true" />
            게임 추가
          </button>
        )}

        <div className="sidebar-scroll">
          <StoreSidebar
            groups={storeGroups}
            error={storesError}
            active={filters.store}
            onPick={(store) => setFilters((f) => ({ ...f, store }))}
            onAdd={() => setStoreDialog('new')}
            onEdit={setStoreDialog}
            onDelete={removeStore}
          />
        </div>

        {load.kind === 'ok' && (
          <div className="sidebar-foot">
            <a className="side-item" href={EXCEL_DOWNLOAD_URL} download>
              <FileDown size={16} aria-hidden="true" />
              엑셀 내려받기
            </a>
            <label className="side-item">
              <FileUp size={16} aria-hidden="true" />
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
          </div>
        )}
      </aside>

      <main className="main">
        <header className="topbar">
          <h1>{tabLabel === '전체' ? '전체 게임' : tabLabel}</h1>
          {load.kind === 'ok' && (
            <p className="summary">
              <span className="summary-pill">
                총 <b>{summary.total}</b>
              </span>
              <span className="summary-pill">
                안 해봄 <b>{summary.unplayed}</b>
              </span>
            </p>
          )}
        </header>

        <div className="content">
          {load.kind === 'loading' && <p className="status">불러오는 중…</p>}
          {load.kind === 'error' && <p className="status bad">목록을 불러오지 못했습니다 ({load.message})</p>}
          {load.kind === 'ok' && (
            <>
              <GenreTabs tabs={tabs} value={filters.genre} onChange={(genre) => setFilters((f) => ({ ...f, genre }))} />
              <GameTable
                games={shown}
                sort={sort}
                onSort={onSort}
                onOpen={setDialog}
                onEdit={(g, patch) => void editInline(g, patch)}
              />
            </>
          )}
        </div>

        {load.kind === 'ok' && (
          <div className="dock">
            {notice && (
              <div className={`notice ${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>
                {notice.kind === 'ok' ? <CircleCheck size={16} aria-hidden="true" /> : <CircleAlert size={16} aria-hidden="true" />}
                <span>{notice.text}</span>
                <button type="button" className="icon-btn" aria-label="알림 닫기" onClick={() => setNotice(null)}>
                  <X size={14} aria-hidden="true" />
                </button>
              </div>
            )}
            <FilterBar
              filters={filters}
              publishers={publishers}
              storeName={activeStore?.name}
              shown={shown.length}
              onChange={setFilters}
            />
          </div>
        )}
      </main>

      {storeDialog && stores && (
        <StoreDialog
          key={storeDialog === 'new' ? 'new' : storeDialog.id}
          store={storeDialog === 'new' ? null : storeDialog}
          groups={groupNames(stores)}
          onClose={() => setStoreDialog(null)}
          onSaved={(store, isNew) => {
            const old = storeDialog === 'new' ? null : storeDialog
            setStores((list) => (list ? (isNew ? [...list, store] : list.map((s) => (s.id === store.id ? store : s))) : list))
            // 주소를 바꾸면 그 스토어로 거르던 것도 새 주소를 따라간다
            if (old && storeKey(old.url) === filters.store) setFilters((f) => ({ ...f, store: storeKey(store.url) ?? '' }))
            setStoreDialog(null)
            notify({ kind: 'ok', text: `스토어 '${store.name}' ${isNew ? '추가' : '저장'}했습니다` })
          }}
        />
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
