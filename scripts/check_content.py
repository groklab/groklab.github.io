#!/usr/bin/env python3
"""Validate Markdown posts and smoke-test build-time math and image rendering."""

from __future__ import annotations

import argparse
import ast
import datetime as dt
import html.parser
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.parse


SLUG_RE = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*\Z")
FENCE_RE = re.compile(
    r"(?ms)^[ \t]*(?P<fence>`{3,}|~{3,})[^\n]*\n.*?^[ \t]*(?P=fence)[ \t]*$"
)
INLINE_CODE_RE = re.compile(r"(?<!`)`[^`\n]*`(?!`)")
MARKDOWN_IMAGE_RE = re.compile(
    r"!\[(?P<alt>[^\]]*)\]\(\s*(?:<(?P<angle>[^>]+)>|(?P<plain>[^\s)]+))"
)
REFERENCE_IMAGE_RE = re.compile(r"!\[(?P<alt>[^\]]*)\]\s*\[(?P<label>[^\]]*)\]")
REFERENCE_DEF_RE = re.compile(
    r"(?m)^[ \t]{0,3}\[(?P<label>[^\]]+)\]:[ \t]*(?:<(?P<angle>[^>]+)>|(?P<plain>\S+))"
)


class ContentError(Exception):
    """A user-correctable content validation error."""


class ImageHTMLParser(html.parser.HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.images: list[dict[str, str | None]] = []

    def handle_starttag(
        self, tag: str, attrs: list[tuple[str, str | None]]
    ) -> None:
        if tag.casefold() == "img":
            self.images.append({name.casefold(): value for name, value in attrs})

    def handle_startendtag(
        self, tag: str, attrs: list[tuple[str, str | None]]
    ) -> None:
        self.handle_starttag(tag, attrs)


class RenderedFeatureParser(html.parser.HTMLParser):
    """Collect the build output needed by the math and image smoke fixture."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.math_count = 0
        self.picture_count = 0
        self.sources: list[dict[str, str | None]] = []
        self.images: list[dict[str, str | None]] = []
        self.caption_parts: list[str] = []
        self.post_links: list[str] = []
        self._caption_depth = 0
        self._post_title_depth = 0

    def handle_starttag(
        self, tag: str, attrs: list[tuple[str, str | None]]
    ) -> None:
        tag = tag.casefold()
        attributes = {name.casefold(): value for name, value in attrs}
        classes = set((attributes.get("class") or "").split())
        if self._post_title_depth and tag not in {"br", "img", "source"}:
            self._post_title_depth += 1
        elif "post-entry__title" in classes:
            self._post_title_depth = 1
        if tag == "a" and self._post_title_depth and attributes.get("href"):
            self.post_links.append(attributes["href"] or "")
        if tag == "math":
            self.math_count += 1
        elif tag == "picture":
            self.picture_count += 1
        elif tag == "source":
            self.sources.append(attributes)
        elif tag == "img":
            self.images.append(attributes)
        elif tag == "figcaption":
            self._caption_depth += 1

    def handle_startendtag(
        self, tag: str, attrs: list[tuple[str, str | None]]
    ) -> None:
        self.handle_starttag(tag, attrs)

    def handle_endtag(self, tag: str) -> None:
        if tag.casefold() == "figcaption" and self._caption_depth:
            self._caption_depth -= 1
        if self._post_title_depth:
            self._post_title_depth -= 1

    def handle_data(self, data: str) -> None:
        if self._caption_depth:
            self.caption_parts.append(data)


def parse_scalar(raw: str) -> str:
    value = raw.strip()
    if not value:
        return ""
    if value[0] in {'"', "'"}:
        try:
            parsed = ast.literal_eval(value)
        except (SyntaxError, ValueError) as exc:
            raise ContentError(f"invalid quoted front matter value: {value}") from exc
        if not isinstance(parsed, str):
            raise ContentError(f"front matter value must be text: {value}")
        return parsed
    return value.split(" #", 1)[0].rstrip()


def split_front_matter(path: pathlib.Path) -> tuple[dict[str, str], str]:
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines(keepends=True)
    if not lines or lines[0].strip() != "---":
        raise ContentError("must start with YAML front matter delimited by ---")

    closing = next(
        (index for index, line in enumerate(lines[1:], start=1) if line.strip() == "---"),
        None,
    )
    if closing is None:
        raise ContentError("front matter is missing its closing --- delimiter")

    values: dict[str, str] = {}
    for line_number, line in enumerate(lines[1:closing], start=2):
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        match = re.fullmatch(r"([A-Za-z][A-Za-z0-9_-]*):\s*(.*)", line.rstrip("\r\n"))
        if not match:
            raise ContentError(
                f"line {line_number}: use one simple 'key: value' per front matter line"
            )
        key = match.group(1)
        if key in values:
            raise ContentError(f"line {line_number}: duplicate front matter key '{key}'")
        values[key] = parse_scalar(match.group(2))

    return values, "".join(lines[closing + 1 :])


def parse_date(value: str) -> dt.datetime:
    if not re.search(r"(?:Z|[+-]\d{2}:\d{2})\Z", value):
        raise ContentError(
            "date must be an ISO 8601 timestamp with an explicit offset, "
            "for example 2026-08-30T09:00:00-05:00"
        )
    try:
        parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ContentError(f"date is not a valid ISO 8601 timestamp: {value}") from exc
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        raise ContentError("date must include an explicit UTC offset")
    return parsed


def strip_code(markdown: str) -> str:
    return INLINE_CODE_RE.sub("", FENCE_RE.sub("", markdown))


def validate_local_image(
    post_path: pathlib.Path, source: str, description: str
) -> list[str]:
    errors: list[str] = []
    parsed = urllib.parse.urlsplit(source)
    if parsed.scheme or parsed.netloc:
        return [
            f"{description} must be stored inside its post bundle, not loaded "
            f"from an external URL: {source}"
        ]
    if not parsed.path:
        return [f"{description} has an empty image source"]

    decoded = urllib.parse.unquote(parsed.path)
    if decoded.startswith("/"):
        return [
            f"{description} must use a relative file inside its post bundle: {source}"
        ]
    bundle = post_path.parent.resolve()
    candidate = (bundle / decoded).resolve()
    try:
        candidate.relative_to(bundle)
    except ValueError:
        return [f"{description} escapes its post bundle: {source}"]
    if not candidate.is_file():
        errors.append(f"{description} points to missing local image: {source}")
    return errors


def validate_images(path: pathlib.Path, body: str) -> list[str]:
    errors: list[str] = []
    searchable = strip_code(body)
    definitions = {
        match.group("label").casefold(): match.group("angle") or match.group("plain")
        for match in REFERENCE_DEF_RE.finditer(searchable)
    }

    for number, match in enumerate(MARKDOWN_IMAGE_RE.finditer(searchable), start=1):
        alt = match.group("alt").strip()
        source = match.group("angle") or match.group("plain")
        description = f"Markdown image {number}"
        if not alt:
            errors.append(f"{description} needs meaningful alt text")
        errors.extend(validate_local_image(path, source, description))

    for number, match in enumerate(REFERENCE_IMAGE_RE.finditer(searchable), start=1):
        alt = match.group("alt").strip()
        label = (match.group("label") or alt).casefold()
        description = f"reference image {number}"
        if not alt:
            errors.append(f"{description} needs meaningful alt text")
        source = definitions.get(label)
        if source is None:
            errors.append(f"{description} has no matching [{label}] definition")
        else:
            errors.extend(validate_local_image(path, source, description))

    parser = ImageHTMLParser()
    parser.feed(searchable)
    for number, image in enumerate(parser.images, start=1):
        description = f"HTML image {number}"
        alt = image.get("alt")
        if alt is None or not alt.strip():
            errors.append(f"{description} needs a non-empty alt attribute")
        source = image.get("src")
        if not source:
            errors.append(f"{description} needs a src attribute")
        else:
            errors.extend(validate_local_image(path, source, description))
    return errors


def validate_posts(root: pathlib.Path, now: dt.datetime) -> list[str]:
    errors: list[str] = []
    posts_root = root / "content" / "posts"
    paths = sorted(path for path in posts_root.rglob("*.md") if path.name != "_index.md")
    if not paths:
        return ["content/posts must contain at least one Markdown post"]

    seen_slugs: dict[str, pathlib.Path] = {}
    for path in paths:
        relative = path.relative_to(root)
        try:
            front_matter, body = split_front_matter(path)
        except (ContentError, OSError, UnicodeError) as exc:
            errors.append(f"{relative}: {exc}")
            continue

        required = {"title", "date", "slug", "draft"}
        missing = sorted(required - front_matter.keys())
        if missing:
            errors.append(f"{relative}: missing front matter: {', '.join(missing)}")
            continue

        title = front_matter["title"].strip()
        slug = front_matter["slug"].strip()
        draft = front_matter["draft"].casefold()
        if not title:
            errors.append(f"{relative}: title must not be empty")
        if not SLUG_RE.fullmatch(slug):
            errors.append(
                f"{relative}: slug must use lowercase ASCII words separated by hyphens"
            )
        elif slug in seen_slugs:
            errors.append(
                f"{relative}: slug duplicates {seen_slugs[slug].relative_to(root)}"
            )
        else:
            seen_slugs[slug] = path

        if path != posts_root / slug / "index.md":
            errors.append(
                f"{relative}: posts must use content/posts/<slug>/index.md page bundles"
            )

        if draft not in {"true", "false"}:
            errors.append(f"{relative}: draft must be the boolean true or false")
        elif draft == "true":
            errors.append(
                f"{relative}: draft is true, so a production push would not publish it"
            )

        try:
            published = parse_date(front_matter["date"])
        except ContentError as exc:
            errors.append(f"{relative}: {exc}")
        else:
            if published.astimezone(dt.timezone.utc) > now.astimezone(dt.timezone.utc):
                errors.append(
                    f"{relative}: date is in the future; Hugo would not publish it in this build"
                )

        if not body.strip():
            errors.append(f"{relative}: post body must not be empty")
        errors.extend(f"{relative}: {error}" for error in validate_images(path, body))
    return errors


def smoke_test_rendering(root: pathlib.Path, hugo_command: str) -> list[str]:
    executable = shutil.which(hugo_command)
    if executable is None:
        return [
            f"Hugo executable '{hugo_command}' was not found; install Hugo 0.165.0 "
            "to run the build-time math and image smoke test"
        ]

    source_image = root / "static" / "apple-touch-icon.png"
    if not source_image.is_file():
        return ["static/apple-touch-icon.png is required by the rendering smoke test"]

    with tempfile.TemporaryDirectory(prefix="hugo-rendering-smoke-") as temporary:
        temp = pathlib.Path(temporary)
        posts_dir = temp / "content" / "posts"
        fixture_dir = posts_dir / "rendering-smoke"
        fixture_dir.mkdir(parents=True)
        fixture = """---
title: "Rendering smoke"
date: 2026-01-02T00:00:00+00:00
slug: "rendering-smoke"
draft: false
---

Inline math: \\(E = mc^2\\).

Display math:

\\[
\\int_0^1 x^2\\,dx = \\frac{1}{3}
\\]

![Responsive image smoke](./smoke.png "Responsive image caption")
"""
        (fixture_dir / "index.md").write_text(fixture, encoding="utf-8")
        shutil.copyfile(source_image, fixture_dir / "smoke.png")
        older_dir = posts_dir / "older-smoke"
        older_dir.mkdir()
        older_fixture = """---
title: "Older smoke"
date: 2026-01-01T00:00:00+00:00
slug: "older-smoke"
draft: false
---

Older post used to verify newest-first ordering.
"""
        (older_dir / "index.md").write_text(older_fixture, encoding="utf-8")
        destination = temp / "public"
        command = [
            executable,
            "--baseURL",
            "https://example.invalid/",
            "--cacheDir",
            str(temp / "cache"),
            "--cleanDestinationDir",
            "--contentDir",
            str(temp / "content"),
            "--destination",
            str(destination),
            "--gc",
            "--minify",
            "--panicOnWarning",
        ]
        result = subprocess.run(
            command,
            cwd=root,
            check=False,
            capture_output=True,
            text=True,
        )
        if result.returncode:
            details = "\n".join(
                part.strip() for part in (result.stderr, result.stdout) if part.strip()
            )
            return [
                f"Hugo rendering smoke build failed (exit {result.returncode}): {details}"
            ]

        rendered_path = destination / "posts" / "rendering-smoke" / "index.html"
        if not rendered_path.is_file():
            return ["Hugo rendering smoke did not generate the fixture post"]

        features = RenderedFeatureParser()
        features.feed(rendered_path.read_text(encoding="utf-8"))
        features.close()
        errors: list[str] = []
        if features.math_count < 2:
            errors.append(
                "Hugo rendering smoke expected inline and display MathML; verify "
                "Goldmark passthrough delimiters and the math render hook"
            )
        if features.picture_count != 1:
            errors.append(
                "Hugo rendering smoke expected one responsive <picture>; verify the "
                "image render hook"
            )

        webp_sources = [
            source
            for source in features.sources
            if source.get("type") == "image/webp" and source.get("srcset")
        ]
        if len(webp_sources) != 1:
            errors.append("Hugo rendering smoke expected one WebP source with a srcset")
        else:
            for candidate in (webp_sources[0]["srcset"] or "").split(","):
                url = candidate.strip().split(maxsplit=1)[0]
                target = destination / urllib.parse.urlsplit(url).path.lstrip("/")
                if not url or not target.is_file():
                    errors.append(
                        f"Hugo rendering smoke produced a missing WebP candidate: {url}"
                    )

        if len(features.images) != 1:
            errors.append("Hugo rendering smoke expected one fallback <img>")
        else:
            image = features.images[0]
            expected = {
                "alt": "Responsive image smoke",
                "loading": "lazy",
                "decoding": "async",
                "title": "Responsive image caption",
            }
            for attribute, value in expected.items():
                if image.get(attribute) != value:
                    errors.append(
                        f"Hugo rendering smoke expected img {attribute}={value!r}"
                    )
            for attribute in ("width", "height"):
                if not re.fullmatch(r"[1-9][0-9]*", image.get(attribute) or ""):
                    errors.append(
                        f"Hugo rendering smoke expected a positive img {attribute}"
                    )
            source = image.get("src") or ""
            target = destination / urllib.parse.urlsplit(source).path.lstrip("/")
            if not source or not target.is_file():
                errors.append(
                    f"Hugo rendering smoke produced a missing fallback image: {source}"
                )

        caption = " ".join(" ".join(features.caption_parts).split())
        if caption != "Responsive image caption":
            errors.append("Hugo rendering smoke did not preserve the image caption")

        homepage_path = destination / "index.html"
        homepage = RenderedFeatureParser()
        homepage.feed(homepage_path.read_text(encoding="utf-8"))
        homepage.close()
        expected_order = ["/posts/rendering-smoke/", "/posts/older-smoke/"]
        if homepage.post_links[:2] != expected_order:
            errors.append(
                "Hugo rendering smoke expected homepage posts newest first; found "
                f"{homepage.post_links[:2]!r}"
            )
        archive_path = destination / "posts" / "index.html"
        archive = RenderedFeatureParser()
        archive.feed(archive_path.read_text(encoding="utf-8"))
        archive.close()
        if archive.post_links[:2] != expected_order:
            errors.append(
                "Hugo rendering smoke expected archive posts newest first; found "
                f"{archive.post_links[:2]!r}"
            )
        if errors:
            return errors
    return []


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=pathlib.Path, default=pathlib.Path.cwd())
    parser.add_argument("--hugo", default="hugo", help="Hugo executable name or path")
    arguments = parser.parse_args()
    root = arguments.root.resolve()

    errors = validate_posts(root, dt.datetime.now(dt.timezone.utc))
    errors.extend(smoke_test_rendering(root, arguments.hugo))
    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1

    print("Content check passed: front matter, publication state, images, and math.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
