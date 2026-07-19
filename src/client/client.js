// Respondentenseitiges Client-Skript (Fragebogen-Logik).
// Nutzt die Helfer aus src/shared/common.js (escapeHtml [ungenutzt hier,
// da ausschließlich textContent/createElement verwendet wird],
// sanitizeFilename, triggerDownload, lsGet/lsSet/lsRemove/lsKeys,
// APP_VERSION, compareVersions) sowie das Einheitsformat-Modul
// src/shared/format.js (buildUnifiedSurvey, parseUnifiedSurvey), die vom
// Build vor diesem Skript in denselben <script>-Block eingefügt werden.
//
// Zwei Betriebsarten (seit Phase 2, siehe plan-gitHubPageClient.md):
//  - Eingebettetes Survey (per HTML exportierter Client, buildClientHtml()
//    im Manager): SURVEY ist beim Laden bereits ein echtes Objekt
//    (Einheitsformat, siehe src/shared/format.js), die Fragebogen-Ansicht
//    erscheint sofort — unverändertes Verhalten.
//  - Gehosteter Client (build.py erzeugt client/index.html mit
//    SURVEY = null): es erscheint zunächst nur eine Start-Ansicht
//    (Beschreibung + Datei-Import + Drag-&-Drop); erst nach erfolgreichem
//    Import einer YAML-Datei wird SURVEY (Laufzeit-Zustand, kein
//    Build-Konstante mehr) gesetzt und die Fragebogen-Ansicht gerendert.
let SURVEY = {{SURVEY_JSON}};

// Wird einmalig beim Skriptstart ausgewertet (bevor SURVEY ggf. durch einen
// Import überschrieben wird) und steuert, ob die "Andere Umfrage laden"-
// Option überhaupt sinnvoll ist (nur beim gehosteten Client, s. u.).
const HOSTED_MODE = (SURVEY === null);

let UUID = null;
let LS_PREFIX = null;

/** Übernimmt ein geparstes Einheitsformat-Objekt als aktiven Umfrage-Zustand
 * und leitet UUID/localStorage-Präfix daraus ab (statt aus einer
 * Build-Zeit-Konstante — im gehosteten Client ist die UUID erst nach dem
 * Import einer Umfrage bekannt). */
function setSurveyState(data) {
  SURVEY = data;
  UUID = SURVEY.uuid;
  LS_PREFIX = 'umfrageClient.' + UUID;
}

if (SURVEY) setSurveyState(SURVEY);

/** Setzt Titel, Frist und den Befragten-Label-Text/-Platzhalter zur
 * Laufzeit per textContent/placeholder (kein innerHTML) aus SURVEY. Muss
 * für beide Betriebsarten aufgerufen werden: im eingebetteten Client sind
 * {{TITLE}}/{{BEFRAGTER_LABEL}} zwar bereits als escapte Platzhalter vom
 * Export befüllt, aber der gehostete Client kennt diese Werte erst nach
 * dem Import einer YAML-Datei zur Laufzeit — deshalb hier einheitlich per
 * DOM-API gesetzt statt sich auf Export-Zeit-Escaping zu verlassen (siehe
 * plan-gitHubPageClient.md, "Security Implications" #4). */
function applySurveyMeta() {
  document.getElementById('survey-title').textContent = SURVEY.bezeichnung || 'Umfrage';
  document.getElementById('survey-frist').textContent = SURVEY.frist ? ('Frist: ' + SURVEY.frist) : '';
  document.title = SURVEY.bezeichnung || 'Umfrage';
  const label = SURVEY.bezeichner_label || 'Hochschule';
  document.getElementById('label-befragte').textContent = label;
  document.getElementById('meta-befragte').placeholder = label;
  document.getElementById('help-befragter-label').textContent = label;
}

function loadAnswers() {
  const meta = lsGet(LS_PREFIX + '.meta');
  // Ohne gespeicherten Fortschritt auf die im Client eingebetteten Werte
  // zurückfallen (antwort_meta bzw. das antwort-Feld je Frage).
  const m = meta ? JSON.parse(meta) : (SURVEY.antwort_meta || {});
  document.getElementById('meta-befragte').value = m.befragte || '';
  document.getElementById('meta-version').value = (m.version !== undefined && m.version !== null && m.version !== '') ? m.version : 0;
  document.getElementById('meta-notizen').value = m.notizen || '';

  SURVEY.fragen.forEach(q => {
    const stored = lsGet(LS_PREFIX + '.' + q.id);
    const val = stored !== null ? stored : (q.antwort || '');
    if (!val) return;
    if (q.typ === 'freitext' || q.typ === 'zahl') {
      const el = document.getElementById('q-' + q.id);
      if (el) el.value = val;
    } else if (q.typ === 'ja_nein') {
      const el = document.querySelector('input[name="q-' + q.id + '"][value="' + val + '"]');
      if (el) el.checked = true;
    } else if (q.typ === 'auswahl') {
      const els = document.querySelectorAll('input[name="q-' + q.id + '"]');
      els.forEach(r => { if (r.value === val) r.checked = true; });
    }
  });
}

function saveAnswers() {
  lsSet(LS_PREFIX + '.meta', JSON.stringify({
    befragte: document.getElementById('meta-befragte').value,
    version: document.getElementById('meta-version').value,
    notizen: document.getElementById('meta-notizen').value
  }));
  SURVEY.fragen.forEach(q => {
    let val = '';
    if (q.typ === 'freitext' || q.typ === 'zahl') {
      const el = document.getElementById('q-' + q.id);
      val = el ? el.value : '';
    } else {
      const el = document.querySelector('input[name="q-' + q.id + '"]:checked');
      val = el ? el.value : '';
    }
    lsSet(LS_PREFIX + '.' + q.id, val);
  });
}

// ---- Fragen rendern ----
function renderQuestions() {
  const container = document.getElementById('questions-container');
  SURVEY.fragen.forEach((q, idx) => {
    const card = document.createElement('div');
    card.className = 'question-card';

    const numEl = document.createElement('div');
    numEl.className = 'question-num';
    numEl.textContent = 'Frage ' + (idx + 1);

    const textEl = document.createElement('div');
    textEl.className = 'question-text';
    textEl.textContent = q.text;

    card.appendChild(numEl);
    card.appendChild(textEl);

    if (q.typ === 'freitext') {
      const ta = document.createElement('textarea');
      ta.id = 'q-' + q.id;
      ta.rows = 3;
      ta.style.cssText = 'resize:vertical; width:100%; padding:0.45rem 0.75rem; border:1px solid var(--border); border-radius:6px; font-size:0.875rem;';
      ta.addEventListener('input', saveAnswers);
      card.appendChild(ta);

    } else if (q.typ === 'ja_nein') {
      const group = document.createElement('div');
      group.className = 'radio-group';
      ['ja', 'nein'].forEach(val => {
        const lbl = document.createElement('label');
        lbl.className = 'radio-label';
        const inp = document.createElement('input');
        inp.type = 'radio'; inp.name = 'q-' + q.id; inp.value = val;
        inp.addEventListener('change', saveAnswers);
        const span = document.createElement('span');
        span.textContent = val.charAt(0).toUpperCase() + val.slice(1);
        lbl.appendChild(inp); lbl.appendChild(span);
        group.appendChild(lbl);
      });
      card.appendChild(group);

    } else if (q.typ === 'auswahl') {
      const group = document.createElement('div');
      group.className = 'choice-group';
      (q.optionen || []).forEach(opt => {
        const lbl = document.createElement('label');
        lbl.className = 'choice-label';
        const inp = document.createElement('input');
        inp.type = 'radio'; inp.name = 'q-' + q.id; inp.value = opt;
        inp.addEventListener('change', saveAnswers);
        const span = document.createElement('span');
        span.textContent = opt;
        lbl.appendChild(inp); lbl.appendChild(span);
        group.appendChild(lbl);
      });
      card.appendChild(group);

    } else if (q.typ === 'zahl') {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex; align-items:center; gap:0.5rem;';
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.id = 'q-' + q.id;
      inp.step = q.erlaubtDezimal ? 'any' : '1';
      inp.style.cssText = 'width:auto; flex:0 0 160px;';
      inp.addEventListener('input', saveAnswers);
      wrap.appendChild(inp);
      if (q.einheit) {
        const unitSpan = document.createElement('span');
        unitSpan.style.color = 'var(--muted)';
        unitSpan.textContent = q.einheit;
        wrap.appendChild(unitSpan);
      }
      card.appendChild(wrap);
    }

    container.appendChild(card);
  });
}

// ---- Export ----
function exportAnswers() {
  const befragte = document.getElementById('meta-befragte').value.trim();
  // "befragte" bleibt Pflichtfeld für einen gültigen Antwort-Export;
  // "version" ist inzwischen rein informativ (Auto-Inkrement beim
  // Import) und daher kein Pflichtfeld mehr (Einheitsformat, siehe
  // src/shared/format.js und plan-gitHubPageClient.md Entscheidung 4).
  if (!befragte) {
    alert('Bitte füllen Sie das Pflichtfeld aus (mit * markiert).');
    return;
  }
  const version = document.getElementById('meta-version').value.trim();
  const notizen = document.getElementById('meta-notizen').value;

  const fragen = SURVEY.fragen.map(q => {
    let val = '';
    if (q.typ === 'freitext' || q.typ === 'zahl') {
      const el = document.getElementById('q-' + q.id);
      val = el ? el.value : '';
    } else {
      const el = document.querySelector('input[name="q-' + q.id + '"]:checked');
      val = el ? el.value : '';
    }
    const obj = { id: q.id, typ: q.typ, text: q.text };
    if (q.typ === 'auswahl') obj.optionen = q.optionen || [];
    if (q.typ === 'zahl') {
      obj.einheit = q.einheit || '';
      obj.erlaubtDezimal = !!q.erlaubtDezimal;
    }
    obj.antwort = val;
    return obj;
  });

  const exportData = buildUnifiedSurvey({
    uuid: UUID,
    bezeichnung: SURVEY.bezeichnung,
    frist: SURVEY.frist,
    bezeichnerLabel: SURVEY.bezeichner_label,
    fragen,
    antwortMeta: { befragte, version, datum: new Date().toISOString().slice(0, 10), notizen },
    appVersion: APP_VERSION
  });

  const yml = jsyaml.dump(exportData, { lineWidth: -1 });
  const filename = sanitizeFilename(befragte) + '_v' + sanitizeFilename(String(version || 0)) + '.yaml';
  triggerDownload(yml, filename, 'application/x-yaml;charset=utf-8');
}

// ---- Import ----

/** Liest eine Datei als YAML, parst/validiert sie gegen das
 * Einheitsformat und ruft bei Erfolg onParsed(data) auf. Alt-Format oder
 * grob invalide Dateien werden mit einer Fehlermeldung abgelehnt statt
 * stumm falsch interpretiert zu werden (parseUnifiedSurvey(),
 * src/shared/format.js). Einziger FileReader/Parse-Pfad für beide
 * Aufrufer unten (Datei-Auswahl und Drag & Drop) — keine doppelte
 * Parsing-Logik. */
function readYamlFile(file, onParsed) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const raw = jsyaml.load(e.target.result);
      const data = parseUnifiedSurvey(raw, { withAnswers: true });
      onParsed(data);
    } catch (err) {
      alert('Fehler beim Importieren:\n' + err.message);
    }
  };
  reader.readAsText(file);
}

/** Übernimmt ein geparstes Einheitsformat-Objekt in die Formularfelder.
 * `isInitialLoad` unterscheidet den erstmaligen Import einer Umfrage im
 * gehosteten Client (noch kein SURVEY gesetzt, UUID-Prüfung entfällt,
 * Fragen müssen erst gerendert werden) vom "normalen" Re-Import einer
 * (ggf. teilweise ausgefüllten) Antwortdatei in eine bereits geladene
 * Umfrage (UUID-Abgleich gegen die aktuell aktive Umfrage). In beiden
 * Fällen wird der Versionszähler genau gleich behandelt: Auto-Inkrement,
 * rein informativ, kein Integritäts-/Authentizitätsnachweis (siehe
 * plan-gitHubPageClient.md Entscheidung 4 und "Security Implications" #6).
 * Gibt true zurück, wenn die Daten übernommen wurden. */
function applyImportedData(data, isInitialLoad) {
  if (isInitialLoad) {
    if (!data.uuid) {
      alert('Diese Datei enthält keine gültige Umfrage-UUID und kann nicht als Umfrage geladen werden.');
      return false;
    }
    setSurveyState(data);
    applySurveyMeta();
    renderQuestions();
  } else if (data.uuid && data.uuid !== UUID) {
    alert('Diese Antwort-Datei gehört zu einer anderen Umfrage (UUID: ' + data.uuid + ').');
    return false;
  }

  if (data.app_version) {
    const diff = compareVersions(data.app_version, APP_VERSION);
    if (diff === 'major' || diff === 'minor') {
      alert('Hinweis: Diese Datei wurde mit einer anderen App-Version (' + data.app_version + ') erstellt als der aktuell verwendete Client (' + APP_VERSION + ').');
    }
  }

  // Felder befüllen
  const meta = data.antwort_meta || {};
  document.getElementById('meta-befragte').value = meta.befragte || '';
  document.getElementById('meta-notizen').value = meta.notizen || '';
  // Versionszähler: Auto-Inkrement bei jedem Import in den Client.
  const incomingVersion = Number.isFinite(+meta.version) ? +meta.version : 0;
  document.getElementById('meta-version').value = incomingVersion + 1;

  data.fragen.forEach(q => {
    const val = q.antwort;
    if (val === undefined || val === null || val === '') return;
    if (q.typ === 'freitext' || q.typ === 'zahl') {
      const el = document.getElementById('q-' + q.id);
      if (el) el.value = val;
    } else {
      const els = document.querySelectorAll('input[name="q-' + q.id + '"]');
      els.forEach(r => { r.checked = (r.value === String(val)); });
    }
  });
  saveAnswers();
  return true;
}

/** Re-Import einer Antwort-/Definitionsdatei in eine bereits geladene
 * Umfrage (Fragebogen-Ansicht ist bereits sichtbar). */
function importAnswers(file) {
  readYamlFile(file, (data) => applyImportedData(data, false));
}

/** Erstmaliger Import im gehosteten Client (Start-Ansicht): lädt die
 * Umfrage aus der Datei und blendet danach von der Start- zur
 * Fragebogen-Ansicht um. */
function loadSurveyFile(file) {
  readYamlFile(file, (data) => {
    if (!applyImportedData(data, true)) return;
    document.getElementById('start-view').style.display = 'none';
    document.getElementById('survey-view').style.display = '';
    if (HOSTED_MODE) document.getElementById('btn-load-other').style.display = '';
  });
}

/** Verkabelt Datei-Auswahl und Drag-&-Drop-Fläche der Start-Ansicht
 * (nur im gehosteten Client relevant, s. Aufrufer). */
function wireStartView() {
  const fileInput = document.getElementById('start-import-file');
  const dropZone = document.getElementById('drop-zone');

  fileInput.addEventListener('change', function() {
    if (this.files[0]) loadSurveyFile(this.files[0]);
    this.value = '';
  });

  function isYamlFile(file) {
    return /\.ya?ml$/i.test(file.name);
  }

  // Dokument-weites preventDefault auf dragover/drop: ohne dies öffnet/
  // zeigt der Browser bei einem Drop NEBEN der Drop-Fläche die YAML-Datei
  // als Rohtext-Seite an (Navigation weg von der Anwendung) — siehe
  // plan-gitHubPageClient.md, "Potential Conflicts & Issues".
  document.addEventListener('dragover', (e) => e.preventDefault());
  document.addEventListener('drop', (e) => e.preventDefault());

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drop-zone-active');
  });
  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drop-zone-active');
  });
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drop-zone-active');
    const files = e.dataTransfer.files;
    if (!files || files.length !== 1) {
      alert('Bitte genau eine Datei ablegen.');
      return;
    }
    if (!isYamlFile(files[0])) {
      alert('Bitte eine .yaml- oder .yml-Datei ablegen.');
      return;
    }
    loadSurveyFile(files[0]);
  });
}

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => {
  // ls-Check
  lsGet('__test__');
  if (!lsOk) document.getElementById('ls-banner').style.display = 'block';

  document.getElementById('btn-help').addEventListener('click', () => {
    const box = document.getElementById('help-box');
    box.style.display = box.style.display === 'block' ? 'none' : 'block';
  });

  if (SURVEY) {
    // Eingebetteter Client (HTML-Export, buildClientHtml() im Manager):
    // Umfrage bereits vorhanden — unverändert direkt in die
    // Fragebogen-Ansicht starten, keine Start-Ansicht.
    applySurveyMeta();
    renderQuestions();
    loadAnswers();
  } else {
    // Gehosteter Client (build.py → client/index.html, SURVEY = null):
    // nur Beschreibung + Datei-Import/Drag-&-Drop anzeigen, bis eine
    // Umfrage erfolgreich importiert wurde (siehe loadSurveyFile()).
    document.getElementById('survey-view').style.display = 'none';
    document.getElementById('start-view').style.display = 'flex';
    wireStartView();
  }

  document.getElementById('btn-export').addEventListener('click', exportAnswers);

  document.getElementById('import-answers').addEventListener('change', function() {
    if (this.files[0]) importAnswers(this.files[0]);
    this.value = '';
  });

  // Auto-Save auf Metafelder
  ['meta-befragte', 'meta-version', 'meta-notizen'].forEach(id => {
    document.getElementById(id).addEventListener('input', saveAnswers);
  });

  document.getElementById('btn-clear-survey').addEventListener('click', () => {
    if (!confirm('Alle gespeicherten Antworten zu dieser Umfrage löschen?')) return;
    lsKeys().filter(k => k.startsWith(LS_PREFIX)).forEach(k => lsRemove(k));
    location.reload();
  });

  document.getElementById('btn-clear-all').addEventListener('click', () => {
    if (!confirm('ALLE Umfrage-Client-Daten aus dem Browser-Speicher löschen?')) return;
    lsKeys().filter(k => k.startsWith('umfrageClient.')).forEach(k => lsRemove(k));
    location.reload();
  });

  // Minimaler Ausweg aus einer bereits geladenen Umfrage zurück zur
  // Start-Ansicht — nur im gehosteten Client relevant (der per HTML
  // exportierte Client kennt nur "seine" eingebettete Umfrage). Da der
  // gehostete Client als statische Seite immer mit SURVEY = null neu
  // lädt, genügt ein einfacher Seiten-Reload; bereits gespeicherte
  // Antworten bleiben UUID-scoped in localStorage erhalten.
  if (HOSTED_MODE) {
    document.getElementById('btn-load-other').addEventListener('click', () => {
      location.reload();
    });
  }
});
