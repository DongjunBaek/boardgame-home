# 테스트·확인

| 할 일 | 명령 |
|---|---|
| 서버 테스트 | `.venv/Scripts/python -m pytest` |
| 화면 테스트 | `npm --prefix frontend test` (Vitest) |
| 화면 린트 | `npm --prefix frontend run lint` (oxlint) |
| 화면 빌드 | `npm --prefix frontend run build` (타입 검사 포함) |

- 테스트는 임시 폴더만 쓴다. `data/`가 바뀌면 실패한다.
- 인원 해석·스토어 열쇠는 `shared/*.json` 사례로 서버와 화면이 같은 답을 내는지 함께 검사한다.

## 화면 확인

각 단계는 **테스트 통과 + 실제 화면 확인**으로 끝낸다. 확인하지 못한 것은 "확인 못 함"이라고 적는다.

1. `data-sandbox/`에 데이터를 복사하고 `app-sandbox`(8001)를 띄운다. `/api/health`의 `data_dir`를 먼저 확인한다.
2. 바꾼 화면을 직접 눌러 본다. 콘솔 오류가 없어야 한다.
3. 밝은·어두운 화면을 둘 다 스크린샷으로 본다. 레이아웃을 바꿨으면 폭 375px도 본다.
