# 설치·실행

## 처음 설치

Python 3.10 이상과 Node.js가 필요하다. 저장소 폴더에서 아래를 실행한다.

```bash
python -m venv .venv
.venv/Scripts/python -m pip install -r backend/requirements.txt
npm --prefix frontend install
```

그다음 `data/collection.json`(과 `data/stores.json`)을 복사해 넣고 `start.bat`을 실행한다.

## 실행 방법

| 목적 | 방법 | 주소 |
|---|---|---|
| 평소 사용 | `start.bat`: 화면 코드가 바뀌었으면 빌드한 뒤 서버를 켠다 | http://127.0.0.1:8000 |
| 개발 (서버) | `.claude/launch.json`의 `backend-dev` (`--reload`) | 8000 |
| 개발 (화면) | `frontend-dev` (Vite, `/api`는 8000으로 넘긴다) | 5173 |
| 실데이터 없이 시험 | `data/`의 JSON을 `data-sandbox/`에 복사한 뒤 `app-sandbox`로 실행. 띄운 뒤 `/api/health`의 `data_dir`가 `data-sandbox`인지 먼저 본다 | 8001 |

- 데이터 위치는 환경변수 `BGH_DATA_DIR`로 바꾼다. `data/`와 `data-sandbox/`는 git에 올리지 않는다.
- 서버는 `127.0.0.1`에만 연다.
- 화면 주소(`/games` 등)는 서버가 모두 `index.html`로 돌려준다 (`backend/app/main.py`의 `spa`).

## 폴더

```
boardgame-home/
  backend/    app/(main, games, stores, excel, players, store, config), tests/
  frontend/   src/(App, main, components/, pages/, lib/, styles.css), public/
  shared/     서버·화면이 함께 쓰는 테스트 사례 (인원 해석, 스토어 열쇠)
  data/       collection.json, stores.json, backups/   ← git 제외
  scripts/    migrate_from_danseo.py
  handoff/    옛 앱 인수인계 원본 (읽기 전용)
  docs/       개발 문서 (docs/README.md가 목차)
  start.bat
```
