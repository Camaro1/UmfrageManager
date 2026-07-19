// ============================================================
// Shared helpers (used by both the manager UI and the generated
// respondent-facing client). Kept in one place so the two script
// bundles never drift apart silently.
// ============================================================

/** Maskiert HTML-Sonderzeichen, um XSS zu verhindern. */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Ersetzt Sonderzeichen im Dateinamen durch Unterstriche. */
function sanitizeFilename(str) {
  return String(str).replace(/[^a-zA-Z0-9\-_äöüÄÖÜß]/g, '_').replace(/_+/g, '_').trim();
}

// ============================================================
// App-Version
// ============================================================
const APP_VERSION = '1.0.1';

/** Parst eine "major.minor.patch"-Versionsnummer. */
function parseVersion(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(String(v || ''));
  if (!m) return null;
  return { major: +m[1], minor: +m[2], patch: +m[3] };
}

/** Vergleicht zwei Versionen. Gibt 'major', 'minor', 'patch' oder null (identisch) zurück, je nachdem auf welcher Ebene sie zuerst abweichen. */
function compareVersions(a, b) {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (!pa || !pb) return 'unknown';
  if (pa.major !== pb.major) return 'major';
  if (pa.minor !== pb.minor) return 'minor';
  if (pa.patch !== pb.patch) return 'patch';
  return null;
}

/** Löst einen Datei-Download aus. */
function triggerDownload(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============================================================
// localStorage-Helfer (mit try/catch für Firefox file://)
// ============================================================
let lsOk = true;

function lsGet(key) {
  try { return localStorage.getItem(key); }
  catch (e) { lsOk = false; return null; }
}

function lsSet(key, value) {
  try { localStorage.setItem(key, value); }
  catch (e) { lsOk = false; }
}

function lsRemove(key) {
  try { localStorage.removeItem(key); }
  catch (e) { lsOk = false; }
}

function lsKeys() {
  try { return Object.keys(localStorage); }
  catch (e) { lsOk = false; return []; }
}
