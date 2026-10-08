import type { PlayerMode, PlayerRow } from '../lib/gameForm'

type Props = { rows: PlayerRow[]; onChange: (rows: PlayerRow[]) => void }

const MODES: { value: PlayerMode; label: string }[] = [
  { value: 'fixed', label: '고정' },
  { value: 'range', label: '범위' },
  { value: 'gm', label: 'GM 필요' },
]

/** 인원 입력: 줄마다 고정(4인) / 범위(2-4인) / GM(5+gm). 줄이 없으면 '모름'. */
export default function PlayersInput({ rows, onChange }: Props) {
  const update = (i: number, change: Partial<PlayerRow>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...change } : r)))

  return (
    <div className="players-input">
      {rows.length === 0 && <span className="hint">모름</span>}
      {rows.map((row, i) => (
        <div key={i} className="players-row">
          <select aria-label="인원 방식" value={row.mode} onChange={(e) => update(i, { mode: e.target.value as PlayerMode })}>
            {MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            aria-label={row.mode === 'range' ? '최소 인원' : '인원'}
            value={row.min}
            onChange={(e) => update(i, { min: e.target.value })}
          />
          {row.mode === 'range' && (
            <>
              <span>-</span>
              <input
                type="number"
                min={1}
                aria-label="최대 인원"
                value={row.max}
                onChange={(e) => update(i, { max: e.target.value })}
              />
            </>
          )}
          <span>{row.mode === 'gm' ? '+GM' : '인'}</span>
          <button type="button" className="link-btn" onClick={() => onChange(rows.filter((_, j) => j !== i))}>
            빼기
          </button>
        </div>
      ))}
      <button type="button" className="link-btn" onClick={() => onChange([...rows, { mode: 'fixed', min: '', max: '' }])}>
        + 인원 추가
      </button>
    </div>
  )
}
