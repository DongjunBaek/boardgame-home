import { describe, expect, it } from 'vitest'
import type { Member, Payment } from './club'
import { buildRows, categoryOptions, duesLines, filterRows, monthsLabel, totals, type LedgerEntry } from './ledger'

const member = (id: string, name: string): Member => ({
  id,
  name,
  tier_id: 't1',
  joined: '2026-03',
  status: 'active',
  status_since: null,
  memo: null,
})

const pay = (member_id: string, month: string, paid_on: string | null, amount = 2000, kind: Payment['kind'] = 'paid'): Payment => ({
  member_id,
  month,
  kind,
  amount: kind === 'paid' ? amount : null,
  paid_on,
  method: 'bank',
  memo: null,
})

const entry = (id: string, date: string, kind: LedgerEntry['kind'], amount: number, category: string | null = null): LedgerEntry => ({
  id,
  date,
  kind,
  amount,
  category,
  description: id,
  memo: null,
})

describe('monthsLabel', () => {
  it('이어진 달은 범위, 아니면 점으로', () => {
    expect(monthsLabel(['2026-10'])).toBe('10월')
    expect(monthsLabel(['2026-05', '2026-03', '2026-04'])).toBe('3~5월')
    expect(monthsLabel(['2026-03', '2026-05'])).toBe('3·5월')
    expect(monthsLabel(['2026-12', '2027-01'])).toBe('2026-12~2027-01')
  })
})

describe('duesLines', () => {
  it('같은 회원·같은 날 여러 달은 한 줄, 면제·낸 날 없음 처리', () => {
    const members = [member('a', '김철수'), member('b', '이영희')]
    const payments = [
      pay('a', '2026-03', '2026-10-05'),
      pay('a', '2026-04', '2026-10-05'),
      pay('a', '2026-05', '2026-10-05'),
      pay('b', '2026-03', null, 5000),
      pay('b', '2026-04', null, 5000),
      pay('b', '2026-05', null, 5000, 'exempt'),
    ]
    const lines = duesLines({ members, payments })
    expect(lines.map((l) => [l.date, l.description, l.amount, l.memo !== null])).toEqual([
      ['2026-10-05', '김철수 3~5월 회비', 6000, false],
      ['2026-03-01', '이영희 3월 회비', 5000, true],
      ['2026-04-01', '이영희 4월 회비', 5000, true],
    ])
    expect(lines.every((l) => l.kind === 'in' && l.category === '회비' && l.fromDues)).toBe(true)
  })
})

describe('buildRows / filterRows / totals', () => {
  const dues = duesLines({ members: [member('a', '김철수')], payments: [pay('a', '2026-10', '2026-10-01', 10000)] })
  const rows = buildRows(
    [entry('간식', '2026-10-01', 'out', 3000, '간식·식비'), entry('후원', '2026-09-20', 'in', 50000), entry('게임', '2026-11-02', 'out', 40000, '게임 구매')],
    dues,
  )

  it('날짜순, 같은 날은 입금 먼저, 잔액은 0원부터 누적', () => {
    expect(rows.map((r) => [r.description, r.balance])).toEqual([
      ['후원', 50000],
      ['김철수 10월 회비', 60000],
      ['간식', 57000],
      ['게임', 17000],
    ])
    expect(rows[2].entry?.id).toBe('간식')
  })

  it('기간·입출금·분류로 거르고 합계', () => {
    const oct = filterRows(rows, { year: 2026, month: 10, kind: '', category: '' })
    expect(oct.map((r) => r.description)).toEqual(['김철수 10월 회비', '간식'])
    expect(totals(oct)).toEqual({ in: 10000, out: 3000 })
    expect(filterRows(rows, { year: 2026, month: 0, kind: 'out', category: '' })).toHaveLength(2)
    expect(filterRows(rows, { year: 2026, month: 0, kind: '', category: '회비' })).toHaveLength(1)
    expect(filterRows(rows, { year: 2025, month: 0, kind: '', category: '' })).toHaveLength(0)
  })

  it('분류 목록은 처음 목록 + 쓰인 분류', () => {
    const opts = categoryOptions([...rows, { ...rows[0], category: '후원금' }])
    expect(opts[0]).toBe('회비')
    expect(opts).toContain('후원금')
    expect(new Set(opts).size).toBe(opts.length)
  })
})
