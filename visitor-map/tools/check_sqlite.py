#!/usr/bin/env python3
"""Exercise the Worker's exact SQL against Python's in-memory SQLite."""

from __future__ import annotations

import re
import sqlite3
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
STATEMENT_NAMES = (
    "claimDailyBudget",
    "incrementCell",
    "aggregateWindow",
    "pruneCells",
    "pruneBudgets",
)


def worker_statements() -> dict[str, str]:
    source = (ROOT / "src" / "index.mjs").read_text(encoding="utf-8")
    statements: dict[str, str] = {}
    for name in STATEMENT_NAMES:
        template_match = re.search(rf"\b{name}:\s*`(.*?)`", source, re.DOTALL)
        quoted_match = re.search(rf'\b{name}:\s*"([^"]+)"', source)
        match = template_match or quoted_match
        if match is None:
            raise AssertionError(f"cannot extract SQL statement {name}")
        statements[name] = match.group(1)
    return statements


def main() -> None:
    database = sqlite3.connect(":memory:")
    database.executescript(
        (ROOT / "migrations" / "0001_aggregate_counts.sql").read_text(
            encoding="utf-8"
        )
    )
    sql = worker_statements()

    first_budget = database.execute(
        sql["claimDailyBudget"], ("2026-08-30", 20_000)
    ).fetchone()
    assert first_budget == (1,)
    database.execute(
        "UPDATE daily_budget SET accepted = 19999 WHERE day = ?", ("2026-08-30",)
    )
    final_budget = database.execute(
        sql["claimDailyBudget"], ("2026-08-30", 20_000)
    ).fetchone()
    exhausted_budget = database.execute(
        sql["claimDailyBudget"], ("2026-08-30", 20_000)
    ).fetchone()
    assert final_budget == (20_000,)
    assert exhausted_budget is None

    database.execute(sql["incrementCell"], ("2026-08-30", 8, 6, 2_000))
    database.execute(
        "UPDATE cell_day SET hits = 1999 WHERE day = ? AND lat_band = ? AND lon_band = ?",
        ("2026-08-30", 8, 6),
    )
    database.execute(sql["incrementCell"], ("2026-08-30", 8, 6, 2_000))
    database.execute(sql["incrementCell"], ("2026-08-30", 8, 6, 2_000))
    saturated = database.execute(
        "SELECT hits FROM cell_day WHERE day = ? AND lat_band = ? AND lon_band = ?",
        ("2026-08-30", 8, 6),
    ).fetchone()
    assert saturated == (2_000,)

    database.execute(
        "INSERT INTO cell_day(day, lat_band, lon_band, hits) VALUES (?, ?, ?, ?)",
        ("2026-08-29", 9, 7, 4),
    )
    aggregate = database.execute(
        sql["aggregateWindow"], ("2026-06-02", "2026-08-30", 5)
    ).fetchall()
    assert aggregate == [(8, 6, 2_000)]

    database.execute(
        "INSERT INTO cell_day(day, lat_band, lon_band, hits) VALUES (?, ?, ?, ?)",
        ("2026-06-01", 1, 1, 1),
    )
    database.execute(
        "INSERT INTO daily_budget(day, accepted) VALUES (?, ?)",
        ("2026-06-01", 1),
    )
    database.execute(sql["pruneCells"], ("2026-06-02",))
    database.execute(sql["pruneBudgets"], ("2026-06-02",))
    assert database.execute(
        "SELECT COUNT(*) FROM cell_day WHERE day < ?", ("2026-06-02",)
    ).fetchone() == (0,)
    assert database.execute(
        "SELECT COUNT(*) FROM daily_budget WHERE day < ?", ("2026-06-02",)
    ).fetchone() == (0,)
    assert database.execute("PRAGMA integrity_check").fetchone() == ("ok",)


if __name__ == "__main__":
    main()
