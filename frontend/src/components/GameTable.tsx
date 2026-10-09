import { ChevronDown, ChevronUp, Minus, Plus } from 'lucide-react'
import type { ReactNode } from 'react'
import { formatMinutes, formatPlayers, formatPrice, parseMinutes, parsePlayerInput, parseText, parseWon, shortGenre } from '../lib/format'
import type { Sort, SortKey } from '../lib/games'
import type { Game, GameInput } from '../lib/types'
import EditableCell from './EditableCell'
import GameThumb from './GameThumb'
import StarRating from './StarRating'

type Props = {
  games: Game[]
  sort: Sort
  onSort: (key: SortKey) => void
  onOpen: (game: Game) => void
  /** 표에서 바로 고치기 (제작사·인원·시간·정가·구매가격·개수·해봤음·별점) */
  onEdit: (game: Game, patch: GameInput) => void
}

const COLUMNS: { key: SortKey; label: string; className?: string }[] = [
  { key: 'title', label: '제목', className: 'col-title' },
  { key: 'publisher', label: '제작사', className: 'col-publisher' },
  { key: 'genre', label: '장르' },
  { key: 'players', label: '인원' },
  { key: 'time', label: '시간', className: 'num' },
  { key: 'price', label: '정가', className: 'num' },
  { key: 'paid', label: '구매가격', className: 'num' },
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
                    <span className="sort-mark" aria-hidden="true">
                      {active && (sort.dir === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />)}
                    </span>
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
                  <GameThumb game={g} />
                  <span>{g.title}</span>
                </button>
              </td>
              <td className="col-publisher">
                <EditableCell
                  label={`${g.title} 제작사`}
                  display={g.publisher}
                  initialText={g.publisher ?? ''}
                  parse={parseText}
                  hint=""
                  width={130}
                  onSave={(publisher) => onEdit(g, { publisher })}
                />
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
              <td>
                <EditableCell
                  label={`${g.title} 인원`}
                  display={formatPlayers(g.player_count)}
                  initialText={g.player_count.join(', ')}
                  parse={parsePlayerInput}
                  hint="예: 4인 / 2-4인 / 5+gm, 여러 개면 쉼표로"
                  placeholder="2-4인"
                  onSave={(player_count) => onEdit(g, { player_count })}
                />
              </td>
              <td className="num">
                <EditableCell
                  label={`${g.title} 시간`}
                  display={formatMinutes(g.play_time_minutes)}
                  initialText={g.play_time_minutes === null ? '' : String(g.play_time_minutes)}
                  parse={parseMinutes}
                  hint="1 이상의 숫자(분)로 적어 주세요"
                  placeholder="분"
                  width={70}
                  onSave={(play_time_minutes) => onEdit(g, { play_time_minutes })}
                />
              </td>
              <td className="num">
                <EditableCell
                  label={`${g.title} 정가`}
                  display={formatPrice(g.price)}
                  initialText={g.price === null ? '' : String(g.price)}
                  parse={parseWon}
                  hint="0 이상의 숫자(원)로 적어 주세요"
                  placeholder="원"
                  onSave={(price) => onEdit(g, { price })}
                />
              </td>
              <td className="num">
                <EditableCell
                  label={`${g.title} 구매가격`}
                  display={formatPrice(g.mine.purchase.paid)}
                  initialText={g.mine.purchase.paid === null ? '' : String(g.mine.purchase.paid)}
                  parse={parseWon}
                  hint="0 이상의 숫자(원)로 적어 주세요"
                  placeholder="원"
                  onSave={(paid) => onEdit(g, { mine: { purchase: { paid } } })}
                />
              </td>
              <td className="num">
                <span className="stepper">
                  <button
                    type="button"
                    aria-label={`${g.title} 개수 줄이기`}
                    disabled={g.mine.quantity <= 1}
                    onClick={() => onEdit(g, { mine: { quantity: g.mine.quantity - 1 } })}
                  >
                    <Minus size={12} aria-hidden="true" />
                  </button>
                  <span className="qty">{g.mine.quantity}</span>
                  <button
                    type="button"
                    aria-label={`${g.title} 개수 늘리기`}
                    onClick={() => onEdit(g, { mine: { quantity: g.mine.quantity + 1 } })}
                  >
                    <Plus size={12} aria-hidden="true" />
                  </button>
                </span>
              </td>
              <td className="center">
                <input
                  type="checkbox"
                  className="played-check"
                  aria-label={`${g.title} 해봤음`}
                  checked={g.mine.played}
                  onChange={(e) => onEdit(g, { mine: { played: e.target.checked } })}
                />
              </td>
              <td>
                <StarRating value={g.mine.rating} onChange={(rating) => onEdit(g, { mine: { rating } })} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {games.length === 0 && <p className="empty">조건에 맞는 게임이 없습니다. 아래 입력창에서 거르기를 줄이거나 초기화해 보세요.</p>}
    </div>
  )
}
