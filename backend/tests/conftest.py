"""테스트는 임시 데이터 폴더만 쓴다. 실데이터(data/)가 바뀌면 테스트를 실패시킨다."""
import hashlib

import pytest

from backend.app.config import ROOT

REAL_DATA = ROOT / "data"


def _snapshot() -> dict[str, str]:
    if not REAL_DATA.is_dir():
        return {}
    return {
        str(p.relative_to(REAL_DATA)): hashlib.md5(p.read_bytes()).hexdigest()
        for p in sorted(REAL_DATA.rglob("*"))
        if p.is_file()
    }


@pytest.fixture(autouse=True)
def isolated_data_dir(tmp_path, monkeypatch):
    monkeypatch.setenv("BGH_DATA_DIR", str(tmp_path / "data"))
    before = _snapshot()
    yield tmp_path / "data"
    assert _snapshot() == before, "테스트가 실데이터(data/)를 바꿨다"
