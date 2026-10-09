import { useState } from 'react'
import { createMember, deleteMember, updateMember } from '../../lib/api'
import { STATUS_LABEL, type Member, type MemberInput, type MemberStatus, type Tier } from '../../lib/club'
import { formatPrice } from '../../lib/format'
import FormDialog, { Field } from './FormDialog'

type Props = {
  /** null이면 새 회원 */
  member: Member | null
  tiers: Tier[]
  /** 새 회원의 가입 월 처음 값 (이번 달) */
  currentMonth: string
  onClose: () => void
  onSaved: (member: Member, isNew: boolean) => void
  onDeleted: (member: Member) => void
}

const tierLabel = (t: Tier) => `${t.name} · ${t.exempt ? '면제' : (formatPrice(t.monthly_fee) ?? '금액 미정')}`

/** 회원 추가·수정. 그만두면 지우지 말고 상태를 탈퇴로 바꾼다 (지난 기록을 남기려고) */
export default function MemberDialog({ member, tiers, currentMonth, onClose, onSaved, onDeleted }: Props) {
  const [name, setName] = useState(member?.name ?? '')
  const [tierId, setTierId] = useState(member?.tier_id ?? tiers[0]?.id ?? '')
  const [joined, setJoined] = useState(member?.joined ?? currentMonth)
  const [status, setStatus] = useState<MemberStatus>(member?.status ?? 'active')
  const [since, setSince] = useState(member?.status_since ?? currentMonth)
  const [memo, setMemo] = useState(member?.memo ?? '')

  async function submit() {
    if (!name.trim()) throw new Error('이름을 입력해 주세요')
    if (!joined) throw new Error('가입 월을 입력해 주세요')
    if (status !== 'active' && !since) throw new Error('휴면·탈퇴를 시작한 달을 입력해 주세요')
    const input: MemberInput = {
      name: name.trim(),
      tier_id: tierId,
      joined,
      status,
      status_since: status === 'active' ? null : since,
      memo: memo.trim() || null,
    }
    onSaved(member ? await updateMember(member.id, input) : await createMember(input), !member)
  }

  return (
    <FormDialog
      title={member ? '회원 고치기' : '회원 추가'}
      submitLabel={member ? '저장' : '추가'}
      onSubmit={submit}
      onClose={onClose}
      onDelete={
        member
          ? async () => {
              await deleteMember(member.id)
              onDeleted(member)
            }
          : undefined
      }
      confirmText={`'${member?.name}' 회원을 지울까요? 납부 기록이 있으면 지워지지 않으니 상태를 탈퇴로 바꿔 주세요.`}
    >
      <Field label="이름">
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="회비 구분">
        <select value={tierId} onChange={(e) => setTierId(e.target.value)}>
          {tiers.map((t) => (
            <option key={t.id} value={t.id}>
              {tierLabel(t)}
            </option>
          ))}
        </select>
      </Field>
      <Field label="가입 월">
        <input type="month" value={joined} onChange={(e) => setJoined(e.target.value)} />
      </Field>
      <Field label="상태">
        <select value={status} onChange={(e) => setStatus(e.target.value as MemberStatus)}>
          {(Object.keys(STATUS_LABEL) as MemberStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </Field>
      {status !== 'active' && (
        <Field label={`${STATUS_LABEL[status]} 시작 달 (이 달부터 미납으로 세지 않음)`} wide>
          <input type="month" value={since} onChange={(e) => setSince(e.target.value)} />
        </Field>
      )}
      <Field label="메모" wide>
        <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="예: 연락처, 특이사항" />
      </Field>
    </FormDialog>
  )
}
