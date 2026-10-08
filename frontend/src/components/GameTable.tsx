import type { ReactNode } from 'react'
import { formatMinutes, formatPlayers, formatPrice, shortGenre } from '../lib/format'
import type { Sort, SortKey } from '../lib/games'
import type { Game, GameInput } from '../lib/types'
import PaidCell from './PaidCell'
import StarRating from './StarRating'

type Props = {
  games: Game[]
  sort: Sort
  onSort: (key: SortKey) => void
  onOpen: (game: Game) => void
  /** 표에서 바로 고치기 (개수·해봤음·별점·낸 가격) */
  onEdit: (game: Game, mine: NonNullable<GameInput['mine']>) => void
}

const COLUMNS: { key: SortKey; label: string; className?: string }[] = [
  { key: 'title', label: '제목', className: 'col-title' },
  { key: 'genre', label: '장르' },
  { key: 'players', label: '인원' },
  { key: 'time', label: '시간', className: 'num' },
  { key: 'price', label: '정가', className: 'num' },
  { key: 'paid', label: '낸 가격', className: 'num' },
  { key: 'quantity', label: '개수', className: 'num' },
  { key: 'played', label: '해봄', className: 'center' },
  { key: 'rating', label: '별점' },
]

/** 빈 값은 "—"로 흐리게 */
const cell = (value: ReactNode | null) => (value === null ? <span className="blank">—</span> : value)

export default function GameTable({ games, sort, onSort, onOpen, onEdit }: Props) {
  return (
    <div className="table-wrap">
      <table className="game-table">
        <thead>
          <tr>
            {COLUMNS.map((c) => {
              const active = sort.key === c.key
              return (
                <th
                  key={c.key}
                  className={c.className}
                  aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  <button type="button" className="sort-btn" onClick={() => onSort(c.key)}>
                    {c.label}
                    <span className="sort-mark">{active ? (sort.dir === 'asc' ? '▲' : '▼') : ''}</span>
                  </button>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {games.map((g) => (
            <tr key={g.id}>
              <td className="col-title">
                <button type="button" className="title" onClick={() => onOpen(g)}>
                  {g.title}
                </button>
                {g.publisher && <div className="sub">{g.publisher}</div>}
              </td>
              <td>
                {g.genres.length
                  ? g.genres.map((genre) => (
                      <span key={genre} className={`chip ${genre === '머더미스터리' ? 'chip-murder' : 'chip-board'}`}>
                        {shortGenre(genre)}
                      </span>
                    ))
                  : cell(null)}
              </td>
              <td>{cell(formatPlayers(g.player_count))}</td>
              <td className="num">{cell(formatMinutes(g.play_time_minutes))}</td>
              <td className="num">{cell(formatPrice(g.price))}</td>
              <td className="num">
                <PaidCell
                  title={g.title}
                  value={g.mine.purchase.paid}
                  onSave={(paid) => onEdit(g, { purchase: { paid } })}
                />
              </td>
              <td className="num">
                <span className="stepper">
                  <button
                    type="button"
                    aria-label={`${g.title} 개수 줄이기`}
                    disabled={g.mine.quantity <= 1}
                    onClick={() => onEdit(g, { quantity: g.mine.quantity - 1 })}
                  >
                    −
                  </button>
                  <span className="qty">{g.mine.quantity}</span>
                  <button
                    type="button"
                    aria-label={`${g.title} 개수 늘리기`}
                    onClick={() => onEdit(g, { quantity: g.mine.quantity + 1 })}
                  >
                    +
                  </button>
                </span>
              </td>
              <td className="center">
                <input
                  type="checkbox"
                  className="played-check"
                  aria-label={`${g.title} 해봤음`}
                  checked={g.mine.played}
                  onChange={(e) => onEdit(g, { played: e.target.checked })}
                />
              </td>
              <td>
                <StarRating value={g.mine.rating} onChange={(rating) => onEdit(g, { rating })} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {games.length === 0 && <p className="empty">조건에 맞는 게임이 없습니다.</p>}
    </div>
  )
}
