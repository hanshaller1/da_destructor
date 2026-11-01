# Prüfung am 1. November 2026

- `npm.cmd test`: 62 bestanden, 0 fehlgeschlagen.
- `node tests/browser-smoke.mjs`: 11 bestanden, 0 fehlgeschlagen.
- `node tests/browser-files-midi.mjs`: 5 bestanden, 0 fehlgeschlagen.
- `npm.cmd run build`: statische Ausgabe vollständig erstellt.
- `git diff --check`: ohne Beanstandung. Es wurden keine Git-Commits oder Pushes ausgeführt.

Die Browserprüfung lief unter Windows mit installiertem Google Chrome im Headless-Modus. Sie verwendete das echte AudioWorklet. Der Aufnahmecheck erzeugte ein gültiges Stereo-PCM-WAV bei 48 kHz/16 Bit, ungefähr 1,30 Sekunden lang, mit nicht stummen Samplewerten. Desktop 1545×909 und Mobilansicht 390×844 hatten auf allen sechs Seiten keinen horizontalen Dokumentüberlauf. Keine unbehandelten Browser- oder Konsolenfehler traten auf.

Dateiimport wurde mit einer echten WAV-Datei geprüft, einschließlich Pause und Wiederaufnahme an der erhaltenen Position. Ein exportiertes Preset stellte Effekt-Reihenfolge, SNAP und Tonart nach Init-Reset wieder her. Simulierte MIDI-Nachrichten prüften Freigabe, ausdrückliche Eingangswahl, 100-BPM-Erkennung und START/STOP/CONTINUE. Es wurde kein physisches MIDI-Gerät und kein konkretes Audio-Interface geprüft. Die numerischen und Browserprüfungen sind kein Beleg für die Echtzeitfähigkeit aller 62 Effekte gleichzeitig und keine Klanggleichheitsprüfung eines kommerziellen Plugins.

Das Quellcode-/Startpaket ist lokal verfügbar. Eine zusätzliche private Sites-Veröffentlichung wurde durch die automatische Freigabe blockiert: Die externe Übertragung des vollständigen Projekts benötigt eine ausdrückliche Zustimmung des Nutzers. Es fand keine Quellcode-Synchronisierung statt.
