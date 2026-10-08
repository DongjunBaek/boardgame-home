import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { applyExcel, previewExcel } from '../lib/api'
import type { ExcelPreview, ExcelReport } from '../lib/types'

type Props = {
  file: File
  onClose: () => void
  onApplied: (report: ExcelReport) => void
}

type State =
  | { kind: 'checking' }
  | { kind: 'failed'; message: string }
  | { kind: 'ready'; preview: ExcelPreview; applying: boolean; message?: string }

/** 엑셀 올리기: 바뀔 내용을 먼저 보여 주고, [적용]을 눌러야 저장한다 */
export default function ExcelImportDialog({ file, onClose, onApplied }: Props) {
  const [state, setState] = useState<State>({ kind: 'checking' })

  useEffect(() => {
    let current = true // StrictMode에서 두 번 불려도 마지막 결과만 쓴다 (미리보기는 저장하지 않아 안전)
    previewExcel(file)
      .then((preview) => current && setState({ kind: 'ready', preview, applying: false }))
      .catch((e: Error) => current && setState({ kind: 'failed', message: e.message }))
    return () => {
      current = false
    }
  }, [file])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !(state.kind === 'ready' && state.applying)) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [state, onClose])

  async function apply(preview: ExcelPreview) {
    setState({ kind: 'ready', preview, applying: true })
    try {
      const { report } = await applyExcel(file, preview.base)
      onApplied(report)
    } catch (e) {
      setState({ kind: 'ready', preview, applying: false, message: (e as Error).message })
    }
  }

  const report = state.kind === 'ready' ? state.preview.report : null
  const canApply = report !== null && report.errors.length === 0 && report.changes.length > 0

  return createPortal(
    <div className="overlay">
      <div className="dialog dialog-wide" role="dialog" aria-modal="true" aria-labelledby="excel-title">
        <header className="dialog-head">
          <h2 id="excel-title">엑셀 올리기 미리보기</h2>
          <button type="button" className="icon-btn" aria-label="닫기" onClick={onClose}>
            ✕
          </button>
        </header>

        <div className="dialog-body">
          <p className="file-name">{file.name}</p>
          {state.kind === 'checking' && <p className="status">파일 확인 중…</p>}
          {state.kind === 'failed' && (
            <ul className="errors" role="alert">
              <li>{state.message}</li>
            </ul>
          )}

          {report && (
            <>
              <p className="import-counts">
                새 게임 <b>{report.counts.new}</b> · 바뀌는 게임 <b>{report.counts.updated}</b> · 그대로{' '}
                {report.counts.unchanged}
                {report.counts.not_in_file > 0 && <> · 엑셀에 없는 게임 {report.counts.not_in_file} (지우지 않음)</>}
              </p>

              {report.errors.length > 0 && (
                <div className="errors" role="alert">
                  <p>
                    <b>오류 {report.errors.length}건</b> — 오류가 있으면 적용할 수 없습니다. 엑셀을 고쳐 다시 올려 주세요.
                  </p>
                  <ul>
                    {report.errors.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}

              {report.changes.length === 0 && report.errors.length === 0 && (
                <p className="status">바뀔 내용이 없습니다.</p>
              )}

              {report.changes.map((c) => (
                <section key={c.id} className="change">
                  <h3>
                    {c.kind === 'new' && <span className="chip chip-new">새 게임</span>}
                    {c.title} <span className="sub">({c.row}행)</span>
                  </h3>
                  <table className="change-table">
                    <tbody>
                      {c.fields.map((f) => (
                        <tr key={f.field}>
                          <th>{f.field}</th>
                          {c.kind === 'update' && <td className="before">{f.before}</td>}
                          {c.kind === 'update' && <td className="arrow">→</td>}
                          <td className="after">{f.after}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              ))}
            </>
          )}

          {state.kind === 'ready' && state.message && (
            <ul className="errors" role="alert">
              <li>{state.message}</li>
            </ul>
          )}

          <footer className="dialog-foot">
            <span className="hint">적용하기 전 상태는 자동으로 백업됩니다.</span>
            <span className="spacer" />
            <button type="button" onClick={onClose} disabled={state.kind === 'ready' && state.applying}>
              {canApply ? '취소' : '닫기'}
            </button>
            {canApply && state.kind === 'ready' && (
              <button
                type="button"
                className="primary"
                onClick={() => void apply(state.preview)}
                disabled={state.applying || !!state.message}
              >
                {state.applying ? '적용 중…' : `적용 (${report.changes.length}개 게임)`}
              </button>
            )}
          </footer>
        </div>
      </div>
    </div>,
    document.body,
  )
}
