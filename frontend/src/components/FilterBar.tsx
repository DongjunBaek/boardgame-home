import { Clock, Download, FileQuestion, RotateCcw, Search, Store, Users, X } from 'lucide-react'
import { EXCEL_BLANKS_URL } from '../lib/api'
import { EMPTY_FILTERS, isFiltered, type Filters, type PlayedFilter, type PublisherOption } from '../lib/games'

type Props = {
  filters: Filters
  publishers: PublisherOption[]
  /** 사이드바에서 고른 스토어 이름 (거르는 중일 때) */
  storeName?: string
  /** 지금 표에 보이는 게임 수 */
  shown: number
  onChange: (next: Filters) => void
}

/** 빈칸이나 1 미만이면 null (조건 없음) */
function toPositiveInt(text: string): number | null {
  const n = Number.parseInt(text, 10)
  return Number.isFinite(n) && n >= 1 ? n : null
}

/** 화면 아래 입력창. 윗줄은 검색, 아랫줄은 거르기 칩 */
export default function FilterBar({ filters, publishers, storeName, shown, onChange }: Props) {
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => onChange({ ...filters, [key]: value })
  // 초기화는 거르기 칸만 비운다 (장르 탭은 그대로)
  const filtered = isFiltered({ ...filters, genre: '' })

  return (
    <div className="composer" role="search">
      {filters.store && (
        <div className="composer-attach">
          <span className="filter-chip">
            <Store size={13} aria-hidden="true" />
            {storeName ?? filters.store}
            <button type="button" className="icon-btn" aria-label="스토어 거르기 풀기" onClick={() => set('store', '')}>
              <X size={13} aria-hidden="true" />
            </button>
          </span>
        </div>
      )}
      <label className="composer-input">
        <Search size={18} aria-hidden="true" />
        <input
          type="search"
          placeholder="게임 제목이나 제작사로 찾기…"
          aria-label="제목·제작사 검색"
          value={filters.q}
          onChange={(e) => set('q', e.target.value)}
        />
        {filters.q && (
          <button type="button" className="icon-btn" aria-label="검색어 지우기" onClick={() => set('q', '')}>
            <X size={16} aria-hidden="true" />
          </button>
        )}
      </label>
      <div className="composer-tools">
        <select
          className={`pill pill-select ${filters.publisher ? 'on' : ''}`}
          aria-label="제작사"
          value={filters.publisher}
          onChange={(e) => set('publisher', e.target.value)}
        >
          <option value="">제작사 전체</option>
          {publishers.map((p) => (
            <option key={p.key} value={p.key}>
              {p.name} ({p.count})
            </option>
          ))}
          {/* 고르고 나서 그 제작사 이름을 바꿔 목록에서 사라진 경우 */}
          {filters.publisher && !publishers.some((p) => p.key === filters.publisher) && (
            <option value={filters.publisher}>(바뀐 제작사)</option>
          )}
        </select>
        <label className={`pill ${filters.players ? 'on' : ''}`}>
          <Users size={14} aria-hidden="true" />
          <input
            type="number"
            min={1}
            aria-label="인원"
            placeholder="–"
            value={filters.players ?? ''}
            onChange={(e) => set('players', toPositiveInt(e.target.value))}
          />
          명 가능
        </label>
        <label className={`pill ${filters.maxTime ? 'on' : ''}`}>
          <Clock size={14} aria-hidden="true" />
          <input
            type="number"
            min={1}
            step={10}
            aria-label="최대 시간(분)"
            placeholder="–"
            value={filters.maxTime ?? ''}
            onChange={(e) => set('maxTime', toPositiveInt(e.target.value))}
          />
          분 이하
        </label>
        <select
          className={`pill pill-select ${filters.played !== 'all' ? 'on' : ''}`}
          aria-label="해봤음"
          value={filters.played}
          onChange={(e) => set('played', e.target.value as PlayedFilter)}
        >
          <option value="all">해봄 전체</option>
          <option value="unplayed">안 해본 게임</option>
          <option value="played">해본 게임</option>
        </select>
        <label className={`pill ${filters.blanksOnly ? 'on' : ''}`}>
          <input type="checkbox" aria-label="빈칸 있는 것만" checked={filters.blanksOnly} onChange={(e) => set('blanksOnly', e.target.checked)} />
          <FileQuestion size={14} aria-hidden="true" />
          빈칸 있는 것만
        </label>
        {filters.blanksOnly && (
          <a className="pill pill-link" href={EXCEL_BLANKS_URL} download>
            <Download size={14} aria-hidden="true" />
            빈칸 채우기용 엑셀
          </a>
        )}
        <span className="spacer" />
        <span className="composer-count" aria-live="polite">
          <b>{shown}</b>개
        </span>
        <button
          type="button"
          className="composer-reset"
          aria-label="초기화"
          title="거르기 초기화"
          onClick={() => onChange({ ...EMPTY_FILTERS, genre: filters.genre })}
          disabled={!filtered}
        >
          <RotateCcw size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
