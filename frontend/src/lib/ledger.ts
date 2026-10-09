// 동아리 회계록: 직접 적은 입금·출금 + 회비 납부(자동 입금)를 날짜순으로 합치고 잔액을 계산한다.
// 서버는 직접 적은 기록만 저장한다 (backend/app/ledger.py). 회비는 회비 화면에서만 고친다.
import { monthLabel, type Club } from './club'

export type EntryKind = 'in' | 'out'
export type LedgerEntry = {
  id: string
  /** "2026-10-01" */
  date: string
  kind: EntryKind
  amount: number
  category: string | null
  description: string
  memo: string | null
}
export type EntryInput = Partial<Omit<LedgerEntry, 'id'>>

export const KIND_LABEL: Record<EntryKind, string> = { in: '입금', out: '출금' }
export const DUES_CATEGORY = '회비'
/** 분류 처음 목록. 직접 적은 분류도 함께 고를 수 있다 */
export const DEFAULT_CATEGORIES = [DUES_CATEGORY, '모임비', '간식·식비', '게임 구매', '장소 대여', '기타']

export type LedgerRow = {
  key: string
  date: string
  kind: EntryKind
  amount: number
  category: string | null
  description: string
  memo: string | null
  /** 직접 적은 기록이면 그 기록 (고치기 창에 쓴다) */
  entry?: LedgerEntry
  /** 회비 납부에서 온 줄이면 true (회비 화면에서 고친다) */
  fromDues?: boolean
  /** 이 줄까지 더한 잔액 */
  balance: number
}

/** ["2026-03", ..., "2026-10"] → "3~10월", 이어지지 않으면 "3·5월" */
export function monthsLabel(months: readonly string[]): string {
  const sorted = [...months].sort()
  if (sorted.length === 1) return monthLabel(sorted[0])
  const nums = sorted.map((m) => Number(m.slice(0, 4)) * 12 + Number(m.slice(5)))
  const sameYear = sorted.every((m) => m.slice(0, 4) === sorted[0].slice(0, 4))
  const consecutive = nums.every((n, i) => i === 0 || n === nums[i - 1] + 1)
  if (sameYear && consecutive) return `${Number(sorted[0].slice(5))}~${monthLabel(sorted[sorted.length - 1])}`
  if (consecutive) return `${sorted[0]}~${sorted[sorted.length - 1]}`
  return sameYear ? `${sorted.map((m) => Number(m.slice(5))).join('·')}월` : sorted.join('·')
}

type DuesLine = Omit<LedgerRow, 'balance'>

/**
 * 회비 납부 → 입금 줄. 같은 회원이 같은 날 낸 여러 달은 한 줄로 묶는다 ("김철수 3~10월 회비").
 * 낸 날이 없는 기록은 그 달 1일로 놓는다.
 */
export function duesLines(club: Pick<Club, 'members' | 'payments'>): DuesLine[] {
  const nameOf = new Map(club.members.map((m) => [m.id, m.name]))
  const groups = new Map<string, { memberId: string; date: string; noDate: boolean; months: string[]; amount: number }>()
  for (const p of club.payments) {
    if (p.kind !== 'paid' || !p.amount) continue
    const date = p.paid_on ?? `${p.month}-01`
    const key = `${p.member_id}|${date}|${p.paid_on ? '' : p.month}`
    const g = groups.get(key) ?? { memberId: p.member_id, date, noDate: !p.paid_on, months: [], amount: 0 }
    g.months.push(p.month)
    g.amount += p.amount
    groups.set(key, g)
  }
  return [...groups.entries()].map(([key, g]) => ({
    key: `dues|${key}`,
    date: g.date,
    kind: 'in',
    amount: g.amount,
    category: DUES_CATEGORY,
    description: `${nameOf.get(g.memberId) ?? '(지운 회원)'} ${monthsLabel(g.months)} 회비`,
    memo: g.noDate ? '낸 날 기록 없음 (그 달 1일로 표시)' : null,
    fromDues: true,
  }))
}

/** 직접 적은 기록 + 회비 줄을 날짜순(같은 날은 입금 먼저)으로 합치고 잔액을 더한다. 0원에서 시작 */
export function buildRows(entries: readonly LedgerEntry[], dues: readonly DuesLine[]): LedgerRow[] {
  const lines: DuesLine[] = [
    ...dues,
    ...entries.map((e) => ({
      key: e.id,
      date: e.date,
      kind: e.kind,
      amount: e.amount,
      category: e.category,
      description: e.description,
      memo: e.memo,
      entry: e,
    })),
  ]
  lines.sort((a, b) => a.date.localeCompare(b.date) || (a.kind === b.kind ? 0 : a.kind === 'in' ? -1 : 1) || a.key.localeCompare(b.key))
  let balance = 0
  return lines.map((l) => {
    balance += l.kind === 'in' ? l.amount : -l.amount
    return { ...l, balance }
  })
}

export type LedgerFilter = {
  year: number
  /** 0이면 그 해 전체 */
  month: number
  kind: '' | EntryKind
  category: string
}

export function filterRows(rows: readonly LedgerRow[], f: LedgerFilter): LedgerRow[] {
  const prefix = f.month ? `${f.year}-${String(f.month).padStart(2, '0')}` : `${f.year}-`
  return rows.filter(
    (r) => r.date.startsWith(prefix) && (!f.kind || r.kind === f.kind) && (!f.category || (r.category ?? '') === f.category),
  )
}

export function totals(rows: readonly LedgerRow[]): { in: number; out: number } {
  let income = 0
  let out = 0
  for (const r of rows) {
    if (r.kind === 'in') income += r.amount
    else out += r.amount
  }
  return { in: income, out }
}

/** 고를 수 있는 분류: 처음 목록 + 기록에 쓰인 분류 (중복 없이) */
export function categoryOptions(rows: readonly LedgerRow[]): string[] {
  const used = rows.map((r) => r.category).filter((c): c is string => !!c)
  return [...new Set([...DEFAULT_CATEGORIES, ...used])]
}
