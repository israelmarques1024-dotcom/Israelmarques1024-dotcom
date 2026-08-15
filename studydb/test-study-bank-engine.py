#!/usr/bin/env python3
from pathlib import Path
import importlib.util

ENGINE = Path(__file__).with_name("study-bank-engine-v5.py")
spec = importlib.util.spec_from_file_location("study_bank_engine", ENGINE)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def test_boundaries():
    assert module.generate(0)["grade"] == 6
    assert module.generate(25_000_000)["grade"] == 7
    assert module.generate(50_000_000)["grade"] == 8
    assert module.generate(75_000_000)["grade"] == 9
    assert module.generate(99_999_999)["grade"] == 9


def test_determinism():
    ids = [0, 1, 6, 12345, 25_000_000, 50_000_000, 75_000_000, 99_999_999]
    for record_id in ids:
        assert module.generate(record_id) == module.generate(record_id)


def test_schema():
    required = {
        "id", "grade", "subject", "topic", "question", "answer",
        "explanation", "hint", "difficulty", "questionHash", "recordHash"
    }
    for record_id in range(1000):
        item = module.generate(record_id)
        assert required.issubset(item)
        assert len(item["questionHash"]) == 64
        assert len(item["recordHash"]) == 64


if __name__ == "__main__":
    test_boundaries()
    test_determinism()
    test_schema()
    print("OK: Study Bank Engine tests passed")
