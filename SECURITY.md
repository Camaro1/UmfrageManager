# Sicherheitsrichtlinie

Danke, dass Sie zur Sicherheit von **Umfrage-Manager** beitragen. Dieses Dokument
beschreibt, welche Versionen unterstützt werden und wie Sie eine Sicherheitslücke
verantwortungsvoll melden.

## Unterstützte Versionen

Umfrage-Manager ist eine Einzeldatei-Anwendung (`UmfrageManager.html`) ohne Server,
Build-Schritt oder Update-Mechanismus. Sicherheitskorrekturen fließen ausschließlich
in die jeweils aktuelle Version ein; ältere Stände erhalten keine rückportierten Fixes.
Die Version ist über `APP_VERSION` in der Datei und im In-App-Footer ersichtlich.

| Version | Unterstützt        |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

Verwenden Sie stets die neueste Version aus dem Repository.

## Eine Sicherheitslücke melden

**Melden Sie Sicherheitslücken bitte nicht über öffentliche GitHub-Issues, Pull
Requests oder Diskussionen.**

Nutzen Sie stattdessen die private Meldefunktion von GitHub unter
[*Security → Report a vulnerability*](https://github.com/Camaro1/UmfrageManager/security/advisories/new)
(GitHub Security Advisories).

Bitte geben Sie so viele Informationen wie möglich an, damit wir das Problem schnell
nachvollziehen können:

- Art und Auswirkung der Schwachstelle (z. B. XSS, Datenoffenlegung, CSP-Umgehung).
- Betroffene Datei bzw. Funktion und die verwendete Version (`APP_VERSION`).
- Schritt-für-Schritt-Anleitung zur Reproduktion, idealerweise mit einer minimalen
  Beispiel-Datei (Umfrage-/Antwort-YAML oder generierte Client-HTML).
- Etwaige Proof-of-Concept-Skripte oder Screenshots.

### Was Sie erwarten können

- **Eingangsbestätigung:** innerhalb von 5 Werktagen.
- **Erste Einschätzung:** innerhalb von 10 Werktagen, inklusive Angabe, ob wir die
  Meldung als Sicherheitslücke einstufen.
- **Verlauf:** Wir halten Sie über den Fortschritt bis zur Behebung auf dem Laufenden
  und stimmen einen Zeitpunkt für eine eventuelle Veröffentlichung mit Ihnen ab.
- **Anerkennung:** Auf Wunsch nennen wir Sie nach der Behebung als Melder:in.

Wir bitten um **verantwortungsvolle Offenlegung**: Geben Sie uns angemessene Zeit zur
Behebung, bevor Sie Details öffentlich machen.

## Sicherheitsdesign und akzeptierte Risiken

Umfrage-Manager läuft vollständig lokal (`file://`) ohne serverseitige Komponente. Die
wichtigsten Sicherheitsmaßnahmen und bewusst akzeptierten Restrisiken sind im Abschnitt
[**Sicherheit** der `README.md`](README.md#sicherheit) dokumentiert. Kurzüberblick:

- **Keine externen Laufzeit-Abhängigkeiten.** js-yaml ist eingebettet ("vendored");
  Sicherheitsupdates der Bibliothek müssen manuell nachgezogen werden.
- **Hash-basierte Content-Security-Policy** in Manager und in jeder exportierten
  Client-Datei; kein `eval()`.
- **XSS-Schutz** durch konsequente Nutzung von `textContent`/`createElement` sowie
  Escaping an der einzigen Stelle, die aktiv HTML erzeugt.
- **Formula-Injection-Schutz** beim CSV-Export.

Bewusst akzeptierte Risiken (bitte **nicht** als Sicherheitslücke melden, sondern bei
Bedarf über ein reguläres Issue diskutieren):

- `style-src 'unsafe-inline'` in der CSP.
- Unverschlüsselte Speicherung von Umfragen und Antworten im `localStorage`.
- Keine formale Schema-Validierung importierter YAML-Dateien (fehlerhafte Dateien
  sollen jedoch kontrolliert fehlschlagen, nicht den Zustand beschädigen).

Meldungen zu diesen Punkten, die eine konkrete, ausnutzbare Verschärfung des Risikos
über das dokumentierte Maß hinaus aufzeigen, sind hingegen willkommen.
