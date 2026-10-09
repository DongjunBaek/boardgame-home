import { X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

type Props = {
  title: string
  /** 저장. 실패하면 Error를 던지고, 창에 이유가 뜬다 */
  onSubmit: () => Promise<void>
  onClose: () => void
  /** 있으면 왼쪽 아래에 지우기 단추. confirmText는 확인 문구 */
  onDelete?: () => Promise<void>
  deleteLabel?: string
  confirmText?: string
  submitLabel: string
  children: ReactNode
}

/** 회비 화면의 작은 입력 창 공통 틀: 닫기, Esc, 오류 줄, 지우기 확인, 저장 단추 */
export default function FormDialog({ title, onSubmit, onClose, onDelete, deleteLabel = '지우기', confirmText, submitLabel, children }: Props) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError('')
    try {
      await action()
    } catch (e) {
      setError((e as Error).message)
      setConfirming(false)
      setBusy(false)
    }
  }

  return createPortal(
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="dialog dialog-narrow" role="dialog" aria-modal="true" aria-label={title}>
        <header className="dialog-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" aria-label="닫기" onClick={onClose} disabled={busy}>
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <form
          className="dialog-body"
          onSubmit={(e) => {
            e.preventDefault()
            void run(onSubmit)
          }}
        >
          <div className="fields">{children}</div>
          {error && (
            <ul className="errors" role="alert">
              <li>{error}</li>
            </ul>
          )}
          <footer className="dialog-foot">
            {confirming && onDelete ? (
              <div className="confirm" role="alert">
                <span>{confirmText}</span>
                <button type="button" className="danger" onClick={() => void run(onDelete)} disabled={busy}>
                  {deleteLabel}
                </button>
                <button type="button" onClick={() => setConfirming(false)} disabled={busy}>
                  취소
                </button>
              </div>
            ) : (
              <>
                {onDelete && (
                  <button type="button" className="danger-text" onClick={() => setConfirming(true)} disabled={busy}>
                    {deleteLabel}
                  </button>
                )}
                <span className="spacer" />
                <button type="button" onClick={onClose} disabled={busy}>
                  취소
                </button>
                <button type="submit" className="primary" disabled={busy}>
                  {busy ? '저장 중…' : submitLabel}
                </button>
              </>
            )}
          </footer>
        </form>
      </div>
    </div>,
    document.body,
  )
}

/** 이름표 붙은 칸 하나 */
export function Field({ label, wide, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return (
    <label className={`field ${wide ? 'wide' : ''}`}>
      <span className="field-label">{label}</span>
      {children}
    </label>
  )
}
