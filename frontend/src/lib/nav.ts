import { Library, LayoutDashboard, MessageSquare, Shield, Wallet, type LucideIcon } from 'lucide-react'

export type NavItem = { path: string; label: string; icon: LucideIcon }

/** 사이드바 메뉴와 화면 주소. 스토어는 주소 없이 사이드바에서 펼치므로 따로 그린다. */
export const NAV = {
  dashboard: { path: '/', label: '대시보드', icon: LayoutDashboard },
  games: { path: '/games', label: '내 보드게임 목록', icon: Library },
  dues: { path: '/club/dues', label: '동아리 회비 관리', icon: Wallet },
  board: { path: '/board', label: '게시판', icon: MessageSquare },
  admin: { path: '/admin', label: '관리자 메뉴', icon: Shield },
} satisfies Record<string, NavItem>

/** 아직 기능이 없는 메뉴. '준비 중' 화면을 보여 준다 */
export const PLACEHOLDER_PAGES: NavItem[] = [NAV.dashboard, NAV.dues, NAV.board, NAV.admin]
