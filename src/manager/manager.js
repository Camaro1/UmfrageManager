// ============================================================
// Gehosteter Client — zentrale Konstanten (Phase 3, siehe
// plan-gitHubPageClient.md, Entscheidung 1 + 6). Beide Werte werden nur
// hier definiert und überall sonst referenziert (Export-Dialog,
// Hilfe-Box) statt als Literal dupliziert — ein späterer Wechsel auf eine
// eigene Domain (Settings → Pages → Custom domain) bleibt so eine
// Ein-Zeilen-Änderung. ACHTUNG: Diese URL ist der Vertrauensanker für
// Befragte (Look-alike-Phishing-Risiko, siehe README "Sicherheit") — bei
// einem Domain-Wechsel muss sie den Befragten aktiv neu kommuniziert
// werden.
// ============================================================
const CANONICAL_CLIENT_URL = 'https://camaro1.github.io/UmfrageManager/';
/** Absolute GitHub-URL (nicht relativ!): UmfrageManager.html wird typischerweise
 * von einem lokalen file://-Pfad aus geöffnet, wo ein relativer Link auf
 * docs/getting-started.md ins Leere liefe. */
const GETTING_STARTED_URL = 'https://github.com/Camaro1/UmfrageManager/blob/master/docs/getting-started.md';

// ============================================================
// Hilfsfunktionen
// ============================================================

/** Kopiert Text in die Zwischenablage (Clipboard API). Erfordert keinen
 * Netzwerkzugriff und ist daher mit `connect-src 'none'` in der CSP
 * kompatibel. Bei fehlender/verweigerter Berechtigung (z.B. sehr alte
 * Browser oder unsicherer Kontext) bleibt der Text zumindest sichtbar und
 * per Hand markierbar im zugehörigen (readonly) Eingabefeld — kein
 * zusätzlicher Fallback-Mechanismus nötig. */
function copyTextToClipboard(text, btnEl) {
  if (!navigator.clipboard || !navigator.clipboard.writeText) return;
  navigator.clipboard.writeText(text).then(() => {
    if (!btnEl) return;
    const original = btnEl.textContent;
    btnEl.textContent = 'Kopiert!';
    setTimeout(() => { btnEl.textContent = original; }, 1500);
  }).catch(() => { /* still visible/selectable in the input field */ });
}

/** Erzeugt eine RFC 4122 v4 UUID. Nutzt crypto.randomUUID() wenn verfügbar, sonst Fallback. */
function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}

// Speichert Umfrage-Metadaten im localStorage.
function saveSurveyMeta(uuid, data) {
  lsSet(`umfrageManager.${uuid}.meta`, JSON.stringify(data));
}

// Speichert Fragen-Array im localStorage.
function saveSurveyQuestions(uuid, questions) {
  lsSet(`umfrageManager.${uuid}.fragen`, JSON.stringify(questions));
}

// Lädt eine Umfrage aus dem localStorage.
function loadSurvey(uuid) {
  const meta = lsGet(`umfrageManager.${uuid}.meta`);
  const fragen = lsGet(`umfrageManager.${uuid}.fragen`);
  return {
    meta: meta ? JSON.parse(meta) : { bezeichnung: '', frist: '', naechsteFrageNummer: 1 },
    fragen: fragen ? JSON.parse(fragen) : []
  };
}

// Löscht alle localStorage-Einträge einer Umfrage.
function deleteSurveyFromLS(uuid) {
  const keys = lsKeys().filter(k => k.startsWith(`umfrageManager.${uuid}.`));
  keys.forEach(k => lsRemove(k));
}

// Gibt alle gespeicherten Umfrage-UUIDs zurück.
function getAllSurveyUUIDs() {
  return lsKeys()
    .filter(k => k.startsWith('umfrageManager.') && k.endsWith('.meta'))
    .map(k => k.slice('umfrageManager.'.length, -'.meta'.length));
}

// ============================================================
// App-Zustand
// ============================================================
let currentUUID = null;   // aktuell geöffnete Umfrage
let currentQuestions = []; // aktuelle Fragenliste
let currentMeta = { naechsteFrageNummer: 1 }; // Metadaten der aktuellen Umfrage (u.a. Fragen-Zähler)

// ============================================================
// Sidebar: Umfragen-Liste rendern
// ============================================================
function renderSurveyList() {
  const list = document.getElementById('survey-list');
  list.innerHTML = '';
  const uuids = getAllSurveyUUIDs();

  if (uuids.length === 0) {
    const msg = document.createElement('p');
    msg.style.cssText = 'padding:1rem; font-size:0.8125rem; color:var(--muted); text-align:center;';
    msg.textContent = 'Noch keine Umfragen vorhanden.';
    list.appendChild(msg);
    return;
  }

  // Sortierung nach Bezeichnung
  const surveys = uuids.map(uuid => {
    const meta = lsGet(`umfrageManager.${uuid}.meta`);
    const bezeichnung = meta ? (JSON.parse(meta).bezeichnung || '(Ohne Titel)') : '(Ohne Titel)';
    return { uuid, bezeichnung };
  }).sort((a, b) => a.bezeichnung.localeCompare(b.bezeichnung, 'de'));

  surveys.forEach(({ uuid, bezeichnung }) => {
    const item = document.createElement('div');
    item.className = 'survey-item' + (uuid === currentUUID ? ' active' : '');
    item.dataset.uuid = uuid;

    // Bezeichnungs-Span (keine innerHTML mit Nutzerdaten)
    const nameSpan = document.createElement('span');
    nameSpan.className = 'survey-item-name';
    nameSpan.textContent = bezeichnung;
    nameSpan.title = bezeichnung;

    const actions = document.createElement('div');
    actions.className = 'survey-item-actions';

    const btnCopy = document.createElement('button');
    btnCopy.className = 'icon-btn';
    btnCopy.title = 'Kopieren';
    btnCopy.textContent = '⧉';
    btnCopy.addEventListener('click', (e) => { e.stopPropagation(); copySurvey(uuid); });

    const btnDel = document.createElement('button');
    btnDel.className = 'icon-btn danger';
    btnDel.title = 'Löschen';
    btnDel.textContent = '✕';
    btnDel.addEventListener('click', (e) => { e.stopPropagation(); confirmDeleteSurvey(uuid, bezeichnung); });

    actions.appendChild(btnCopy);
    actions.appendChild(btnDel);
    item.appendChild(nameSpan);
    item.appendChild(actions);
    item.addEventListener('click', () => openSurvey(uuid));
    list.appendChild(item);
  });
}

// ============================================================
// Editor: Umfrage öffnen / neu erstellen
// ============================================================
function openSurvey(uuid) {
  currentUUID = uuid;
  const survey = loadSurvey(uuid);
  currentQuestions = survey.fragen;
  currentMeta = survey.meta;
  if (!currentMeta.naechsteFrageNummer) currentMeta.naechsteFrageNummer = currentQuestions.length + 1;

  document.getElementById('meta-uuid').value = uuid;
  document.getElementById('meta-bezeichnung').value = survey.meta.bezeichnung || '';
  document.getElementById('meta-frist').value = survey.meta.frist || '';
  document.getElementById('meta-bezeichner-label').value = survey.meta.bezeichner_label || '';

  document.getElementById('editor-empty').style.display = 'none';
  document.getElementById('editor-form').style.display = 'flex';

  renderQuestions();
  renderSurveyList();

  // Bug 1: Auswertung mit der Auswahl synchronisieren
  const saved = lsGet(`umfrageManager.${uuid}.antworten`);
  importedAnswers = saved ? JSON.parse(saved) : [];
  auswertungSurvey = null;
  renderAuswertung();
}

function createNewSurvey() {
  const uuid = generateUUID();
  saveSurveyMeta(uuid, { bezeichnung: '', frist: '', naechsteFrageNummer: 1 });
  saveSurveyQuestions(uuid, []);
  openSurvey(uuid);
}

// ============================================================
// Editor: Fragen rendern
// ============================================================
function renderQuestions() {
  const list = document.getElementById('question-list');
  list.innerHTML = '';

  if (currentQuestions.length === 0) {
    const msg = document.createElement('p');
    msg.style.cssText = 'font-size:0.875rem; color:var(--muted); padding:0.5rem 0;';
    msg.textContent = 'Noch keine Fragen. Klicken Sie auf "+ Frage hinzufügen".';
    list.appendChild(msg);
    return;
  }

  currentQuestions.forEach((q, idx) => {
    const card = buildQuestionCard(q, idx);
    list.appendChild(card);
  });
}

function buildQuestionCard(q, idx) {
  const card = document.createElement('div');
  card.className = 'question-card';
  card.dataset.qid = q.id;

  // Header
  const header = document.createElement('div');
  header.className = 'question-header';

  const num = document.createElement('div');
  num.className = 'question-number';
  num.textContent = idx + 1;

  // Typ-Auswahl
  const typSelect = document.createElement('select');
  typSelect.title = 'Fragetyp';
  typSelect.style.cssText = 'flex:0 0 auto; width:auto;';
  const types = [
    { value: 'freitext', label: 'Freitext' },
    { value: 'ja_nein', label: 'Ja / Nein' },
    { value: 'auswahl', label: 'Auswahl' },
    { value: 'zahl', label: 'Zahl' }
  ];
  types.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.value;
    opt.textContent = t.label;
    opt.selected = (q.typ === t.value);
    typSelect.appendChild(opt);
  });
  typSelect.addEventListener('change', () => {
    q.typ = typSelect.value;
    if (q.typ !== 'auswahl') delete q.optionen;
    if (q.typ === 'auswahl' && !q.optionen) q.optionen = [''];
    if (q.typ !== 'zahl') { delete q.einheit; delete q.erlaubtDezimal; }
    if (q.typ === 'zahl' && q.erlaubtDezimal === undefined) q.erlaubtDezimal = false;
    autoSave();
    renderQuestions();
  });

  // Steuerungs-Buttons
  const controls = document.createElement('div');
  controls.className = 'question-controls';

  const btnUp = document.createElement('button');
  btnUp.className = 'icon-btn';
  btnUp.title = 'Nach oben';
  btnUp.textContent = '↑';
  btnUp.disabled = idx === 0;
  btnUp.addEventListener('click', () => { moveQuestion(idx, -1); });

  const btnDown = document.createElement('button');
  btnDown.className = 'icon-btn';
  btnDown.title = 'Nach unten';
  btnDown.textContent = '↓';
  btnDown.disabled = idx === currentQuestions.length - 1;
  btnDown.addEventListener('click', () => { moveQuestion(idx, 1); });

  const btnDel = document.createElement('button');
  btnDel.className = 'icon-btn danger';
  btnDel.title = 'Frage löschen';
  btnDel.textContent = '✕';
  btnDel.addEventListener('click', () => { removeQuestion(idx); });

  controls.appendChild(btnUp);
  controls.appendChild(btnDown);
  controls.appendChild(btnDel);
  header.appendChild(num);
  header.appendChild(typSelect);
  header.appendChild(controls);

  // Fragetext
  const textInput = document.createElement('input');
  textInput.type = 'text';
  textInput.placeholder = 'Fragetext eingeben…';
  textInput.value = q.text || '';
  textInput.addEventListener('input', () => { q.text = textInput.value; autoSave(); });

  card.appendChild(header);
  card.appendChild(textInput);

  // Frage-ID (editierbar, validiert on blur)
  const idRow = document.createElement('div');
  idRow.className = 'form-group';
  idRow.style.maxWidth = '260px';

  const idLabel = document.createElement('label');
  idLabel.textContent = 'Frage-ID';
  idRow.appendChild(idLabel);

  const idInput = document.createElement('input');
  idInput.type = 'text';
  idInput.value = q.id || '';
  idRow.appendChild(idInput);

  const idError = document.createElement('div');
  idError.className = 'field-error';
  idError.style.display = 'none';
  idRow.appendChild(idError);

  idInput.addEventListener('blur', () => {
    const newId = idInput.value.trim();
    idError.style.display = 'none';
    idInput.classList.remove('input-error');

    if (!/^[A-Za-z0-9_-]+$/.test(newId)) {
      idInput.classList.add('input-error');
      idError.textContent = 'Die ID darf nur Buchstaben, Zahlen, "_" und "-" enthalten.';
      idError.style.display = 'block';
      idInput.value = q.id;
      return;
    }
    const duplicate = currentQuestions.some((other, oi) => oi !== idx && other.id === newId);
    if (duplicate) {
      idInput.classList.add('input-error');
      idError.textContent = 'Diese ID wird bereits von einer anderen Frage verwendet.';
      idError.style.display = 'block';
      idInput.value = q.id;
      return;
    }
    q.id = newId;
    card.dataset.qid = newId;
    autoSave();
  });

  card.appendChild(idRow);

  // Optionen (nur bei Typ "auswahl")
  if (q.typ === 'auswahl') {
    const optContainer = document.createElement('div');
    optContainer.className = 'options-container';

    const optLabel = document.createElement('label');
    optLabel.textContent = 'Antwortmöglichkeiten:';
    optContainer.appendChild(optLabel);

    (q.optionen || []).forEach((opt, oi) => {
      const row = document.createElement('div');
      row.className = 'option-row';

      const optInput = document.createElement('input');
      optInput.type = 'text';
      optInput.placeholder = `Option ${oi + 1}`;
      optInput.value = opt;
      optInput.addEventListener('input', () => { q.optionen[oi] = optInput.value; autoSave(); });

      const delBtn = document.createElement('button');
      delBtn.className = 'icon-btn danger';
      delBtn.title = 'Option entfernen';
      delBtn.textContent = '✕';
      delBtn.addEventListener('click', () => {
        q.optionen.splice(oi, 1);
        autoSave();
        renderQuestions();
      });

      row.appendChild(optInput);
      row.appendChild(delBtn);
      optContainer.appendChild(row);
    });

    const addOptBtn = document.createElement('button');
    addOptBtn.className = 'add-option-btn';
    addOptBtn.textContent = '+ Option hinzufügen';
    addOptBtn.addEventListener('click', () => {
      if (!q.optionen) q.optionen = [];
      q.optionen.push('');
      autoSave();
      renderQuestions();
    });

    optContainer.appendChild(addOptBtn);
    card.appendChild(optContainer);
  }

  // Einheit + Dezimalzahlen (nur bei Typ "zahl")
  if (q.typ === 'zahl') {
    const zahlRow = document.createElement('div');
    zahlRow.className = 'form-row';

    const einheitGroup = document.createElement('div');
    einheitGroup.className = 'form-group';
    const einheitLabel = document.createElement('label');
    einheitLabel.textContent = 'Einheit';
    const einheitInput = document.createElement('input');
    einheitInput.type = 'text';
    einheitInput.placeholder = 'z.B. kg, cm, €';
    einheitInput.value = q.einheit || '';
    einheitInput.addEventListener('input', () => { q.einheit = einheitInput.value; autoSave(); });
    einheitGroup.appendChild(einheitLabel);
    einheitGroup.appendChild(einheitInput);

    const dezimalGroup = document.createElement('div');
    dezimalGroup.className = 'form-group';
    dezimalGroup.style.flexDirection = 'row';
    dezimalGroup.style.alignItems = 'center';
    dezimalGroup.style.gap = '0.5rem';
    const dezimalCheckbox = document.createElement('input');
    dezimalCheckbox.type = 'checkbox';
    dezimalCheckbox.style.width = 'auto';
    dezimalCheckbox.checked = !!q.erlaubtDezimal;
    dezimalCheckbox.addEventListener('change', () => { q.erlaubtDezimal = dezimalCheckbox.checked; autoSave(); });
    const dezimalLabel = document.createElement('label');
    dezimalLabel.textContent = 'Dezimalzahlen erlauben';
    dezimalGroup.appendChild(dezimalCheckbox);
    dezimalGroup.appendChild(dezimalLabel);

    zahlRow.appendChild(einheitGroup);
    zahlRow.appendChild(dezimalGroup);
    card.appendChild(zahlRow);
  }

  return card;
}

function moveQuestion(idx, dir) {
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= currentQuestions.length) return;
  [currentQuestions[idx], currentQuestions[newIdx]] = [currentQuestions[newIdx], currentQuestions[idx]];
  autoSave();
  renderQuestions();
}

function removeQuestion(idx) {
  currentQuestions.splice(idx, 1);
  autoSave();
  renderQuestions();
}

function addQuestion() {
  if (!currentMeta.naechsteFrageNummer) currentMeta.naechsteFrageNummer = 1;
  const id = 'f' + currentMeta.naechsteFrageNummer;
  currentMeta.naechsteFrageNummer++;
  currentQuestions.push({ id, typ: 'freitext', text: '' });
  autoSave();
  renderQuestions();
}

// ============================================================
// Auto-Save
// ============================================================
function autoSave() {
  if (!currentUUID) return;
  const meta = {
    bezeichnung: document.getElementById('meta-bezeichnung').value,
    frist: document.getElementById('meta-frist').value,
    bezeichner_label: document.getElementById('meta-bezeichner-label').value || 'Hochschule',
    naechsteFrageNummer: currentMeta.naechsteFrageNummer || 1
  };
  saveSurveyMeta(currentUUID, meta);
  saveSurveyQuestions(currentUUID, currentQuestions);
  renderSurveyList();
}

// ============================================================
// YAML-Export (Manager: Umfrage-Definition)
// ============================================================
function exportSurveyAsYaml() {
  if (!currentUUID) return;
  const survey = buildSurveyObject();
  const yml = jsyaml.dump(survey, { lineWidth: -1 });
  const name = sanitizeFilename(survey.bezeichnung || survey.uuid);
  triggerDownload(yml, `${name}.yaml`, 'application/x-yaml;charset=utf-8');
  showExportInfoModal();
}

/** Post-Export-Hinweis (Phase 3): die soeben exportierte YAML-Datei dient
 * auch als Eingabe für den zentral gehosteten Client — zeigt dessen
 * kanonische URL (aus der zentralen Konstante, s.o.) kopierbar an. */
function showExportInfoModal() {
  document.getElementById('export-client-url').value = CANONICAL_CLIENT_URL;
  document.getElementById('modal-export-info').style.display = 'flex';
}

function buildSurveyObject() {
  const fragen = currentQuestions.map(q => {
    const obj = { id: q.id, typ: q.typ, text: q.text };
    if (q.typ === 'auswahl') obj.optionen = q.optionen || [];
    if (q.typ === 'zahl') {
      obj.einheit = q.einheit || '';
      obj.erlaubtDezimal = !!q.erlaubtDezimal;
    }
    // Reines Definitions-/Client-Export: antwort-Feld vorhanden, aber leer
    // (Einheitsformat, siehe src/shared/format.js).
    obj.antwort = '';
    return obj;
  });
  return buildUnifiedSurvey({
    uuid: document.getElementById('meta-uuid').value,
    bezeichnung: document.getElementById('meta-bezeichnung').value,
    frist: document.getElementById('meta-frist').value,
    bezeichnerLabel: document.getElementById('meta-bezeichner-label').value || 'Hochschule',
    fragen,
    antwortMeta: { befragte: '', version: 0, datum: '', notizen: '' }
  });
}

// ============================================================
// YAML-Import (Manager: Umfrage-Definition)
// ============================================================
function importSurveyYaml(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const raw = jsyaml.load(e.target.result);
      // parseUnifiedSurvey() validiert/koerziert gegen das Einheitsformat
      // (src/shared/format.js) und wirft bei Alt-Format (< 2.0.0) oder
      // grob invalider Struktur einen Error mit verständlicher Meldung.
      // withAnswers: false — beim Definitions-Import werden etwaige
      // antwort-Felder ignoriert, nicht übernommen.
      const data = parseUnifiedSurvey(raw, { withAnswers: false });

      const uuid = data.uuid || generateUUID();
      const existingUUIDs = getAllSurveyUUIDs();

      if (existingUUIDs.includes(uuid) && uuid === data.uuid) {
        // UUID-Konflikt: Dialog anzeigen
        showConflictModal(uuid, data);
      } else {
        applyImportedSurvey(uuid, data);
      }
    } catch (err) {
      alert('Fehler beim Importieren der YAML-Datei:\n' + err.message);
    }
  };
  reader.readAsText(file);
}

function applyImportedSurvey(uuid, data) {
  // data.fragen ist bereits über parseUnifiedSurvey()/coerceFragen() auf
  // gültige, deduplizierte IDs sanitisiert (src/shared/format.js).
  const fragen = data.fragen;
  const maxNum = fragen.reduce((max, q) => {
    const m = /^f(\d+)$/.exec(q.id);
    return m ? Math.max(max, +m[1]) : max;
  }, 0);
  saveSurveyMeta(uuid, {
    bezeichnung: data.bezeichnung,
    frist: data.frist,
    bezeichner_label: data.bezeichner_label,
    naechsteFrageNummer: maxNum + 1
  });
  saveSurveyQuestions(uuid, fragen);
  openSurvey(uuid);
}

// ============================================================
// Umfrage kopieren
// ============================================================
function copySurvey(sourceUUID) {
  const survey = loadSurvey(sourceUUID);
  const newUUID = generateUUID();
  saveSurveyMeta(newUUID, {
    bezeichnung: survey.meta.bezeichnung + ' (Kopie)',
    frist: survey.meta.frist,
    bezeichner_label: survey.meta.bezeichner_label || 'Hochschule',
    naechsteFrageNummer: survey.meta.naechsteFrageNummer || (survey.fragen.length + 1)
  });
  saveSurveyQuestions(newUUID, survey.fragen.map(q => ({ ...q })));
  openSurvey(newUUID);
}

// ============================================================
// Umfrage löschen
// ============================================================
let pendingDeleteUUID = null;

function confirmDeleteSurvey(uuid, bezeichnung) {
  pendingDeleteUUID = uuid;
  document.getElementById('modal-delete-msg').textContent =
    `Soll "${bezeichnung}" wirklich gelöscht werden? Diese Aktion kann nicht rückgängig gemacht werden.`;
  document.getElementById('modal-delete').style.display = 'flex';
}

function executeSurveyDelete() {
  if (!pendingDeleteUUID) return;
  deleteSurveyFromLS(pendingDeleteUUID);
  if (currentUUID === pendingDeleteUUID) {
    currentUUID = null;
    currentQuestions = [];
    document.getElementById('editor-empty').style.display = 'flex';
    document.getElementById('editor-form').style.display = 'none';
    importedAnswers = [];
    auswertungSurvey = null;
    renderAuswertung();
  }
  pendingDeleteUUID = null;
  document.getElementById('modal-delete').style.display = 'none';
  renderSurveyList();
}

// ============================================================
// UUID-Konflikt-Dialog
// ============================================================
let pendingConflictData = null;
let pendingConflictUUID = null;

function showConflictModal(uuid, data) {
  pendingConflictUUID = uuid;
  pendingConflictData = data;
  document.getElementById('modal-conflict-msg').textContent =
    `Eine Umfrage mit UUID "${uuid}" existiert bereits. Was möchten Sie tun?`;
  document.getElementById('modal-uuid-conflict').style.display = 'flex';
}

// ============================================================
// HTML-Export: Umfrage-Client generieren
// ============================================================
async function exportSurveyAsHtml() {
  if (!currentUUID) return;
  const survey = buildSurveyObject();
  const bezeichnung = survey.bezeichnung || 'Umfrage';
  const jsyamlCode = document.getElementById('jsyaml-src').textContent;
  const clientHtml = await buildClientHtml(survey, jsyamlCode);
  triggerDownload(clientHtml, `${sanitizeFilename(bezeichnung)}.html`, 'text/html;charset=utf-8');
}

/** Berechnet den SHA-256-Hash eines Strings, base64-kodiert für CSP script-src Hash-Quellen. */
async function sha256Base64(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return btoa(String.fromCharCode(...new Uint8Array(digest)));
}

/** Erzeugt die vollständige HTML-Datei des Umfrage-Clients. */
async function buildClientHtml(survey, jsyamlCode) {
  // Umfrage-Daten als JSON sicher kodiert in den Client einbetten
  const surveyJson = JSON.stringify(survey).replace(/<\//g, '<\\/');

  // CLIENT_APP_SCRIPT_SRC und CLIENT_HTML_TEMPLATE stammen aus src/client/
  // (client.js, client.css, client.html) und werden von build.py als
  // String-Konstanten in dieses Skript eingebettet (siehe unten in der
  // gebauten UmfrageManager.html). Hier wird nur noch das Survey-JSON und
  // die zur Laufzeit berechneten CSP-Hashes eingesetzt.
  const appScript = CLIENT_APP_SCRIPT_SRC.replace('{{SURVEY_JSON}}', () => surveyJson);

  const [jsyamlHash, appHash] = await Promise.all([
    sha256Base64(jsyamlCode),
    sha256Base64(appScript)
  ]);
  const csp = `default-src 'none'; script-src 'sha256-${jsyamlHash}' 'sha256-${appHash}'; style-src 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'none'; connect-src 'none'`;

  const title = escapeHtml(survey.bezeichnung || 'Umfrage');
  const befragterLabel = escapeHtml(survey.bezeichner_label || 'Hochschule');

  return CLIENT_HTML_TEMPLATE
    .replace('{{CSP}}', () => csp)
    .replace('{{TITLE}}', () => title)
    .replace(/\{\{BEFRAGTER_LABEL\}\}/g, () => befragterLabel)
    .replace('{{JSYAML}}', () => jsyamlCode)
    .replace('{{APP_SCRIPT}}', () => appScript);
}


// ============================================================
// Auswertungs-Modul
// ============================================================
let importedAnswers = [];   // Array von geparsten Antwort-Objekten
let auswertungSurvey = null; // aktuell verknüpfte Umfrage-Daten für die Auswertung

function importAnswerFiles(files) {
  let pending = files.length;
  if (pending === 0) return;

  const versionMismatches = [];
  const rejectedFiles = [];

  for (const file of files) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const raw = jsyaml.load(e.target.result);
        // parseUnifiedSurvey() lehnt Alt-Format-Dateien (< 2.0.0, alte
        // Feldnamen umfrage_uuid/bezeichnung_umfrage/antworten-Map) mit
        // einer aussagekräftigen Meldung ab, statt sie stumm falsch zu
        // interpretieren. withAnswers: true — antwort-Felder je Frage
        // werden übernommen (Einheitsformat, src/shared/format.js).
        const data = parseUnifiedSurvey(raw, { withAnswers: true });

        // uuid-Abgleich gegen die aktuell geöffnete Umfrage: eine Datei,
        // die zu einer anderen Umfrage gehört, darf nicht stillschweigend
        // mit eingemischt werden (siehe plan-gitHubPageClient.md,
        // "Potential Conflicts & Issues").
        if (currentUUID && data.uuid && data.uuid !== currentUUID) {
          rejectedFiles.push(`${file.name}: gehört zu einer anderen Umfrage (Datei-UUID "${data.uuid}" ≠ geöffnete Umfrage) und wurde nicht übernommen.`);
        } else {
          importedAnswers.push(data);
          if (data.app_version) {
            const diff = compareVersions(data.app_version, APP_VERSION);
            if (diff === 'major' || diff === 'minor') {
              versionMismatches.push(`${file.name}: Datei-Version ${data.app_version} ≠ App-Version ${APP_VERSION}`);
            }
          }
        }
      } catch(err) {
        alert(`Fehler beim Lesen von "${file.name}":\n${err.message}`);
      }
      pending--;
      if (pending === 0) {
        if (currentUUID) {
          lsSet(`umfrageManager.${currentUUID}.antworten`, JSON.stringify(importedAnswers));
        }
        renderAuswertung();
        const warningEl = document.getElementById('import-version-warning');
        const messages = [...rejectedFiles, ...versionMismatches];
        if (messages.length > 0) {
          warningEl.textContent = messages.join('\n');
          warningEl.style.display = 'block';
        } else {
          warningEl.style.display = 'none';
        }
      }
    };
    reader.readAsText(file);
  }
}

function renderAuswertung() {
  const empty = document.getElementById('auswertung-empty');
  const result = document.getElementById('auswertung-result');
  const warningEl = document.getElementById('auswertung-warning');

  if (importedAnswers.length === 0) {
    empty.style.display = 'flex';
    result.style.display = 'none';
    warningEl.style.display = 'none';
    return;
  }

  empty.style.display = 'none';
  result.style.display = 'flex';

  // Fragen bestimmen: lokale Umfrage + Union mit den in Antwort-Dateien eingebetteten Fragen
  const firstUUID = importedAnswers[0].uuid;
  const surveyData = loadSurvey(firstUUID);
  const byId = new Map();
  (surveyData.fragen || []).forEach(q => byId.set(q.id, q));
  let unionHappened = false;
  importedAnswers.forEach(ans => {
    (ans.fragen || []).forEach(q => {
      if (!byId.has(q.id)) {
        byId.set(q.id, q);
        unionHappened = true;
      }
    });
  });
  const fragen = Array.from(byId.values());

  if (unionHappened) {
    warningEl.textContent = 'Hinweis: Die importierten Antwort-Dateien enthalten Fragen, die nicht in der lokal gespeicherten Umfrage vorhanden sind. Die Fragenliste wurde zusammengeführt (Union).';
    warningEl.style.display = 'block';
  } else {
    warningEl.style.display = 'none';
  }

  const thead = document.getElementById('result-thead');
  const tbody = document.getElementById('result-tbody');
  thead.innerHTML = '';
  tbody.innerHTML = '';

  // Kopfzeile: "Befragte(r)" + eine Spalte pro Frage + "Notizen"
  const headRow = document.createElement('tr');
  const thBefragte = document.createElement('th');
  thBefragte.textContent = 'Befragte(r)';
  headRow.appendChild(thBefragte);

  fragen.forEach(q => {
    const th = document.createElement('th');
    th.textContent = q.text;
    headRow.appendChild(th);
  });

  const thNotizen = document.createElement('th');
  thNotizen.textContent = 'Notizen';
  headRow.appendChild(thNotizen);
  thead.appendChild(headRow);

  // Datenzeilen: eine Zeile pro Befragte(r), per Drag & Drop oder ↑/↓ sortierbar
  let dragSrcIdx = null;

  importedAnswers.forEach((ans, idx) => {
    const tr = document.createElement('tr');
    tr.draggable = true;
    tr.dataset.idx = idx;

    tr.addEventListener('dragstart', () => {
      dragSrcIdx = idx;
      tr.classList.add('dragging');
    });
    tr.addEventListener('dragend', () => {
      tr.classList.remove('dragging');
    });
    tr.addEventListener('dragover', (e) => { e.preventDefault(); });
    tr.addEventListener('drop', (e) => {
      e.preventDefault();
      if (dragSrcIdx === null || dragSrcIdx === idx) return;
      reorderRespondents(dragSrcIdx, idx);
    });

    const tdBefragte = document.createElement('td');
    const wrap = document.createElement('div');
    wrap.className = 'row-reorder-controls';

    const btnUp = document.createElement('button');
    btnUp.className = 'icon-btn';
    btnUp.title = 'Nach oben';
    btnUp.textContent = '↑';
    btnUp.disabled = idx === 0;
    btnUp.addEventListener('click', () => reorderRespondents(idx, idx - 1));

    const btnDown = document.createElement('button');
    btnDown.className = 'icon-btn';
    btnDown.title = 'Nach unten';
    btnDown.textContent = '↓';
    btnDown.disabled = idx === importedAnswers.length - 1;
    btnDown.addEventListener('click', () => reorderRespondents(idx, idx + 1));

    const meta = ans.antwort_meta || {};
    const nameSpan = document.createElement('span');
    nameSpan.textContent = `${meta.befragte || '?'} (v${meta.version != null ? meta.version : '?'})`;

    wrap.appendChild(btnUp);
    wrap.appendChild(btnDown);
    wrap.appendChild(nameSpan);
    tdBefragte.appendChild(wrap);
    tr.appendChild(tdBefragte);

    // Einheitsformat: Antworten stehen als `antwort`-Feld je Frage in
    // ans.fragen, nicht mehr in einer separaten antworten-Map.
    const ansById = new Map((ans.fragen || []).map(q => [q.id, q]));

    fragen.forEach(q => {
      const td = document.createElement('td');
      const aq = ansById.get(q.id);
      const val = (aq && aq.antwort !== undefined && aq.antwort !== '') ? aq.antwort : undefined;
      if (val === undefined) {
        td.textContent = '—';
      } else if (q.typ === 'zahl' && q.einheit) {
        td.textContent = `${val} ${q.einheit}`;
      } else {
        td.textContent = String(val);
      }
      tr.appendChild(td);
    });

    const tdNotizen = document.createElement('td');
    tdNotizen.style.fontStyle = 'italic';
    tdNotizen.textContent = meta.notizen || '—';
    tr.appendChild(tdNotizen);

    tbody.appendChild(tr);
  });

  auswertungSurvey = { fragen, uuid: firstUUID };
}

function reorderRespondents(fromIdx, toIdx) {
  if (toIdx < 0 || toIdx >= importedAnswers.length) return;
  const [moved] = importedAnswers.splice(fromIdx, 1);
  importedAnswers.splice(toIdx, 0, moved);
  if (currentUUID) {
    lsSet(`umfrageManager.${currentUUID}.antworten`, JSON.stringify(importedAnswers));
  }
  renderAuswertung();
}

// Auswertung als YAML exportieren
function exportResultYaml() {
  if (importedAnswers.length === 0) return;
  const result = {
    uuid: importedAnswers[0].uuid,
    bezeichnung: importedAnswers[0].bezeichnung || '',
    export_datum: new Date().toISOString().slice(0, 10),
    antworten: importedAnswers
  };
  const yml = jsyaml.dump(result, { lineWidth: -1 });
  triggerDownload(yml, 'auswertung.yaml', 'application/x-yaml;charset=utf-8');
}

// Schützt eine CSV-Zelle vor Formula Injection (CSV/Excel Injection, CWE-1236):
// Werte aus importierten Antwort-Dateien sind nicht vertrauenswürdig und könnten
// mit '=', '+', '-', '@', Tab oder CR beginnen, was Tabellenkalkulationen als
// Formel auswerten. Ein führendes Apostroph neutralisiert das (OWASP-Empfehlung).
function csvSafeCell(value) {
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) {
    s = "'" + s;
  }
  return '"' + s.replace(/"/g, '""') + '"';
}

// Auswertung als CSV exportieren (Semikolon, UTF-8 BOM für Excel)
function exportResultCsv() {
  if (importedAnswers.length === 0 || !auswertungSurvey) return;

  const rows = [];
  // Header: Befragte(r) + eine Spalte pro Frage + Notizen
  const header = ['Befragte(r)', ...auswertungSurvey.fragen.map(q => q.text), 'Notizen'];
  rows.push(header);

  // Eine Zeile pro Befragte(r)
  importedAnswers.forEach(ans => {
    const meta = ans.antwort_meta || {};
    const row = [`${meta.befragte || '?'} (v${meta.version != null ? meta.version : '?'})`];
    const ansById = new Map((ans.fragen || []).map(q => [q.id, q]));
    auswertungSurvey.fragen.forEach(q => {
      const aq = ansById.get(q.id);
      const val = (aq && aq.antwort !== undefined) ? aq.antwort : '';
      row.push(String(val)); // bare Wert ohne Einheit, für Tabellenkalkulation
    });
    row.push(meta.notizen || '');
    rows.push(row);
  });

  // CSV-String aufbauen (Semikolon-getrennt, Felder in Anführungszeichen, formel-sicher)
  const csv = '﻿' + rows.map(row =>
    row.map(cell => csvSafeCell(cell)).join(';')
  ).join('\r\n');

  triggerDownload(csv, 'auswertung.csv', 'text/csv;charset=utf-8');
}

// ============================================================
// Event-Listener & Initialisierung
// ============================================================
document.addEventListener('DOMContentLoaded', () => {

  // localStorage-Verfügbarkeit prüfen
  lsGet('__test__');
  if (!lsOk) {
    document.getElementById('ls-banner').style.display = 'block';
  }

  // Neue Umfrage
  document.getElementById('btn-new-survey').addEventListener('click', createNewSurvey);

  // Tab-Navigation
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    });
  });

  // Frage hinzufügen
  document.getElementById('btn-add-question').addEventListener('click', addQuestion);

  // Speichern-Button
  document.getElementById('btn-save').addEventListener('click', autoSave);

  // Auto-Save auf Meta-Felder
  ['meta-bezeichnung', 'meta-frist', 'meta-bezeichner-label'].forEach(id => {
    document.getElementById(id).addEventListener('input', autoSave);
  });

  // YAML-Export
  document.getElementById('btn-export-yaml').addEventListener('click', exportSurveyAsYaml);

  // HTML-Export
  document.getElementById('btn-export-html').addEventListener('click', exportSurveyAsHtml);

  // YAML-Import
  document.getElementById('import-yaml-input').addEventListener('change', function() {
    if (this.files[0]) importSurveyYaml(this.files[0]);
    this.value = '';
  });

  // Auswertung: Antworten importieren
  document.getElementById('import-answers-input').addEventListener('change', function() {
    if (this.files.length > 0) importAnswerFiles(Array.from(this.files));
    this.value = '';
  });

  // Auswertung: Ergebnisse leeren
  document.getElementById('btn-clear-answers').addEventListener('click', () => {
    importedAnswers = [];
    auswertungSurvey = null;
    if (currentUUID) lsRemove(`umfrageManager.${currentUUID}.antworten`);
    document.getElementById('import-version-warning').style.display = 'none';
    renderAuswertung();
  });

  // Auswertung: Export
  document.getElementById('btn-export-result-yaml').addEventListener('click', exportResultYaml);
  document.getElementById('btn-export-result-csv').addEventListener('click', exportResultCsv);

  // UUID-Konflikt-Dialog
  document.getElementById('modal-conflict-overwrite').addEventListener('click', () => {
    document.getElementById('modal-uuid-conflict').style.display = 'none';
    applyImportedSurvey(pendingConflictUUID, pendingConflictData);
  });
  document.getElementById('modal-conflict-new-uuid').addEventListener('click', () => {
    document.getElementById('modal-uuid-conflict').style.display = 'none';
    applyImportedSurvey(generateUUID(), pendingConflictData);
  });
  document.getElementById('modal-conflict-cancel').addEventListener('click', () => {
    document.getElementById('modal-uuid-conflict').style.display = 'none';
    pendingConflictData = null;
    pendingConflictUUID = null;
  });

  // Löschen-Dialog
  document.getElementById('modal-delete-confirm').addEventListener('click', executeSurveyDelete);
  document.getElementById('modal-delete-cancel').addEventListener('click', () => {
    pendingDeleteUUID = null;
    document.getElementById('modal-delete').style.display = 'none';
  });

  // Modals bei Klick außerhalb schließen
  ['modal-uuid-conflict', 'modal-delete', 'modal-export-info'].forEach(id => {
    document.getElementById(id).addEventListener('click', (e) => {
      if (e.target.id === id) document.getElementById(id).style.display = 'none';
    });
  });

  // Export-Hinweis-Dialog (gehosteter Client)
  document.getElementById('modal-export-info-close').addEventListener('click', () => {
    document.getElementById('modal-export-info').style.display = 'none';
  });
  document.getElementById('btn-copy-export-url').addEventListener('click', (e) => {
    copyTextToClipboard(CANONICAL_CLIENT_URL, e.currentTarget);
  });

  // Hilfe-Box (?-Button im Header, Phase 3)
  document.getElementById('btn-help').addEventListener('click', () => {
    const box = document.getElementById('help-box');
    box.style.display = box.style.display === 'block' ? 'none' : 'block';
  });
  document.getElementById('help-client-url').value = CANONICAL_CLIENT_URL;
  document.getElementById('help-getting-started-link').href = GETTING_STARTED_URL;
  document.getElementById('btn-copy-help-url').addEventListener('click', (e) => {
    copyTextToClipboard(CANONICAL_CLIENT_URL, e.currentTarget);
  });

  // Sidebar initial rendern
  renderSurveyList();

  // App-Version anzeigen
  document.getElementById('app-version-display').textContent = 'v' + APP_VERSION;
});

