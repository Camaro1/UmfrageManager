# CLAUDE.md

This file guides Claude Code (and other AI assistants) working in this repository.

## Documentation language split

- `CLAUDE.md` (this file): **English** — AI-assistant context.
- `README.md`: **German** — the app's UI is German (`lang="de"`), and the human audience is German-speaking. Keep it that way; don't "fix" this into English.

## What this project is

Umfrage-Manager: a locally run, single-file survey creation/management tool that replaces a manual Excel-based workflow. No server, no build step, no external network dependency at runtime.

## Architecture

- The entire app is **one file**: `UmfrageManager.html`. There is no `package.json`, no build tooling, no test framework, and no other source files. Do not invent build/lint/test commands — none exist. Any tooling work is a deliberate, separate decision, not an assumption.
- Structure inside the file:
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
2. `exportSurveyAsHtml()` generates a **second, fully standalone HTML file** — a respondent-facing "client" — with the survey JSON and the same vendored js-yaml baked in. This file is meant to be handed to survey respondents, who fill it out in their own browser with no server involved.
3. Respondents export their answers as a YAML file from that client.
4. The manager re-imports those answer YAML files for aggregation and CSV export in the "Auswertung" (evaluation) tab.

When touching this flow, keep both HTML files (manager and generated client) consistent — e.g., if the survey data shape changes, both the manager's rendering and the generated client's embedded logic need to agree on it.

## Security invariants — do not regress these

- **Never use `innerHTML`/`insertAdjacentHTML` with user- or import-controlled data.** All dynamic rendering of survey names, question text, options, and answers must use `textContent`/`createElement`. This is enforced today with an explicit code comment; preserve it.
- The one place raw HTML is intentionally generated — the template literal in `buildClientHtml()` that produces the exported client file — uses a local `escapeHtml()` for interpolated strings and neutralizes `</script>` breakout for the embedded survey JSON (`.replace(/<\//g, '<\\/')`). Any change to this template must keep both protections.
- **No `eval()` anywhere in this codebase.** js-yaml used to be activated via `eval()`; it is now embedded directly as an active `<script>` instead, specifically so that neither document needs `'unsafe-eval'` in its CSP. Don't reintroduce `eval()`/`new Function()` for any purpose — it would force `'unsafe-eval'` back into the policies below and weaken them.
- **Content Security Policy (hash-based `script-src`).** Both `UmfrageManager.html` and every exported client HTML file carry a `<meta http-equiv="Content-Security-Policy">` tag as the *first element in `<head>`* (a meta CSP only governs content that appears after it in document order). The policy is `default-src 'none'; script-src 'sha256-<hash>' 'sha256-<hash>'; style-src 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'none'; connect-src 'none'`.
  - `script-src` allow-lists the exact SHA-256 hash of each `<script>` block's content (base64-encoded, `crypto.subtle.digest('SHA-256', ...)`), not a nonce — a nonce baked into a static, offline file would be identical on every load and trivially readable from the page source, so it would offer an attacker no less than a nonce visibly copy-pasted alongside the injected `<script>` tag. A content hash blocks any injected/altered script even if the attacker can read the whole page.
  - **Manager (`UmfrageManager.html`) — no build step, so this is a manual step:** whenever you edit the content of either of the manager's two `<script>` blocks (the js-yaml block, id `jsyaml-src`; and the main app-logic block right after it), you MUST recompute both SHA-256 hashes and paste them into the CSP `<meta>` tag in `<head>`. If you don't, the browser will silently refuse to run the (now-mismatched) script — there is no automated check for this. To recompute: extract each script's exact text content (everything between `<script...>` and `</script>`, byte-for-byte, including surrounding whitespace/newlines) and hash it, e.g. with a short Python snippet (`hashlib.sha256(content.encode('utf-8')).digest()`, then base64-encode) or in a browser console via `crypto.subtle.digest`.
  - **Exported client:** `buildClientHtml()` is `async` and computes a fresh SHA-256 hash of its embedded script content on every export via `crypto.subtle.digest()`, so each generated client file gets an up-to-date, correct CSP automatically — no manual step needed there. This hashing is purely XSS hardening for the standalone client file; it is not used for anything else (no integrity/versioning meaning).
  - **`style-src: 'unsafe-inline'` is a deliberate, accepted risk**, not an oversight: both documents use inline `<style>` blocks and many `style="..."` attributes, and CSP has no per-attribute nonce/hash mechanism, so locking down styles as tightly as scripts would require a much larger refactor (converting every inline style to a CSS class). CSS injection is lower-severity than JS injection (no arbitrary code execution). Don't "fix" this without discussing scope with the user first — see also README.md's Sicherheit section, which documents the same acceptance.
  - `crypto.subtle` requires no fallback: `file://` is treated as a secure context in current Chrome, Firefox, and Safari, so `crypto.subtle.digest` is available without a server.
- Survey and answer data is stored unencrypted in `localStorage` in both the manager and the generated client, with no access control beyond the browser profile. This is a known, accepted characteristic, not a bug to silently "fix" with ad hoc encryption — larger security posture changes should be discussed with the user first.
- Imported YAML is trusted structurally without schema validation (`jsyaml.load` in js-yaml 4.x is safe against arbitrary type instantiation, but doesn't validate shape). Malformed input should fail gracefully, not silently corrupt state.

## Process instructions

- **Bump `APP_VERSION`** (in `UmfrageManager.html`) by default whenever you make a change to the app — the user will explicitly say if a particular change should *not* bump it. `APP_VERSION` is embedded into exported YAML files and compared on import to warn about version mismatches, so keep it accurate.
- **Check whether `README.md` needs updating** whenever you make a change — it's the human-facing description of behavior, usage, and security posture. If a change affects what's described there, update it in the same pass rather than leaving it stale.
- js-yaml is vendored inline rather than CDN-loaded. If it's ever upgraded, re-vendor the full source into the `#jsyaml-src` script tag in both the manager and the `buildClientHtml()` template — there's no dependency manager doing this automatically.
- **Recompute the manager's CSP script hashes whenever either of its two `<script>` blocks changes.** This is a mandatory step, not optional cleanup — see the CSP invariant above for exactly what to hash and where the hashes go. Skipping this breaks the app under CSP (the browser refuses to run the mismatched script) without any build-time or lint-time warning.

## License

MIT (see `LICENSE`). The SPDX header in `UmfrageManager.html` and the in-app footer must stay in sync with whatever license is in effect.
