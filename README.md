# Polski Sprint

Fertige Browser-App für GitHub Pages: ein Polnisch-Vokabeltrainer mit 1000 Vokabeln, 10 Leveln, Smalltalk-/Business-Fokus, Streaks, Sternen und Tagespokal.

## Enthaltene Dateien

- `index.html` – die eigentliche App-Seite
- `styles.css` – das Design
- `script.js` – die Logik der App
- `vocab-data.js` – alle 1000 Vokabeln
- `favicon.svg` – Tab-Icon
- `.nojekyll` – damit GitHub Pages die Seite sauber als statische Seite ausliefert
- `ANLEITUNG_GITHUB.md` – extra einfache Schritt-für-Schritt-Anleitung

## Sehr kurz: So geht es

1. Auf GitHub ein neues Repository anlegen, z. B. `polski-sprint`.
2. Alle Dateien aus diesem Ordner in das Repository hochladen.
3. In GitHub: **Settings** → **Pages** → **Deploy from a branch**.
4. Branch **main** und Ordner **/(root)** auswählen.
5. Speichern.
6. Danach ist die Seite unter deiner GitHub-Pages-Adresse erreichbar.

## Vokabel-Logik

- Deutsch wird angezeigt.
- Du tippst Polnisch.
- Richtig = grün.
- Falsch = rot.
- Richtig gelöste Wörter verschwinden in der aktuellen Runde.
- Falsch gelöste Wörter bleiben im Pool und kommen wieder.
- Normale Tastatur reicht: polnische Sonderzeichen sind **nicht zwingend nötig**.

## Gamification

- ⭐ bei 5 richtigen in Folge
- ⭐⭐ bei 10 richtigen in Folge
- ⭐⭐⭐ bei 20 richtigen in Folge
- 🏆 bei 10 richtigen Antworten an einem Tag
- Streak im Startmenü: Tage am Stück mit mindestens 10 richtigen Antworten

## Inhalte

- 10 Level mit je 100 Vokabeln
- Fokus auf:
  - Smalltalk
  - Business
  - Bewegungsverben
  - Adverben
- Niveau grob von A1 bis B2

## Tipp

Wenn du später Vokabeln austauschen willst, musst du nur die Datei `vocab-data.js` ändern.
