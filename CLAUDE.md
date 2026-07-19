# CLAUDE.md

This file guides Claude Code (and other AI assistants) working in this repository.

## Documentation language split

- `CLAUDE.md` (this file): **English** — AI-assistant context.
- `README.md`: **German** — the app's UI is German (`lang="de"`), and the human audience is German-speaking. Keep it that way; don't "fix" this into English.

## What this project is

Umfrage-Manager: a locally run survey creation/management tool that replaces a manual Excel-based workflow. No server, no external network dependency at runtime. The distributed app is still a single file (`UmfrageManager.html`), but — as of the Phase 0 build-step refactor — that file is now a **generated build artifact**, not hand-edited source.

This build-step introduction is "Phase 0" of a larger, separately-planned effort (see `plan-gitHubPageClient.md`) that will eventually add a YAML format change and a GitHub-Pages-hosted client. Those later phases have **not** been implemented yet — don't assume the answer/YAML format has changed, and don't assume a hosted client exists, until that work actually lands.

## Architecture

- **`UmfrageManager.html` (repo root) is a generated file, committed to the repo.** It is produced by `build.py` from the sources under `src/`. **Never edit `UmfrageManager.html` directly** — your changes will be silently overwritten (and lost) the next time someone runs the build. Always edit the appropriate file under `src/` and rerun `python3 build.py`.
- **Build step: `build.py`, pure Python 3 standard library, no dependencies** (no Node, no npm, no pip packages — Node isn't available in this environment, and dependency-free was a deliberate choice; see `plan-gitHubPageClient.md`, "Build-Step"). There is still no test framework. Do not invent other build/lint/test commands beyond `python3 build.py`.
- Source tree:
  ```
  src/
    shared/   js-yaml.min.js  — vendored js-yaml 4.1.0, extracted as-is
              common.js       — helpers shared by manager and client:
                                 escapeHtml, sanitizeFilename, triggerDownload,
                                 lsGet/lsSet/lsRemove/lsKeys, APP_VERSION,
                                 parseVersion/compareVersions
              base.css        — CSS rules identical in both UIs (reset, .card,
                                 label, .btn*, #ls-banner)
    manager/  manager.html    — manager document template (placeholders:
                                 {{STYLE}}, {{JSYAML}}, {{APP_JS}}, {{CSP}})
              manager.js      — manager-only logic (survey CRUD, editor,
                                 YAML import/export, Auswertung, and
                                 buildClientHtml(), which assembles the
                                 exported client from the client bundle below)
              manager.css     — manager-only CSS rules
    client/   client.html     — respondent-facing client document template
                                 (placeholders: {{STYLE}}, {{CSP}}, {{TITLE}},
                                 {{BEFRAGTER_LABEL}}, {{JSYAML}}, {{APP_SCRIPT}})
              client.js       — client-only logic (SURVEY placeholder
                                 {{SURVEY_JSON}}, question rendering,
                                 loadAnswers/saveAnswers, exportAnswers/
                                 importAnswers)
              client.css      — client-only CSS rules
  build.py    — generates UmfrageManager.html (see below)
  ```
- **What `build.py` does:** concatenates `shared/` + `manager/` sources into `manager.html`'s placeholders to produce the single committed `UmfrageManager.html`; separately assembles the client bundle (`shared/` + `client/`) into two JS string constants (`CLIENT_HTML_TEMPLATE`, `CLIENT_APP_SCRIPT_SRC`) that get embedded into the manager's own script so that `buildClientHtml()` no longer duplicates the client's HTML/CSS/JS by hand — it only fills in runtime-only placeholders (survey JSON, CSP hashes, escaped title/label) when a user clicks "Als HTML exportieren". It also computes the CSP `script-src` SHA-256 hashes for the manager's two `<script>` blocks automatically (see the CSP invariant below) — **the old manual hash-recomputation step is gone**. Run `python3 build.py` any time a file under `src/` changes, and commit the regenerated `UmfrageManager.html` together with the source change.
- Structure of the generated `UmfrageManager.html` (unchanged from before the refactor):
  - Inline `<style>` block.
  - Vendored **js-yaml 4.1.0** (MIT), embedded directly as an active `<script id="jsyaml-src">` (no `eval()` — see the CSP invariant below for why). The library runs immediately as a normal script.
  - The main application logic, in a `<script>` block after that.
- No CDN scripts, no external fonts — everything needed to run is embedded in the file, so it works fully offline from `file://`.

## Data model

A survey (`Umfrage`) object: `{ uuid, bezeichnung, frist, bezeichner_label, app_version, fragen: [...] }`.

Each question (`fragen[]`) has `{ id, typ, text }`, plus type-specific fields:
- `typ: 'auswahl'` → `optionen: [...]`
- `typ: 'zahl'` → `einheit`, `erlaubtDezimal`
- `typ: 'freitext'`, `'ja_nein'` → no extra fields

Question IDs must match `/^[A-Za-z0-9_-]+$/`; duplicates are rejected.

## Persistence

Data lives only in browser `localStorage`, no server round-trip:
- `umfrageManager.<uuid>.meta` — survey metadata
- `umfrageManager.<uuid>.fragen` — questions array
- `umfrageManager.<uuid>.antworten` — imported answers for that survey

All access goes through `lsGet/lsSet/lsRemove/lsKeys` helpers wrapped in try/catch. When `localStorage` is unavailable (e.g. some `file://` configurations), the app shows the `#ls-banner` warning and silently doesn't persist — don't add code paths that assume persistence always succeeds.

## The two-HTML-file exchange pattern

This is the mechanism the app uses instead of a server:

1. The manager exports a survey definition as **YAML** (`jsyaml.dump`), and can re-import one (`jsyaml.load`).
2. `exportSurveyAsHtml()` generates a **second, fully standalone HTML file** — a respondent-facing "client" — with the survey JSON and the same vendored js-yaml baked in. This file is meant to be handed to survey respondents, who fill it out in their own browser with no server involved. The client's HTML/CSS/JS comes from the `src/client/` + `src/shared/` bundle that `build.py` pre-assembles into the manager's script (see Architecture above); `buildClientHtml()` only substitutes the survey JSON, CSP hashes, and the escaped title/label at export time.
3. Respondents export their answers as a YAML file from that client.
4. The manager re-imports those answer YAML files for aggregation and CSV export in the "Auswertung" (evaluation) tab.

When touching this flow, keep the manager and client sources consistent — e.g., if the survey data shape changes, both `src/manager/manager.js` (rendering/export) and `src/client/client.js` (respondent-facing rendering/answers) need to agree on it. Any change to either bundle requires an `python3 build.py` rerun before the change takes effect in `UmfrageManager.html`.

## Security invariants — do not regress these

- **Never use `innerHTML`/`insertAdjacentHTML` with user- or import-controlled data.** All dynamic rendering of survey names, question text, options, and answers must use `textContent`/`createElement`. This is enforced today with an explicit code comment; preserve it.
- The one place raw HTML is intentionally generated — the template literal in `buildClientHtml()` that produces the exported client file — uses a local `escapeHtml()` for interpolated strings and neutralizes `</script>` breakout for the embedded survey JSON (`.replace(/<\//g, '<\\/')`). Any change to this template must keep both protections.
- **No `eval()` anywhere in this codebase.** js-yaml used to be activated via `eval()`; it is now embedded directly as an active `<script>` instead, specifically so that neither document needs `'unsafe-eval'` in its CSP. Don't reintroduce `eval()`/`new Function()` for any purpose — it would force `'unsafe-eval'` back into the policies below and weaken them.
- **Content Security Policy (hash-based `script-src`).** Both `UmfrageManager.html` and every exported client HTML file carry a `<meta http-equiv="Content-Security-Policy">` tag as the *first element in `<head>`* (a meta CSP only governs content that appears after it in document order). The policy is `default-src 'none'; script-src 'sha256-<hash>' 'sha256-<hash>'; style-src 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'none'; connect-src 'none'`.
  - `script-src` allow-lists the exact SHA-256 hash of each `<script>` block's content (base64-encoded, `crypto.subtle.digest('SHA-256', ...)`), not a nonce — a nonce baked into a static, offline file would be identical on every load and trivially readable from the page source, so it would offer an attacker no less than a nonce visibly copy-pasted alongside the injected `<script>` tag. A content hash blocks any injected/altered script even if the attacker can read the whole page.
  - **Manager (`UmfrageManager.html`) — hashes are computed automatically by `build.py`.** If you change script content under `src/shared/`, `src/manager/`, or `src/client/` (the client bundle is embedded into the manager's own script — see Architecture above), just rerun `python3 build.py` before committing; it re-extracts the exact text content of both `<script>` blocks and recomputes their SHA-256 hashes into the CSP `<meta>` tag. There is no longer a manual hash-recomputation step for the manager. (The exported client's hashes are still computed at runtime in the browser — see below — that part is unchanged.)
  - **Exported client:** `buildClientHtml()` is `async` and computes a fresh SHA-256 hash of its embedded script content on every export via `crypto.subtle.digest()`, so each generated client file gets an up-to-date, correct CSP automatically — no manual step needed there. This hashing is purely XSS hardening for the standalone client file; it is not used for anything else (no integrity/versioning meaning).
  - **`style-src: 'unsafe-inline'` is a deliberate, accepted risk**, not an oversight: both documents use inline `<style>` blocks and many `style="..."` attributes, and CSP has no per-attribute nonce/hash mechanism, so locking down styles as tightly as scripts would require a much larger refactor (converting every inline style to a CSS class). CSS injection is lower-severity than JS injection (no arbitrary code execution). Don't "fix" this without discussing scope with the user first — see also README.md's Sicherheit section, which documents the same acceptance.
  - `crypto.subtle` requires no fallback: `file://` is treated as a secure context in current Chrome, Firefox, and Safari, so `crypto.subtle.digest` is available without a server.
- Survey and answer data is stored unencrypted in `localStorage` in both the manager and the generated client, with no access control beyond the browser profile. This is a known, accepted characteristic, not a bug to silently "fix" with ad hoc encryption — larger security posture changes should be discussed with the user first.
- Imported YAML is trusted structurally without schema validation (`jsyaml.load` in js-yaml 4.x is safe against arbitrary type instantiation, but doesn't validate shape). Malformed input should fail gracefully, not silently corrupt state.

## Process instructions

- **Edit `src/`, never `UmfrageManager.html` directly, then run `python3 build.py`.** The generated file is what gets committed, but the source of truth is under `src/`.
- **Bump `APP_VERSION`** (in `src/shared/common.js`) by default whenever you make a change to the app — the user will explicitly say if a particular change should *not* bump it. `APP_VERSION` is embedded into exported YAML files and compared on import to warn about version mismatches, so keep it accurate.
- **Check whether `README.md` needs updating** whenever you make a change — it's the human-facing description of behavior, usage, and security posture. If a change affects what's described there, update it in the same pass rather than leaving it stale.
- **Update `CHANGELOG.md`** whenever you make a user-visible or security-relevant change. It's a German-language changelog following the [Keep a Changelog](https://keepachangelog.com/) format; its version headings mirror `APP_VERSION`. Add entries under an `## [Unveröffentlicht]` (Unreleased) section as you go, and when you bump `APP_VERSION`, promote those entries into a new dated version heading matching the new `APP_VERSION`. Keep it in German to match `README.md`.
- js-yaml is vendored inline rather than CDN-loaded, as `src/shared/js-yaml.min.js`. If it's ever upgraded, replace that file's content with the new vendored source (single copy now — it feeds both the manager and the exported client via `build.py`) and rerun the build — there's no dependency manager doing this automatically.
- **Rerun `python3 build.py` whenever anything under `src/` changes, before committing.** It recomputes the manager's CSP script hashes automatically (see the CSP invariant above) — there is no separate manual hash step anymore, but forgetting to rerun the build after a source change means `UmfrageManager.html` still reflects the *old* source, which is just as broken as a stale hash used to be.

## License

MIT (see `LICENSE`). The SPDX header in `UmfrageManager.html` and the in-app footer must stay in sync with whatever license is in effect.
