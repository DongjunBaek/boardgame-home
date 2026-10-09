import { CircleAlert, CircleCheck, FileDown, FileUp, Plus, X } from 'lucide-react'
import FilterBar from '../components/FilterBar'
import GameTable from '../components/GameTable'
import GenreTabs from '../components/GenreTabs'
import { EXCEL_DOWNLOAD_URL } from '../lib/api'
import type { Filters, GenreTabInfo, PublisherOption, Sort, SortKey } from '../lib/games'
import type { Game, GameInput } from '../lib/types'

export type Notice = { kind: 'ok' | 'error'; text: string }

type Props = {
  ready: boolean
  loadError: string | null
  games: Game[]
  filters: Filters
  sort: Sort
  tabs: GenreTabInfo[]
  publishers: PublisherOption[]
  unplayed: number
  storeName?: string
  notice: Notice | null
  onFilters: (f: Filters) => void
  onSort: (key: SortKey) => void
  onOpen: (game: Game) => void
  onEdit: (game: Game, patch: GameInput) => void
  onAdd: () => void
  onUpload: (file: File) => void
  onCloseNotice: () => void
}

/** 내 보드게임 목록: 제목줄 · 장르 탭 · 표 · 아래 입력창 */
export default function GamesPage(p: Props) {
  const tabLabel = p.tabs.find((t) => t.key === p.filters.genre)?.label ?? '전체'

  return (
    <>
      <header className="page-head">
        <h1>{tabLabel === '전체' ? '전체 게임' : tabLabel}</h1>
        {p.ready && (
          <p className="summary">
            <span className="summary-pill">
              안 해봄 <b>{p.unplayed}</b>
            </span>
          </p>
        )}
        {p.ready && (
          <div className="page-actions">
            <a className="ghost-btn" href={EXCEL_DOWNLOAD_URL} download>
              <FileDown size={15} aria-hidden="true" />
              엑셀 내려받기
            </a>
            <label className="ghost-btn">
              <FileUp size={15} aria-hidden="true" />
              엑셀 올리기
              <input
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) p.onUpload(file)
                  e.target.value = '' // 같은 파일을 다시 골라도 올라가게
                }}
              />
            </label>
            <button type="button" className="primary with-icon" onClick={p.onAdd}>
              <Plus size={15} aria-hidden="true" />
              게임 추가
            </button>
          </div>
        )}
      </header>

      <div className="content">
        {!p.ready && !p.loadError && <p className="status">불러오는 중…</p>}
        {p.loadError && <p className="status bad">목록을 불러오지 못했습니다 ({p.loadError})</p>}
        {p.ready && (
          <>
            <GenreTabs tabs={p.tabs} value={p.filters.genre} onChange={(genre) => p.onFilters({ ...p.filters, genre })} />
            <GameTable games={p.games} sort={p.sort} onSort={p.onSort} onOpen={p.onOpen} onEdit={p.onEdit} />
          </>
        )}
      </div>

      {p.ready && (
        <div className="dock">
          {p.notice && (
            <div className={`notice ${p.notice.kind}`} role={p.notice.kind === 'error' ? 'alert' : 'status'}>
              {p.notice.kind === 'ok' ? <CircleCheck size={16} aria-hidden="true" /> : <CircleAlert size={16} aria-hidden="true" />}
              <span>{p.notice.text}</span>
              <button type="button" className="icon-btn" aria-label="알림 닫기" onClick={p.onCloseNotice}>
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          )}
          <FilterBar filters={p.filters} publishers={p.publishers} storeName={p.storeName} shown={p.games.length} onChange={p.onFilters} />
        </div>
      )}
    </>
  )
}
