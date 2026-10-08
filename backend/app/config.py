"""경로 설정. 데이터 폴더는 환경변수 BGH_DATA_DIR로 바꿀 수 있다 (테스트는 임시 폴더를 쓴다)."""
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FRONTEND_DIST = ROOT / "frontend" / "dist"


def data_dir() -> Path:
    return Path(os.environ.get("BGH_DATA_DIR") or ROOT / "data")
