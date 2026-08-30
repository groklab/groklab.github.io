#!/usr/bin/env python3
"""Validate the generated GitHub Pages artifact without third-party packages."""

from __future__ import annotations

import argparse
import html.parser
import pathlib
import posixpath
import re
import sys
import urllib.parse
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field


EXPECTED_ORIGIN = "https://groklab.github.io"
EXPECTED_SITE_NAME = "真假维斯"
EXPECTED_FIRST_TITLE = "hello world"
EXPECTED_FIRST_BODY = (
    "AI时代，我突然想让自己写点东西。可多可少。未必是好的写作，"
    "但力争是我自己的写作。开始罢。"
)
REQUIRED_FILES = (
    "index.html",
    "404.html",
    "index.xml",
    "robots.txt",
    "sitemap.xml",
)
URL_SCHEMES_TO_IGNORE = {"mailto", "tel", "data"}
VOID_ELEMENTS = {
    "area",
    "base",
    "br",
    "col",
    "embed",
    "hr",
    "img",
    "input",
    "link",
    "meta",
    "param",
    "source",
    "track",
    "wbr",
}
CSS_URL_RE = re.compile(
    r"url\(\s*(?:\"(?P<double>[^\"]*)\"|'(?P<single>[^']*)'|(?P<plain>[^)'\"]+))\s*\)",
    re.IGNORECASE,
)


@dataclass
class HTMLDocument:
    path: pathlib.Path
    lang: str | None = None
    titles: list[str] = field(default_factory=list)
    canonicals: list[str] = field(default_factory=list)
    references: list[tuple[str, str, str]] = field(default_factory=list)
    images: list[dict[str, str | None]] = field(default_factory=list)
    ids: set[str] = field(default_factory=set)
    duplicate_ids: set[str] = field(default_factory=set)
    text_parts: list[str] = field(default_factory=list)
    brand_labels: list[str | None] = field(default_factory=list)
    brand_text_parts: list[str] = field(default_factory=list)
    h1_parts: list[str] = field(default_factory=list)
    post_content_parts: list[str] = field(default_factory=list)
    script_count: int = 0
    post_entry_count: int = 0

    @property
    def text(self) -> str:
        return " ".join(" ".join(self.text_parts).split())


class DocumentParser(html.parser.HTMLParser):
    def __init__(self, path: pathlib.Path) -> None:
        super().__init__(convert_charrefs=True)
        self.document = HTMLDocument(path=path)
        self._title_depth = 0
        self._nonvisible_depth = 0
        self._brand_depth = 0
        self._h1_depth = 0
        self._post_content_depth = 0

    def handle_decl(self, decl: str) -> None:
        return

    def handle_starttag(
        self, tag: str, attrs: list[tuple[str, str | None]]
    ) -> None:
        tag = tag.casefold()
        attributes = {name.casefold(): value for name, value in attrs}
        classes = set((attributes.get("class") or "").split())
        is_void = tag in VOID_ELEMENTS
        if self._brand_depth and not is_void:
            self._brand_depth += 1
        elif tag == "a" and "brand" in classes:
            self._brand_depth = 1
            self.document.brand_labels.append(attributes.get("aria-label"))
        if self._post_content_depth and not is_void:
            self._post_content_depth += 1
        elif "post-content" in classes:
            self._post_content_depth = 1
        if tag == "html" and self.document.lang is None:
            self.document.lang = attributes.get("lang")
        if tag == "title":
            self._title_depth += 1
        if tag == "h1":
            self._h1_depth += 1
        if tag == "script":
            self.document.script_count += 1
        if tag == "li" and "post-entry" in classes:
            self.document.post_entry_count += 1
        if tag in {"head", "script", "style", "template", "noscript"}:
            self._nonvisible_depth += 1

        identifier = attributes.get("id")
        if identifier:
            if identifier in self.document.ids:
                self.document.duplicate_ids.add(identifier)
            self.document.ids.add(identifier)

        if tag == "link":
            rel = {part.casefold() for part in (attributes.get("rel") or "").split()}
            href = attributes.get("href")
            if "canonical" in rel and href:
                self.document.canonicals.append(href)
            if href:
                self.document.references.append((tag, "href", href))
        elif tag == "a" and attributes.get("href") is not None:
            self.document.references.append((tag, "href", attributes["href"] or ""))
        elif tag in {"img", "script", "iframe", "audio", "video", "source"}:
            source = attributes.get("src")
            if source:
                self.document.references.append((tag, "src", source))
            if tag == "video" and attributes.get("poster"):
                self.document.references.append((tag, "poster", attributes["poster"] or ""))
            if tag in {"img", "source"} and attributes.get("srcset"):
                for item in (attributes["srcset"] or "").split(","):
                    candidate = item.strip().split(maxsplit=1)[0]
                    if candidate:
                        self.document.references.append((tag, "srcset", candidate))
            if tag == "img":
                self.document.images.append(attributes)
        elif tag == "meta":
            name = (attributes.get("property") or attributes.get("name") or "").casefold()
            content = attributes.get("content")
            if content and name in {"og:url", "og:image", "twitter:image"}:
                self.document.references.append((tag, name, content))

    def handle_startendtag(
        self, tag: str, attrs: list[tuple[str, str | None]]
    ) -> None:
        self.handle_starttag(tag, attrs)

    def handle_endtag(self, tag: str) -> None:
        tag = tag.casefold()
        if tag == "title" and self._title_depth:
            self._title_depth -= 1
        if tag == "h1" and self._h1_depth:
            self._h1_depth -= 1
        if self._brand_depth:
            self._brand_depth -= 1
        if self._post_content_depth:
            self._post_content_depth -= 1
        if tag in {"head", "script", "style", "template", "noscript"} and self._nonvisible_depth:
            self._nonvisible_depth -= 1

    def handle_data(self, data: str) -> None:
        if self._title_depth:
            self.document.titles.append(data)
        if self._brand_depth:
            self.document.brand_text_parts.append(data)
        if self._h1_depth:
            self.document.h1_parts.append(data)
        if self._post_content_depth:
            self.document.post_content_parts.append(data)
        if not self._nonvisible_depth:
            self.document.text_parts.append(data)


def page_url_path(relative: pathlib.PurePosixPath) -> str:
    value = relative.as_posix()
    if value == "index.html":
        return "/"
    if value.endswith("/index.html"):
        return f"/{value[:-len('index.html')]}"
    return f"/{value}"


def parse_html(path: pathlib.Path) -> HTMLDocument:
    parser = DocumentParser(path)
    parser.feed(path.read_text(encoding="utf-8"))
    parser.close()
    return parser.document


def local_url_path(
    value: str, current_page: str, errors: list[str], context: str
) -> tuple[str, str] | None:
    if not value:
        errors.append(f"{context}: empty URL")
        return None
    if value.startswith("//"):
        errors.append(f"{context}: protocol-relative URL is not allowed: {value}")
        return None

    parsed = urllib.parse.urlsplit(value)
    scheme = parsed.scheme.casefold()
    if scheme in URL_SCHEMES_TO_IGNORE:
        return None
    if scheme == "javascript":
        errors.append(f"{context}: javascript URL is not allowed")
        return None
    if scheme:
        if scheme not in {"http", "https"}:
            errors.append(f"{context}: unsupported URL scheme in {value}")
            return None
        origin = f"{scheme}://{parsed.netloc}"
        if parsed.netloc != "groklab.github.io":
            return None
        if origin != EXPECTED_ORIGIN:
            errors.append(f"{context}: internal absolute URL must use {EXPECTED_ORIGIN}: {value}")
        path = parsed.path or "/"
    else:
        path = urllib.parse.urljoin(current_page, parsed.path or "")

    decoded = urllib.parse.unquote(path)
    normalized = posixpath.normpath(decoded)
    if decoded.endswith("/") and normalized != "/":
        normalized += "/"
    if not normalized.startswith("/"):
        normalized = f"/{normalized}"
    return normalized, urllib.parse.unquote(parsed.fragment)


def resolve_public_path(public: pathlib.Path, url_path: str) -> pathlib.Path | None:
    relative = url_path.lstrip("/")
    candidates: list[pathlib.Path]
    if not relative:
        candidates = [public / "index.html"]
    elif url_path.endswith("/"):
        candidates = [public / relative / "index.html"]
    else:
        base = public / relative
        candidates = [base]
        if not pathlib.PurePosixPath(relative).suffix:
            candidates.extend((base / "index.html", base.with_suffix(".html")))

    public_resolved = public.resolve()
    for candidate in candidates:
        try:
            candidate.resolve().relative_to(public_resolved)
        except ValueError:
            continue
        if candidate.is_file():
            return candidate
    return None


def expected_canonical(relative: pathlib.PurePosixPath) -> str:
    return f"{EXPECTED_ORIGIN}{page_url_path(relative)}"


def validate_image_dimensions(
    image: dict[str, str | None], context: str
) -> list[str]:
    errors: list[str] = []
    alt = image.get("alt")
    if alt is None or not alt.strip():
        errors.append(f"{context}: image needs meaningful non-empty alt text")

    dimensions: dict[str, int] = {}
    for name in ("width", "height"):
        raw = image.get(name)
        if raw is None or not re.fullmatch(r"[0-9]+", raw):
            errors.append(f"{context}: image {name} must be a positive integer")
            continue
        value = int(raw)
        if not 1 <= value <= 20_000:
            errors.append(f"{context}: image {name}={value} is outside 1..20000")
        dimensions[name] = value

    if dimensions.keys() >= {"width", "height"}:
        ratio = dimensions["width"] / dimensions["height"]
        if not 0.01 <= ratio <= 100:
            errors.append(f"{context}: image dimensions have an implausible aspect ratio")
    return errors


def validate_html_documents(
    public: pathlib.Path, documents: dict[pathlib.Path, HTMLDocument]
) -> list[str]:
    errors: list[str] = []
    by_resolved_path = {path.resolve(): document for path, document in documents.items()}

    for path, document in documents.items():
        relative = pathlib.PurePosixPath(path.relative_to(public).as_posix())
        context = relative.as_posix()
        current_page = page_url_path(relative)

        if not document.lang or not document.lang.strip():
            errors.append(f"{context}: <html> needs a non-empty lang attribute")
        title = " ".join(" ".join(document.titles).split())
        if not title:
            errors.append(f"{context}: missing non-empty <title>")
        elif EXPECTED_SITE_NAME not in title:
            errors.append(f"{context}: <title> must include {EXPECTED_SITE_NAME}")

        if len(document.canonicals) != 1:
            errors.append(f"{context}: expected exactly one canonical URL")
        elif document.canonicals[0] != expected_canonical(relative):
            errors.append(
                f"{context}: canonical must be {expected_canonical(relative)}, "
                f"found {document.canonicals[0]}"
            )

        if document.duplicate_ids:
            errors.append(
                f"{context}: duplicate HTML ids: {', '.join(sorted(document.duplicate_ids))}"
            )
        brand_text = "".join(document.brand_text_parts).strip()
        if document.brand_labels != [EXPECTED_SITE_NAME] or brand_text != EXPECTED_SITE_NAME:
            errors.append(
                f"{context}: visible and accessible brand must both be exactly "
                f"{EXPECTED_SITE_NAME}"
            )
        if document.script_count:
            errors.append(
                f"{context}: client-side <script> elements are not allowed in this site"
            )

        for number, image in enumerate(document.images, start=1):
            errors.extend(validate_image_dimensions(image, f"{context} image {number}"))

        for tag, attribute, value in document.references:
            reference_context = f"{context} <{tag}> {attribute}"
            if tag == "meta":
                errors.extend(absolute_site_url(value, reference_context))
            local = local_url_path(value, current_page, errors, reference_context)
            if local is None:
                continue
            url_path, fragment = local
            target = resolve_public_path(public, url_path)
            if target is None:
                errors.append(f"{reference_context}: broken internal reference {value}")
                continue
            if fragment and target.suffix.casefold() == ".html":
                target_document = by_resolved_path.get(target.resolve())
                if target_document is not None and fragment not in target_document.ids:
                    errors.append(f"{reference_context}: missing fragment #{fragment} in {value}")
    return errors


def validate_css(public: pathlib.Path) -> list[str]:
    errors: list[str] = []
    for stylesheet in public.rglob("*.css"):
        relative = pathlib.PurePosixPath(stylesheet.relative_to(public).as_posix())
        current = f"/{relative.as_posix()}"
        text = stylesheet.read_text(encoding="utf-8")
        for match in CSS_URL_RE.finditer(text):
            value = (match.group("double") or match.group("single") or match.group("plain")).strip()
            context = f"{relative.as_posix()} CSS url()"
            local = local_url_path(value, current, errors, context)
            if local is None:
                continue
            url_path, _fragment = local
            if resolve_public_path(public, url_path) is None:
                errors.append(f"{context}: broken internal asset {value}")
    return errors


def absolute_site_url(value: str, context: str) -> list[str]:
    parsed = urllib.parse.urlsplit(value.strip())
    if parsed.scheme != "https" or parsed.netloc != "groklab.github.io":
        return [f"{context}: URL must be absolute under {EXPECTED_ORIGIN}: {value}"]
    return []


def validate_xml(public: pathlib.Path, filename: str) -> list[str]:
    errors: list[str] = []
    path = public / filename
    try:
        tree = ET.parse(path)
    except (ET.ParseError, OSError) as exc:
        return [f"{filename}: XML is not parseable: {exc}"]

    root_name = tree.getroot().tag.rsplit("}", 1)[-1].casefold()
    expected_root = "urlset" if filename == "sitemap.xml" else "rss"
    if root_name != expected_root:
        errors.append(f"{filename}: expected <{expected_root}> root, found <{root_name}>")

    found_url = False
    for element in tree.iter():
        name = element.tag.rsplit("}", 1)[-1].casefold()
        if name in {"loc", "link"} and element.text and element.text.strip():
            value = element.text.strip()
            found_url = True
            errors.extend(absolute_site_url(value, f"{filename} <{name}>"))
            parsed = urllib.parse.urlsplit(value)
            if parsed.netloc == "groklab.github.io" and resolve_public_path(public, parsed.path) is None:
                errors.append(f"{filename} <{name}>: URL has no generated target: {value}")
        elif name == "guid" and element.text and element.text.strip():
            value = element.text.strip()
            is_permalink = element.attrib.get("isPermaLink", "true").casefold() != "false"
            if is_permalink or value.startswith(("http://", "https://")):
                found_url = True
                errors.extend(absolute_site_url(value, f"{filename} <guid>"))
        href = element.attrib.get("href")
        if href:
            found_url = True
            errors.extend(absolute_site_url(href, f"{filename} href"))

    if not found_url:
        errors.append(f"{filename}: expected at least one absolute site URL")
    return errors


def validate_identity(
    public: pathlib.Path, documents: dict[pathlib.Path, HTMLDocument]
) -> list[str]:
    errors: list[str] = []
    homepage = documents.get(public / "index.html")
    if homepage is None:
        return ["index.html could not be parsed"]
    if homepage.post_entry_count < 1:
        errors.append("index.html: newest-post list must contain at least one post")

    first_post_path = public / "posts" / "hello-world" / "index.html"
    first_post = documents.get(first_post_path)
    if first_post is None:
        errors.append("generated site is missing /posts/hello-world/")
        return errors

    h1 = " ".join(" ".join(first_post.h1_parts).split())
    if h1 != EXPECTED_FIRST_TITLE:
        errors.append(
            f"/posts/hello-world/ h1 must be exactly {EXPECTED_FIRST_TITLE!r}, found {h1!r}"
        )
    body = " ".join(" ".join(first_post.post_content_parts).split())
    if body != EXPECTED_FIRST_BODY:
        errors.append(
            "/posts/hello-world/ article body must exactly match the supplied first post"
        )
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("public", nargs="?", type=pathlib.Path, default=pathlib.Path("public"))
    arguments = parser.parse_args()
    public = arguments.public.resolve()
    errors: list[str] = []

    if not public.is_dir():
        errors.append(f"artifact directory does not exist: {public}")
    else:
        for filename in REQUIRED_FILES:
            if not (public / filename).is_file():
                errors.append(f"artifact is missing required top-level file: {filename}")

    documents: dict[pathlib.Path, HTMLDocument] = {}
    if public.is_dir():
        for path in sorted(public.rglob("*.html")):
            try:
                documents[path] = parse_html(path)
            except (OSError, UnicodeError) as exc:
                errors.append(f"{path.relative_to(public)}: cannot parse UTF-8 HTML: {exc}")
        if not documents:
            errors.append("artifact does not contain any HTML files")

    errors.extend(validate_html_documents(public, documents))
    errors.extend(validate_css(public))
    if (public / "index.xml").is_file():
        errors.extend(validate_xml(public, "index.xml"))
    if (public / "sitemap.xml").is_file():
        errors.extend(validate_xml(public, "sitemap.xml"))
    errors.extend(validate_identity(public, documents))

    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1

    print(
        f"Site check passed: {len(documents)} HTML pages, links/assets, metadata, "
        "images, RSS, and sitemap."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
