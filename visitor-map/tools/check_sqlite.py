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
    "aggregateAllTime",
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
    database.executemany(
        "INSERT INTO cell_day(day, lat_band, lon_band, hits) VALUES (?, ?, ?, ?)",
        (
            ("2026-06-01", 1, 1, 1),
            ("2026-08-28", 8, 6, 3),
            ("2026-08-29", 8, 6, 4),
            ("2026-08-29", 9, 7, 5),
        ),
    )
    database.executescript(
        (ROOT / "migrations" / "0002_all_time_counts.sql").read_text(
            encoding="utf-8"
        )
    )
    sql = worker_statements()

    tables = {
        row[0]
        for row in database.execute(
            "SELECT name FROM sqlite_schema WHERE type = 'table'"
        )
    }
    assert {"cell_day", "cell_total", "daily_budget"}.issubset(tables)

    triggers = database.execute(
        "SELECT name, sql FROM sqlite_schema WHERE type = 'trigger' ORDER BY name"
    ).fetchall()
    assert [row[0] for row in triggers] == [
        "cell_day_total_after_insert",
        "cell_day_total_after_update",
    ]
    assert all("AFTER DELETE" not in statement.upper() for _, statement in triggers)

    backfilled = database.execute(
        "SELECT lat_band, lon_band, hits FROM cell_total ORDER BY lat_band, lon_band"
    ).fetchall()
    assert backfilled == [(1, 1, 1), (8, 6, 7), (9, 7, 5)]

    # A cell first seen only after the migration must take both the trigger's
    # INSERT path and later UPDATE path, then survive daily-buffer pruning.
    database.execute(sql["incrementCell"], ("2026-06-01", 2, 2, 2_000))
    database.execute(sql["incrementCell"], ("2026-06-01", 2, 2, 2_000))
    assert database.execute(
        "SELECT hits FROM cell_total WHERE lat_band = ? AND lon_band = ?",
        (2, 2),
    ).fetchone() == (2,)

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

    # The existing Worker still writes cell_day. The two triggers must mirror
    # both the insert path and the subsequent upsert-update path into cell_total.
    database.execute(sql["incrementCell"], ("2026-08-30", 8, 6, 2_000))
    assert database.execute(
        "SELECT hits FROM cell_total WHERE lat_band = ? AND lon_band = ?",
        (8, 6),
    ).fetchone() == (8,)
    database.execute(sql["incrementCell"], ("2026-08-30", 8, 6, 2_000))
    assert database.execute(
        "SELECT hits FROM cell_total WHERE lat_band = ? AND lon_band = ?",
        (8, 6),
    ).fetchone() == (9,)

    # Raising the daily row exercises a large positive delta. Once that row
    # saturates, NEW.hits == OLD.hits and the guarded trigger must not overcount.
    database.execute(
        "UPDATE cell_day SET hits = 1999 WHERE day = ? AND lat_band = ? AND lon_band = ?",
        ("2026-08-30", 8, 6),
    )
    database.execute(sql["incrementCell"], ("2026-08-30", 8, 6, 2_000))
    total_at_saturation = database.execute(
        "SELECT hits FROM cell_total WHERE lat_band = ? AND lon_band = ?",
        (8, 6),
    ).fetchone()
    database.execute(sql["incrementCell"], ("2026-08-30", 8, 6, 2_000))
    saturated = database.execute(
        "SELECT hits FROM cell_day WHERE day = ? AND lat_band = ? AND lon_band = ?",
        ("2026-08-30", 8, 6),
    ).fetchone()
    assert saturated == (2_000,)
    assert total_at_saturation == (2_007,)
    assert database.execute(
        "SELECT hits FROM cell_total WHERE lat_band = ? AND lon_band = ?",
        (8, 6),
    ).fetchone() == total_at_saturation

    # The permanent counter remains safely bounded even when a positive delta
    # would otherwise exceed its two-billion ceiling.
    database.execute(
        "UPDATE cell_total SET hits = 1999999999 WHERE lat_band = ? AND lon_band = ?",
        (9, 7),
    )
    database.execute(
        "UPDATE cell_day SET hits = 6 WHERE day = ? AND lat_band = ? AND lon_band = ?",
        ("2026-08-29", 9, 7),
    )
    database.execute(
        "UPDATE cell_day SET hits = 7 WHERE day = ? AND lat_band = ? AND lon_band = ?",
        ("2026-08-29", 9, 7),
    )
    assert database.execute(
        "SELECT hits FROM cell_total WHERE lat_band = ? AND lon_band = ?",
        (9, 7),
    ).fetchone() == (2_000_000_000,)

    aggregate = database.execute(
        sql["aggregateAllTime"], (1,)
    ).fetchall()
    assert aggregate == [
        (1, 1, 1),
        (2, 2, 2),
        (8, 6, 2_007),
        (9, 7, 2_000_000_000),
    ]
    assert len(aggregate) <= 12 * 24

    database.executemany(
        "INSERT INTO daily_budget(day, accepted) VALUES (?, ?)",
        (("2026-06-01", 1), ("2026-08-29", 1)),
    )
    totals_before_prune = database.execute(
        "SELECT lat_band, lon_band, hits FROM cell_total ORDER BY lat_band, lon_band"
    ).fetchall()
    database.execute(sql["pruneCells"], ("2026-06-02",))
    database.execute(sql["pruneBudgets"], ("2026-08-30",))
    assert database.execute(
        "SELECT COUNT(*) FROM cell_day WHERE day < ?", ("2026-06-02",)
    ).fetchone() == (0,)
    assert database.execute(
        "SELECT DISTINCT day FROM cell_day ORDER BY day"
    ).fetchall() == [("2026-08-28",), ("2026-08-29",), ("2026-08-30",)]
    assert database.execute(
        "SELECT day, accepted FROM daily_budget ORDER BY day"
    ).fetchall() == [("2026-08-30", 20_000)]
    assert database.execute(
        "SELECT lat_band, lon_band, hits FROM cell_total ORDER BY lat_band, lon_band"
    ).fetchall() == totals_before_prune
    assert database.execute(
        "SELECT COUNT(*) FROM daily_budget WHERE day < ?", ("2026-08-30",)
    ).fetchone() == (0,)
    assert database.execute("PRAGMA integrity_check").fetchone() == ("ok",)


if __name__ == "__main__":
    main()
