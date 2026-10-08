import json

import pytest

from backend.app import store


def test_load_missing_file_is_empty():
    assert store.load_collection() == []


def test_save_and_load_roundtrip_keeps_korean():
    games = [{"id": "manual:1", "title": "딕싯"}]
    assert store.save_collection(games) is None  # 처음 저장은 백업할 것이 없다
    assert store.load_collection() == games
    assert "딕싯" in store.collection_path().read_text(encoding="utf-8")


def test_save_backs_up_previous_version():
    store.save_collection([{"id": "a"}])
    backup = store.save_collection([{"id": "b"}])
    assert json.loads(backup.read_text(encoding="utf-8")) == [{"id": "a"}]
    assert store.load_collection() == [{"id": "b"}]


def test_old_backups_are_pruned(monkeypatch):
    monkeypatch.setattr(store, "BACKUP_KEEP", 3)
    for i in range(6):
        store.save_collection([{"id": str(i)}])
    backups = sorted(store.backup_dir().glob("collection-*.json"))
    assert [json.loads(b.read_text(encoding="utf-8"))[0]["id"] for b in backups] == ["2", "3", "4"]


def test_corrupted_file_raises_instead_of_empty():
    store.collection_path().parent.mkdir(parents=True)
    store.collection_path().write_text("[{깨짐", encoding="utf-8")
    with pytest.raises(store.DataFileCorruptedError):
        store.load_collection()


def test_non_list_file_is_corrupted():
    store.collection_path().parent.mkdir(parents=True)
    store.collection_path().write_text("{}", encoding="utf-8")
    with pytest.raises(store.DataFileCorruptedError):
        store.load_collection()


def test_failed_write_keeps_original_file(monkeypatch):
    store.save_collection([{"id": "원본"}])

    def broken_dump(*args, **kwargs):
        raise OSError("디스크 오류 흉내")

    # undo()는 쓰지 않는다: 임시 데이터 폴더 설정까지 되돌려 실데이터를 읽게 된다
    with monkeypatch.context() as patch:
        patch.setattr(store.json, "dump", broken_dump)
        with pytest.raises(OSError):
            store.save_collection([{"id": "새것"}])
    assert store.load_collection() == [{"id": "원본"}]
    assert not list(store.collection_path().parent.glob(".tmp_*"))
