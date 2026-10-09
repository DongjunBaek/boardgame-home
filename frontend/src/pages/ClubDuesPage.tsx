import { Check, ChevronLeft, ChevronRight, Grid3x3, Plus, Settings2, UserPlus, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import MemberDialog from '../components/club/MemberDialog'
import PaymentDialog from '../components/club/PaymentDialog'
import TierDialog from '../components/club/TierDialog'
import Toast, { type Notice } from '../components/Toast'
import { fetchClub } from '../lib/api'
import {
  clubSummary,
  filterByTier,
  findPayment,
  memberYear,
  membersInYear,
  mergePayments,
  METHOD_LABEL,
  monthLabel,
  monthOf,
  removePayment,
  sortMembers,
  STATUS_LABEL,
  tierTabs,
  yearMonths,
  type CellState,
  type Club,
  type Member,
  type Tier,
  paymentIndex,
} from '../lib/club'
import { formatPrice } from '../lib/format'

type Props = {
  notice: Notice | null
  notify: (n: Notice) => void
  onCloseNotice: () => void
}

type Tab = 'grid' | 'members'
type Load = { kind: 'loading' } | { kind: 'ok'; club: Club } | { kind: 'error'; message: string }
type PaymentTarget = { member: Member; month: string }

const won = (n: number) => formatPrice(n) ?? ''

/** 동아리 회비 관리: 납부 현황표(회원 × 달)와 회원 명단. 혼자 쓰는 장부다 (docs/features/club-dues.md) */
export default function ClubDuesPage({ notice, notify, onCloseNotice }: Props) {
  // 이번 달은 화면을 연 때 한 번 정한다 (그리는 동안 바뀌지 않게)
  const [current] = useState(() => monthOf(new Date()))
  const [load, setLoad] = useState<Load>({ kind: 'loading' })
  const [tab, setTab] = useState<Tab>('grid')
  /** 구분 탭: 고른 구분의 회원만 본다. ''이면 전체 */
  const [tierFilter, setTierFilter] = useState('')
  const [year, setYear] = useState(() => Number(current.slice(0, 4)))
  const [paymentTarget, setPaymentTarget] = useState<PaymentTarget | null>(null)
  const [memberDialog, setMemberDialog] = useState<Member | 'new' | null>(null)
  const [tierDialog, setTierDialog] = useState<Tier | 'new' | null>(null)

  useEffect(() => {
    fetchClub()
      .then((club) => setLoad({ kind: 'ok', club }))
      .catch((e: Error) => setLoad({ kind: 'error', message: e.message }))
  }, [])

  const fullClub = load.kind === 'ok' ? load.club : null
  const club = useMemo(() => (fullClub ? filterByTier(fullClub, tierFilter) : null), [fullClub, tierFilter])
  const tabs = useMemo(() => (fullClub ? tierTabs(fullClub, tierFilter) : []), [fullClub, tierFilter])
  const update = (fn: (c: Club) => Club) => setLoad((l) => (l.kind === 'ok' ? { kind: 'ok', club: fn(l.club) } : l))

  const tierOf = useMemo(() => new Map(fullClub?.tiers.map((t) => [t.id, t])), [fullClub])
  const index = useMemo(() => paymentIndex(club?.payments ?? []), [club])
  const rows = useMemo(() => (club ? membersInYear(club, year) : []), [club, year])
  const summary = useMemo(() => (club ? clubSummary(club, year, current) : null), [club, year, current])
  const months = yearMonths(year)

  return (
    <>
      <header className="page-head">
        <h1>동아리 회비 관리</h1>
        {summary && club && fullClub && fullClub.members.length > 0 && (
          <p className="summary">
            <span className="summary-pill">
              {monthLabel(current)} 납부{' '}
              <b>
                {summary.paidThisMonth}/{summary.dueThisMonth}
              </b>
              명
            </span>
            <span className="summary-pill">
              {monthLabel(current)} 걷힘 <b>{won(summary.collectedThisMonth)}</b>
            </span>
            <span className="summary-pill">
              {year}년 미납 <b>{won(summary.unpaidYear)}</b>
              {summary.unpaidUnknown && ' + 금액 미정'}
            </span>
          </p>
        )}
        {fullClub && (
          <div className="page-actions">
            <button type="button" className="primary with-icon" onClick={() => setMemberDialog('new')}>
              <UserPlus size={15} aria-hidden="true" />
              회원 추가
            </button>
          </div>
        )}
      </header>

      <div className="content">
        {load.kind === 'loading' && <p className="status">불러오는 중…</p>}
        {load.kind === 'error' && <p className="status bad">회비 장부를 불러오지 못했습니다 ({load.message})</p>}
        {club && (
          <>
            <div className="tab-row">
              <div className="genre-tabs" role="tablist" aria-label="회비 구분">
                {tabs.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    role="tab"
                    aria-selected={tierFilter === t.key}
                    className={`genre-tab ${tierFilter === t.key ? 'active' : ''}`}
                    onClick={() => setTierFilter(t.key)}
                  >
                    {t.label} <span className="tab-count">{t.count}</span>
                  </button>
                ))}
              </div>
              <div className="tab-tools">
                <div className="seg" role="group" aria-label="보기">
                  <button type="button" aria-pressed={tab === 'grid'} onClick={() => setTab('grid')}>
                    <Grid3x3 size={14} aria-hidden="true" />
                    현황표
                  </button>
                  <button type="button" aria-pressed={tab === 'members'} onClick={() => setTab('members')}>
                    <Users size={14} aria-hidden="true" />
                    회원
                  </button>
                </div>
                {tab === 'grid' && (
                  <div className="year-pick">
                    <button type="button" className="icon-btn" aria-label="지난해" onClick={() => setYear((y) => y - 1)}>
                      <ChevronLeft size={16} aria-hidden="true" />
                    </button>
                    <span>{year}년</span>
                    <button type="button" className="icon-btn" aria-label="다음 해" onClick={() => setYear((y) => y + 1)}>
                      <ChevronRight size={16} aria-hidden="true" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {fullClub!.members.length === 0 ? (
              <div className="placeholder">
                <UserPlus size={28} aria-hidden="true" />
                <p>회원을 추가하면 납부 현황표가 생깁니다</p>
                <button type="button" className="primary with-icon" onClick={() => setMemberDialog('new')}>
                  <Plus size={15} aria-hidden="true" />
                  회원 추가
                </button>
              </div>
            ) : tab === 'grid' ? (
              <div className="table-wrap">
                <table className="game-table dues-table">
                  <thead>
                    <tr>
                      <th className="col-name">이름</th>
                      <th>구분</th>
                      {months.map((m) => (
                        <th key={m} className={`center ${m === current ? 'is-current' : ''}`}>
                          {monthLabel(m)}
                        </th>
                      ))}
                      <th className="num">미납</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 && (
                      <tr>
                        <td colSpan={15} className="empty">
                          {year}년에 회원이었던 사람이 없습니다
                        </td>
                      </tr>
                    )}
                    {rows.map((m) => {
                      const tier = tierOf.get(m.tier_id)
                      const y = memberYear(m, tier, year, index, current)
                      return (
                        <tr key={m.id} className={m.status === 'active' ? '' : 'is-inactive'}>
                          <td className="col-name">
                            <button type="button" className="cell-link" onClick={() => setMemberDialog(m)}>
                              {m.name}
                            </button>
                            {m.status !== 'active' && <span className="status-tag">{STATUS_LABEL[m.status]}</span>}
                          </td>
                          <td className="muted-cell">{tier?.name ?? '—'}</td>
                          {y.cells.map((c) => (
                            <td key={c.month} className={`dues-td ${c.month === current ? 'is-current' : ''}`}>
                              <DuesCell
                                state={c.state}
                                title={cellTitle(m, c.month, c.state, c.payment)}
                                onClick={() => setPaymentTarget({ member: m, month: c.month })}
                              />
                            </td>
                          ))}
                          <td className="num">
                            {y.unpaidMonths === 0 ? (
                              <span className="blank">—</span>
                            ) : (
                              <span className="unpaid-total">
                                {y.unpaidMonths}개월{y.unpaidAmount !== null && ` · ${won(y.unpaidAmount)}`}
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <MembersTab club={fullClub!} members={club.members} onOpenMember={setMemberDialog} onOpenTier={setTierDialog} />
            )}
          </>
        )}
      </div>

      <div className="dock dock-toast">{notice && <Toast notice={notice} onClose={onCloseNotice} />}</div>

      {fullClub && paymentTarget && (
        <PaymentDialog
          member={paymentTarget.member}
          tier={tierOf.get(paymentTarget.member.tier_id)}
          month={paymentTarget.month}
          payment={findPayment(index, paymentTarget.member.id, paymentTarget.month)}
          onClose={() => setPaymentTarget(null)}
          onSaved={(written) => {
            update((c) => ({ ...c, payments: mergePayments(c.payments, written) }))
            setPaymentTarget(null)
            const first = written[0]
            notify({
              kind: 'ok',
              text: `${paymentTarget.member.name} ${monthLabel(first.month)}${written.length > 1 ? `부터 ${written.length}개월` : ''} ${first.kind === 'paid' ? '납부' : '면제'} 기록했습니다`,
            })
          }}
          onDeleted={() => {
            update((c) => ({ ...c, payments: removePayment(c.payments, paymentTarget.member.id, paymentTarget.month) }))
            setPaymentTarget(null)
            notify({ kind: 'ok', text: `${paymentTarget.member.name} ${monthLabel(paymentTarget.month)} 기록을 지웠습니다` })
          }}
        />
      )}

      {fullClub && memberDialog && (
        <MemberDialog
          member={memberDialog === 'new' ? null : memberDialog}
          tiers={fullClub.tiers}
          currentMonth={current}
          onClose={() => setMemberDialog(null)}
          onSaved={(member, isNew) => {
            update((c) => ({ ...c, members: isNew ? [...c.members, member] : c.members.map((m) => (m.id === member.id ? member : m)) }))
            setMemberDialog(null)
            notify({ kind: 'ok', text: `회원 '${member.name}' ${isNew ? '추가' : '저장'}했습니다` })
          }}
          onDeleted={(member) => {
            update((c) => ({ ...c, members: c.members.filter((m) => m.id !== member.id) }))
            setMemberDialog(null)
            notify({ kind: 'ok', text: `회원 '${member.name}' 지웠습니다` })
          }}
        />
      )}

      {fullClub && tierDialog && (
        <TierDialog
          tier={tierDialog === 'new' ? null : tierDialog}
          onClose={() => setTierDialog(null)}
          onSaved={(tier, isNew) => {
            update((c) => ({ ...c, tiers: isNew ? [...c.tiers, tier] : c.tiers.map((t) => (t.id === tier.id ? tier : t)) }))
            setTierDialog(null)
            notify({ kind: 'ok', text: `구분 '${tier.name}' ${isNew ? '추가' : '저장'}했습니다` })
          }}
          onDeleted={(tier) => {
            update((c) => ({ ...c, tiers: c.tiers.filter((t) => t.id !== tier.id) }))
            if (tierFilter === tier.id) setTierFilter('')
            setTierDialog(null)
            notify({ kind: 'ok', text: `구분 '${tier.name}' 지웠습니다` })
          }}
        />
      )}
    </>
  )
}

function cellTitle(member: Member, month: string, state: CellState, payment: ReturnType<typeof findPayment>): string {
  const head = `${member.name} ${monthLabel(month)}`
  if (state === 'paid' && payment) {
    const parts = [won(payment.amount ?? 0), payment.paid_on, payment.method && METHOD_LABEL[payment.method], payment.memo]
    return `${head}: 납부 (${parts.filter(Boolean).join(' · ')})`
  }
  const label: Record<CellState, string> = { paid: '납부', exempt: '면제', unpaid: '미납', future: '미리 내기', off: '회원 아님' }
  return `${head}: ${label[state]}${payment?.memo ? ` · ${payment.memo}` : ''}`
}

function DuesCell({ state, title, onClick }: { state: CellState; title: string; onClick: () => void }) {
  return (
    <button type="button" className={`dues-cell ${state}`} title={title} aria-label={title} onClick={onClick}>
      {state === 'paid' && <Check size={15} aria-hidden="true" />}
      {state === 'exempt' && '면제'}
      {state === 'unpaid' && '미납'}
    </button>
  )
}

function MembersTab({
  club,
  members,
  onOpenMember,
  onOpenTier,
}: {
  /** 구분 상자는 전체 장부로 센다 */
  club: Club
  /** 표에 보일 회원 (구분 탭으로 거른 것) */
  members: Member[]
  onOpenMember: (m: Member) => void
  onOpenTier: (t: Tier | 'new') => void
}) {
  const tierOf = new Map(club.tiers.map((t) => [t.id, t]))
  const counts = new Map<string, number>()
  for (const m of club.members) counts.set(m.tier_id, (counts.get(m.tier_id) ?? 0) + 1)

  return (
    <div className="members-tab">
      <div className="table-wrap">
        <table className="game-table">
          <thead>
            <tr>
              <th className="col-name">이름</th>
              <th>구분</th>
              <th>가입 월</th>
              <th>상태</th>
              <th>메모</th>
            </tr>
          </thead>
          <tbody>
            {sortMembers(members).map((m) => (
              <tr key={m.id} className={m.status === 'active' ? '' : 'is-inactive'}>
                <td className="col-name">
                  <button type="button" className="cell-link" onClick={() => onOpenMember(m)}>
                    {m.name}
                  </button>
                </td>
                <td>{tierOf.get(m.tier_id)?.name ?? '—'}</td>
                <td>{m.joined}</td>
                <td>
                  {STATUS_LABEL[m.status]}
                  {m.status_since && <span className="muted-cell"> ({m.status_since}부터)</span>}
                </td>
                <td className="muted-cell">{m.memo ?? <span className="blank">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="tier-box" aria-label="회비 구분">
        <header>
          <h2>
            <Settings2 size={14} aria-hidden="true" /> 회비 구분
          </h2>
          <button type="button" className="ghost-btn" onClick={() => onOpenTier('new')}>
            <Plus size={14} aria-hidden="true" />
            구분 추가
          </button>
        </header>
        <ul>
          {club.tiers.map((t) => (
            <li key={t.id}>
              <button type="button" className="tier-row" onClick={() => onOpenTier(t)}>
                <span className="tier-name">{t.name}</span>
                <span className="tier-fee">{t.exempt ? '면제' : t.monthly_fee === null ? '금액 미정' : `월 ${won(t.monthly_fee)}`}</span>
                <span className="tier-count">{counts.get(t.id) ?? 0}명</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
