import { describe, expect, it } from 'vitest'
import {
  countsFromRows,
  diffInput,
  EMPTY_FORM,
  formFromGame,
  inputFromForm,
  isEmptyPatch,
  rowsFromCounts,
  type GameForm,
} from './gameForm'
import type { Game } from './types'

const GAME: Game = {
  id: 'manual:a',
  title: '딕싯',
  genres: ['보드게임'],
  player_count: ['3-8인'],
  play_time_minutes: 30,
  price: 59000,
  publisher: '코리아보드게임즈',
  sale_link: 'https://example.com/dixit',
  images: [],
  tags: [],
  source: 'manual',
  extra: {},
  mine: {
    quantity: 1,
    played: false,
    rating: null,
    review: null,
    notes: '메모',
    added_at: '2026-05-14T17:44:24',
    purchase: { date: null, paid: null, shop: null },
  },
}

function full(f: GameForm) {
  const r = inputFromForm(f)
  if ('errors' in r) throw new Error(r.errors.join())
  return r.input
}

describe('인원 줄 ↔ 표기', () => {
  it('표기를 고정/범위/GM 줄로 나눈다', () => {
    expect(rowsFromCounts(['4인', '2-4인', '5+gm', '모름'])).toEqual([
      { mode: 'fixed', min: '4', max: '' },
      { mode: 'range', min: '2', max: '4' },
      { mode: 'gm', min: '5', max: '' },
    ])
  })
  it('줄을 표기로 되돌린다', () => {
    expect(countsFromRows(rowsFromCounts(['4인', '2-4인', '5+gm']))).toEqual(['4인', '2-4인', '5+gm'])
  })
  it('잘못된 줄은 오류 글자', () => {
    expect(countsFromRows([{ mode: 'fixed', min: '', max: '' }])).toMatch('1 이상')
    expect(countsFromRows([{ mode: 'range', min: '4', max: '4' }])).toMatch('뒤의 숫자가 더 커야')
    expect(countsFromRows([{ mode: 'range', min: '4', max: '' }])).toMatch('뒤의 숫자가 더 커야')
  })
})

describe('inputFromForm', () => {
  it('게임 → 입력값 → 저장값이 원래 값과 같다', () => {
    const input = full(formFromGame(GAME))
    expect(input.title).toBe('딕싯')
    expect(input.player_count).toEqual(['3-8인'])
    expect(input.mine).toEqual({
      quantity: 1,
      played: false,
      rating: null,
      review: null,
      notes: '메모',
      purchase: { date: null, paid: null, shop: null },
    })
  })
  it('빈칸은 null, 쉼표 숫자 허용, 앞뒤 공백 제거', () => {
    const input = full({ ...EMPTY_FORM, title: ' 새 게임 ', price: '59,000', publisher: '  ', time: '' })
    expect(input.title).toBe('새 게임')
    expect(input.price).toBe(59000)
    expect(input.publisher).toBeNull()
    expect(input.play_time_minutes).toBeNull()
  })
  it('잘못된 값은 모두 모아서 알려 준다', () => {
    const r = inputFromForm({
      ...EMPTY_FORM,
      title: ' ',
      time: '0',
      price: '1.5',
      quantity: '0',
      saleLink: 'naver.com',
      purchasePaid: '-1',
    })
    expect('errors' in r && r.errors).toEqual([
      '제목을 입력해 주세요',
      '시간은 1분 이상의 정수로 적어 주세요',
      '정가는 0원 이상의 정수로 적어 주세요',
      '구매가격은 0원 이상의 정수로 적어 주세요',
      '개수는 1 이상이어야 합니다',
      '판매 링크는 http:// 또는 https://로 시작해야 합니다',
    ])
  })
})

describe('diffInput', () => {
  const before = full(formFromGame(GAME))

  it('바뀐 것이 없으면 빈 수정 값', () => {
    expect(isEmptyPatch(diffInput(before, full(formFromGame(GAME))))).toBe(true)
  })
  it('바뀐 칸만 담는다 (구입 정보도 바뀐 칸만)', () => {
    const after = full({
      ...formFromGame(GAME),
      price: '',
      played: true,
      purchaseShop: '보드엠',
      players: rowsFromCounts(['3-8인']),
    })
    expect(diffInput(before, after)).toEqual({ price: null, mine: { played: true, purchase: { shop: '보드엠' } } })
  })
  it('장르·인원 목록 변경도 잡는다', () => {
    const after = full({ ...formFromGame(GAME), genres: ['보드게임', '머더미스터리'], players: [] })
    expect(diffInput(before, after)).toEqual({ genres: ['보드게임', '머더미스터리'], player_count: [] })
  })
})
