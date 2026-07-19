#!/usr/bin/env python3
"""Build script for Umfrage-Manager.

Assembles UmfrageManager.html (repo root, committed) from the sources under
src/. Pure Python 3 standard library, no dependencies (no Node, no pip
packages) — see plan-gitHubPageClient.md, "Build-Step (entschieden;
Struktur)" and CLAUDE.md.

What it does:
  1. Reads src/shared/{js-yaml.min.js, common.js, format.js, base.css},
     src/manager/{manager.html, manager.js, manager.css} and src/client/
     {client.html, client.js, client.css}.
  2. Builds the standalone client bundle (CLIENT_HTML_TEMPLATE and
     CLIENT_APP_SCRIPT_SRC) as JS string constants and prepends them to
     manager.js, so buildClientHtml() in the manager no longer duplicates
     the client's HTML/CSS/JS by hand — it just fills in the runtime-only
     placeholders (survey JSON, CSP hashes, escaped title/label).
  3. Concatenates src/shared/common.js + the client-bundle constants +
     src/manager/manager.js into the single "app logic" <script> block,
     and src/shared/base.css + src/manager/manager.css into manager's
     <style> block.
  4. Computes the SHA-256 (base64) hash of the exact text content of the
     two <script> blocks (js-yaml, app logic) and injects them into the
     CSP <meta> tag — this replaces the manual hash-recomputation step
     that CLAUDE.md used to document.
  5. Writes the result to UmfrageManager.html at the repo root.

Usage:
    python3 build.py

Re-run this after any change under src/ and commit the regenerated
UmfrageManager.html together with the source change.
"""
import base64
import hashlib
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent
SRC = ROOT / "src"


def read(relpath: str) -> str:
    return (SRC / relpath).read_text(encoding="utf-8")


def sha256_base64(text: str) -> str:
    digest = hashlib.sha256(text.encode("utf-8")).digest()
    return base64.b64encode(digest).decode("ascii")


def to_js_template_literal(text: str) -> str:
    """Escape text for safe embedding as a JS backtick template literal.

    This is needed because build.py embeds whole HTML/JS/CSS bundles
    (which legitimately contain their own literal `<script>...</script>`
    tags) as string constants inside the manager's own <script> block.
    Without escaping, a literal `</script>` inside the embedded text would
    make the browser's HTML parser close the *outer* <script> tag early —
    the same class of problem the original buildClientHtml() guarded
    against for the embedded survey JSON via `.replace(/<\\//g, '<\\\\/')`.
    """
    escaped = text.replace("\\", "\\\\")
    escaped = escaped.replace("`", "\\`")
    escaped = escaped.replace("${", "\\${")
    # Neutralize any "</" so "</script>" can never appear literally inside
    # the outer <script> block (mirrors buildClientHtml()'s existing
    # protection for the embedded survey JSON).
    escaped = escaped.replace("</", "<\\/")
    return escaped


def extract_script_content(html: str, search_from: int) -> str:
    """Returns the exact text content of the next <script ...>...</script>
    element at/after `search_from` (everything after the opening tag's
    closing ">" up to the matching "</script>")."""
    tag_start = html.index("<script", search_from)
    tag_close = html.index(">", tag_start) + 1
    content_end = html.index("</script>", tag_close)
    return html[tag_close:content_end]


def build_client_bundle() -> tuple[str, str]:
    """Returns (client_html_js_const_src, client_app_script_js_const_src)."""
    client_css = read("client/client.css")
    base_css = read("shared/base.css")
    client_html = read("client/client.html")
    client_html = client_html.replace("{{STYLE}}", base_css + "\n" + client_css)

    common_js = read("shared/common.js")
    format_js = read("shared/format.js")
    client_js = read("client/client.js")
    client_app_script = common_js + "\n" + format_js + "\n" + client_js

    return client_html, client_app_script


def build_manager_html() -> str:
    manager_html = read("manager/manager.html")
    manager_css = read("manager/manager.css")
    base_css = read("shared/base.css")
    manager_js = read("manager/manager.js")
    jsyaml_src = read("shared/js-yaml.min.js")
    common_js = read("shared/common.js")
    format_js = read("shared/format.js")

    client_html_template, client_app_script_src = build_client_bundle()

    client_bundle_consts = (
        "// ============================================================\n"
        "// Vorgebautes Client-Bundle (aus src/client/*, siehe build.py).\n"
        "// buildClientHtml() unten füllt nur noch die zur Laufzeit bekannten\n"
        "// Platzhalter (Survey-JSON, CSP-Hashes, escapte Titel/Label) ein.\n"
        "// ============================================================\n"
        f"const CLIENT_HTML_TEMPLATE = `{to_js_template_literal(client_html_template)}`;\n"
        f"const CLIENT_APP_SCRIPT_SRC = `{to_js_template_literal(client_app_script_src)}`;\n"
    )

    app_js = common_js + "\n" + format_js + "\n" + client_bundle_consts + "\n" + manager_js
    style = base_css + "\n" + manager_css

    manager_html = manager_html.replace("{{STYLE}}", style)
    manager_html = manager_html.replace("{{JSYAML}}", jsyaml_src)
    manager_html = manager_html.replace("{{APP_JS}}", app_js)

    # CSP hashes: hash the *exact* text content of each <script> block, i.e.
    # everything between the opening tag's ">" and the matching "</script>"
    # — byte-for-byte identical to what the browser will actually execute.
    # This is deliberately re-extracted from the assembled document (rather
    # than hashing jsyaml_src/app_js directly) because the manager.html
    # template may wrap a placeholder in extra whitespace/newlines that
    # become part of the script element's actual text content.
    jsyaml_hash = sha256_base64(extract_script_content(manager_html, 0))
    first_end = manager_html.index("</script>") + len("</script>")
    app_js_hash = sha256_base64(extract_script_content(manager_html, first_end))
    csp = (
        "default-src 'none'; "
        f"script-src 'sha256-{jsyaml_hash}' 'sha256-{app_js_hash}'; "
        "style-src 'unsafe-inline'; img-src 'self' data:; object-src 'none'; "
        "base-uri 'none'; form-action 'none'; connect-src 'none'"
    )
    # Replace only the manager's own <meta> placeholder (count=1): the
    # app-logic script also contains a *second*, textual "{{CSP}}"
    # occurrence — inside the embedded CLIENT_HTML_TEMPLATE constant, meant
    # for the exported client's own CSP meta tag. That one must be left
    # untouched here; buildClientHtml() fills it in at runtime with the
    # client's own freshly computed hash values, not the manager's.
    manager_html = manager_html.replace("{{CSP}}", csp, 1)

    return manager_html


def main() -> None:
    output = build_manager_html()
    out_path = ROOT / "UmfrageManager.html"
    out_path.write_text(output, encoding="utf-8", newline="\n")
    print(f"Wrote {out_path} ({len(output)} bytes)")


if __name__ == "__main__":
    main()
