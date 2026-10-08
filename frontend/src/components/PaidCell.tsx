import { useState } from 'react'
import { formatPrice, parseWon } from '../lib/format'

type Props = { title: string; value: number | null; onSave: (paid: number | null) => void }

/** 표의 '낸 가격' 칸: 누르면 입력, Enter나 다른 곳을 누르면 저장, Esc는 취소. 비우면 지운다. */
export default function PaidCell({ title, value, onSave }: Props) {
  const [draft, setDraft] = useState<string | null>(null) // null이면 보기 상태
  const [invalid, setInvalid] = useState(false)

  if (draft === null) {
    return (
      <button
        type="button"
        className="paid-btn"
        aria-label={`${title} 낸 가격 ${value === null ? '적기' : '고치기'}`}
        title="눌러서 적기"
        onClick={() => setDraft(value === null ? '' : String(value))}
      >
        {value === null ? <span className="blank">—</span> : formatPrice(value)}
      </button>
    )
  }

  const cancel = () => {
    setDraft(null)
    setInvalid(false)
  }
  const commit = () => {
    const paid = parseWon(draft)
    if (paid === undefined) return setInvalid(true)
    cancel()
    if (paid !== value) onSave(paid)
  }

  return (
    <input
      autoFocus
      inputMode="numeric"
      className={`paid-input ${invalid ? 'invalid' : ''}`}
      aria-label={`${title} 낸 가격`}
      aria-invalid={invalid}
      title={invalid ? '0 이상의 숫자(원)로 적어 주세요. Esc로 취소' : 'Enter로 저장, Esc로 취소, 비우면 지움'}
      placeholder="원"
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value)
        setInvalid(false)
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit()
        if (e.key === 'Escape') cancel()
      }}
    />
  )
}
