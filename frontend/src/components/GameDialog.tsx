import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { createGame, deleteGame, updateGame } from '../lib/api'
import { diffInput, EMPTY_FORM, formFromGame, inputFromForm, isEmptyPatch, type GameForm } from '../lib/gameForm'
import { GENRES, type Game } from '../lib/types'
import PlayersInput from './PlayersInput'
import StarRating from './StarRating'

type Props = {
  /** null이면 새 게임 추가 */
  game: Game | null
  onClose: () => void
  onSaved: (game: Game, isNew: boolean) => void
  onDeleted: (game: Game) => void
}

const EXTRA_LABELS: Record<string, string> = {
  sale_status: '판매 상태',
  sellers: '판매처',
  funding_status: '펀딩 상태',
  funding_link: '펀딩 링크',
  release_date: '출시일',
  crawled_at: '정보 수집일',
}

const show = (v: unknown) => (Array.isArray(v) ? v.join(', ') : String(v))

/** 고칠 수 없는 참고 정보: [이름, 값] */
function referenceRows(g: Game): [string, string][] {
  return [
    ['ID', g.id],
    ['출처', g.source ?? '—'],
    ['추가일', g.mine.added_at?.slice(0, 10) ?? '—'],
    ...(g.tags.length ? [['태그', g.tags.join(', ')] as [string, string]] : []),
    ...Object.entries(g.extra).map(([k, v]): [string, string] => [EXTRA_LABELS[k] ?? k, show(v)]),
  ]
}

export default function GameDialog({ game, onClose, onSaved, onDeleted }: Props) {
  // 처음 값은 effect가 아니라 초기 state로 넣는다 (StrictMode에서 effect가 두 번 돌아도 안전)
  const [initial] = useState<GameForm>(() => (game ? formFromGame(game) : EMPTY_FORM))
  const [form, setForm] = useState<GameForm>(initial)
  const [errors, setErrors] = useState<string[]>([])
  const [confirm, setConfirm] = useState<'close' | 'delete' | null>(null)
  const [busy, setBusy] = useState(false)

  const dirty = JSON.stringify(form) !== JSON.stringify(initial)
  const set = <K extends keyof GameForm>(key: K, value: GameForm[K]) => setForm((f) => ({ ...f, [key]: value }))
  const tryClose = () => (dirty ? setConfirm('close') : onClose())

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) {
        if (confirm) setConfirm(null)
        else if (dirty) setConfirm('close')
        else onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [busy, confirm, dirty, onClose])

  async function save() {
    const result = inputFromForm(form)
    if ('errors' in result) return setErrors(result.errors)
    setBusy(true)
    setErrors([])
    try {
      if (game) {
        const before = inputFromForm(initial)
        const patch = 'input' in before ? diffInput(before.input, result.input) : result.input
        if (isEmptyPatch(patch)) return onClose()
        onSaved(await updateGame(game.id, patch), false)
      } else {
        onSaved(await createGame(result.input), true)
      }
    } catch (e) {
      setErrors([(e as Error).message])
      setBusy(false)
    }
  }

  async function remove() {
    if (!game) return
    setBusy(true)
    try {
      await deleteGame(game.id)
      onDeleted(game)
    } catch (e) {
      setErrors([(e as Error).message])
      setConfirm(null)
      setBusy(false)
    }
  }

  const field = (label: string, control: ReactNode, wide = false) => (
    <label className={`field ${wide ? 'wide' : ''}`}>
      <span className="field-label">{label}</span>
      {control}
    </label>
  )

  return createPortal(
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && !busy && tryClose()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        <header className="dialog-head">
          <h2 id="dialog-title">{game ? game.title : '게임 추가'}</h2>
          <button type="button" className="icon-btn" aria-label="닫기" onClick={tryClose} disabled={busy}>
            ✕
          </button>
        </header>

        <form
          className="dialog-body"
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
        >
          {game?.images[0] && <img className="cover" src={game.images[0]} alt="" referrerPolicy="no-referrer" />}

          <section>
            <h3>게임 정보</h3>
            <div className="fields">
              {field('제목', <input autoFocus value={form.title} onChange={(e) => set('title', e.target.value)} />, true)}
              <div className="field wide">
                <span className="field-label">장르</span>
                <div className="checks">
                  {GENRES.map((g) => (
                    <label key={g}>
                      <input
                        type="checkbox"
                        checked={form.genres.includes(g)}
                        onChange={(e) =>
                          set('genres', e.target.checked ? [...form.genres, g] : form.genres.filter((x) => x !== g))
                        }
                      />
                      {g}
                    </label>
                  ))}
                </div>
              </div>
              <div className="field wide">
                <span className="field-label">인원</span>
                <PlayersInput rows={form.players} onChange={(rows) => set('players', rows)} />
              </div>
              {field(
                '시간(분)',
                <input inputMode="numeric" value={form.time} onChange={(e) => set('time', e.target.value)} placeholder="모름" />,
              )}
              {field(
                '정가(원, 할인 전)',
                <input inputMode="numeric" value={form.price} onChange={(e) => set('price', e.target.value)} placeholder="모름" />,
              )}
              {field('제작사', <input value={form.publisher} onChange={(e) => set('publisher', e.target.value)} />, true)}
              {field(
                '판매 링크',
                <span className="with-link">
                  <input value={form.saleLink} onChange={(e) => set('saleLink', e.target.value)} placeholder="https://" />
                  {/^https?:\/\//.test(form.saleLink.trim()) && (
                    <a href={form.saleLink.trim()} target="_blank" rel="noreferrer">
                      열기
                    </a>
                  )}
                </span>,
                true,
              )}
            </div>
          </section>

          <section>
            <h3>내 정보</h3>
            <div className="fields">
              {field(
                '개수',
                <input type="number" min={1} value={form.quantity} onChange={(e) => set('quantity', e.target.value)} />,
              )}
              <div className="field">
                <span className="field-label">해봤음</span>
                <label className="checks">
                  <input type="checkbox" checked={form.played} onChange={(e) => set('played', e.target.checked)} />
                  해본 게임
                </label>
              </div>
              <div className="field wide">
                <span className="field-label">별점</span>
                <StarRating value={form.rating} onChange={(v) => set('rating', v)} />
              </div>
              {field('후기', <textarea rows={2} value={form.review} onChange={(e) => set('review', e.target.value)} />, true)}
              {field('메모', <textarea rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} />, true)}
              {field(
                '구입일',
                <input type="date" value={form.purchaseDate} onChange={(e) => set('purchaseDate', e.target.value)} />,
              )}
              {field(
                '구매가격(원)',
                <input inputMode="numeric" value={form.purchasePaid} onChange={(e) => set('purchasePaid', e.target.value)} />,
              )}
              {field('산 곳', <input value={form.purchaseShop} onChange={(e) => set('purchaseShop', e.target.value)} />, true)}
            </div>
          </section>

          {game && (
            <section>
              <h3>기타 정보 (참고용)</h3>
              <dl className="extra">
                {referenceRows(game).map(([label, value]) => (
                  <div key={label} className="extra-row">
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {errors.length > 0 && (
            <ul className="errors" role="alert">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}

          <footer className="dialog-foot">
            {confirm === 'delete' ? (
              <div className="confirm" role="alert">
                <span>'{game?.title}'을(를) 목록에서 지울까요? 직전 상태는 백업에 남습니다.</span>
                <button type="button" className="danger" onClick={() => void remove()} disabled={busy}>
                  삭제
                </button>
                <button type="button" onClick={() => setConfirm(null)} disabled={busy}>
                  취소
                </button>
              </div>
            ) : confirm === 'close' ? (
              <div className="confirm" role="alert">
                <span>저장하지 않은 변경이 있습니다.</span>
                <button type="button" className="danger" onClick={onClose}>
                  버리고 닫기
                </button>
                <button type="button" onClick={() => setConfirm(null)}>
                  계속 편집
                </button>
              </div>
            ) : (
              <>
                {game && (
                  <button type="button" className="danger-text" onClick={() => setConfirm('delete')} disabled={busy}>
                    삭제
                  </button>
                )}
                <span className="spacer" />
                <button type="button" onClick={tryClose} disabled={busy}>
                  취소
                </button>
                <button type="submit" className="primary" disabled={busy || (game !== null && !dirty)}>
                  {busy ? '저장 중…' : game ? '저장' : '추가'}
                </button>
              </>
            )}
          </footer>
        </form>
      </div>
    </div>,
    document.body,
  )
}
