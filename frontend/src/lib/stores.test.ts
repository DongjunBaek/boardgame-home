import { describe, expect, it } from 'vitest'
import shared from '../../../shared/store_key_cases.json'
import { EMPTY_FILTERS, filterGames } from './games'
import { groupNames, groupStores, storeKey } from './stores'
import type { Game, Store } from './types'

describe('storeKey (서버와 공통 사례)', () => {
  it.each(shared.cases)('$url → $key', ({ url, key }) => {
    expect(storeKey(url)).toBe(key)
  })
})

const store = (id: string, name: string, url: string, group: string | null = null): Store => ({ id, name, url, group, memo: null })

const game = (id: string, sale_link: string | null) => ({ id, title: id, sale_link, genres: [] }) as unknown as Game

const GAMES = [
  game('a', 'https://smartstore.naver.com/udg/products/1'),
  game('b', 'https://m.smartstore.naver.com/udg/products/2'),
  game('c', 'https://www.boardm.co.kr/goods/1'),
  game('d', null),
]

describe('groupStores', () => {
  const stores = [
    store('1', '텀블벅', 'https://tumblbug.com', '펀딩'),
    store('2', '보드엠', 'https://boardm.co.kr', '보드게임 쇼핑몰'),
    store('3', '언더독 게임즈', 'https://smartstore.naver.com/udg', '제작사 스토어'),
    store('4', '가나 스토어', 'https://gana.kr', null),
    store('5', '내 단골', 'https://mine.kr', '단골'),
    store('6', '미스터리게임즈', 'https://smartstore.naver.com/mysterygames', '제작사 스토어'),
  ]
  const groups = groupStores(stores, GAMES)

  it('기본 묶음 순서 → 나머지 묶음 → 기타', () => {
    expect(groups.map((g) => g.name)).toEqual(['제작사 스토어', '보드게임 쇼핑몰', '펀딩', '단골', '기타'])
  })
  it('묶음 안은 이름순이고, 판매 링크로 내 게임 수를 센다', () => {
    expect(groups[0].rows.map((r) => [r.store.name, r.count])).toEqual([
      ['미스터리게임즈', 0],
      ['언더독 게임즈', 2],
    ])
    expect(groups[1].rows[0].count).toBe(1)
    expect(groups[2].rows[0].count).toBe(0)
  })
})

describe('스토어로 거르기', () => {
  it('열쇠가 같은 판매 링크만 남긴다 (PC/모바일 주소 모두)', () => {
    const shown = filterGames(GAMES, { ...EMPTY_FILTERS, store: 'smartstore.naver.com/udg' })
    expect(shown.map((g) => g.id)).toEqual(['a', 'b'])
  })
})

describe('groupNames', () => {
  it('기본 묶음 뒤에 쓰는 묶음을 한 번씩', () => {
    expect(groupNames([store('1', 'x', 'https://x.kr', '단골'), store('2', 'y', 'https://y.kr', '펀딩'), store('3', 'z', 'https://z.kr', '단골')])).toEqual([
      '제작사 스토어',
      '보드게임 쇼핑몰',
      '펀딩',
      '단골',
    ])
  })
})
