PRAGMA foreign_keys = ON;

-- These are day-level counters, not event or visitor records.
CREATE TABLE cell_day (
  day TEXT NOT NULL
    CHECK (day GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  lat_band INTEGER NOT NULL CHECK (lat_band BETWEEN 0 AND 11),
  lon_band INTEGER NOT NULL CHECK (lon_band BETWEEN 0 AND 23),
  hits INTEGER NOT NULL CHECK (hits BETWEEN 1 AND 2000),
  PRIMARY KEY (day, lat_band, lon_band)
) WITHOUT ROWID;

-- Global daily write budget. It is also aggregate-only and acts as a circuit
-- breaker before the cell counter is touched.
CREATE TABLE daily_budget (
  day TEXT PRIMARY KEY
    CHECK (day GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  accepted INTEGER NOT NULL CHECK (accepted BETWEEN 1 AND 20000)
) WITHOUT ROWID;
