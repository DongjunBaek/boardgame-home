// 동아리 회비 장부: 타입과 미납 계산. 서버는 기록만 저장하고, 미납은 여기서 계산한다 (backend/app/club.py 참고).

export type Tier = { id: string; name: string; monthly_fee: number | null; exempt: boolean }
export type MemberStatus = 'active' | 'paused' | 'left'
export type Member = {
  id: string
  name: string
  tier_id: string
  /** 가입 월 "2026-03" */
  joined: string
  status: MemberStatus
  /** 휴면·탈퇴가 시작된 달. 활동 중이면 null */
  status_since: string | null
  memo: string | null
}
export type PaymentKind = 'paid' | 'exempt'
export type PaymentMethod = 'bank' | 'cash' | 'other'
export type Payment = {
  member_id: string
  month: string
  kind: PaymentKind
  amount: number | null
  paid_on: string | null
  method: PaymentMethod | null
  memo: string | null
}
export type Club = { tiers: Tier[]; members: Member[]; payments: Payment[] }

export type TierInput = Partial<Omit<Tier, 'id'>>
export type MemberInput = Partial<Omit<Member, 'id'>>
export type PaymentInput = Partial<Omit<Payment, 'member_id' | 'month'>> & { months?: number }

export const STATUS_LABEL: Record<MemberStatus, string> = { active: '활동', paused: '휴면', left: '탈퇴' }
export const METHOD_LABEL: Record<PaymentMethod, string> = { bank: '계좌', cash: '현금', other: '기타' }

/**
 * 칸 상태
 * - paid / exempt: 기록이 있음 (구분이 면제면 기록 없이도 exempt)
 * - unpaid: 회원이었던 지난 달(이번 달 포함)인데 기록이 없음
 * - future: 아직 안 온 달 (미리 내면 paid)
 * - off: 가입 전, 휴면·탈퇴 뒤
 */
export type CellState = 'paid' | 'exempt' | 'unpaid' | 'future' | 'off'

export const monthOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

export const yearMonths = (year: number) => Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`)

const key = (memberId: string, month: string) => `${memberId}|${month}`

export function paymentIndex(payments: readonly Payment[]): Map<string, Payment> {
  return new Map(payments.map((p) => [key(p.member_id, p.month), p]))
}

export const findPayment = (index: Map<string, Payment>, memberId: string, month: string) => index.get(key(memberId, month))

/** 그 달에 회원이었는지 (가입 뒤, 휴면·탈퇴 전) */
export function isMemberIn(member: Member, month: string): boolean {
  if (month < member.joined) return false
  if (member.status !== 'active' && member.status_since && month >= member.status_since) return false
  return true
}

export function cellState(member: Member, tier: Tier | undefined, month: string, payment: Payment | undefined, current: string): CellState {
  if (payment) return payment.kind
  if (!isMemberIn(member, month)) return 'off'
  if (month > current) return 'future'
  if (tier?.exempt) return 'exempt'
  return 'unpaid'
}

export type MemberYear = {
  cells: { month: string; state: CellState; payment?: Payment }[]
  unpaidMonths: number
  /** 미납 금액. 구분 금액을 아직 안 정했으면 null */
  unpaidAmount: number | null
}

export function memberYear(member: Member, tier: Tier | undefined, year: number, index: Map<string, Payment>, current: string): MemberYear {
  const cells = yearMonths(year).map((month) => {
    const payment = findPayment(index, member.id, month)
    return { month, state: cellState(member, tier, month, payment, current), payment }
  })
  const unpaidMonths = cells.filter((c) => c.state === 'unpaid').length
  const fee = tier?.monthly_fee ?? null
  return { cells, unpaidMonths, unpaidAmount: unpaidMonths === 0 ? 0 : fee === null ? null : fee * unpaidMonths }
}

/** 그 해에 한 달이라도 회원이었거나 기록이 있는 회원만 현황표에 보인다 */
export function membersInYear(club: Club, year: number): Member[] {
  const months = yearMonths(year)
  const recorded = new Set(club.payments.filter((p) => p.month.startsWith(`${year}-`)).map((p) => p.member_id))
  return sortMembers(club.members.filter((m) => recorded.has(m.id) || months.some((month) => isMemberIn(m, month))))
}

const STATUS_ORDER: Record<MemberStatus, number> = { active: 0, paused: 1, left: 2 }

/** 활동 → 휴면 → 탈퇴, 그 안에서 이름순 */
export function sortMembers(members: readonly Member[]): Member[] {
  return [...members].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.name.localeCompare(b.name, 'ko'))
}

export type ClubSummary = {
  /** 이번 달 내야 하는 회원 수 (면제·비회원 제외) */
  dueThisMonth: number
  paidThisMonth: number
  /** 이번 달 회비로 걷힌 금액 */
  collectedThisMonth: number
  /** 고른 해의 미납 합계. 금액을 모르는 미납은 빼고 더한다 */
  unpaidYear: number
  /** 금액을 정하지 않은 구분 때문에 합계에서 빠진 미납이 있음 */
  unpaidUnknown: boolean
}

export function clubSummary(club: Club, year: number, current: string): ClubSummary {
  const index = paymentIndex(club.payments)
  const tierOf = new Map(club.tiers.map((t) => [t.id, t]))
  let dueThisMonth = 0
  let paidThisMonth = 0
  let collectedThisMonth = 0
  for (const m of club.members) {
    const payment = findPayment(index, m.id, current)
    const state = cellState(m, tierOf.get(m.tier_id), current, payment, current)
    if (state === 'paid' || state === 'unpaid') dueThisMonth += 1
    if (state === 'paid') {
      paidThisMonth += 1
      collectedThisMonth += payment?.amount ?? 0
    }
  }
  let unpaidYear = 0
  let unpaidUnknown = false
  for (const m of club.members) {
    const y = memberYear(m, tierOf.get(m.tier_id), year, index, current)
    if (y.unpaidAmount === null) unpaidUnknown = true
    else unpaidYear += y.unpaidAmount
  }
  return { dueThisMonth, paidThisMonth, collectedThisMonth, unpaidYear, unpaidUnknown }
}

/** 기록을 반영한 새 목록: 같은 (회원, 달)은 바꾸고 나머지는 더한다 */
export function mergePayments(payments: readonly Payment[], written: readonly Payment[]): Payment[] {
  const index = paymentIndex(payments)
  for (const p of written) index.set(key(p.member_id, p.month), p)
  return [...index.values()].sort((a, b) => a.month.localeCompare(b.month) || a.member_id.localeCompare(b.member_id))
}

export const removePayment = (payments: readonly Payment[], memberId: string, month: string) =>
  payments.filter((p) => !(p.member_id === memberId && p.month === month))

/** "2026-10" → "10월" */
export const monthLabel = (month: string) => `${Number(month.slice(5))}월`

export type TierTab = { key: string; label: string; count: number }

/** 구분 탭: 전체 + 회원이 있는 구분 (구분 순서대로). 지금 고른 구분은 0명이어도 남긴다 */
export function tierTabs(club: Club, selected = ''): TierTab[] {
  const counts = new Map<string, number>()
  for (const m of club.members) counts.set(m.tier_id, (counts.get(m.tier_id) ?? 0) + 1)
  return [
    { key: '', label: '전체', count: club.members.length },
    ...club.tiers
      .filter((t) => (counts.get(t.id) ?? 0) > 0 || t.id === selected)
      .map((t) => ({ key: t.id, label: t.name, count: counts.get(t.id) ?? 0 })),
  ]
}

/** 고른 구분의 회원만 남긴 장부 (''이면 그대로). 요약·현황표·명단이 모두 이것을 쓴다 */
export function filterByTier(club: Club, tierId: string): Club {
  if (!tierId) return club
  const members = club.members.filter((m) => m.tier_id === tierId)
  const ids = new Set(members.map((m) => m.id))
  return { ...club, members, payments: club.payments.filter((p) => ids.has(p.member_id)) }
}
