PRAGMA foreign_keys = ON;

-- Preserve the existing daily aggregates while adding one all-time row per
-- coarse cell. No event or visitor record is created.
CREATE TABLE cell_total (
  lat_band INTEGER NOT NULL CHECK (lat_band BETWEEN 0 AND 11),
  lon_band INTEGER NOT NULL CHECK (lon_band BETWEEN 0 AND 23),
  hits INTEGER NOT NULL CHECK (hits BETWEEN 1 AND 2000000000),
  PRIMARY KEY (lat_band, lon_band)
) WITHOUT ROWID;

INSERT INTO cell_total (lat_band, lon_band, hits)
SELECT lat_band, lon_band, MIN(SUM(hits), 2000000000)
FROM cell_day
GROUP BY lat_band, lon_band;

-- Bridge requests from the old Worker during migration and after a rollback.
-- Deleting expired daily rows must never subtract from the all-time totals.
CREATE TRIGGER cell_day_total_after_insert
AFTER INSERT ON cell_day
BEGIN
  INSERT INTO cell_total (lat_band, lon_band, hits)
  VALUES (NEW.lat_band, NEW.lon_band, NEW.hits)
  ON CONFLICT(lat_band, lon_band) DO UPDATE
  SET hits = MIN(cell_total.hits + excluded.hits, 2000000000);
END;

CREATE TRIGGER cell_day_total_after_update
AFTER UPDATE OF hits ON cell_day
WHEN NEW.hits > OLD.hits
BEGIN
  INSERT INTO cell_total (lat_band, lon_band, hits)
  VALUES (NEW.lat_band, NEW.lon_band, NEW.hits - OLD.hits)
  ON CONFLICT(lat_band, lon_band) DO UPDATE
  SET hits = MIN(cell_total.hits + excluded.hits, 2000000000);
END;
