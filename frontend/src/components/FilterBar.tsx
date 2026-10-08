import { EXCEL_BLANKS_URL } from '../lib/api'
import { EMPTY_FILTERS, isFiltered, type Filters, type PlayedFilter, type PublisherOption } from '../lib/games'
import { GENRES, type Genre } from '../lib/types'

type Props = { filters: Filters; publishers: PublisherOption[]; onChange: (next: Filters) => void }

/** 빈칸이나 1 미만이면 null (조건 없음) */
function toPositiveInt(text: string): number | null {
  const n = Number.parseInt(text, 10)
  return Number.isFinite(n) && n >= 1 ? n : null
}

export default function FilterBar({ filters, publishers, onChange }: Props) {
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => onChange({ ...filters, [key]: value })

  return (
    <div className="filter-bar" role="search">
      <input
        type="search"
        className="filter-q"
        placeholder="제목·제작사 검색"
        aria-label="제목·제작사 검색"
        value={filters.q}
        onChange={(e) => set('q', e.target.value)}
      />
      <select aria-label="장르" value={filters.genre} onChange={(e) => set('genre', e.target.value as Genre | '')}>
        <option value="">장르 전체</option>
        {GENRES.map((g) => (
          <option key={g} value={g}>
            {g}
          </option>
        ))}
      </select>
      <select
        className="filter-publisher"
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
      <label className="filter-num">
        <input
          type="number"
          min={1}
          aria-label="인원"
          value={filters.players ?? ''}
          onChange={(e) => set('players', toPositiveInt(e.target.value))}
        />
        명 가능
      </label>
      <label className="filter-num">
        <input
          type="number"
          min={1}
          step={10}
          aria-label="최대 시간(분)"
          value={filters.maxTime ?? ''}
          onChange={(e) => set('maxTime', toPositiveInt(e.target.value))}
        />
        분 이하
      </label>
      <select aria-label="해봤음" value={filters.played} onChange={(e) => set('played', e.target.value as PlayedFilter)}>
        <option value="all">해봄 전체</option>
        <option value="unplayed">안 해본 게임</option>
        <option value="played">해본 게임</option>
      </select>
      <label className="filter-check">
        <input type="checkbox" aria-label="빈칸 있는 것만" checked={filters.blanksOnly} onChange={(e) => set('blanksOnly', e.target.checked)} />
        빈칸 있는 것만
      </label>
      {filters.blanksOnly && (
        <a className="filter-link" href={EXCEL_BLANKS_URL} download>
          빈칸 채우기용 엑셀 받기
        </a>
      )}
      <button type="button" onClick={() => onChange(EMPTY_FILTERS)} disabled={!isFiltered(filters)}>
        초기화
      </button>
    </div>
  )
}
