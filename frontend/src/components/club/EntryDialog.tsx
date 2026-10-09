import { useState } from 'react'
import { createEntry, deleteEntry, updateEntry } from '../../lib/api'
import { KIND_LABEL, type EntryKind, type LedgerEntry } from '../../lib/ledger'
import { parseWon } from '../../lib/format'
import FormDialog, { Field } from './FormDialog'

type Props = {
  /** null이면 새 기록 */
  entry: LedgerEntry | null
  /** 분류 고르기 목록 */
  categories: string[]
  onClose: () => void
  onSaved: (entry: LedgerEntry, isNew: boolean) => void
  onDeleted: (entry: LedgerEntry) => void
}

const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 회계록 입금·출금 한 줄. 회비 납부는 회비 화면에서 적으면 여기 자동으로 보이므로 따로 적지 않는다 */
export default function EntryDialog({ entry, categories, onClose, onSaved, onDeleted }: Props) {
  const [kind, setKind] = useState<EntryKind>(entry?.kind ?? 'out')
  const [date, setDate] = useState(entry?.date ?? today())
  const [amount, setAmount] = useState(entry?.amount.toLocaleString('ko-KR') ?? '')
  const [category, setCategory] = useState(entry?.category ?? '')
  const [description, setDescription] = useState(entry?.description ?? '')
  const [memo, setMemo] = useState(entry?.memo ?? '')

  async function submit() {
    if (!date) throw new Error('날짜를 입력해 주세요')
    const won = parseWon(amount)
    if (!won) throw new Error('금액을 1원 이상 숫자로 입력해 주세요')
    if (!description.trim()) throw new Error('내용을 입력해 주세요 (예: 10월 모임 간식)')
    const input = { kind, date, amount: won, category: category.trim() || null, description: description.trim(), memo: memo.trim() || null }
    onSaved(entry ? await updateEntry(entry.id, input) : await createEntry(input), !entry)
  }

  return (
    <FormDialog
      title={entry ? '입출금 고치기' : '입출금 기록'}
      submitLabel={entry ? '저장' : '기록'}
      onSubmit={submit}
      onClose={onClose}
      onDelete={
        entry
          ? async () => {
              await deleteEntry(entry.id)
              onDeleted(entry)
            }
          : undefined
      }
      confirmText="이 기록을 지울까요? 직전 상태는 백업에 남습니다."
    >
      <div className="field wide">
        <span className="field-label">종류</span>
        <div className="genre-tabs compact" role="radiogroup" aria-label="종류">
          {(['in', 'out'] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              className={`genre-tab ${kind === k ? 'active' : ''}`}
              onClick={() => setKind(k)}
            >
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>
      </div>
      <Field label="날짜">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Field label="금액 (원)">
        <input autoFocus inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="예: 30000" />
      </Field>
      <Field label="분류">
        <input list="ledger-categories" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="고르거나 새로 적기" />
        <datalist id="ledger-categories">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </Field>
      <Field label="내용">
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="예: 10월 모임 간식" />
      </Field>
      <Field label="메모" wide>
        <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="예: 영수증 사진은 단톡방에" />
      </Field>
    </FormDialog>
  )
}
