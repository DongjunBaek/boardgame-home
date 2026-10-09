import { useState } from 'react'
import { createTier, deleteTier, updateTier } from '../../lib/api'
import type { Tier } from '../../lib/club'
import { parseWon } from '../../lib/format'
import FormDialog, { Field } from './FormDialog'

type Props = {
  /** null이면 새 구분 */
  tier: Tier | null
  onClose: () => void
  onSaved: (tier: Tier, isNew: boolean) => void
  onDeleted: (tier: Tier) => void
}

/** 회비 구분 추가·수정. 금액을 비우면 '미정' (미납 금액 합계에서 빠진다) */
export default function TierDialog({ tier, onClose, onSaved, onDeleted }: Props) {
  const [name, setName] = useState(tier?.name ?? '')
  const [fee, setFee] = useState(tier?.monthly_fee?.toLocaleString('ko-KR') ?? '')
  const [exempt, setExempt] = useState(tier?.exempt ?? false)

  async function submit() {
    if (!name.trim()) throw new Error('이름을 입력해 주세요')
    const monthly_fee = parseWon(fee)
    if (monthly_fee === undefined) throw new Error('월 금액은 숫자로 적어 주세요 (비우면 미정)')
    const input = { name: name.trim(), monthly_fee, exempt }
    onSaved(tier ? await updateTier(tier.id, input) : await createTier(input), !tier)
  }

  return (
    <FormDialog
      title={tier ? '회비 구분 고치기' : '회비 구분 추가'}
      submitLabel={tier ? '저장' : '추가'}
      onSubmit={submit}
      onClose={onClose}
      onDelete={
        tier
          ? async () => {
              await deleteTier(tier.id)
              onDeleted(tier)
            }
          : undefined
      }
      confirmText={`'${tier?.name}' 구분을 지울까요? 쓰는 회원이 있으면 지워지지 않습니다.`}
    >
      <Field label="이름">
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 정회원" />
      </Field>
      <Field label="월 금액 (원)">
        <input inputMode="numeric" value={fee} onChange={(e) => setFee(e.target.value)} placeholder="비우면 미정" />
      </Field>
      <label className="field wide checks">
        <input type="checkbox" checked={exempt} onChange={(e) => setExempt(e.target.checked)} />
        회비 면제 (이 구분 회원은 기록이 없어도 미납이 아님)
      </label>
    </FormDialog>
  )
}
