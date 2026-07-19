# Umfrage-Manager

Umfrage-Manager ist eine lokal laufende Anwendung zum Erstellen und Auswerten von Umfragen. Sie ersetzt einen bisher manuellen Workflow auf Basis von MS Excel und reduziert den Aufwand beim Erstellen und Auswerten von Umfragen deutlich.

Die Anwendung besteht aus einer einzigen HTML-Datei (`UmfrageManager.html`), die direkt im Browser geöffnet wird — es ist keine Installation, kein Server und keine Internetverbindung erforderlich.

## Voraussetzungen

- Ein aktueller Webbrowser (Chrome, Firefox, Edge o. ä.).
- Keine weitere Software, kein Server, keine Installation.

## Verwendung

1. **`UmfrageManager.html` im Browser öffnen.** Alle bisher angelegten Umfragen erscheinen in der Seitenleiste (gespeichert im lokalen Speicher des Browsers, siehe [Sicherheit](#sicherheit)).
2. **Neue Umfrage anlegen** über "+ Neue Umfrage", Metadaten (Bezeichnung, Frist, Bezeichner-Label) sowie die gewünschten Fragen (Freitext, Ja/Nein, Auswahl, Zahl) im Editor-Tab erfassen.
3. **Umfrage als HTML-Client exportieren.** Über den Export wird eine zweite, eigenständige HTML-Datei erzeugt, die die Umfrage enthält. Diese Datei wird an die Teilnehmenden verteilt (z. B. per E-Mail oder Dateiablage).
4. **Teilnehmende füllen den Client aus**, ganz ohne Server oder Internetverbindung — die HTML-Client-Datei läuft eigenständig im Browser der Teilnehmenden.
5. **Antworten als YAML-Datei exportieren.** Nach dem Ausfüllen exportieren die Teilnehmenden ihre Antworten als YAML-Datei aus dem Client heraus. Das Feld, mit dem sich Teilnehmende kennzeichnen (Bezeichner-Label), ist dabei Pflicht; ein Versionszähler wird beim Import einer bereits begonnenen Antwortdatei automatisch erhöht und dient nur als Indiz für den Bearbeitungsstand, nicht als Echtheitsnachweis.
6. **Antwort-Dateien in den Umfrage-Manager importieren.** Die gesammelten YAML-Antwortdateien werden im Reiter "Auswertung" importiert und dort aggregiert; ein CSV-Export der Ergebnisse ist ebenfalls möglich. Dateien, die zu einer anderen Umfrage gehören (abweichende UUID) oder mit einer App-Version unterhalb von 2.0.0 erstellt wurden, werden mit einer klaren Fehlermeldung abgelehnt statt vermischt zu werden.

Umfragen selbst lassen sich außerdem über einen einzigen YAML-Export sichern/übertragen — dieselbe Datei dient zugleich als Eingabe für den HTML-Client-Export. Manager-Definitions-Export, Manager→Client-Übergabe und Client-Antwort-Export/-Import verwenden alle dasselbe YAML-Format (Details siehe [Getting Started](docs/getting-started.md)).

## Gehosteter Client (Weitergabe-Workflow)

Neben dem HTML-Client-Export gibt es einen zweiten Weg, eine Umfrage an Befragte zu verteilen: den zentral gehosteten Client unter der festen, per GitHub Pages ausgelieferten Adresse

> **https://camaro1.github.io/UmfrageManager/**

Dieser Client wird direkt aus diesem Repository gebaut und automatisch per GitHub-Actions-Workflow (`.github/workflows/pages.yml`) veröffentlicht — es ist keine eigene Installation oder ein eigener Server nötig. Statt jede/n Befragte/n mit einer eigenen HTML-Datei zu versorgen, exportieren Sie im Manager nur die eine YAML-Datei ("Als YAML exportieren"); alle Befragten öffnen dieselbe Adresse in ihrem Browser und importieren dort diese Datei (Datei-Auswahl oder Drag & Drop). Das eignet sich besonders für die **Weitergabe-Kette mehrerer Befragter**: Die erste Person füllt ihre Antworten aus, exportiert die YAML-Datei und reicht sie an die nächste Person weiter, die dieselbe Adresse erneut öffnet, die erhaltene Datei importiert und weiter ausfüllt — und so weiter, bis die Datei am Ende an die Umfrage-Ersteller:in zurückgeht und dort wie gewohnt im Reiter "Auswertung" importiert wird. Die kanonische URL ist im Manager auch im Hilfetext (?-Button im Header) und im Hinweis nach dem YAML-Export kopierbar hinterlegt.

> **Hinweis für Betreiber:innen des Repositories:** Damit der Workflow tatsächlich ausliefert, muss einmalig unter *Settings → Pages* die Quelle auf **„GitHub Actions"** gestellt und **„Enforce HTTPS"** aktiviert werden. Das ist ein manueller, sicherheitsrelevanter Einrichtungsschritt mit Repository-Admin-Rechten, den kein Workflow automatisch vornehmen kann oder sollte.

## Daten & Speicherung

Alle Daten (Umfragen, Fragen, importierte Antworten) werden ausschließlich im **lokalen Speicher (localStorage) des Browsers** gehalten — es findet keine Übertragung an einen Server statt. Alle Anwendungskomponenten bieten die Möglichkeit die gespeicherten Daten aus dem lokalen Speicher zu löschen. Ist localStorage nicht verfügbar (z. B. bei manchen Browser-Konfigurationen beim Öffnen über `file://`), zeigt die Anwendung einen Warnhinweis an; in diesem Fall werden Eingaben nicht dauerhaft gespeichert.

## Sicherheit

Diese Anwendung wurde ohne serverseitige Komponente konzipiert; der gesamte Datenfluss (Erstellung, Verteilung, Rückerfassung, Auswertung) findet lokal auf den beteiligten Rechnern statt, ausgetauscht über HTML- und YAML-Dateien.

Aktueller Sicherheitsstatus:

- **Keine externen Abhängigkeiten zur Laufzeit.** Die einzige verwendete Bibliothek (js-yaml 4.1.0) ist vollständig in die HTML-Datei eingebettet ("vendored"), es werden keine Skripte von CDNs oder Drittanbietern nachgeladen. Dadurch entsteht kein Lieferketten-Risiko durch externe Quellen, allerdings müssen Sicherheitsupdates der Bibliothek manuell nachgezogen werden.
- **Kein `eval()`.** Die eingebettete js-yaml-Bibliothek wird als normales, aktives Skript eingebunden, nicht mehr per `eval()` aktiviert.
- **Content-Security-Policy (CSP) auf Hash-Basis.** Sowohl der Umfrage-Manager als auch jede exportierte Client-Datei enthalten eine CSP, die per `<meta>`-Tag ausgeliefert wird. Sie erlaubt Skriptausführung nur für Skript-Blöcke mit genau passendem SHA-256-Hash (`script-src 'sha256-...'`) — anders als eine feste Nonce, die in einer statischen, offline gespeicherten Datei bei jedem Aufruf identisch und im Quelltext direkt sichtbar wäre, verhindert ein Hash-basierter Ansatz auch dann noch die Ausführung eingeschleuster oder veränderter Skripte, wenn der Quelltext vollständig einsehbar ist. Zusätzlich sind unter anderem `object-src`, `base-uri`, `form-action` und `connect-src` auf `'none'` gesetzt sowie `default-src` komplett gesperrt. **Bewusst akzeptiertes Risiko:** `style-src` erlaubt weiterhin `'unsafe-inline'`, da eine ebenso strikte Absicherung von CSS (viele einzelne `style="..."`-Attribute) einen deutlich größeren Umbau erfordern würde und CSS-Einschleusung ein wesentlich geringeres Risiko darstellt als JavaScript-Einschleusung (keine beliebige Codeausführung möglich).
- **Schutz vor XSS bei der Darstellung von Nutzereingaben.** Alle nutzergesteuerten Inhalte (Umfragebezeichnungen, Fragetexte, Antwortoptionen, Antworten) werden über `textContent`/`createElement` dargestellt, nicht über `innerHTML`. An der einzigen Stelle, an der aktiv HTML erzeugt wird (die generierte Client-Datei), kommt eine dedizierte Escaping-Funktion zum Einsatz, und die eingebetteten Umfragedaten sind gegen ein Herausbrechen aus dem `<script>`-Tag abgesichert.
- **Keine Verschlüsselung der gespeicherten Daten.** Umfragen und importierte Antworten — die personenbezogene oder sensible Informationen enthalten können (z. B. Mitarbeiterbefragungen) — werden unverschlüsselt im localStorage des Browsers abgelegt, ohne zusätzlichen Zugriffsschutz über das Browserprofil hinaus.
- **Kein Schema-Abgleich beim YAML-Import.** Importierte YAML-Dateien (Umfragen wie Antworten) werden strukturell vertraut, ohne formale Schema-Validierung. Die verwendete YAML-Bibliothek verhindert zwar die Ausführung von beliebigem Code beim Parsen, fehlerhafte Dateien können aber zu Laufzeitfehlern führen.
- **Alt-Format- und Fremd-Umfrage-Erkennung beim Import (ab 2.0.0).** Dateien, die noch das vor Version 2.0.0 verwendete Format tragen (alte Feldnamen bzw. `app_version` unterhalb von 2.0.0), werden mit einer klaren Fehlermeldung abgelehnt statt stillschweigend falsch interpretiert zu werden. Beim Import von Antwort-Dateien in den Manager wird zusätzlich geprüft, ob die Datei überhaupt zur aktuell geöffneten Umfrage gehört (UUID-Abgleich) — Dateien einer anderen Umfrage werden nicht in die Auswertung übernommen.
- **Schutz vor Formula Injection im CSV-Export.** Werte aus importierten Antwort-Dateien gelten als nicht vertrauenswürdig, da sie von Befragten stammen. Beim CSV-Export der Auswertung wird jede Zelle (inklusive der aus Antwortdateien übernommenen Fragetexte in der Kopfzeile) geprüft: Beginnt ein Wert mit einem Zeichen, das von Tabellenkalkulationsprogrammen (Excel, LibreOffice, Google Sheets) als Formelanfang interpretiert werden könnte (`=`, `+`, `-`, `@`, Tab, Wagenrücklauf), wird ihm ein Apostroph vorangestellt, damit er als reiner Text angezeigt und nicht ausgeführt wird.

**Zusätzliche Aspekte des gehosteten Clients** (`https://camaro1.github.io/UmfrageManager/`): Der Umfrage-Manager selbst und der per HTML exportierte Client bleiben vollständig offline-fähig; nur der gehostete Client hängt zusätzlich von einem externen Dienst ab. Das bringt eigene, bewusst akzeptierte Restrisiken mit sich:

- **Look-alike-Phishing.** Die kanonische URL ist der Vertrauensanker dieses Wegs — eine ähnlich aussehende, aber gefälschte Adresse (Tippfehler-Domain, anderer Nutzername) wäre für Befragte nicht ohne Weiteres von der echten zu unterscheiden. Mitigation: Nur die von der Umfrage-Ersteller:in kommunizierte URL verwenden und die Adresszeile des Browsers vor dem Import einer Datei prüfen.
- **Neue zentrale Kompromittierungsstelle.** Anders als beim HTML-Export (jede Datei ist unabhängig) liefert eine Kompromittierung des GitHub-Repositories oder -Accounts allen Befragten denselben, potenziell bösartigen Client aus. Dem wird auf GitHub-Seite mit 2FA und Branch-Protection begegnet — das liegt in der Verantwortung der Repository-Eigentümer:in und wird nicht durch den Code selbst erzwungen.
- **Geteilter Origin.** Alle GitHub-Pages-Projektseiten desselben Accounts (`camaro1.github.io/…`) teilen sich einen Origin; der clientseitig genutzte `localStorage` wäre technisch von jeder anderen, unter demselben Account gehosteten Seite lesbar. Mitigation: Unter diesem GitHub-Account keine weiteren, nicht vertrauenswürdigen Seiten hosten.
- **Verfügbarkeit hängt von GitHub ab.** Der gehostete Client ist — im Unterschied zum Manager und zum HTML-Export-Client — nur erreichbar, solange GitHub Pages verfügbar ist; das ist eine bewusst eingegangene Abhängigkeit von einem externen Hosting-Dienst, nur für diesen einen Verteilungsweg.

Eine formale, ausführliche Bedrohungsmodell-Aktualisierung für den gehosteten Client ist als separates, noch ausstehendes Vorhaben geplant (siehe Hinweis in [`docs/security/threat-model.md`](docs/security/threat-model.md)).

### Bedrohungsmodell (Threat Model)

Ein ausführliches STRIDE-Bedrohungsmodell (Bewertung nach OWASP Risk Rating) liegt unter [`docs/security/`](docs/security/) vor. Eine Kurzfassung mit Verweis auf alle Artefakte findet sich in [`docs/security/threat-model.md`](docs/security/threat-model.md).

## Dokumentation

- [Getting Started](docs/getting-started.md) — Schritt-für-Schritt-Anleitung zu den Arbeitsabläufen inkl. Sicherheitsempfehlungen.
- [Bedrohungsmodell — Kurzfassung](docs/security/threat-model.md).
- [Sicherheitsrichtlinie (`SECURITY.md`)](SECURITY.md) — Melden von Schwachstellen.
- [Änderungsprotokoll (`CHANGELOG.md`)](CHANGELOG.md).

## Lizenz

Umfrage-Manager steht unter der [MIT-Lizenz](LICENSE).

Die eingebettete Bibliothek **js-yaml 4.1.0** steht unter der MIT-Lizenz (Copyright © 2011–2015 Vitaly Puzrin, [nodeca/js-yaml](https://github.com/nodeca/js-yaml)). Die Einbettung, Anpassung und Weitergabe im Rahmen dieses Projekts ist davon gedeckt.
