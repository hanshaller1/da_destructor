# Prüfstand DA DESTRUCTOR 2.0

Stand: 1. November 2026. Die Vervollständigung wurde am gesicherten Zwischenstand fortgesetzt; die folgenden Ergebnisse gehören zur erweiterten Version 2.0.

- `node --test tests/*.test.mjs`: **150 bestanden, 0 fehlgeschlagen**.
- `tests/browser-smoke.mjs`: **11 bestanden, 0 fehlgeschlagen**.
- `tests/browser-files-midi.mjs`: **5 bestanden, 0 fehlgeschlagen**.
- `tests/browser-completion.mjs`: **10 bestanden, 0 fehlgeschlagen**.
- `npm.cmd run build`: statische Ausgabe erstellt; relative Modulimporte vollständig und Runtime-Dateien mit dem Quellstand abgeglichen.
- `git diff --check`: ohne Beanstandung bei der normalen Repository-Konfiguration.

## Geprüfte Mechanismen

Die Signaltests erfassen alle 62 Prozessoren einschließlich Extremwerten, Bypass und Stereoausgabe. Zusätzliche Nachweise prüfen MDCT/TDAC und tatsächliche Bitbudgets, Pitch-Following bei mehreren Sampleraten, Hilbert-Seitenbandunterdrückung, Aliasing-Reduktion, Filtertopologien und Rolloffs, Cutoff-FM, Capture-Bänke, gehaltene Aufnahmen, lange Historien, 60 Resonanzmoden und echte Bandisolation.

Time-Tests messen Grain-Raster, unabhängige Pitch-/Wiederholungsdauer, musikalische Patterns, Scratch-Zyklen, Null-Durchgänge, Oversampling-Latenz und gebrochene kurze Repeat-Perioden. Modulations-/Runtime-Prüfungen erfassen externe Sidechain, Auto Gain, echte Kurvenhandles, Pickup zwischen mehreren Quellen, typisierte samplegetreue Automation, BYPASS im hörbaren Pfad, effektive Parameterwerte, tatsächliche FX-Meter, MIDI-Phasenverhalten und zurückgestellte Latenzänderungen.

Die Browserprüfungen liefen unter Windows mit installiertem Chrome im Headless-Modus und dem echten AudioWorklet. Sie erfassen Audioausgabe, nicht stumme Stereo-PCM-WAVs, echte Datei-/Preset-Imports, Bewegung aufnehmen/wiedergeben, getrennte L/R- und Slice-Werte, reale Bézier-Handles, Live-Slot-Vorschau, Cancel-Wiederherstellung, überlappende Macro-Sperren, Sidechain-Datei/ENV und Clock-Recall.

Die letzte Browseraufnahme enthielt Stereo-PCM bei 44,1 kHz/16 Bit und rund 1,30 Sekunden Länge. Desktop-/Mobilprüfungen einschließlich aller sechs Ansichten hatten keinen horizontalen Dokumentüberlauf. Zusätzlich wurden **1545, 1280, 1024, 768, 390 und 360 Pixel** Breite mit jeweils allen sechs Seiten kontrolliert. Alle vier Themes blieben funktionsfähig. In den Browserprotokollen traten keine unbehandelten Seiten- oder Konsolenfehler auf.

## Grenzen der Prüfung

Web MIDI wurde mit simulierten 100-BPM-Nachrichten inklusive Freigabe, Eingangswahl und START/STOP/CONTINUE geprüft. Song Position Pointer besitzt zusätzliche Parser- und Clock-Prüfungen. Physische MIDI-/Audiohardware wurde nicht geprüft. Die numerischen und Browserprüfungen garantieren weder gleichzeitigen Echtzeitbetrieb aller 62 Effekte bei maximaler Qualität noch Klanggleichheit mit einem proprietären Plugin.

Lokale Prüfartefakte liegen im ignorierten Verzeichnis `test-results/`. Die komplette Testquelle wird mitgeliefert. Die private Veröffentlichung verwendet den geprüften, über den Sites-Workflow versionierten Quellstand; Freigaben und Zielgruppe bleiben owner-only.
