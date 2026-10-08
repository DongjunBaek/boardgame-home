type Props = { value: number | null; onChange: (next: number | null) => void; disabled?: boolean }

/** 별 다섯 개. 지금 점수의 별을 다시 누르면 점수를 지운다. */
export default function StarRating({ value, onChange, disabled }: Props) {
  return (
    <span className="stars" role="group" aria-label={`별점 ${value ?? '없음'}`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={`star ${value !== null && n <= value ? 'on' : ''}`}
          aria-label={value === n ? `별점 ${n}점 지우기` : `별점 ${n}점`}
          title={value === n ? '다시 누르면 지웁니다' : `${n}점`}
          disabled={disabled}
          onClick={() => onChange(value === n ? null : n)}
        >
          {value !== null && n <= value ? '★' : '☆'}
        </button>
      ))}
    </span>
  )
}
