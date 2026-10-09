import type { NavItem } from '../lib/nav'

/** 메뉴만 있고 기능은 아직 없는 화면 */
export default function PlaceholderPage({ item }: { item: NavItem }) {
  const Icon = item.icon
  return (
    <>
      <header className="page-head">
        <h1>{item.label}</h1>
      </header>
      <div className="content">
        <div className="placeholder">
          <Icon size={28} aria-hidden="true" />
          <p>아직 준비 중인 메뉴입니다</p>
        </div>
      </div>
    </>
  )
}
