import { useState } from 'react'
import { deletePayment, putPayment } from '../../lib/api'
import { METHOD_LABEL, monthLabel, type Member, type Payment, type PaymentKind, type PaymentMethod, type Tier } from '../../lib/club'
import { parseWon } from '../../lib/format'
import FormDialog, { Field } from './FormDialog'

type Props = {
  member: Member
  tier: Tier | undefined
  month: string
  /** 이 칸에 이미 있는 기록 */
  payment: Payment | undefined
  onClose: () => void
  onSaved: (written: Payment[]) => void
  onDeleted: () => void
}

const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 한 칸(회원 × 달) 기록. 처음 값: 금액 = 구분의 월 금액, 낸 날 = 오늘, 방법 = 계좌 */
export default function PaymentDialog({ member, tier, month, payment, onClose, onSaved, onDeleted }: Props) {
  const [kind, setKind] = useState<PaymentKind>(payment?.kind ?? 'paid')
  const [amount, setAmount] = useState((payment?.amount ?? tier?.monthly_fee)?.toLocaleString('ko-KR') ?? '')
  const [paidOn, setPaidOn] = useState(payment?.paid_on ?? today())
  const [method, setMethod] = useState<PaymentMethod>(payment?.method ?? 'bank')
  const [months, setMonths] = useState(1)
  const [memo, setMemo] = useState(payment?.memo ?? '')
  const year = month.slice(0, 4)

  async function submit() {
    const memoValue = memo.trim() || null
    if (kind === 'exempt') {
      onSaved(await putPayment(member.id, month, { kind, memo: memoValue }))
      return
    }
    const won = parseWon(amount)
    if (won === null || won === undefined) throw new Error('금액을 숫자로 입력해 주세요')
    onSaved(await putPayment(member.id, month, { kind, amount: won, paid_on: paidOn || null, method, memo: memoValue, months }))
  }

  return (
    <FormDialog
      title={`${member.name} · ${year}년 ${monthLabel(month)}`}
      submitLabel="저장"
      onSubmit={submit}
      onClose={onClose}
      onDelete={
        payment
          ? async () => {
              await deletePayment(member.id, month)
              onDeleted()
            }
          : undefined
      }
      deleteLabel="기록 지우기"
      confirmText="이 달 기록을 지울까요? 지난 달이면 미납으로 바뀝니다."
    >
      <div className="field wide">
        <span className="field-label">종류</span>
        <div className="genre-tabs compact" role="radiogroup" aria-label="종류">
          {(['paid', 'exempt'] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              className={`genre-tab ${kind === k ? 'active' : ''}`}
              onClick={() => setKind(k)}
            >
              {k === 'paid' ? '납부' : '이 달 면제'}
            </button>
          ))}
        </div>
      </div>
      {kind === 'paid' && (
        <>
          <Field label="금액 (원)">
            <input autoFocus inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="예: 10000" />
          </Field>
          <Field label="낸 날">
            <input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
          </Field>
          <Field label="방법">
            <select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
              {(Object.keys(METHOD_LABEL) as PaymentMethod[]).map((m) => (
                <option key={m} value={m}>
                  {METHOD_LABEL[m]}
                </option>
              ))}
            </select>
          </Field>
          {!payment && (
            <Field label="몇 달 치">
              <select value={months} onChange={(e) => setMonths(Number(e.target.value))}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n === 1 ? '이 달만' : `${n}개월 (같은 금액으로 이어서)`}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </>
      )}
      <Field label="메모" wide>
        <input value={memo} onChange={(e) => setMemo(e.target.value)} />
      </Field>
    </FormDialog>
  )
}
