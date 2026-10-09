import { Dices } from 'lucide-react'
import { Link } from 'react-router'

/** 화면 맨 위 상단바. 오른쪽 칸은 나중에 넣을 기능 자리로 비워 둔다. */
export default function AppBar() {
  return (
    <header className="appbar">
      <Link to="/" className="appbar-brand">
        <span className="brand-mark" aria-hidden="true">
          <Dices size={18} />
        </span>
        <span className="brand-name">내 보드게임</span>
      </Link>
      <div className="appbar-slot" />
    </header>
  )
}
