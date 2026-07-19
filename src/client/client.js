// Respondentenseitiges Client-Skript (Fragebogen-Logik).
// Nutzt die Helfer aus src/shared/common.js (escapeHtml [ungenutzt hier,
// da ausschließlich textContent/createElement verwendet wird],
// sanitizeFilename, triggerDownload, lsGet/lsSet/lsRemove/lsKeys,
// APP_VERSION, compareVersions) sowie das Einheitsformat-Modul
// src/shared/format.js (buildUnifiedSurvey, parseUnifiedSurvey), die vom
// Build vor diesem Skript in denselben <script>-Block eingefügt werden.
// Eingebettete Umfrage-Daten (Einheitsformat, siehe src/shared/format.js:
// enthält bereits antwort_meta und je Frage ein antwort-Feld, i. d. R.
// leer, da der Manager sie beim Definitions-/Client-Export leer exportiert)
const SURVEY = {{SURVEY_JSON}};

const UUID = SURVEY.uuid;
const LS_PREFIX = 'umfrageClient.' + UUID;

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
function importAnswers(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const raw = jsyaml.load(e.target.result);
      // parseUnifiedSurvey() lehnt Alt-Format-Dateien (< 2.0.0) mit einer
      // aussagekräftigen Meldung ab, statt sie stumm falsch zu
      // interpretieren (src/shared/format.js).
      const data = parseUnifiedSurvey(raw, { withAnswers: true });

      if (data.uuid && data.uuid !== UUID) {
        alert('Diese Antwort-Datei gehört zu einer anderen Umfrage (UUID: ' + data.uuid + ').');
        return;
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
      // Versionszähler: Auto-Inkrement bei jedem Import in den Client
      // (rein informativ, editierbar, kein Integritäts-/Authentizitäts-
      // nachweis — siehe plan-gitHubPageClient.md Entscheidung 4 und
      // "Security Implications" #6).
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
    } catch(err) {
      alert('Fehler beim Importieren:\n' + err.message);
    }
  };
  reader.readAsText(file);
}

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => {
  // Titel und Frist setzen
  document.getElementById('survey-title').textContent = SURVEY.bezeichnung || 'Umfrage';
  if (SURVEY.frist) {
    document.getElementById('survey-frist').textContent = 'Frist: ' + SURVEY.frist;
  }
  document.title = SURVEY.bezeichnung || 'Umfrage';

  renderQuestions();
  loadAnswers();

  // ls-Check
  lsGet('__test__');
  if (!lsOk) document.getElementById('ls-banner').style.display = 'block';

  // Auto-Save auf Metafelder
  ['meta-befragte', 'meta-version', 'meta-notizen'].forEach(id => {
    document.getElementById(id).addEventListener('input', saveAnswers);
  });

  document.getElementById('btn-help').addEventListener('click', () => {
    const box = document.getElementById('help-box');
    box.style.display = box.style.display === 'block' ? 'none' : 'block';
  });

  document.getElementById('btn-export').addEventListener('click', exportAnswers);

  document.getElementById('import-answers').addEventListener('change', function() {
    if (this.files[0]) importAnswers(this.files[0]);
    this.value = '';
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
});
