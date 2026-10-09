import { describe, expect, it } from 'vitest'
import {
  cellState,
  clubSummary,
  memberYear,
  membersInYear,
  mergePayments,
  paymentIndex,
  removePayment,
  sortMembers,
  yearMonths,
  type Club,
  type Member,
  type Payment,
  type Tier,
} from './club'

const full: Tier = { id: 't1', name: '정회원', monthly_fee: 10000, exempt: false }
const half: Tier = { id: 't2', name: '준회원', monthly_fee: null, exempt: false }
const free: Tier = { id: 't3', name: '면제', monthly_fee: 0, exempt: true }

const member = (id: string, extra: Partial<Member> = {}): Member => ({
  id,
  name: id,
  tier_id: 't1',
  joined: '2026-01',
  status: 'active',
  status_since: null,
  memo: null,
  ...extra,
})

const paid = (member_id: string, month: string, amount = 10000): Payment => ({
  member_id,
  month,
  kind: 'paid',
  amount,
  paid_on: null,
  method: 'bank',
  memo: null,
})

const NOW = '2026-10'

describe('cellState', () => {
  it('가입 전·탈퇴 뒤는 off, 지난 달 기록 없음은 unpaid, 다음 달은 future', () => {
    const m = member('a', { joined: '2026-03' })
    expect(cellState(m, full, '2026-02', undefined, NOW)).toBe('off')
    expect(cellState(m, full, '2026-03', undefined, NOW)).toBe('unpaid')
    expect(cellState(m, full, NOW, undefined, NOW)).toBe('unpaid')
    expect(cellState(m, full, '2026-11', undefined, NOW)).toBe('future')
    const left = member('b', { status: 'left', status_since: '2026-06' })
    expect(cellState(left, full, '2026-05', undefined, NOW)).toBe('unpaid')
    expect(cellState(left, full, '2026-06', undefined, NOW)).toBe('off')
  })

  it('기록이 있으면 그 종류, 면제 구분은 기록 없이도 면제', () => {
    const m = member('a')
    expect(cellState(m, full, '2026-12', paid('a', '2026-12'), NOW)).toBe('paid')
    expect(cellState(m, free, '2026-05', undefined, NOW)).toBe('exempt')
    expect(cellState(m, full, '2026-05', { ...paid('a', '2026-05'), kind: 'exempt' }, NOW)).toBe('exempt')
  })
})

describe('memberYear', () => {
  it('미납 개월 수와 금액, 금액 미정이면 null', () => {
    const index = paymentIndex([paid('a', '2026-01'), paid('a', '2026-02')])
    const y = memberYear(member('a'), full, 2026, index, NOW)
    expect(y.cells).toHaveLength(12)
    expect(y.unpaidMonths).toBe(8) // 3~10월
    expect(y.unpaidAmount).toBe(80000)
    expect(memberYear(member('b', { tier_id: 't2' }), half, 2026, index, NOW).unpaidAmount).toBeNull()
    expect(memberYear(member('c', { joined: '2026-11' }), half, 2026, index, NOW).unpaidAmount).toBe(0)
  })
})

describe('clubSummary', () => {
  it('이번 달 납부 수·걷힌 금액·올해 미납 합계', () => {
    const club: Club = {
      tiers: [full, half, free],
      members: [
        member('a', { joined: '2026-10' }),
        member('b', { joined: '2026-09' }),
        member('c', { tier_id: 't3' }),
        member('d', { tier_id: 't2', joined: '2026-10' }),
        member('e', { status: 'left', status_since: '2026-10', joined: '2026-09' }),
      ],
      payments: [paid('a', '2026-10', 10000), paid('e', '2026-09', 10000)],
    }
    const s = clubSummary(club, 2026, NOW)
    expect(s.dueThisMonth).toBe(3) // a, b, d (c 면제, e 탈퇴)
    expect(s.paidThisMonth).toBe(1)
    expect(s.collectedThisMonth).toBe(10000)
    expect(s.unpaidYear).toBe(20000) // b 9·10월
    expect(s.unpaidUnknown).toBe(true) // d 금액 미정
  })
})

describe('membersInYear / sortMembers', () => {
  it('그 해에 회원이었던 사람만, 활동 → 휴면 → 탈퇴 순', () => {
    const club: Club = {
      tiers: [full],
      members: [
        member('하', { status: 'left', status_since: '2025-05', joined: '2025-01' }),
        member('나'),
        member('가', { status: 'paused', status_since: '2026-05' }),
        member('다', { joined: '2027-01' }),
      ],
      payments: [],
    }
    expect(membersInYear(club, 2026).map((m) => m.id)).toEqual(['나', '가'])
    expect(sortMembers(club.members).map((m) => m.id)).toEqual(['나', '다', '가', '하'])
  })
})

describe('mergePayments / removePayment', () => {
  it('같은 칸은 바꾸고 새 칸은 더한다', () => {
    const merged = mergePayments([paid('a', '2026-02'), paid('a', '2026-01')], [paid('a', '2026-02', 5000), paid('b', '2026-01')])
    expect(merged.map((p) => `${p.member_id}${p.month}${p.amount}`)).toEqual(['a2026-0110000', 'b2026-0110000', 'a2026-025000'])
    expect(removePayment(merged, 'a', '2026-01')).toHaveLength(2)
  })

  it('yearMonths', () => {
    expect(yearMonths(2026)[0]).toBe('2026-01')
    expect(yearMonths(2026)[11]).toBe('2026-12')
  })
})
