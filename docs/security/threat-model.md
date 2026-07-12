# Bedrohungsmodell — Kurzfassung

Dieses Dokument fasst das Bedrohungsmodell des Umfrage-Managers zusammen. Die
**vollständige Analyse** liegt als ausführliche HTML-Berichte und als maschinenlesbarer
Risiko-Audit-Trail im Verzeichnis [`docs/security/`](.) — siehe
[Vollständige Artefakte](#vollständige-artefakte) am Ende.

## Vorgehen

Das Modell folgt **STRIDE** zur Bedrohungsidentifikation und dem **OWASP Risk Rating**
zur Bewertung. Eintrittswahrscheinlichkeit und Auswirkung ergeben sich jeweils als
Durchschnitt aus acht Faktoren (0–9); die Gesamtrisikostufe folgt aus einer 3×3-Matrix
(LOW / MEDIUM / HIGH / CRITICAL). Einzelne Bewertungen wurden vom Risk Owner begründet
vom mechanischen Mittelwert abgesetzt (im Audit-Trail als „RO" gekennzeichnet).

## Betrachtetes System

Der Umfrage-Manager läuft vollständig lokal ohne Server; der Datenaustausch erfolgt über
HTML- und YAML-Dateien (siehe [Getting Started](../getting-started.md)). Das Modell
unterscheidet drei Vertrauensgrenzen:

- **TB-1 · Operator-Rechner** — der Rechner, auf dem Umfragen erstellt und Antworten
  ausgewertet werden.
- **TB-2 · Passwortgeschützter Dateiaustausch** — die (out-of-scope) Plattform, über die
  Client-Datei und Antwortdateien ausgetauscht werden. Passwort A ist lese-/
  download-fähig, Passwort B ist **upload-only** (Write-only-Drop).
- **TB-3 · Respondenten-Rechner** — der Rechner der Teilnehmenden, auf dem die
  generierte Client-Datei ausgefüllt wird.

**Schützenswerte Güter (Assets):**

- **A01 Umfrage-Antwortdaten** — Vertraulichkeit *sehr hoch* (können personenbezogene
  Daten enthalten).
- **A02 Umfragedefinition** — Vertraulichkeit *normal*.
- **A03 Anwendungslogik / Quellcode**.

## Ergebnisse im Überblick

15 Bedrohungen wurden betrachtet (T-04 zurückgezogen). Kernaussagen:

| ID | Bedrohung (verkürzt) | STRIDE | Gesamtrisiko | Status |
|----|----------------------|--------|--------------|--------|
| T-01 | Nicht zuordenbarer Antwort-Upload (kein Audit-Trail) | S, R | LOW | Akzeptiert |
| T-02 | PII-Offenlegung von Antwortdateien auf der Austauschplattform | I | LOW | M-01, M-02 |
| T-03 | Gefälschte Antwortdatei durch Passwortinhaber hochgeladen | T | LOW | M-03 (geplant) |
| T-04 | Löschen/Überschreiben auf dem Drop | — | — | **Zurückgezogen** (upload-only) |
| T-05 | Offenlegung der Umfragedefinition über geleaktes Passwort A | I | LOW | M-01 |
| T-06 | Bösartige:r Teilnehmer:in fälscht Antwortinhalte | T, E | MEDIUM | Teilw. akzeptiert, M-03 |
| T-07 | Kompromittierter Respondenten-Rechner exfiltriert eigene Daten | I | MEDIUM | Akzeptiert (Umfeld), M-02/M-04 |
| T-08 | Lokale Manipulation der generierten Client-Datei | T | LOW | Akzeptiert (Umfeld), M-05 |
| T-09 | Supply-Chain-Injektion über künftiges js-yaml-Neuvendoring | T, I, E | MEDIUM | M-05, M-07 |
| T-10 | Manipulierte Antwortdatei nutzt Manager-Import aus | T, D | LOW | M-03 (geplant) |
| T-11 | CSV-/Excel-Formula-Injection über Antwortwerte | T, E | LOW | **Mitigiert (M-06)** |
| T-12 | Kompromittierter Operator-Rechner liest/verändert Gesamtdatensatz | S, T, I | **CRITICAL** | **Akzeptiert (Umfeld)**, M-08 |
| T-13 | Kein Audit-Trail — Operator-Aktionen nicht zuordenbar | R | MEDIUM | Akzeptiert |
| T-14 | Antwortdaten unverschlüsselt gespeichert | I | LOW | Akzeptiert, M-02/M-08 |
| T-15 | Stored XSS über importierte Umfrage-/Antwortdaten | T, I, E | LOW | **Mitigiert (M-06, M-05)** |

**Wichtigste Erkenntnisse:**

- Das **höchste Restrisiko (T-12, CRITICAL)** ist ein vollständig kompromittierter
  Operator-Rechner. Es wird als **Umfeld-Annahme akzeptiert**: eine rein clientseitige
  Anwendung kann sich dagegen nicht selbst schützen. Dies deckt sich mit der bewusst
  akzeptierten Entscheidung, `localStorage` unverschlüsselt zu nutzen (siehe `CLAUDE.md`
  und `README.md`).
- Die beiden klassischen Anwendungs-Schwachstellen — **Formula Injection (T-11)** und
  **Stored XSS (T-15)** — sind **implementiert mitigiert** (M-06) und dadurch auf LOW
  reduziert; vor Mitigation wären sie HIGH bzw. CRITICAL gewesen.
- Mehrere Restrisiken sind bewusst **akzeptiert**, weil sie dem bisherigen
  Excel-Austausch-Baseline entsprechen (kein Audit-Trail: T-01/T-13) oder außerhalb der
  Kontrolle der App liegen (T-07/T-08/T-12/T-14).

## Mitigationskatalog

| ID | Maßnahme | Typ | Status |
|----|----------|-----|--------|
| M-01 | Plattform-Nutzungsempfehlungen (Operator) | Präventiv | Betrieblich |
| M-02 | Datensparsamkeit im Umfragedesign | Präventiv | Betrieblich |
| M-03 | Import-Validierung gegen Umfragedefinition | Präv./Detektiv | **Geplant** |
| M-04 | Client-Löschfunktionen | Korrektiv | Implementiert |
| M-05 | Integritäts-/Supply-Chain-Härtung (Hash-CSP, kein `eval`, Inline-Vendoring) | Präventiv | Implementiert |
| M-06 | XSS-/Injection-Schutz (`textContent`, `escapeHtml`, `csvSafeCell`) | Präventiv | Implementiert |
| M-07 | Prozesskontrolle js-yaml-Neuvendoring | Präventiv | Betrieblich |
| M-08 | Operator-Endpoint-Härtung | Präventiv | **Out of Scope** |

Betriebliche Maßnahmen (M-01, M-02) sind als **Sicherheitsempfehlungen** in der
[Getting-Started-Dokumentation](../getting-started.md#sicherheitsempfehlungen) für
Anwender:innen aufbereitet.

## Offene Punkte

- **M-03 (Import-Schema-Validierung)** ist die einzige noch offene technische Maßnahme
  und adressiert T-03, T-06 und T-10.
- Eine numerische Bewertung des Restrisikos (Phase 4 der Methodik) steht noch aus.

## Vollständige Artefakte

- **Gesamtbericht:** [`ThreatModel/threatmodel_umfragemanager_final.html`](ThreatModel/threatmodel_umfragemanager_final.html)
- Phase 1 — Systembeschreibung: [`ThreatModel/threatmodel_umfragemanager_phase1_systembeschreibung.html`](ThreatModel/threatmodel_umfragemanager_phase1_systembeschreibung.html)
- Phase 2 — Bedrohungen: [`ThreatModel/threatmodel_umfragemanager_phase2_bedrohungen.html`](ThreatModel/threatmodel_umfragemanager_phase2_bedrohungen.html)
- Phase 3 — Mitigationen: [`ThreatModel/threatmodel_umfragemanager_phase3_mitigationen.html`](ThreatModel/threatmodel_umfragemanager_phase3_mitigationen.html)
- Risiko-Audit-Trail (maschinenlesbar): [`ThreatModel/risk-scoring-all-threats.yaml`](ThreatModel/risk-scoring-all-threats.yaml)
- Datenflussdiagramm (DFD): [`data-flow-diagrams/threatmodel_umfragemanager_dfd.svg`](data-flow-diagrams/threatmodel_umfragemanager_dfd.svg)
  ([Excalidraw-Quelle](data-flow-diagrams/threatmodel_umfragemanager_dfd.excalidraw))
