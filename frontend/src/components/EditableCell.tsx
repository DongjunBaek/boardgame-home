import { useState, type ReactNode } from 'react'

type Props<T> = {
  /** 화면 읽기 프로그램용 이름. 예: "딕싯 정가" */
  label: string
  /** 보기 상태에서 보여 줄 값. null이면 흐린 "—" */
  display: ReactNode | null
  /** 입력을 시작할 때 칸에 들어갈 글자 */
  initialText: string
  /** 입력 글자 → 저장할 값. 형식이 틀리면 undefined */
  parse: (text: string) => T | undefined
  /** 형식이 틀렸을 때 보여 줄 안내 */
  hint: string
  placeholder?: string
  width?: number
  onSave: (value: T) => void
}

/** 표 안에서 바로 고치는 칸: 누르면 입력, Enter나 다른 곳을 누르면 저장, Esc는 취소. 비우면 지운다. */
export default function EditableCell<T>({ label, display, initialText, parse, hint, placeholder, width = 90, onSave }: Props<T>) {
  const [draft, setDraft] = useState<string | null>(null) // null이면 보기 상태
  const [invalid, setInvalid] = useState(false)

  if (draft === null) {
    return (
      <button
        type="button"
        className="cell-btn"
        aria-label={`${label} 고치기`}
        title="눌러서 고치기"
        onClick={() => setDraft(initialText)}
      >
        {display ?? <span className="blank">—</span>}
      </button>
    )
  }

  const cancel = () => {
    setDraft(null)
    setInvalid(false)
  }
  const commit = () => {
    const value = parse(draft)
    if (value === undefined) return setInvalid(true)
    cancel()
    if (draft.trim() !== initialText.trim()) onSave(value)
  }

  return (
    <input
      autoFocus
      className={`cell-input ${invalid ? 'invalid' : ''}`}
      style={{ width }}
      aria-label={label}
      aria-invalid={invalid}
      title={invalid ? `${hint} (Esc로 취소)` : 'Enter로 저장, Esc로 취소, 비우면 지움'}
      placeholder={placeholder}
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
