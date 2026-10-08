import type { GenreTab, GenreTabInfo } from '../lib/games'

type Props = { tabs: GenreTabInfo[]; value: GenreTab; onChange: (genre: GenreTab) => void }

/** 장르 탭 (전체 / 보드게임 / 머더미스터리 / 미분류). 고른 탭 안에서 나머지 거르기가 적용된다. */
export default function GenreTabs({ tabs, value, onChange }: Props) {
  return (
    <div className="genre-tabs" role="tablist" aria-label="장르">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={value === t.key}
          className={`genre-tab ${value === t.key ? 'active' : ''}`}
          onClick={() => onChange(t.key)}
        >
          {t.label} <span className="tab-count">{t.count}</span>
        </button>
      ))}
    </div>
  )
}
