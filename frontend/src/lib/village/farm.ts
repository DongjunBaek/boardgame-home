// 밭 화면 계산. 코인 수는 서버가 정한다 (backend/app/village.py의 farm·harvest).
// 화면은 서버가 보낸 시각을 기준으로 1초마다 다시 세어 '쌓인 코인'과 '남은 시간'을 보여 줄 뿐이다.
import type { VillageState } from './state'

export type FarmNow = {
  pending: number
  /** 한도까지 쌓일 코인 */
  capCoins: number
  /** 0~1: 한도까지 얼마나 찼는지 (작물이 자라는 모습에 쓴다) */
  ratio: number
  /** 가득 차기까지 남은 밀리초 (가득 찼으면 0) */
  fullInMs: number
}

const HOUR = 3_600_000

/** 서버 시각과 이 컴퓨터 시각의 차이(ms). 응답을 받은 순간에 잰다 */
export const clockOffset = (state: VillageState, clientNow = Date.now()) => Date.parse(state.server_time) - clientNow

export function farmNow(state: VillageState, offsetMs: number, clientNow = Date.now()): FarmNow {
  const { rate_per_hour: rate, cap_hours: capHours } = state.farm
  const cap = capHours * HOUR
  const elapsed = Math.min(Math.max(clientNow + offsetMs - Date.parse(state.last_harvest), 0), cap)
  return {
    pending: Math.floor((elapsed * rate) / HOUR),
    capCoins: rate * capHours,
    ratio: elapsed / cap,
    fullInMs: cap - elapsed,
  }
}

/** 3시간 12분 / 12분 / 1분 미만 */
export function formatLeft(ms: number): string {
  const min = Math.floor(ms / 60_000)
  if (min < 1) return '1분 미만'
  const h = Math.floor(min / 60)
  const m = min % 60
  return h ? (m ? `${h}시간 ${m}분` : `${h}시간`) : `${m}분`
}

/** 작물 그림 단계 1~4: 한도의 1/4씩 찰 때마다 한 단계 자란다 */
export const growthStage = (ratio: number) => 1 + Math.min(3, Math.floor(ratio * 4))
