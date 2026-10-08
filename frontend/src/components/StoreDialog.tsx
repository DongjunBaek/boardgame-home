import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { createStore, updateStore } from '../lib/api'
import type { Store, StoreInput } from '../lib/types'

type Props = {
  /** null이면 새 스토어 추가 */
  store: Store | null
  /** 고를 수 있는 묶음 이름들 */
  groups: string[]
  /** 새로 추가할 때 처음 묶음 */
  defaultGroup?: string
  onClose: () => void
  onSaved: (store: Store, isNew: boolean) => void
}

type Form = { name: string; url: string; group: string; memo: string }

/** 스토어 추가·수정 창. 이름과 주소는 꼭 적고, 묶음은 고르거나 새로 적는다. */
export default function StoreDialog({ store, groups, defaultGroup = '', onClose, onSaved }: Props) {
  const [initial] = useState<Form>(() => ({
    name: store?.name ?? '',
    url: store?.url ?? '',
    group: store ? (store.group ?? '') : defaultGroup,
    memo: store?.memo ?? '',
  }))
  const [form, setForm] = useState(initial)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (key: keyof Form, value: string) => setForm((f) => ({ ...f, [key]: value }))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  async function save() {
    const name = form.name.trim()
    const url = form.url.trim()
    if (!name) return setError('이름을 입력해 주세요')
    if (!/^https?:\/\/\S+$/.test(url)) return setError('주소는 http:// 또는 https://로 시작해야 합니다')
    // 고친 칸만 보낸다
    const input: StoreInput = {}
    if (!store || name !== initial.name.trim()) input.name = name
    if (!store || url !== initial.url.trim()) input.url = url
    if (!store || form.group.trim() !== initial.group.trim()) input.group = form.group.trim() || null
    if (!store || form.memo.trim() !== initial.memo.trim()) input.memo = form.memo.trim() || null
    if (store && Object.keys(input).length === 0) return onClose()
    setBusy(true)
    setError('')
    try {
      onSaved(store ? await updateStore(store.id, input) : await createStore(input), !store)
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  const field = (label: string, control: ReactNode) => (
    <label className="field wide">
      <span className="field-label">{label}</span>
      {control}
    </label>
  )

  return createPortal(
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="dialog dialog-narrow" role="dialog" aria-modal="true" aria-labelledby="store-dialog-title">
        <header className="dialog-head">
          <h2 id="store-dialog-title">{store ? '스토어 고치기' : '스토어 추가'}</h2>
          <button type="button" className="icon-btn" aria-label="닫기" onClick={onClose} disabled={busy}>
            ✕
          </button>
        </header>
        <form
          className="dialog-body"
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
        >
          <div className="fields">
            {field('이름', <input autoFocus value={form.name} onChange={(e) => set('name', e.target.value)} />)}
            {field(
              '주소',
              <input
                value={form.url}
                onChange={(e) => set('url', e.target.value)}
                placeholder="https://smartstore.naver.com/..."
              />,
            )}
            {field(
              '묶음',
              <>
                <input
                  list="store-groups"
                  value={form.group}
                  onChange={(e) => set('group', e.target.value)}
                  placeholder="고르거나 새로 적기 (비우면 기타)"
                />
                <datalist id="store-groups">
                  {groups.map((g) => (
                    <option key={g} value={g} />
                  ))}
                </datalist>
              </>,
            )}
            {field('메모', <input value={form.memo} onChange={(e) => set('memo', e.target.value)} placeholder="예: 신작 자주 올라옴" />)}
          </div>
          {error && (
            <ul className="errors" role="alert">
              <li>{error}</li>
            </ul>
          )}
          <footer className="dialog-foot">
            <span className="spacer" />
            <button type="button" onClick={onClose} disabled={busy}>
              취소
            </button>
            <button type="submit" className="primary" disabled={busy}>
              {busy ? '저장 중…' : store ? '저장' : '추가'}
            </button>
          </footer>
        </form>
      </div>
    </div>,
    document.body,
  )
}
