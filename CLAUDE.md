# CLAUDE.md

This file guides Claude Code (and other AI assistants) working in this repository.

## Documentation language split

- `CLAUDE.md` (this file): **English** — AI-assistant context.
- `README.md`: **German** — the app's UI is German (`lang="de"`), and the human audience is German-speaking. Keep it that way; don't "fix" this into English.

## What this project is

Umfrage-Manager: a locally run survey creation/management tool that replaces a manual Excel-based workflow. No server, no external network dependency at runtime. The distributed app is still a single file (`UmfrageManager.html`), but — as of the Phase 0 build-step refactor — that file is now a **generated build artifact**, not hand-edited source.

This is part of a larger, separately-planned effort (see `plan-gitHubPageClient.md`): Phase 0 (build-step refactor), Phase 1 (unified YAML format, breaking, `APP_VERSION` 2.0.0) and Phase 2 (hosted-client build artifact, `APP_VERSION` 2.1.0) are done. Phase 3 (actually deploying `client/index.html` to GitHub Pages via a CI workflow, plus manager UI to show/copy the canonical Pages URL) has **not** been implemented yet — the artifact exists and is committed, but nothing publishes it anywhere yet, and the manager has no UI referencing a hosted URL. Don't assume a live, reachable hosted client exists until that work lands.

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
              format.js       — unified YAML format module (see Data model
                                 below): buildUnifiedSurvey/parseUnifiedSurvey,
                                 question-ID sanitization/dedup, legacy-format
                                 (< 2.0.0) detection/rejection
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
                                 importAnswers; supports SURVEY === null,
                                 see "Hosted client" below)
              client.css      — client-only CSS rules
  build.py    — generates UmfrageManager.html and client/index.html (see below)
  client/     index.html      — generated, committed hosted-client artifact
                                 (see "Hosted client" below). Never edit
                                 directly — edit src/client|shared and rerun
                                 python3 build.py, same as UmfrageManager.html.
  ```
- **What `build.py` does:** `build_client_bundle()` assembles the `src/client/` + `src/shared/` sources into the client's HTML template and app script exactly once; both generated artifacts below are built from that single function, so the client's HTML/CSS/JS is never duplicated by hand:
  - `build_manager_html()` concatenates `shared/` + `manager/` sources into `manager.html`'s placeholders to produce the committed `UmfrageManager.html`, and embeds the client bundle as two JS string constants (`CLIENT_HTML_TEMPLATE`, `CLIENT_APP_SCRIPT_SRC`) into the manager's own script so that `buildClientHtml()` only fills in runtime-only placeholders (survey JSON, CSP hashes, escaped title/label) when a user clicks "Als HTML exportieren".
  - `build_hosted_client_html()` fills the same bundle's `{{SURVEY_JSON}}` placeholder with the literal `null` and generic placeholder title/label text (no survey is known at build time), to produce the committed `client/index.html`.
  - Both functions compute the CSP `script-src` SHA-256 hashes for their own document's two `<script>` blocks automatically at build time (see the CSP invariant below) — **there is no manual hash-recomputation step for either artifact**. Run `python3 build.py` any time a file under `src/` changes; it regenerates both `UmfrageManager.html` and `client/index.html`, and both must be committed together with the source change.
- Structure of the generated `UmfrageManager.html` (unchanged from before the refactor):
  - Inline `<style>` block.
  - Vendored **js-yaml 4.1.0** (MIT), embedded directly as an active `<script id="jsyaml-src">` (no `eval()` — see the CSP invariant below for why). The library runs immediately as a normal script.
  - The main application logic, in a `<script>` block after that.
- No CDN scripts, no external fonts — everything needed to run is embedded in either generated file, so both work fully offline (`UmfrageManager.html` from `file://`; `client/index.html` has no runtime network dependency either, though it is meant to be served over HTTPS once Phase 3 wires up a Pages deploy).

## Hosted client (`client/index.html`, Phase 2)

- **Two operating modes in one `src/client/` bundle**, distinguished at runtime by whether `SURVEY` is a real object or `null`:
  - **Embedded mode** (`UmfrageManager.html`'s "Als HTML exportieren" → `buildClientHtml()`): `SURVEY` is substituted with a real survey object at export time. The question view renders immediately, exactly as before Phase 2 — no start screen, no behavior change.
  - **Hosted mode** (`client/index.html`, built by `build_hosted_client_html()`): `SURVEY` is the literal `null`. The page shows a start view instead — a short usage description, a file picker, and a drag-and-drop zone (`#start-view`/`#drop-zone` in `client.html`) — until a `.yaml`/`.yml` file is imported and successfully parsed via `parseUnifiedSurvey(raw, {withAnswers: true})`. Only then does `client.js` populate an in-memory survey state (`setSurveyState()`), derive `UUID`/`LS_PREFIX` from the imported data's `uuid` (not a build-time constant), render the question view, and hide the start view. The imported file may be either a bare definition (empty `antwort`/`antwort_meta`) or a colleague's partially-filled answer export — both are accepted, and `antwort_meta.version` auto-increments on import exactly like the embedded client's existing re-import flow.
  - Both modes share one FileReader/parse code path (`readYamlFile()` in `client.js`) so the file-picker and the drag-and-drop handler never duplicate parsing logic.
- **Drag-and-drop safety:** `dragover`/`drop` get `preventDefault()` at the **document level**, not just on the drop zone — otherwise a drop that misses the zone makes the browser navigate to/display the raw YAML file as a page. Only a single `.yaml`/`.yml` file per drop is accepted (extension-checked); anything else is rejected with an alert, no silent fallback.
- **No export-time escaping applies in hosted mode** — there's no templating step at the point the survey becomes known, unlike the embedded export where `buildClientHtml()` runs `escapeHtml()` over the title/label before baking them into the HTML. Title, `frist`, `bezeichner_label`, question text, and options all come from runtime-parsed, untrusted YAML in both modes, so `client.js` sets all of them via `textContent`/`placeholder`/`createElement` at runtime (`applySurveyMeta()`, `renderQuestions()`) rather than relying on any value being pre-escaped by a build step — this also means the `{{TITLE}}`/`{{BEFRAGTER_LABEL}}` template placeholders are just initial/fallback text now, not the source of truth once a survey is loaded.
- **localStorage stays UUID-scoped** (`umfrageClient.<uuid>.*`) exactly as before Phase 2; in hosted mode the prefix is only known after import, so nothing is read/written under it beforehand. A minimal "Andere Umfrage laden" button (visible only in hosted mode) reloads the page to return to the start view — deliberately simple, since the hosted client is a static page that always boots with `SURVEY = null`, so a reload alone is enough and no explicit state teardown was needed.
- **CSP:** computed at **build time** in `build_hosted_client_html()` (same `hashlib`/`base64` technique `build.py` already uses for the manager), since there's no manager UI at hosted-client-build time to run `crypto.subtle.digest()` live the way `buildClientHtml()` does for the embedded export. No manual hash-maintenance step either way.
- **Not yet done (Phase 3):** nothing deploys `client/index.html` anywhere — no GitHub Actions workflow, no Pages configuration, no canonical URL. The manager has no help box, no canonical-client-URL display, and no copy-link UI referencing a hosted client. Don't describe any of that as existing.

## Data model

**Since Phase 1 (`APP_VERSION` 2.0.0, breaking change), one unified YAML shape is used everywhere** — manager survey-definition export/import, the manager's single consolidated export button (which doubles as the HTML-client's input), and the HTML client's own answer export/import. This shape and its coercion/validation live in `src/shared/format.js` (`buildUnifiedSurvey`/`parseUnifiedSurvey`), not duplicated ad hoc per call site:

```
{ uuid, bezeichnung, frist, bezeichner_label, app_version,
  antwort_meta: { befragte, version, datum, notizen },
  fragen: [ { id, typ, text, optionen?, einheit?, erlaubtDezimal?, antwort } ] }
```

- `antwort` (per question) and `antwort_meta` are present but empty (`version: 0`) on a pure manager definition/client export; the HTML client fills them in on answer export.
- `antwort_meta.version` is auto-incremented by the client every time it *imports* a YAML (e.g. a colleague's in-progress answers); it is **purely informational, never an integrity/authenticity signal** — don't add code that trusts it as such. `befragte` is the only required field for a valid answer export.
- Files predating this format (old field names `umfrage_uuid`/`bezeichnung_umfrage`, a separate top-level `antworten` map, or `app_version` major < 2) are detected by `format.js` and **rejected with an explicit user-facing error** at every import entry point (manager definition import, manager answer import, client answer import) — never silently misinterpreted.
- Each question (`fragen[]`) has `{ id, typ, text }`, plus type-specific fields: `typ: 'auswahl'` → `optionen: [...]`; `typ: 'zahl'` → `einheit`, `erlaubtDezimal`; `typ: 'freitext'`, `'ja_nein'` → no extra fields. Question IDs must match `/^[A-Za-z0-9_-]+$/`; duplicates get a `_2`/`_3`/… suffix (`sanitizeQuestionIds()` in `format.js`).
- Manager answer-import also checks the imported file's `uuid` against the currently open survey and rejects (does not silently merge) a mismatch.

## Persistence

Data lives only in browser `localStorage`, no server round-trip:
- `umfrageManager.<uuid>.meta` — survey metadata
- `umfrageManager.<uuid>.fragen` — questions array
- `umfrageManager.<uuid>.antworten` — imported answers for that survey (an array of unified-format answer objects, see Data model above, since Phase 1)

All access goes through `lsGet/lsSet/lsRemove/lsKeys` helpers wrapped in try/catch. When `localStorage` is unavailable (e.g. some `file://` configurations), the app shows the `#ls-banner` warning and silently doesn't persist — don't add code paths that assume persistence always succeeds.

## The two-HTML-file exchange pattern

This is the mechanism the app uses instead of a server:

1. The manager has **one consolidated export button** that produces a single unified-format YAML file (`<bezeichnung>.yaml`, see Data model above) via `buildSurveyObject()` → `format.js`'s `buildUnifiedSurvey()`. This file serves double duty: manager→manager definition exchange (re-importable via `importSurveyYaml()`/`jsyaml.load`) *and* manager→respondent input for the hosted/YAML-only flow.
2. `exportSurveyAsHtml()` generates a **second, fully standalone HTML file** — a respondent-facing "client" — with the same unified survey object (JSON) and the same vendored js-yaml baked in. This file is meant to be handed to survey respondents, who fill it out in their own browser with no server involved. The client's HTML/CSS/JS comes from the `src/client/` + `src/shared/` bundle (including `format.js`) that `build.py` pre-assembles into the manager's script (see Architecture above); `buildClientHtml()` only substitutes the survey JSON, CSP hashes, and the escaped title/label at export time — it calls the same `buildSurveyObject()` as the plain YAML export, so both exports always agree on shape.
3. Respondents export their answers as a YAML file from that client (`antwort_meta` filled in, `antwort_meta.version` auto-incremented on every import into the client).
4. The manager re-imports those answer YAML files for aggregation and CSV export in the "Auswertung" (evaluation) tab, reading each question's answer from `frage.antwort`.

When touching this flow, keep the manager and client sources consistent — e.g., if the survey data shape changes, both `src/manager/manager.js` (rendering/export) and `src/client/client.js` (respondent-facing rendering/answers) need to agree on it. Any change to either bundle requires an `python3 build.py` rerun before the change takes effect in `UmfrageManager.html`.

## Security invariants — do not regress these

- **Never use `innerHTML`/`insertAdjacentHTML` with user- or import-controlled data.** All dynamic rendering of survey names, question text, options, and answers must use `textContent`/`createElement`. This is enforced today with an explicit code comment; preserve it.
- The one place raw HTML is intentionally generated — the template literal in `buildClientHtml()` that produces the exported client file — uses a local `escapeHtml()` for interpolated strings and neutralizes `</script>` breakout for the embedded survey JSON (`.replace(/<\//g, '<\\/')`). Any change to this template must keep both protections.
- **No `eval()` anywhere in this codebase.** js-yaml used to be activated via `eval()`; it is now embedded directly as an active `<script>` instead, specifically so that neither document needs `'unsafe-eval'` in its CSP. Don't reintroduce `eval()`/`new Function()` for any purpose — it would force `'unsafe-eval'` back into the policies below and weaken them.
- **Content Security Policy (hash-based `script-src`).** `UmfrageManager.html`, every exported client HTML file, and the committed hosted-client artifact `client/index.html` all carry a `<meta http-equiv="Content-Security-Policy">` tag as the *first element in `<head>`* (a meta CSP only governs content that appears after it in document order). The policy is `default-src 'none'; script-src 'sha256-<hash>' 'sha256-<hash>'; style-src 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'none'; connect-src 'none'`.
  - `script-src` allow-lists the exact SHA-256 hash of each `<script>` block's content (base64-encoded, `crypto.subtle.digest('SHA-256', ...)`), not a nonce — a nonce baked into a static, offline file would be identical on every load and trivially readable from the page source, so it would offer an attacker no less than a nonce visibly copy-pasted alongside the injected `<script>` tag. A content hash blocks any injected/altered script even if the attacker can read the whole page.
  - **Manager (`UmfrageManager.html`) and hosted client (`client/index.html`) — hashes are computed automatically by `build.py`.** If you change script content under `src/shared/`, `src/manager/`, or `src/client/`, just rerun `python3 build.py` before committing; `build_manager_html()` and `build_hosted_client_html()` each re-extract the exact text content of their document's two `<script>` blocks and recompute their SHA-256 hashes into that document's CSP `<meta>` tag. There is no manual hash-recomputation step for either artifact. (The exported client's hashes are still computed at runtime in the browser — see below — that part is unchanged.)
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
- **Rerun `python3 build.py` whenever anything under `src/` changes, before committing.** It regenerates both `UmfrageManager.html` and `client/index.html` and recomputes both documents' CSP script hashes automatically (see the CSP invariant above) — there is no separate manual hash step anymore, but forgetting to rerun the build after a source change means the committed artifacts still reflect the *old* source, which is just as broken as a stale hash used to be. Commit both regenerated files together with the source change.

## License

MIT (see `LICENSE`). The SPDX header in `UmfrageManager.html` and the in-app footer must stay in sync with whatever license is in effect.
