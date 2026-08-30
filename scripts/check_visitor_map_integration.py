#!/usr/bin/env python3
"""Exercise the Hugo visitor-map latch and generated-artifact contract."""

from __future__ import annotations

import argparse
import json
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile
from collections.abc import Callable


ROOT = pathlib.Path(__file__).resolve().parents[1]
CHECKER = ROOT / "scripts" / "check_site.py"
HUGO_VERSION = "0.165.0"
FIXTURE_ORIGIN = "https://fixture.fixture.workers.dev"
MAP_TAG_RE = re.compile(
    r"<img\b[^>]*\bdata-visitor-map=(?:\"map\"|'map'|map)(?=[\s>])[^>]*>",
    re.IGNORECASE,
)
PIXEL_TAG_RE = re.compile(
    r"<img\b[^>]*\bdata-visitor-map=(?:\"pixel\"|'pixel'|pixel)(?=[\s>])[^>]*>",
    re.IGNORECASE,
)
SUMMARY_TAG_RE = re.compile(
    r"<a\b[^>]*\bdata-visitor-map=(?:\"summary\"|'summary'|summary)(?=[\s>])[^>]*>"
    r".*?</a>",
    re.IGNORECASE | re.DOTALL,
)


class IntegrationFailure(RuntimeError):
    pass


def command_output(result: subprocess.CompletedProcess[str]) -> str:
    output = "\n".join(part.strip() for part in (result.stdout, result.stderr) if part.strip())
    if len(output) > 4_000:
        return f"{output[:4_000]}\n... output truncated ..."
    return output


def run_success(command: list[str], label: str) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(
        command,
        cwd=ROOT,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if result.returncode != 0:
        raise IntegrationFailure(
            f"{label} failed with exit {result.returncode}:\n{command_output(result)}"
        )
    return result


def run_failure(
    command: list[str],
    label: str,
    *,
    expected_output: str | None = None,
) -> None:
    result = subprocess.run(
        command,
        cwd=ROOT,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if result.returncode == 0:
        raise IntegrationFailure(f"{label} unexpectedly succeeded")
    output = command_output(result)
    if expected_output is not None and expected_output not in output:
        raise IntegrationFailure(
            f"{label} failed for an unexpected reason; output did not contain "
            f"{expected_output!r}:\n{output}"
        )


def resolve_hugo(value: str) -> str:
    candidate = shutil.which(value)
    if candidate is None:
        path = pathlib.Path(value)
        if path.is_file() and path.stat().st_mode & 0o111:
            candidate = str(path.resolve())
    if candidate is None:
        raise IntegrationFailure(
            f"Hugo executable {value!r} was not found; install Hugo Extended {HUGO_VERSION}"
        )

    version = run_success([candidate, "version"], "Hugo version check")
    output = command_output(version)
    if f"v{HUGO_VERSION}" not in output or "extended" not in output.casefold():
        raise IntegrationFailure(
            f"expected Hugo Extended {HUGO_VERSION}, found: {output or 'no version output'}"
        )
    return candidate


def write_overlay(path: pathlib.Path, visitor_map: dict[str, object]) -> None:
    path.write_text(
        json.dumps({"params": {"visitor_map": visitor_map}}, ensure_ascii=False),
        encoding="utf-8",
    )


def hugo_build_command(
    hugo: str,
    destination: pathlib.Path,
    cache: pathlib.Path,
    overlay: pathlib.Path | None = None,
) -> list[str]:
    configs = [ROOT / "hugo.yaml"]
    if overlay is not None:
        configs.append(overlay)
    return [
        hugo,
        "--source",
        str(ROOT),
        "--config",
        ",".join(str(path) for path in configs),
        "--destination",
        str(destination),
        "--cacheDir",
        str(cache),
        "--cleanDestinationDir",
        "--gc",
        "--minify",
        "--panicOnWarning",
        "--noBuildLock",
    ]


def checker_command(public: pathlib.Path, origin: str | None = None) -> list[str]:
    command = [sys.executable, str(CHECKER)]
    if origin is not None:
        command.extend(("--visitor-map-origin", origin))
    command.append(str(public))
    return command


def build_positive_states(hugo: str, temporary: pathlib.Path) -> tuple[pathlib.Path, pathlib.Path]:
    cache = temporary / "hugo-cache"
    default_public = temporary / "default-public"
    run_success(
        hugo_build_command(hugo, default_public, cache),
        "default-off Hugo build",
    )
    run_success(checker_command(default_public), "default-off artifact check")

    enabled_overlay = temporary / "enabled.json"
    write_overlay(
        enabled_overlay,
        {"enabled": True, "origin": FIXTURE_ORIGIN},
    )
    enabled_public = temporary / "enabled-public"
    run_success(
        hugo_build_command(hugo, enabled_public, cache, enabled_overlay),
        "fixture-enabled Hugo build",
    )
    run_success(
        checker_command(enabled_public, FIXTURE_ORIGIN),
        "fixture-enabled artifact check",
    )
    return default_public, enabled_public


def check_rejected_configs(hugo: str, temporary: pathlib.Path) -> None:
    rejected: list[tuple[str, dict[str, object]]] = [
        ("enabled-without-origin", {"enabled": True}),
        ("origin-while-disabled", {"enabled": False, "origin": FIXTURE_ORIGIN}),
        ("whitespace-origin-while-disabled", {"enabled": False, "origin": " "}),
        ("enabled-string", {"enabled": "true", "origin": FIXTURE_ORIGIN}),
        ("enabled-number", {"enabled": 1, "origin": FIXTURE_ORIGIN}),
        ("origin-number", {"enabled": True, "origin": 1}),
        ("leading-whitespace", {"enabled": True, "origin": f" {FIXTURE_ORIGIN}"}),
        ("trailing-whitespace", {"enabled": True, "origin": f"{FIXTURE_ORIGIN} "}),
        ("http", {"enabled": True, "origin": "http://fixture.fixture.workers.dev"}),
        ("trailing-slash", {"enabled": True, "origin": f"{FIXTURE_ORIGIN}/"}),
        ("path", {"enabled": True, "origin": f"{FIXTURE_ORIGIN}/worker"}),
        ("port", {"enabled": True, "origin": f"{FIXTURE_ORIGIN}:443"}),
        (
            "credentials",
            {"enabled": True, "origin": "https://user@fixture.fixture.workers.dev"},
        ),
        ("query", {"enabled": True, "origin": f"{FIXTURE_ORIGIN}?x=1"}),
        ("fragment", {"enabled": True, "origin": f"{FIXTURE_ORIGIN}#x"}),
        (
            "uppercase",
            {"enabled": True, "origin": "https://Fixture.fixture.workers.dev"},
        ),
        (
            "wrong-suffix",
            {"enabled": True, "origin": "https://fixture.fixture.example.com"},
        ),
        (
            "placeholder",
            {"enabled": True, "origin": "https://<worker>.<account>.workers.dev"},
        ),
    ]
    cache = temporary / "hugo-cache"
    destination = temporary / "rejected-public"
    for number, (name, visitor_map) in enumerate(rejected, start=1):
        overlay = temporary / f"rejected-{number:02d}-{name}.json"
        write_overlay(overlay, visitor_map)
        if destination.exists():
            shutil.rmtree(destination)
        run_failure(
            hugo_build_command(hugo, destination, cache, overlay),
            f"rejected visitor-map config {name}",
            expected_output="params.visitor_map",
        )


def find_required(pattern: re.Pattern[str], text: str, label: str) -> re.Match[str]:
    match = pattern.search(text)
    if match is None:
        raise IntegrationFailure(f"could not find {label} in fixture-enabled homepage")
    return match


def mutate_html_and_expect_failure(
    homepage: pathlib.Path,
    public: pathlib.Path,
    label: str,
    mutate: Callable[[str], str],
) -> None:
    original = homepage.read_text(encoding="utf-8")
    changed = mutate(original)
    if changed == original:
        raise IntegrationFailure(f"artifact mutation {label} made no change")
    try:
        homepage.write_text(changed, encoding="utf-8")
        run_failure(checker_command(public, FIXTURE_ORIGIN), f"artifact mutation {label}")
    finally:
        homepage.write_text(original, encoding="utf-8")


def check_rejected_artifacts(
    default_public: pathlib.Path,
    enabled_public: pathlib.Path,
) -> None:
    homepage = enabled_public / "index.html"

    def wrong_map_loading(text: str) -> str:
        match = find_required(MAP_TAG_RE, text, "visitor map image")
        tag = match.group(0)
        changed_tag, count = re.subn(
            r"\bloading=(?:\"lazy\"|'lazy'|lazy)(?=[\s>])",
            "loading=eager",
            tag,
            count=1,
            flags=re.IGNORECASE,
        )
        if count != 1:
            raise IntegrationFailure("visitor map image did not contain loading=lazy")
        return f"{text[:match.start()]}{changed_tag}{text[match.end():]}"

    def add_map_srcset(text: str) -> str:
        match = find_required(MAP_TAG_RE, text, "visitor map image")
        tag = match.group(0)
        changed_tag = tag.replace(
            ">",
            f' srcset="{FIXTURE_ORIGIN}/v1/map.svg 1x">',
            1,
        )
        return f"{text[:match.start()]}{changed_tag}{text[match.end():]}"

    def duplicate_pixel(text: str) -> str:
        match = find_required(PIXEL_TAG_RE, text, "visitor pixel image")
        return f"{text[:match.end()]}{match.group(0)}{text[match.end():]}"

    def remove_summary(text: str) -> str:
        match = find_required(SUMMARY_TAG_RE, text, "visitor summary link")
        return f"{text[:match.start()]}{text[match.end():]}"

    def add_external_script(text: str) -> str:
        insertion = '<script src="https://cdn.example.invalid/tracker.js"></script>'
        marker = "</body>"
        if marker not in text:
            raise IntegrationFailure("fixture-enabled homepage has no </body>")
        return text.replace(marker, f"{insertion}{marker}", 1)

    def add_empty_alt_image(text: str) -> str:
        insertion = '<img src="/favicon.svg" width="1" height="1" alt="">'
        marker = "</body>"
        if marker not in text:
            raise IntegrationFailure("fixture-enabled homepage has no </body>")
        return text.replace(marker, f"{insertion}{marker}", 1)

    def add_unexpected_worker_link(text: str) -> str:
        insertion = '<a href="https://other.other.workers.dev/v1/map">bad</a>'
        marker = "</body>"
        if marker not in text:
            raise IntegrationFailure("fixture-enabled homepage has no </body>")
        return text.replace(marker, f"{insertion}{marker}", 1)

    mutations = [
        ("wrong-map-attribute", wrong_map_loading),
        ("forbidden-map-srcset", add_map_srcset),
        ("duplicate-pixel", duplicate_pixel),
        ("missing-summary", remove_summary),
        ("external-active-resource", add_external_script),
        ("non-pixel-empty-alt", add_empty_alt_image),
        ("unexpected-worker-link", add_unexpected_worker_link),
    ]
    for label, mutate in mutations:
        mutate_html_and_expect_failure(homepage, enabled_public, label, mutate)

    stylesheet = next(iter(sorted(enabled_public.glob("css/*.css"))), None)
    if stylesheet is None:
        raise IntegrationFailure("fixture-enabled artifact has no generated stylesheet")
    original_css = stylesheet.read_text(encoding="utf-8")
    try:
        stylesheet.write_text(
            '@import url("https://cdn.example.invalid/tracker.css");' + original_css,
            encoding="utf-8",
        )
        run_failure(
            checker_command(enabled_public, FIXTURE_ORIGIN),
            "artifact mutation CSS @import",
        )
    finally:
        stylesheet.write_text(original_css, encoding="utf-8")

    default_homepage = default_public / "index.html"
    default_original = default_homepage.read_text(encoding="utf-8")
    try:
        default_homepage.write_text(
            f"{default_original}<!-- https://hidden.hidden.workers.dev -->",
            encoding="utf-8",
        )
        run_failure(
            checker_command(default_public),
            "default-off hidden workers.dev reference",
        )
    finally:
        default_homepage.write_text(default_original, encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--hugo",
        default="hugo",
        help=f"Hugo Extended {HUGO_VERSION} executable (default: hugo)",
    )
    arguments = parser.parse_args()

    try:
        hugo = resolve_hugo(arguments.hugo)
        with tempfile.TemporaryDirectory(prefix="groklab-visitor-map-integration-") as value:
            temporary = pathlib.Path(value)
            default_public, enabled_public = build_positive_states(hugo, temporary)
            check_rejected_configs(hugo, temporary)
            check_rejected_artifacts(default_public, enabled_public)
    except (IntegrationFailure, OSError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    print(
        "Visitor-map integration check passed: default-off and fixture-enabled builds, "
        "strict config rejection, and negative artifact mutations."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
