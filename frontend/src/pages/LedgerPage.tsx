import { ArrowDownLeft, ArrowUpRight, BookOpen, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import EntryDialog from '../components/club/EntryDialog'
import Toast, { type Notice } from '../components/Toast'
import { fetchClub } from '../lib/api'
import type { Club } from '../lib/club'
import { formatPrice } from '../lib/format'
import {
  buildRows,
  categoryOptions,
  duesLines,
  filterRows,
  KIND_LABEL,
  totals,
  type EntryKind,
  type LedgerEntry,
  type LedgerRow,
} from '../lib/ledger'
import { NAV } from '../lib/nav'

type Props = {
  notice: Notice | null
  notify: (n: Notice) => void
  onCloseNotice: () => void
}

type Data = { club: Pick<Club, 'members' | 'payments'>; entries: LedgerEntry[] }
type Load = { kind: 'loading' } | { kind: 'ok'; data: Data } | { kind: 'error'; message: string }

const won = (n: number) => formatPrice(n) ?? ''
const KIND_TABS: { key: '' | EntryKind; label: string }[] = [
  { key: '', label: '전체' },
  { key: 'in', label: '입금' },
  { key: 'out', label: '출금' },
]

/** 동아리 회계록: 입금·출금과 잔액. 회비 납부는 자동으로 '회비' 입금 줄이 된다 (docs/features/ledger.md) */
export default function LedgerPage({ notice, notify, onCloseNotice }: Props) {
  const navigate = useNavigate()
  const [now] = useState(() => new Date())
  const [load, setLoad] = useState<Load>({ kind: 'loading' })
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(0)
  const [kind, setKind] = useState<'' | EntryKind>('')
  const [category, setCategory] = useState('')
  const [dialog, setDialog] = useState<LedgerEntry | 'new' | null>(null)

  useEffect(() => {
    fetchClub()
      .then(({ members, payments, ledger }) => setLoad({ kind: 'ok', data: { club: { members, payments }, entries: ledger } }))
      .catch((e: Error) => setLoad({ kind: 'error', message: e.message }))
  }, [])

  const data = load.kind === 'ok' ? load.data : null
  const setEntries = (fn: (list: LedgerEntry[]) => LedgerEntry[]) =>
    setLoad((l) => (l.kind === 'ok' ? { kind: 'ok', data: { ...l.data, entries: fn(l.data.entries) } } : l))

  const rows = useMemo(() => (data ? buildRows(data.entries, duesLines(data.club)) : []), [data])
  const periodRows = useMemo(() => filterRows(rows, { year, month, kind: '', category }), [rows, year, month, category])
  const shown = useMemo(() => periodRows.filter((r) => !kind || r.kind === kind).reverse(), [periodRows, kind])
  const sum = useMemo(() => totals(periodRows), [periodRows])
  const categories = useMemo(() => categoryOptions(rows), [rows])
  const balance = rows.length ? rows[rows.length - 1].balance : 0
  const period = month ? `${year}년 ${month}월` : `${year}년`

  function open(row: LedgerRow) {
    if (row.entry) setDialog(row.entry)
    else navigate(NAV.dues.path)
  }

  return (
    <>
      <header className="page-head">
        <h1>회계록</h1>
        {data && (
          <p className="summary">
            <span className="summary-pill">
              지금 잔액 <b>{won(balance)}</b>
            </span>
            <span className="summary-pill">
              {period} 입금 <b className="amt-in">{won(sum.in)}</b>
            </span>
            <span className="summary-pill">
              출금 <b className="amt-out">{won(sum.out)}</b>
            </span>
          </p>
        )}
        {data && (
          <div className="page-actions">
            <button type="button" className="primary with-icon" onClick={() => setDialog('new')}>
              <Plus size={15} aria-hidden="true" />
              입출금 기록
            </button>
          </div>
        )}
      </header>

      <div className="content">
        {load.kind === 'loading' && <p className="status">불러오는 중…</p>}
        {load.kind === 'error' && <p className="status bad">회계록을 불러오지 못했습니다 ({load.message})</p>}
        {data && (
          <>
            <div className="tab-row">
              <div className="genre-tabs" role="tablist" aria-label="입금·출금">
                {KIND_TABS.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    role="tab"
                    aria-selected={kind === t.key}
                    className={`genre-tab ${kind === t.key ? 'active' : ''}`}
                    onClick={() => setKind(t.key)}
                  >
                    {t.label} <span className="tab-count">{periodRows.filter((r) => !t.key || r.kind === t.key).length}</span>
                  </button>
                ))}
              </div>
              <div className="tab-tools">
                <select className={`pill pill-select ${category ? 'on' : ''}`} aria-label="분류" value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="">분류 전체</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <select className={`pill pill-select ${month ? 'on' : ''}`} aria-label="달" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                  <option value={0}>1년 전체</option>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      {m}월
                    </option>
                  ))}
                </select>
                <div className="year-pick">
                  <button type="button" className="icon-btn" aria-label="지난해" onClick={() => setYear((y) => y - 1)}>
                    <ChevronLeft size={16} aria-hidden="true" />
                  </button>
                  <span>{year}년</span>
                  <button type="button" className="icon-btn" aria-label="다음 해" onClick={() => setYear((y) => y + 1)}>
                    <ChevronRight size={16} aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>

            {rows.length === 0 ? (
              <div className="placeholder">
                <BookOpen size={28} aria-hidden="true" />
                <p>아직 기록이 없습니다. 회비 화면에서 납부를 적으면 여기 '회비' 입금으로 자동으로 보입니다</p>
                <button type="button" className="primary with-icon" onClick={() => setDialog('new')}>
                  <Plus size={15} aria-hidden="true" />
                  입출금 기록
                </button>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="game-table ledger-table">
                  <thead>
                    <tr>
                      <th>날짜</th>
                      <th>구분</th>
                      <th>분류</th>
                      <th className="col-desc">내용</th>
                      <th className="num">입금</th>
                      <th className="num">출금</th>
                      <th className="num">잔액</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.length === 0 && (
                      <tr>
                        <td colSpan={7} className="empty">
                          {period}에 맞는 기록이 없습니다
                        </td>
                      </tr>
                    )}
                    {shown.map((r) => (
                      <tr key={r.key} className="ledger-row" onClick={() => open(r)}>
                        <td className="muted-cell">{r.date}</td>
                        <td>
                          <span className={`kind-chip ${r.kind}`}>
                            {r.kind === 'in' ? <ArrowDownLeft size={12} aria-hidden="true" /> : <ArrowUpRight size={12} aria-hidden="true" />}
                            {KIND_LABEL[r.kind]}
                          </span>
                        </td>
                        <td className="muted-cell">{r.category ?? <span className="blank">—</span>}</td>
                        <td className="col-desc">
                          <button
                            type="button"
                            className="cell-link"
                            title={r.fromDues ? '회비 화면에서 고칩니다' : '고치기'}
                            onClick={(e) => {
                              e.stopPropagation()
                              open(r)
                            }}
                          >
                            {r.description}
                          </button>
                          {r.fromDues && <span className="status-tag">자동</span>}
                          {r.memo && <span className="row-memo">{r.memo}</span>}
                        </td>
                        <td className="num amt-in">{r.kind === 'in' ? won(r.amount) : ''}</td>
                        <td className="num amt-out">{r.kind === 'out' ? won(r.amount) : ''}</td>
                        <td className={`num ${r.balance < 0 ? 'amt-out' : ''}`}>{won(r.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      <div className="dock dock-toast">{notice && <Toast notice={notice} onClose={onCloseNotice} />}</div>

      {data && dialog && (
        <EntryDialog
          entry={dialog === 'new' ? null : dialog}
          categories={categories}
          onClose={() => setDialog(null)}
          onSaved={(entry, isNew) => {
            setEntries((list) => (isNew ? [...list, entry] : list.map((e) => (e.id === entry.id ? entry : e))))
            setDialog(null)
            notify({ kind: 'ok', text: `${KIND_LABEL[entry.kind]} '${entry.description}' ${won(entry.amount)} ${isNew ? '기록' : '저장'}했습니다` })
          }}
          onDeleted={(entry) => {
            setEntries((list) => list.filter((e) => e.id !== entry.id))
            setDialog(null)
            notify({ kind: 'ok', text: `'${entry.description}' 기록을 지웠습니다` })
          }}
        />
      )}
    </>
  )
}
