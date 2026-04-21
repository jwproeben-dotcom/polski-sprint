# Schritt-für-Schritt: auf GitHub hochladen und im Browser öffnen

## Variante für absolute Anfänger

### 1) GitHub-Konto öffnen
Melde dich bei GitHub an.

### 2) Neues Repository erstellen
Klicke oben rechts auf **+** und dann auf **New repository**.

Empfehlung für den Namen:
`polski-sprint`

Dann:
- **Public** auswählen
- **Create repository** klicken

### 3) Dateien hochladen
Im neuen Repository auf **Add file** klicken und dann auf **Upload files**.

Jetzt **alle Dateien aus diesem Ordner gleichzeitig** in GitHub hineinziehen oder auswählen:

- `index.html`
- `styles.css`
- `script.js`
- `vocab-data.js`
- `favicon.svg`
- `.nojekyll`

Danach unten auf **Commit changes** klicken.

### 4) GitHub Pages aktivieren
Im Repository auf **Settings** klicken.

Dann links auf **Pages**.

Unter **Build and deployment**:
- bei **Source**: `Deploy from a branch`
- bei **Branch**: `main`
- bei Ordner: `/(root)`

Dann **Save** klicken.

### 5) App öffnen
Nach dem Speichern veröffentlicht GitHub die Seite.

Deine URL ist dann normalerweise:

`https://DEIN-GITHUB-NAME.github.io/polski-sprint/`

Beispiel:
Wenn dein GitHub-Name `maxmustermann` ist, dann ist die Adresse:

`https://maxmustermann.github.io/polski-sprint/`

## Wenn du später etwas ändern willst

1. Datei lokal ändern
2. Im gleichen Repository die Datei ersetzen
3. Wieder **Commit changes**
4. GitHub aktualisiert die Seite automatisch

## Welche Datei wofür da ist

- `index.html` = die App selbst
- `styles.css` = Farben, Layout, schönes Design
- `script.js` = Lernlogik, Streaks, Belohnungen, Speichern im Browser
- `vocab-data.js` = alle 1000 Vokabeln

## Wichtig

Der Lernfortschritt wird im Browser gespeichert (Local Storage).  
Wenn du den Browser wechselst oder die Browserdaten löschst, ist der Fortschritt dort weg.


## Zusatz zum letzten Update

Auf dem Handy bleibt die Eingabe jetzt auch zwischen zwei Fragen aktiv. Nach dem Hochladen der neuen Dateien solltest du beim naechsten Wort direkt weiterschreiben koennen, ohne wieder in das Eingabefeld tippen zu muessen.
