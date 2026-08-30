#!/usr/bin/env python3
"""Convert the verified Natural Earth land shapefile to a compact SVG path."""

from __future__ import annotations

import argparse
import hashlib
import json
import struct
from pathlib import Path


EXPECTED_SHA256 = "8689e6932b8e370e2ca4587cf3ba21e460b1235db37b6ed3c172c35b4a6088de"
SOURCE_URL = (
    "https://github.com/nvkelso/natural-earth-vector/blob/"
    "ca96624a56bd078437bca8184e78163e5039ad19/"
    "110m_physical/ne_110m_land.shp"
)
WIDTH = 720
HEIGHT = 360


def coordinate(value: float) -> str:
    rounded = round(value, 1)
    if rounded == 0:
        rounded = 0.0
    return f"{rounded:.1f}".rstrip("0").rstrip(".")


def project(longitude: float, latitude: float) -> tuple[str, str]:
    x = (longitude + 180) / 360 * WIDTH
    y = (90 - latitude) / 180 * HEIGHT
    return coordinate(x), coordinate(y)


def polygon_parts(data: bytes) -> list[list[tuple[float, float]]]:
    if len(data) < 44:
        raise ValueError("truncated polygon record")
    shape_type = struct.unpack_from("<i", data, 0)[0]
    if shape_type == 0:
        return []
    if shape_type != 5:
        raise ValueError(f"unexpected record shape type: {shape_type}")

    part_count, point_count = struct.unpack_from("<2i", data, 36)
    if part_count < 1 or point_count < 1:
        raise ValueError("polygon record has no geometry")

    parts_offset = 44
    points_offset = parts_offset + part_count * 4
    expected_size = points_offset + point_count * 16
    if expected_size > len(data):
        raise ValueError("truncated polygon points")

    starts = list(struct.unpack_from(f"<{part_count}i", data, parts_offset))
    if starts[0] != 0 or starts != sorted(starts) or starts[-1] >= point_count:
        raise ValueError("invalid polygon part indexes")
    starts.append(point_count)

    points = [
        struct.unpack_from("<2d", data, points_offset + index * 16)
        for index in range(point_count)
    ]
    return [points[start:end] for start, end in zip(starts, starts[1:])]


def read_parts(path: Path) -> list[list[tuple[float, float]]]:
    source = path.read_bytes()
    digest = hashlib.sha256(source).hexdigest()
    if digest != EXPECTED_SHA256:
        raise ValueError(
            f"unexpected source SHA-256 {digest}; expected {EXPECTED_SHA256}"
        )
    if len(source) < 100:
        raise ValueError("truncated shapefile header")
    if struct.unpack_from(">i", source, 0)[0] != 9994:
        raise ValueError("invalid shapefile magic")
    if struct.unpack_from("<i", source, 28)[0] != 1000:
        raise ValueError("unsupported shapefile version")
    if struct.unpack_from("<i", source, 32)[0] != 5:
        raise ValueError("expected polygon shapefile")

    declared_size = struct.unpack_from(">i", source, 24)[0] * 2
    if declared_size != len(source):
        raise ValueError("shapefile length does not match its header")

    parts: list[list[tuple[float, float]]] = []
    offset = 100
    expected_record = 1
    while offset < len(source):
        if offset + 8 > len(source):
            raise ValueError("truncated record header")
        record_number, content_words = struct.unpack_from(">2i", source, offset)
        if record_number != expected_record or content_words < 2:
            raise ValueError("invalid shapefile record sequence")
        offset += 8
        content_size = content_words * 2
        end = offset + content_size
        if end > len(source):
            raise ValueError("truncated record content")
        parts.extend(polygon_parts(source[offset:end]))
        offset = end
        expected_record += 1
    return parts


def render_path(parts: list[list[tuple[float, float]]]) -> str:
    commands: list[str] = []
    for part in parts:
        previous_longitude: float | None = None
        command = "M"
        for longitude, latitude in part:
            if not (-180.000001 <= longitude <= 180.000001 and -90.000001 <= latitude <= 90.000001):
                raise ValueError("coordinate lies outside longitude/latitude bounds")
            # The source contains a handful of floating-point endpoints a few
            # trillionths of a degree beyond the valid closed bounds.
            longitude = min(180.0, max(-180.0, longitude))
            latitude = min(90.0, max(-90.0, latitude))
            if previous_longitude is not None and abs(longitude - previous_longitude) > 180:
                command = "M"
            x, y = project(longitude, latitude)
            commands.append(f"{command}{x},{y}")
            command = "L"
            previous_longitude = longitude
    return "".join(commands)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path, help="verified ne_110m_land.shp")
    parser.add_argument("output", type=Path, help="generated world-path.mjs")
    args = parser.parse_args()

    parts = read_parts(args.source)
    path_data = render_path(parts)
    point_count = path_data.count("L") + path_data.count("M")
    module = (
        "/* Generated by tools/generate_world_path.py; do not edit by hand.\n"
        f" * Source: {SOURCE_URL}\n"
        f" * Source SHA-256: {EXPECTED_SHA256}\n"
        " * Natural Earth map data is public domain.\n"
        " */\n"
        f"export const WORLD_LAND_PATH = {json.dumps(path_data)};\n"
        "export const WORLD_LAND_METADATA = Object.freeze({\n"
        f"  sourceSha256: {json.dumps(EXPECTED_SHA256)},\n"
        f"  sourceUrl: {json.dumps(SOURCE_URL)},\n"
        f"  partCount: {len(parts)},\n"
        f"  pointCount: {point_count},\n"
        "});\n"
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(module, encoding="utf-8")


if __name__ == "__main__":
    main()
