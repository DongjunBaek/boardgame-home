import { useEffect, useState } from 'react'
import { fetchHealth } from './lib/api'

type ServerState = { kind: 'loading' } | { kind: 'ok' } | { kind: 'error'; message: string }

export default function App() {
  const [server, setServer] = useState<ServerState>({ kind: 'loading' })

  useEffect(() => {
    fetchHealth()
      .then(() => setServer({ kind: 'ok' }))
      .catch((e: Error) => setServer({ kind: 'error', message: e.message }))
  }, [])

  return (
    <div className="app">
      <header className="app-header">
        <h1>내 보드게임</h1>
        {server.kind === 'loading' && <p className="status">서버 확인 중…</p>}
        {server.kind === 'ok' && <p className="status ok">서버 연결됨</p>}
        {server.kind === 'error' && <p className="status bad">서버 연결 안 됨 ({server.message})</p>}
      </header>
    </div>
  )
}
