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
5. **Antworten als YAML-Datei exportieren.** Nach dem Ausfüllen exportieren die Teilnehmenden ihre Antworten als YAML-Datei aus dem Client heraus.
6. **Antwort-Dateien in den Umfrage-Manager importieren.** Die gesammelten YAML-Antwortdateien werden im Reiter "Auswertung" importiert und dort aggregiert; ein CSV-Export der Ergebnisse ist ebenfalls möglich.

Umfragen selbst lassen sich außerdem als YAML-Datei exportieren/importieren, z. B. um sie zu sichern, zu teilen oder zwischen Rechnern zu übertragen.

## Daten & Speicherung

Alle Daten (Umfragen, Fragen, importierte Antworten) werden ausschließlich im **lokalen Speicher (localStorage) des Browsers** gehalten — es findet keine Übertragung an einen Server statt. Ist localStorage nicht verfügbar (z. B. bei manchen Browser-Konfigurationen beim Öffnen über `file://`), zeigt die Anwendung einen Warnhinweis an; in diesem Fall werden Eingaben nicht dauerhaft gespeichert.

## Sicherheit

Diese Anwendung wurde ohne serverseitige Komponente konzipiert; der gesamte Datenfluss (Erstellung, Verteilung, Rückerfassung, Auswertung) findet lokal auf den beteiligten Rechnern statt, ausgetauscht über HTML- und YAML-Dateien.

Aktueller Sicherheitsstatus:

- **Keine externen Abhängigkeiten zur Laufzeit.** Die einzige verwendete Bibliothek (js-yaml 4.1.0) ist vollständig in die HTML-Datei eingebettet ("vendored"), es werden keine Skripte von CDNs oder Drittanbietern nachgeladen. Dadurch entsteht kein Lieferketten-Risiko durch externe Quellen, allerdings müssen Sicherheitsupdates der Bibliothek manuell nachgezogen werden.
- **Kein `eval()`.** Die eingebettete js-yaml-Bibliothek wird als normales, aktives Skript eingebunden, nicht mehr per `eval()` aktiviert.
- **Content-Security-Policy (CSP) auf Hash-Basis.** Sowohl der Umfrage-Manager als auch jede exportierte Client-Datei enthalten eine CSP, die per `<meta>`-Tag ausgeliefert wird. Sie erlaubt Skriptausführung nur für Skript-Blöcke mit genau passendem SHA-256-Hash (`script-src 'sha256-...'`) — anders als eine feste Nonce, die in einer statischen, offline gespeicherten Datei bei jedem Aufruf identisch und im Quelltext direkt sichtbar wäre, verhindert ein Hash-basierter Ansatz auch dann noch die Ausführung eingeschleuster oder veränderter Skripte, wenn der Quelltext vollständig einsehbar ist. Zusätzlich sind unter anderem `object-src`, `base-uri`, `form-action` und `connect-src` auf `'none'` gesetzt sowie `default-src` komplett gesperrt. **Bewusst akzeptiertes Risiko:** `style-src` erlaubt weiterhin `'unsafe-inline'`, da eine ebenso strikte Absicherung von CSS (viele einzelne `style="..."`-Attribute) einen deutlich größeren Umbau erfordern würde und CSS-Einschleusung ein wesentlich geringeres Risiko darstellt als JavaScript-Einschleusung (keine beliebige Codeausführung möglich).
- **Schutz vor XSS bei der Darstellung von Nutzereingaben.** Alle nutzergesteuerten Inhalte (Umfragebezeichnungen, Fragetexte, Antwortoptionen, Antworten) werden über `textContent`/`createElement` dargestellt, nicht über `innerHTML`. An der einzigen Stelle, an der aktiv HTML erzeugt wird (die generierte Client-Datei), kommt eine dedizierte Escaping-Funktion zum Einsatz, und die eingebetteten Umfragedaten sind gegen ein Herausbrechen aus dem `<script>`-Tag abgesichert.
- **Keine Verschlüsselung der gespeicherten Daten.** Umfragen und importierte Antworten — die personenbezogene oder sensible Informationen enthalten können (z. B. Mitarbeiterbefragungen) — werden unverschlüsselt im localStorage des Browsers abgelegt, ohne zusätzlichen Zugriffsschutz über das Browserprofil hinaus.
- **Kein Schema-Abgleich beim YAML-Import.** Importierte YAML-Dateien (Umfragen wie Antworten) werden strukturell vertraut, ohne formale Schema-Validierung. Die verwendete YAML-Bibliothek verhindert zwar die Ausführung von beliebigem Code beim Parsen, fehlerhafte Dateien können aber zu Laufzeitfehlern führen.

### Bedrohungsmodell (Threat Model)

Ein ausführliches Bedrohungsmodell wird zu einem späteren Zeitpunkt ergänzt und hier verlinkt.

## Lizenz

Umfrage-Manager steht unter der [MIT-Lizenz](LICENSE).
