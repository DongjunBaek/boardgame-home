# 작업 규칙

## git
- 커밋은 로컬에만 한다. push는 요청할 때만 한다.
- 커밋 메시지는 `종류: 한국어 설명` 형식이다. 예: `feat: 스토어 바로가기 사이드바`
  - 종류: `feat`(기능), `fix`(고침), `refactor`(동작 같음), `docs`(문서), `test`, `chore`
- 코드 변경과 그 문서 변경([docs/README.md](../README.md) 규칙)은 함께 커밋한다.

## 데이터 (v1에서 이어짐)
- 데이터 변경은 미리보기 → 확인 → 백업 → 적용 순서로 한다.
- 게임 정보: 인원·시간·가격은 출처에서 확인한 값만 넣고, 모르면 비운다. 가격은 할인 전 정가다.
- 게임 ID는 바꾸지 않는다. 새로 정리한 제목은 사용자 확인을 받는다.
- 사용자가 작업 중에도 앱을 쓸 수 있다. 백업에서 되돌리기 전에 지금 데이터와 비교한다.
- 파이썬 한글 출력이 깨지면 `PYTHONIOENCODING=utf-8`을 붙인다.

## 화면
- 디자인 규칙은 [design/ui-rules.md](../design/ui-rules.md), 앱 틀과 주소는 [design/layout.md](../design/layout.md)에 있다.
- 새 메뉴는 `frontend/src/lib/nav.ts`에 정의하고, 화면 파일은 `frontend/src/pages/`에 둔다.
