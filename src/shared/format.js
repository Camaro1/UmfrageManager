// ============================================================
// Einheitliches YAML-Format (Umfrage-Definition ⇄ Client-Antworten).
// Ab APP_VERSION 2.0.0 verwenden Umfrage-Definitions-Export/-Import,
// der aus dem Manager exportierte Client-Input und der Antwort-Export/
// -Import des HTML-Clients dieselbe Struktur:
//
// {
//   uuid, bezeichnung, frist, bezeichner_label, app_version,
//   antwort_meta: { befragte, version, datum, notizen },
//   fragen: [ { id, typ, text, optionen?, einheit?, erlaubtDezimal?, antwort } ]
// }
//
// `antwort` je Frage ist bei einem reinen Definitions-Export leer/nicht
// aussagekräftig; `antwort_meta.version` ist ein rein informativer
// Zähler (Auto-Inkrement beim Client-Import), niemals ein Integritäts-
// oder Authentizitätsnachweis (siehe CLAUDE.md, plan-gitHubPageClient.md
// "Security Implications" #6).
//
// Dieses Modul ist bewusst dependency-frei (kein Modul-System) und wird
// von build.py als eigenständiger Textblock zwischen common.js und der
// jeweiligen App-Logik (manager.js / client.js) in denselben <script>-
// Block eingefügt.
// ============================================================

/** Ab welcher Hauptversion ("major") ein importiertes Objekt als
 * Einheitsformat gilt. Dateien mit niedrigerer Hauptversion (oder den
 * alten, vor der Vereinheitlichung verwendeten Feldnamen) werden
 * abgelehnt statt stillschweigend fehlinterpretiert zu werden. */
const UNIFIED_FORMAT_MIN_MAJOR = 2;

/** Gültige Frage-ID: nur Buchstaben, Zahlen, "_" und "-". */
const QUESTION_ID_RE = /^[A-Za-z0-9_-]+$/;

const LEGACY_FORMAT_ERROR =
  'Diese Datei wurde mit einer App-Version vor 2.0.0 erstellt und verwendet ein ' +
  'inzwischen abgelöstes Dateiformat, das nicht mehr unterstützt wird. Bitte exportieren ' +
  'Sie die Datei erneut mit einer aktuellen Version der Anwendung.';

/** Erkennt strukturell und versionsseitig Dateien aus der Zeit vor der
 * Formatvereinheitlichung (< 2.0.0): alte Feldnamen (`umfrage_uuid`,
 * `bezeichnung_umfrage`, eine separate `antworten`-Map) oder eine
 * `app_version` mit Hauptversion < 2. */
function isLegacyFormat(data) {
  if (!data || typeof data !== 'object') return false;
  if (data.umfrage_uuid !== undefined || data.bezeichnung_umfrage !== undefined || data.antworten !== undefined) {
    return true;
  }
  if (data.app_version) {
    const v = parseVersion(data.app_version);
    if (v && v.major < UNIFIED_FORMAT_MIN_MAJOR) return true;
  }
  return false;
}

/** Sanitisiert/dedupliziert Frage-IDs in-place (analog der bisherigen
 * applyImportedSurvey()-Logik im Manager): eine ungültige ID wird durch
 * "f<Index+1>" ersetzt, Duplikate erhalten einen "_2", "_3", …-Suffix. */
function sanitizeQuestionIds(fragen) {
  fragen.forEach((q, idx) => {
    let id = String(q.id != null ? q.id : '').trim();
    if (!QUESTION_ID_RE.test(id)) id = 'f' + (idx + 1);
    q.id = id;
  });
  const seen = new Set();
  fragen.forEach(q => {
    let id = q.id;
    let n = 2;
    while (seen.has(id)) { id = q.id + '_' + n; n++; }
    q.id = id;
    seen.add(id);
  });
  return fragen;
}

/** Koerziert eine rohe (nicht vertrauenswürdige) Frageliste in die
 * interne Definitionsform. Mit `withAnswers: true` wird zusätzlich das
 * `antwort`-Feld je Frage übernommen (als String, Default `''`). */
function coerceFragen(rawFragen, { withAnswers = false } = {}) {
  const fragen = (Array.isArray(rawFragen) ? rawFragen : []).map((q, idx) => {
    const typ = (q && q.typ) ? String(q.typ) : 'freitext';
    const obj = {
      id: (q && q.id != null) ? String(q.id) : '',
      typ,
      text: String((q && q.text) || '')
    };
    if (typ === 'auswahl') obj.optionen = ((q && q.optionen) || []).map(String);
    if (typ === 'zahl') {
      obj.einheit = String((q && q.einheit) || '');
      obj.erlaubtDezimal = !!(q && q.erlaubtDezimal);
    }
    if (withAnswers) obj.antwort = String((q && q.antwort != null) ? q.antwort : '');
    return obj;
  });
  return sanitizeQuestionIds(fragen);
}

/** Koerziert ein rohes antwort_meta-Objekt mit robusten Defaults. */
function coerceAntwortMeta(raw) {
  const m = (raw && typeof raw === 'object') ? raw : {};
  const version = Number(m.version);
  return {
    befragte: String(m.befragte || ''),
    version: Number.isFinite(version) ? version : 0,
    datum: String(m.datum || ''),
    notizen: String(m.notizen || '')
  };
}

/** Baut das vollständige Einheitsformat-Objekt für den Export. Wird
 * sowohl vom Manager (Definitions-/Client-Export, `antwort`-Felder und
 * `antwort_meta` leer) als auch vom Client (Antwort-Export, befüllt)
 * verwendet. */
function buildUnifiedSurvey({ uuid, bezeichnung, frist, bezeichnerLabel, fragen, antwortMeta, appVersion }) {
  return {
    uuid: uuid || '',
    bezeichnung: bezeichnung || '',
    frist: frist || '',
    bezeichner_label: bezeichnerLabel || 'Hochschule',
    app_version: appVersion || APP_VERSION,
    antwort_meta: coerceAntwortMeta(antwortMeta),
    fragen: fragen || []
  };
}

/** Parst/validiert ein importiertes Umfrage- oder Antwort-Objekt gegen
 * das Einheitsformat. Wirft bei Alt-Format oder grob invalider Struktur
 * einen Error mit einer für Endnutzer:innen verständlichen deutschen
 * Meldung — Aufrufer sollen diese Meldung direkt anzeigen, nicht die
 * Datei stillschweigend ignorieren oder falsch interpretieren.
 *
 * `withAnswers`: ob die `antwort`-Felder der Fragen übernommen werden
 * sollen (Antwort-Import in Manager/Client) oder nicht (reiner
 * Definitions-Import im Manager). */
function parseUnifiedSurvey(data, { withAnswers = false } = {}) {
  if (!data || typeof data !== 'object') throw new Error('Ungültiges YAML: Die Datei enthält kein Objekt.');
  if (isLegacyFormat(data)) throw new Error(LEGACY_FORMAT_ERROR);

  return {
    uuid: data.uuid != null ? String(data.uuid) : '',
    bezeichnung: String(data.bezeichnung || ''),
    frist: String(data.frist || ''),
    bezeichner_label: String(data.bezeichner_label || 'Hochschule'),
    app_version: data.app_version ? String(data.app_version) : '',
    antwort_meta: coerceAntwortMeta(data.antwort_meta),
    fragen: coerceFragen(data.fragen, { withAnswers })
  };
}
