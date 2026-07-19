# Änderungsprotokoll (Changelog)

Alle nennenswerten Änderungen an diesem Projekt werden in dieser Datei dokumentiert.

Das Format orientiert sich an [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
und dieses Projekt folgt der [semantischen Versionierung](https://semver.org/lang/de/).
Die hier genannten Versionen entsprechen `APP_VERSION` in `UmfrageManager.html`.

## [Unveröffentlicht]

- Sicherheitsrichtlinie (`SECURITY.md`) mit unterstützten Versionen und
  Meldeweg über GitHub Security Advisories ergänzt.
- Dieses Änderungsprotokoll (`CHANGELOG.md`) eingeführt.
- Benutzerdokumentation `docs/getting-started.md` mit den Arbeitsabläufen und
  einem Abschnitt „Sicherheitsempfehlungen" ergänzt.
- Kurzfassung des Bedrohungsmodells (`docs/security/threat-model.md`) mit Verweis
  auf die vollständigen Artefakte ergänzt; `README.md` entsprechend verlinkt.
- Lizenzhinweis zur eingebetteten Bibliothek js-yaml 4.1.0 (MIT) in `README.md`
  präzisiert.
- Internes Refactoring (kein Verhaltensunterschied, kein `APP_VERSION`-Bump):
  `UmfrageManager.html` wird jetzt aus Quelldateien unter `src/` per
  `build.py` (Python-3-Standardbibliothek, ohne Abhängigkeiten) generiert;
  die zuvor doppelt gepflegte Client-Logik (HTML/CSS/JS des exportierten
  Umfrage-Clients) stammt jetzt aus einer einzigen Quelle unter
  `src/client/`, und die CSP-Hashes des Managers werden automatisch vom
  Build berechnet statt manuell gepflegt zu werden.

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
