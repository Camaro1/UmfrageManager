# Getting Started — Umfrage-Manager

Diese Anleitung beschreibt die typischen Arbeitsabläufe des Umfrage-Managers Schritt für
Schritt. Der Umfrage-Manager ist eine **einzelne HTML-Datei** (`UmfrageManager.html`),
die direkt im Browser läuft — ohne Installation, ohne Server und ohne
Internetverbindung.

## Voraussetzungen

- Ein aktueller Webbrowser (Chrome, Firefox, Edge o. ä.).
- Keine weitere Software, kein Server, keine Installation.

## Rollen und Dateien

Der Ablauf kennt zwei Rollen und drei Dateiarten:

| Rolle | Aufgabe |
|-------|---------|
| **Operator:in** | erstellt Umfragen, verteilt den Client, wertet Antworten aus (nutzt `UmfrageManager.html`) |
| **Teilnehmende** | füllen eine erhaltene Client-Datei aus und geben Antworten zurück |

| Datei | Zweck | Format |
|-------|-------|--------|
| Umfrage-YAML | Sicherung/Transport einer Umfrage **und** Eingabedatei für den HTML-Client-Export **und** Eingabedatei für den gehosteten Client | YAML |
| Umfrage-Client (HTML) | eigenständige, per Datei verteilte Ausfüll-Datei für Teilnehmende | HTML |
| Gehosteter Client | dieselbe Ausfüll-Logik unter einer festen, zentral gehosteten Adresse (`https://camaro1.github.io/UmfrageManager/`); Teilnehmende importieren dort die Umfrage-YAML statt eine eigene Datei zu erhalten | — (Webseite) |
| Antwortdatei | eine ausgefüllte Antwort eines/einer Teilnehmenden | YAML |

Seit Version 2.0.0 verwenden alle drei YAML-Austauschpunkte (Umfrage-Export/-Import im
Manager, Client-Export/-Import) **dasselbe Dateiformat**: Antworten stehen direkt als
`antwort`-Feld bei der jeweiligen Frage, ergänzt um einen `antwort_meta`-Block
(`befragte`, `version`, `datum`, `notizen`). Dateien aus Versionen vor 2.0.0 werden beim
Import mit einer klaren Fehlermeldung abgelehnt, nicht stillschweigend fehlinterpretiert.

---

## Überblick über den Gesamtablauf

```
[Operator]  Umfrage anlegen ──> Client-HTML exportieren ──┐
                                                          │  verteilen (z. B. Dateiablage)
[Teilnehmende]  Client öffnen ──> ausfüllen ──> Antwort-YAML exportieren ──┐
                                                                           │  zurückgeben
[Operator]  Antwort-YAMLs importieren ──> Auswertung ──> CSV-Export
```

---

## Workflow 1: Umfrage erstellen

1. **`UmfrageManager.html` im Browser öffnen.** Bereits angelegte Umfragen erscheinen in
   der Seitenleiste (gespeichert im `localStorage` des Browsers).
2. **„+ Neue Umfrage"** wählen.
3. Im Reiter **„Editor"** die Metadaten erfassen:
   - **Bezeichnung** — der Titel der Umfrage.
   - **Frist** — optionales Fälligkeitsdatum.
   - **Bezeichner-Label** — die Beschriftung des Feldes, mit dem sich Teilnehmende
     kennzeichnen (z. B. „Name", „Mitarbeiter-ID" oder „Abteilung").
4. **Fragen hinzufügen.** Je Frage werden eine eindeutige **ID**
   (erlaubt: `A–Z`, `a–z`, `0–9`, `_`, `-`; keine Duplikate), ein **Typ** und der
   **Fragetext** festgelegt:

   | Typ | Beschreibung | Zusatzfelder |
   |-----|--------------|--------------|
   | **Freitext** | frei eingebbarer Text | — |
   | **Ja/Nein** | binäre Auswahl | — |
   | **Auswahl** | Auswahl aus vorgegebenen Optionen | Liste der **Optionen** |
   | **Zahl** | numerische Eingabe | **Einheit**, **Dezimalstellen erlaubt** (ja/nein) |

5. **Pflichtfelder** (mit `*` markiert) müssen ausgefüllt sein, bevor exportiert werden
   kann.

Die Umfrage wird laufend im `localStorage` gespeichert. Optional lässt sie sich über den
YAML-Export sichern oder auf einen anderen Rechner übertragen (siehe
[Workflow 5](#workflow-5-umfragen-sichern-und-übertragen)).

## Workflow 2: Client an Teilnehmende verteilen

Es gibt zwei alternative Wege, denselben Fragebogen an Teilnehmende zu bringen — die
YAML-Datei bleibt in beiden Fällen dieselbe (Einheitsformat, siehe „Rollen und Dateien"
oben).

**Weg A — HTML-Client (eine Datei pro Person):**

1. In der Umfrage die Funktion **als HTML-Client exportieren** wählen. Es entsteht eine
   zweite, **eigenständige** HTML-Datei, die die Umfrage vollständig enthält.
2. Diese Datei an die Teilnehmenden verteilen (z. B. per Dateiablage oder E-Mail — siehe
   [Sicherheitsempfehlungen](#sicherheitsempfehlungen)).

Die Client-Datei benötigt weder Server noch Internetverbindung; sie läuft direkt im
Browser der Teilnehmenden.

**Weg B — gehosteter Client (eine feste Adresse für alle):**

1. Im Editor stattdessen **„Als YAML exportieren"** wählen — es entsteht die eine
   Umfrage-YAML-Datei.
2. Diese Datei an die (erste) teilnehmende Person weitergeben, zusammen mit der
   kanonischen Client-Adresse **`https://camaro1.github.io/UmfrageManager/`** (auch
   kopierbar im Manager selbst hinterlegt: Hilfetext über den `?`-Button im Header sowie
   im Hinweis-Dialog direkt nach dem YAML-Export).
3. Alle Teilnehmenden öffnen dieselbe Adresse in ihrem Browser (statt eine eigene
   HTML-Datei zu erhalten) und importieren dort die YAML-Datei per Datei-Auswahl oder
   Drag & Drop.

Weg B eignet sich besonders für die **Weitergabe-Kette mehrerer Befragter** (siehe
Workflow 3): Es muss nicht für jede Person eine eigene HTML-Datei erzeugt und verteilt
werden — alle nutzen dieselbe, feste Adresse. Prüfen Sie vor dem Import die Adresszeile
des Browsers, um Look-alike-Phishing-Adressen auszuschließen (siehe
[README → Sicherheit](../README.md#sicherheit)).

## Workflow 3: Teilnehmende füllen den Client aus

1. Teilnehmende öffnen entweder die erhaltene Client-HTML-Datei (Weg A) oder die
   kanonische Client-Adresse und importieren dort die erhaltene YAML-Datei (Weg B).
2. Sie tragen ihren **Bezeichner** ein (Pflichtfeld) und beantworten die Fragen. Ein
   Versionsfeld ist ebenfalls vorhanden, aber optional — es ist nur ein Indiz für den
   Bearbeitungsstand und wird beim Import einer bereits begonnenen Antwortdatei (siehe
   nächster Punkt) automatisch um eins erhöht.
3. Sie **exportieren ihre Antworten als YAML-Datei** und geben diese entweder an die
   nächste Person zum Weiterausfüllen oder an die Operator:in zurück. Eine bereits
   begonnene Antwortdatei lässt sich im Client auch wieder **importieren**, um an ihr
   weiterzuarbeiten — bei Weg B öffnet die nächste Person dafür erneut dieselbe
   Client-Adresse und importiert dort die von der vorherigen Person erhaltene Datei; ein
   eigenes „Andere Umfrage laden" öffnet dort bei Bedarf wieder die Start-Ansicht.

## Workflow 4: Antworten auswerten

1. Im Umfrage-Manager die zugehörige Umfrage öffnen und den Reiter **„Auswertung"**
   wählen.
2. Die zurückerhaltenen **Antwort-YAML-Dateien importieren.** Es können mehrere Dateien
   auf einmal importiert werden.
   - Stimmt die in einer Datei eingebettete Version nicht mit der aktuellen App-Version
     überein, warnt die Anwendung (der Import bleibt möglich).
   - Gehört eine Datei zu einer **anderen Umfrage** (abweichende UUID) oder wurde sie mit
     einer **App-Version unterhalb von 2.0.0** erstellt, lehnt die Anwendung den Import
     dieser Datei mit einer klaren Fehlermeldung ab.
3. Die aggregierten Ergebnisse werden angezeigt.
4. Optional die Ergebnisse als **CSV** exportieren (z. B. zur Weiterverarbeitung in einer
   Tabellenkalkulation). Werte werden dabei gegen Formula Injection abgesichert.

## Workflow 5: Umfragen sichern und übertragen

- Eine Umfrage lässt sich jederzeit als **YAML exportieren** und später wieder
  **importieren** — etwa zur Sicherung, zum Teilen oder zum Wechsel des Rechners.
  Dieselbe Export-Datei dient zugleich als Eingabe für den HTML-Client-Export
  (Einheitsformat, siehe „Rollen und Dateien" oben).
- Beim Import einer bereits vorhandenen UUID fragt die Anwendung, wie mit dem Konflikt
  verfahren werden soll.

---

## Daten & Speicherung

Alle Daten (Umfragen, Fragen, importierte Antworten) liegen ausschließlich im
**`localStorage` des Browsers** — es findet keine Übertragung an einen Server statt. Ist
`localStorage` nicht verfügbar (z. B. bei manchen `file://`-Konfigurationen), zeigt die
Anwendung einen Warnhinweis; Eingaben werden dann **nicht dauerhaft gespeichert**.

> **Wichtig:** Die Daten sind an das jeweilige Browserprofil auf dem jeweiligen Rechner
> gebunden. Ein anderer Browser, ein anderes Profil oder das Löschen der Browserdaten
> führt dazu, dass gespeicherte Umfragen dort nicht (mehr) verfügbar sind. Sichern Sie
> wichtige Umfragen daher zusätzlich als YAML-Datei.

---

## Sicherheitsempfehlungen

Der Umfrage-Manager schützt die Anwendung selbst durch mehrere technische Maßnahmen
(hash-basierte CSP, XSS- und Formula-Injection-Schutz, kein `eval()`; siehe
[README → Sicherheit](../README.md#sicherheit) und die
[Bedrohungsmodell-Kurzfassung](security/threat-model.md)). Einige Risiken lassen sich
jedoch **nur betrieblich** durch die Anwender:innen absichern. Die folgenden Empfehlungen
setzen die betrieblichen Mitigationen des Bedrohungsmodells (M-01, M-02) um:

**Beim Umfragedesign**

- **Datensparsamkeit (M-02):** Fragen Sie nur ab, was Sie wirklich auswerten müssen.
  Verzichten Sie auf personenbezogene Bezeichner (echte Namen, IDs), wenn eine anonyme
  oder pseudonyme Kennung ausreicht. Antwortdaten können personenbezogene Informationen
  enthalten und werden **unverschlüsselt** gespeichert.

**Beim Verteilen und Einsammeln (M-01)**

- Nutzen Sie zum Austausch der Client- und Antwortdateien einen **zugriffsbeschränkten
  Kanal** (z. B. eine passwortgeschützte Dateiablage). Empfehlenswert ist, für die
  **Rückgabe** der Antworten einen **Upload-only-Bereich** zu verwenden, in dem
  Teilnehmende fremde Antworten weder lesen noch verändern oder löschen können.
- Behandeln Sie die Umfragedefinition und die Antwortdateien als **vertraulich** und
  geben Sie Zugangsdaten nur an den vorgesehenen Personenkreis weiter.

**Auf dem Operator-Rechner**

- Der Auswertungs-Rechner hält im Zweifel den **gesamten Antwortdatensatz** unverschlüsselt
  im Browserprofil. Betreiben Sie die Auswertung daher auf einem **vertrauenswürdigen,
  aktuell gehaltenen und zugriffsgeschützten Rechner** (Betriebssystem-Login, ggf.
  Festplattenverschlüsselung). Ein kompromittierter Rechner ist das höchste im
  Bedrohungsmodell identifizierte Restrisiko (T-12) und kann durch die App selbst nicht
  abgewehrt werden.
- Nutzen Sie nach Abschluss der Auswertung die **Löschfunktionen** der Anwendung, um nicht
  mehr benötigte Antwortdaten zu entfernen, und räumen Sie exportierte CSV-/YAML-Dateien
  auf.

**Beim Import fremder Dateien**

- Importieren Sie nur Antwortdateien aus **erwarteter, vertrauenswürdiger Quelle**. Die
  Anwendung parst YAML sicher (keine Ausführung beliebigen Codes), prüft die Struktur der
  Dateien jedoch derzeit nicht vollständig; eine fehlerhafte Datei kann die
  Auswertungsansicht stören (Abhilfe: Datei entfernen bzw. Seite neu laden).

---

## Weiterführende Dokumentation

- [README](../README.md) — Überblick und Sicherheitsstatus (Deutsch).
- [Bedrohungsmodell — Kurzfassung](security/threat-model.md) — Zusammenfassung der
  Risikoanalyse mit Verweis auf die vollständigen Artefakte.
- [Sicherheitsrichtlinie (`SECURITY.md`)](../SECURITY.md) — Melden von Schwachstellen.
