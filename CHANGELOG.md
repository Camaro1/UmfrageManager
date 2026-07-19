# Änderungsprotokoll (Changelog)

Alle nennenswerten Änderungen an diesem Projekt werden in dieser Datei dokumentiert.

Das Format orientiert sich an [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
und dieses Projekt folgt der [semantischen Versionierung](https://semver.org/lang/de/).
Die hier genannten Versionen entsprechen `APP_VERSION` in `UmfrageManager.html`.

## [Unveröffentlicht]

## [2.0.0] – 2026-07-19

### Hinzugefügt (Added)

- Sicherheitsrichtlinie (`SECURITY.md`) mit unterstützten Versionen und
  Meldeweg über GitHub Security Advisories ergänzt.
- Dieses Änderungsprotokoll (`CHANGELOG.md`) eingeführt.
- Benutzerdokumentation `docs/getting-started.md` mit den Arbeitsabläufen und
  einem Abschnitt „Sicherheitsempfehlungen" ergänzt.
- Kurzfassung des Bedrohungsmodells (`docs/security/threat-model.md`) mit Verweis
  auf die vollständigen Artefakte ergänzt; `README.md` entsprechend verlinkt.

### Geändert (Changed)

- Lizenzhinweis zur eingebetteten Bibliothek js-yaml 4.1.0 (MIT) in `README.md`
  präzisiert.
- Internes Refactoring (kein Verhaltensunterschied für sich genommen):
  `UmfrageManager.html` wird jetzt aus Quelldateien unter `src/` per
  `build.py` (Python-3-Standardbibliothek, ohne Abhängigkeiten) generiert;
  die zuvor doppelt gepflegte Client-Logik (HTML/CSS/JS des exportierten
  Umfrage-Clients) stammt jetzt aus einer einzigen Quelle unter
  `src/client/`, und die CSP-Hashes des Managers werden automatisch vom
  Build berechnet statt manuell gepflegt zu werden.

- **Einheitliches YAML-Format (Breaking Change).** Umfrage-Definitions-Export/
  -Import im Manager, der aus dem Manager exportierte Client-Input und der
  Antwort-Export/-Import des HTML-Clients verwenden jetzt dieselbe Struktur
  (`uuid`, `bezeichnung`, `frist`, `bezeichner_label`, `app_version`, ein
  `antwort_meta`-Block mit `befragte`/`version`/`datum`/`notizen`, sowie ein
  `antwort`-Feld direkt bei jeder Frage in `fragen[]` statt einer separaten
  `antworten`-Map). Die neue Logik lebt gebündelt in `src/shared/format.js`.
- **Ein konsolidierter Export-Button.** Der Manager-Button „Als YAML
  exportieren" erzeugt jetzt eine einzige `<bezeichnung>.yaml`-Datei im
  Einheitsformat, die zugleich als Definitions-Austausch (Manager→Manager)
  und als Eingabedatei für den HTML-Client dient (leere `antwort`-Felder,
  `antwort_meta.version: 0`).
- **Versionszähler im Client:** `antwort_meta.version` wird bei jedem Import
  einer Antwort-YAML in den HTML-Client automatisch um eins erhöht; das Feld
  bleibt editierbar und ist kein Pflichtfeld — nur ein Indiz, kein
  Integritäts- oder Authentizitätsnachweis. Pflichtfeld für einen gültigen
  Antwort-Export bleibt weiterhin `befragte`.

### Sicherheit (Security)

- **Alt-Format-Dateien werden abgelehnt, nicht stillschweigend
  fehlinterpretiert.** Sowohl der Manager (Definitions- und
  Antwort-Import) als auch der HTML-Client (Antwort-Import) erkennen
  Dateien mit `app_version` unterhalb von 2.0.0 oder den alten Feldnamen
  (`umfrage_uuid`, `bezeichnung_umfrage`, eine separate `antworten`-Map)
  und brechen den Import mit einer klaren Fehlermeldung ab.
- **`uuid`-Abgleich beim Manager-Antwort-Import.** Bisher wurde nicht
  geprüft, ob eine importierte Antwortdatei überhaupt zur aktuell
  geöffneten Umfrage gehört. Antwortdateien mit abweichender `uuid` werden
  jetzt erkannt und nicht mehr in die Auswertung übernommen, statt
  stillschweigend mit falschen Daten vermischt zu werden.

## [1.0.1] – 2026-07-10

### Behoben (Fixed)

- Formula-Injection-Schwachstelle im CSV-Export: Zellwerte, die mit einem von
  Tabellenkalkulationen als Formel interpretierbaren Zeichen beginnen
  (`=`, `+`, `-`, `@`, Tab, Wagenrücklauf), werden mit einem vorangestellten
  Apostroph als reiner Text ausgegeben.

## [1.0.0]

### Hinzugefügt (Added)

- Erste Veröffentlichung des Umfrage-Managers: lokal laufende Einzeldatei-Anwendung
  (`UmfrageManager.html`) zum Erstellen und Verwalten von Umfragen ohne Server.
- Export einer Umfragedefinition als YAML sowie erneuter Import.
- Export einer eigenständigen, respondentenseitigen Client-HTML-Datei
  (Zwei-Dateien-Austauschmuster) zum Ausfüllen ohne Server.
- Re-Import der Antwort-YAML-Dateien sowie Aggregation und CSV-Export im
  Auswertungs-Tab.
- Sicherheitsmaßnahmen: hash-basierte Content-Security-Policy, kein `eval()`,
  XSS-Schutz über `textContent`/`createElement`, eingebettetes (vendored) js-yaml.
- Dokumentation (`README.md`) und MIT-Lizenz.
