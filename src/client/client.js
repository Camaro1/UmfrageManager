// Respondentenseitiges Client-Skript (Fragebogen-Logik).
// Nutzt die Helfer aus src/shared/common.js (escapeHtml [ungenutzt hier,
// da ausschließlich textContent/createElement verwendet wird],
// sanitizeFilename, triggerDownload, lsGet/lsSet/lsRemove/lsKeys), die
// vom Build vor diesem Skript in denselben <script>-Block eingefügt werden.
// Eingebettete Umfrage-Daten
const SURVEY = {{SURVEY_JSON}};

const UUID = SURVEY.uuid;
const LS_PREFIX = 'umfrageClient.' + UUID;

function loadAnswers() {
  const meta = lsGet(LS_PREFIX + '.meta');
  if (meta) {
    const m = JSON.parse(meta);
    document.getElementById('meta-befragte').value = m.befragte || '';
    document.getElementById('meta-version').value = m.version || '';
    document.getElementById('meta-notizen').value = m.notizen || '';
  }
  SURVEY.fragen.forEach(q => {
    const val = lsGet(LS_PREFIX + '.' + q.id);
    if (val === null) return;
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
  const version = document.getElementById('meta-version').value.trim();
  if (!befragte || !version) {
    alert('Bitte füllen Sie die Pflichtfelder aus (mit * markiert).');
    return;
  }
  const notizen = document.getElementById('meta-notizen').value;

  const antworten = {};
  SURVEY.fragen.forEach(q => {
    if (q.typ === 'freitext' || q.typ === 'zahl') {
      const el = document.getElementById('q-' + q.id);
      antworten[q.id] = el ? el.value : '';
    } else {
      const el = document.querySelector('input[name="q-' + q.id + '"]:checked');
      antworten[q.id] = el ? el.value : '';
    }
  });

  const exportData = {
    umfrage_uuid: UUID,
    bezeichnung_umfrage: SURVEY.bezeichnung || '',
    app_version: SURVEY.app_version || '',
    befragte,
    version,
    datum: new Date().toISOString().slice(0, 10),
    notizen,
    fragen: SURVEY.fragen,
    antworten
  };

  const yml = jsyaml.dump(exportData, { lineWidth: -1 });
  const filename = sanitizeFilename(befragte) + '_v' + sanitizeFilename(version) + '.yaml';
  triggerDownload(yml, filename, 'application/x-yaml;charset=utf-8');
}

// ---- Import ----
function importAnswers(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = jsyaml.load(e.target.result);
      if (!data || typeof data !== 'object') throw new Error('Ungültiges YAML');
      if (data.umfrage_uuid && data.umfrage_uuid !== UUID) {
        alert('Diese Antwort-Datei gehört zu einer anderen Umfrage (UUID: ' + data.umfrage_uuid + ').');
        return;
      }
      // Felder befüllen
      if (data.befragte !== undefined) document.getElementById('meta-befragte').value = data.befragte;
      if (data.version !== undefined) document.getElementById('meta-version').value = data.version;
      if (data.notizen !== undefined) document.getElementById('meta-notizen').value = data.notizen;

      if (data.antworten) {
        SURVEY.fragen.forEach(q => {
          const val = data.antworten[q.id];
          if (val === undefined || val === null) return;
          if (q.typ === 'freitext' || q.typ === 'zahl') {
            const el = document.getElementById('q-' + q.id);
            if (el) el.value = val;
          } else {
            const els = document.querySelectorAll('input[name="q-' + q.id + '"]');
            els.forEach(r => { r.checked = (r.value === String(val)); });
          }
        });
      }
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
