import { ExternalLink, Pencil, Plus, X } from 'lucide-react'
import { useState } from 'react'
import type { StoreGroup } from '../lib/stores'
import type { Store } from '../lib/types'

type Props = {
  /** null이면 불러오는 중 */
  groups: StoreGroup[] | null
  error: string | null
  /** 지금 거르고 있는 스토어 열쇠. ''이면 없음 */
  active: string
  onPick: (key: string) => void
  onAdd: () => void
  onEdit: (store: Store) => void
  onDelete: (store: Store) => Promise<void>
}

/** 왼쪽 스토어 바로가기. 이름을 누르면 새 탭에서 스토어가 열리고, 숫자를 누르면 그 스토어 게임으로 거른다. */
export default function StoreSidebar({ groups, error, active, onPick, onAdd, onEdit, onDelete }: Props) {
  const [editing, setEditing] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function remove(store: Store) {
    setBusy(true)
    try {
      await onDelete(store)
      setConfirmId(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="store-sidebar" aria-label="스토어 바로가기">
      <header className="store-head">
        <h2>스토어</h2>
        {groups && (
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              setEditing((v) => !v)
              setConfirmId(null)
            }}
          >
            {editing ? '완료' : '편집'}
          </button>
        )}
      </header>

      {error && <p className="store-status bad">불러오지 못했습니다 ({error})</p>}
      {!error && !groups && <p className="store-status">불러오는 중…</p>}
      {groups?.length === 0 && <p className="store-status">스토어가 없습니다. 편집에서 추가하세요.</p>}

      {groups?.map((group) => (
        <section key={group.name} className="store-group">
          <h3>{group.name}</h3>
          <ul>
            {group.rows.map(({ store, key, count }) => {
              const isActive = key !== null && key === active
              return (
                <li key={store.id} className={`store-row ${isActive ? 'active' : ''}`}>
                  {confirmId === store.id ? (
                    <div className="store-confirm" role="alert">
                      <span>'{store.name}' 지울까요?</span>
                      <button type="button" className="danger" onClick={() => void remove(store)} disabled={busy}>
                        삭제
                      </button>
                      <button type="button" onClick={() => setConfirmId(null)} disabled={busy}>
                        취소
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="store-main">
                        <a className="store-link" href={store.url} target="_blank" rel="noopener noreferrer" title={store.url}>
                          {store.name}
                          <ExternalLink className="store-ext" size={11} aria-hidden="true" />
                        </a>
                        {store.memo && <span className="store-memo">{store.memo}</span>}
                      </div>
                      {editing ? (
                        <span className="store-tools">
                          <button type="button" className="icon-btn" aria-label={`${store.name} 고치기`} onClick={() => onEdit(store)}>
                            <Pencil size={13} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="icon-btn"
                            aria-label={`${store.name} 지우기`}
                            onClick={() => setConfirmId(store.id)}
                          >
                            <X size={14} aria-hidden="true" />
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="store-count"
                          aria-pressed={isActive}
                          aria-label={`내 게임 중 ${store.name} 것 ${count}개만 보기`}
                          title={isActive ? '다시 누르면 전체 보기' : '내 게임 중 이 스토어 것만 보기'}
                          disabled={!key || (count === 0 && !isActive)}
                          onClick={() => key && onPick(isActive ? '' : key)}
                        >
                          {count}
                        </button>
                      )}
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      ))}

      {editing && (
        <button type="button" className="store-add" onClick={onAdd}>
          <Plus size={14} aria-hidden="true" /> 스토어 추가
        </button>
      )}
      {groups && groups.length > 0 && !editing && <p className="store-hint">숫자: 판매 링크가 그 스토어인 내 게임 수 (누르면 거르기)</p>}
    </section>
  )
}
