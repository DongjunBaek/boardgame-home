"""보유 게임 목록 저장소 (data/collection.json).

- 저장할 때마다 직전 파일을 data/backups/에 복사해 둔다. 최근 BACKUP_KEEP개와,
  최근 DAILY_KEEP일 동안 날마다 첫 백업을 남긴다 (표에서 여러 번 고쳐도 며칠 전 상태로 돌아갈 수 있게).
- 쓰기는 원자적이다: 임시 파일에 끝까지 쓴 뒤 바꿔치기한다. 중간에 꺼져도 원래 파일은 그대로다.
- 파일이 깨져 있으면 빈 목록으로 보지 않고 멈춘다 (빈 목록을 저장하면 데이터가 통째로 사라진다).
"""
import json
import os
import shutil
import tempfile
import threading
import time
from datetime import datetime
from pathlib import Path

from backend.app.config import data_dir

COLLECTION_FILE = "collection.json"
BACKUP_DIR = "backups"
BACKUP_KEEP = 50
DAILY_KEEP = 30

_lock = threading.RLock()


class DataFileCorruptedError(Exception):
    def __init__(self, path: Path, reason: str):
        super().__init__(f"데이터 파일이 손상되었습니다: {path} ({reason})")
        self.path = path


def collection_lock() -> threading.RLock:
    """읽고-고치고-저장하는 동안 잡는다 (요청 두 개가 서로의 변경을 덮어쓰지 않게)."""
    return _lock


def collection_path() -> Path:
    return data_dir() / COLLECTION_FILE


def backup_dir() -> Path:
    return data_dir() / BACKUP_DIR


def load_collection() -> list[dict]:
    """파일이 없으면 빈 목록. JSON이 깨져 있으면 DataFileCorruptedError."""
    path = collection_path()
    with _lock:
        if not path.exists():
            return []
        text = path.read_text(encoding="utf-8")
    try:
        data = json.loads(text)
    except ValueError as e:
        raise DataFileCorruptedError(path, str(e)) from e
    if not isinstance(data, list):
        raise DataFileCorruptedError(path, "목록(JSON 배열)이 아님")
    return data


def save_collection(games: list[dict]) -> Path | None:
    """목록을 저장한다. 기존 파일이 있었으면 그 백업 경로를 돌려준다."""
    path = collection_path()
    with _lock:
        backup = _backup(path) if path.exists() else None
        _write_json_atomic(path, games)
        _prune_backups()
    return backup


def _backup(path: Path) -> Path:
    folder = backup_dir()
    folder.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S-%f")
    target = folder / f"{path.stem}-{stamp}{path.suffix}"
    shutil.copy2(path, target)
    return target


def _prune_backups() -> None:
    folder = backup_dir()
    if not folder.is_dir():
        return
    # 이름이 collection-YYYYMMDD-HHMMSS-ffffff.json이라 이름순 = 시간순
    stem = Path(COLLECTION_FILE).stem
    backups = sorted(folder.glob(f"{stem}-*.json"))
    keep = set(backups[-BACKUP_KEEP:])
    first_of_day: dict[str, Path] = {}
    for b in backups:
        first_of_day.setdefault(b.name[len(stem) + 1 : len(stem) + 9], b)
    keep.update(sorted(first_of_day.values())[-DAILY_KEEP:])
    for old in backups:
        if old not in keep:
            old.unlink()


def _write_json_atomic(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=path.parent, prefix=".tmp_", suffix=".json")
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write("\n")
            f.flush()
            os.fsync(f.fileno())
        _replace_with_retry(tmp, path)
    except BaseException:
        if os.path.exists(tmp):
            os.remove(tmp)
        raise


def _replace_with_retry(src: str, dst: Path, attempts: int = 20, delay: float = 0.01) -> None:
    # Windows에서는 다른 프로그램(백신, 탐색기 미리보기 등)이 파일을 잠깐 잡고 있으면 교체가 거부된다
    for attempt in range(attempts):
        try:
            os.replace(src, dst)
            return
        except PermissionError:
            if attempt == attempts - 1:
                raise
            time.sleep(delay)
