import { useState } from 'react'
import type { Game } from '../lib/types'

/** 제목 앞 작은 표지. 사진이 없거나 못 불러오면 제목 첫 글자를 장르 색 타일에 적는다. */
export default function GameThumb({ game }: { game: Game }) {
  const [broken, setBroken] = useState(false)
  const src = game.images[0]
  const kind = game.genres.includes('머더미스터리') ? 'murder' : game.genres.includes('보드게임') ? 'board' : 'none'

  if (src && !broken) {
    return <img className="thumb" src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
  }
  return (
    <span className={`thumb thumb-${kind}`} aria-hidden="true">
      {game.title.trim().charAt(0)}
    </span>
  )
}
