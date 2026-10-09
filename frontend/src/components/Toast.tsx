import { CircleAlert, CircleCheck, X } from 'lucide-react'

export type Notice = { kind: 'ok' | 'error'; text: string }

/** 화면 아래(.dock) 위에 뜨는 알림. 성공은 잠깐, 실패는 닫을 때까지 남는다 (App의 notify). */
export default function Toast({ notice, onClose }: { notice: Notice; onClose: () => void }) {
  return (
    <div className={`notice ${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>
      {notice.kind === 'ok' ? <CircleCheck size={16} aria-hidden="true" /> : <CircleAlert size={16} aria-hidden="true" />}
      <span>{notice.text}</span>
      <button type="button" className="icon-btn" aria-label="알림 닫기" onClick={onClose}>
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  )
}
