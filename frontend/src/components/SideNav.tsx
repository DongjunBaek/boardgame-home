import { ChevronDown, Store as StoreIcon } from 'lucide-react'
import { useState, type ComponentProps } from 'react'
import { NavLink } from 'react-router'
import { NAV, type NavItem } from '../lib/nav'
import StoreSidebar from './StoreSidebar'

// 스토어 목록이 길어 아래 메뉴를 가리므로 처음에는 접어 둔다
const STORE_OPEN_KEY = 'nav.storesOpen'

function readOpen(): boolean {
  try {
    return localStorage.getItem(STORE_OPEN_KEY) === '1'
  } catch {
    return false
  }
}

function Item({ item }: { item: NavItem }) {
  const Icon = item.icon
  return (
    <NavLink to={item.path} end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
      <Icon size={16} aria-hidden="true" />
      {item.label}
    </NavLink>
  )
}

/** 왼쪽 메뉴. 스토어는 주소 없이 이 안에서 펼쳐 바로가기 목록을 보여 준다. */
export default function SideNav({ stores }: { stores: ComponentProps<typeof StoreSidebar> }) {
  const [open, setOpen] = useState(readOpen)

  function toggle() {
    setOpen((v) => {
      try {
        localStorage.setItem(STORE_OPEN_KEY, v ? '0' : '1')
      } catch {
        // 저장이 막혀 있어도 펼치기는 된다
      }
      return !v
    })
  }

  return (
    <aside className="sidebar">
      <nav className="nav" aria-label="메뉴">
        <Item item={NAV.dashboard} />
        <Item item={NAV.games} />

        <button type="button" className="nav-item" aria-expanded={open} aria-controls="nav-stores" onClick={toggle}>
          <StoreIcon size={16} aria-hidden="true" />
          스토어
          <ChevronDown className={`nav-chevron ${open ? 'open' : ''}`} size={14} aria-hidden="true" />
        </button>
        {open && (
          <div id="nav-stores" className="nav-sub">
            <StoreSidebar {...stores} />
          </div>
        )}

        <Item item={NAV.dues} />
        <Item item={NAV.board} />
      </nav>

      <div className="nav-foot">
        <Item item={NAV.admin} />
      </div>
    </aside>
  )
}
