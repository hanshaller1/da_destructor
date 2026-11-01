# DA DESTRUCTOR

Stereo-Audioinstrument für den Browser, entwickelt aus dem beigefügten Tape-Fiasco-Recherchebriefing. Eigener Produktname, eigene Oberfläche, eigener DSP. Die visuelle Referenz bestimmt die Formensprache: eingefasste Geräteflächen, versenkte Segmente, plastische Drehregler und kompakte Statusanzeigen. Vier Themes und eine freie Akzentfarbe sind zur Laufzeit umschaltbar.

## Lokal starten

Node.js 20 oder neuer wird benötigt; keine Paketinstallation und keine externen Laufzeitbibliotheken.

```powershell
npm.cmd start
```

Dann `http://127.0.0.1:4173` öffnen und **START AUDIO** drücken. Unter Windows funktioniert auch `Start-Destructor.cmd`. Die Dateien benötigen HTTP auf localhost oder HTTPS, weil Browser AudioWorklets und Eingangsfreigaben absichern.

Der erzeugte Factory-Loop ist ein eigener, deterministischer Stereo-Drum-/Bass-/Pluck-Loop mit 120 BPM. Eigene Audiodateien können per Drag-and-drop oder über **PLAY / LOAD** geladen werden. **CONNECT INPUT** verbindet ein Mikrofon oder Audio-Interface. Die Wiedergabe beginnt nach einer bewussten Aktion; es gibt kein Autoplay.

## Bedienung

- **TIME:** Dual-Grain-Stretch, Varispeed-Tape, Stutter oder BendIt. Drei serielle Reihenfolgen und parallele Verarbeitung. Die Taste `···` öffnet weitere Parameter. Ein veränderter Time-Regler aktiviert seine Engine.
- **FX RACK:** 62 eigene Prozessoren in zehn Kategorien, jeweils einmal einfügbar. Reihenfolge per Ziehen oder Pfeiltasten ändern; SERIAL/PARALLEL, Bypass, Mix und Gain je Effekt. SNAP bindet passende Parameter an ROOT/SCALE/CHORD in CONFIG.
- **ANIMATE:** Vier LFO-/Random-/Envelope-Modulatoren mit 19 LFO-Formen, drei editierbare Bézier-Graphen und bis zu sechs Ziele je Quelle. Modulatoren können andere Modulatoren steuern.
- **Sequencer:** Zwei unabhängig laufende Sequencer, jeweils 1–4 verkettete Patterns mit 16 Steps. Klick schaltet einen Step, vertikales Ziehen verändert seinen Wert; abgeschaltete Stutter-Steps lassen Dry durch. Der Sequencer startet selbst keine Audiodatei.
- **PERFORM:** Vier benennbare Macros und XY-Pad, je fünf Ziel-Slots. MIN/MAX/START/END/SKEW sowie lineare, S- und Dreieckskurven. Pickup verhindert sofortige Sprünge nach einer manuellen Änderung des Ziels.
- **MAIN:** Gain, Low/Mid/High, Pan, Compressor und Dry/Wet, anschließend begrenzter Ausgang. Die Monitor-Lautstärke im Kopfbereich liegt hinter der Aufnahme.
- **REC WAV:** Aufnahme des bearbeiteten Stereoausgangs als 16-Bit-PCM-WAV bei der AudioContext-Samplerate. Stoppen speichert die Datei; Pause und Quellenwechsel schließen eine laufende Aufnahme ab. Maximal 10 Minuten pro Aufnahme.
- **CONFIG:** Vier Themes, freie Akzentfarbe, UI-Skalierung, Tonart, Presets und optionale MIDI-Clock. MIDI-Clock erfordert Browserfreigabe und ausdrückliche Eingangswahl. Sie folgt Tempo und START/CONTINUE/STOP; die Audiozeit läuft im Worklet weiter.

Regler: ziehen, Shift für Feineinstellung, Mausrad oder Pfeiltasten, Doppelklick zum Zurücksetzen, Rechtsklick für Modulationszuweisung. Graph: Klick setzt Punkt, Ziehen verschiebt ihn, Shift-Ziehen verändert den Bézier-Verlauf, Rechtsklick löscht. Leertaste startet/pausiert, Escape stoppt und leert die Audiospeicher.

Session, Themes und User-Presets liegen im lokalen Browserspeicher. **SAVE USER PRESET** speichert immer einen neuen Namen mit Suffix bei Namenskonflikten. JSON-Import/-Export ermöglicht den Transfer auf andere Geräte. Audiodateien sind kein Bestandteil des Presets. Audio wird nicht hochgeladen.

## Einordnung des Briefings

Das Briefing ist eine recherchierte Funktionsbeschreibung mit ausdrücklich unbekannten DSP-Details. Die App interpretiert die beschriebenen Funktionen eigenständig. Sie ist keine binär- oder klangidentische Umsetzung des genannten Plugins. Alle 62 Einträge verarbeiten tatsächlich Audio; je Effekt ist eine ausgewählte, funktionsfähige Parametergruppe umgesetzt. Sie bilden nicht sämtliche Detailoptionen des Recherchebriefings ab.

Wesentliche Unterschiede:

- Web Audio statt VST3/AUv3 und DAW-Automation; keine Plugin-Host-Integration.
- MIDI als Tempo-/Transport-Follower, keine samplegenau an externem PPQ verriegelte DAW-Zeit.
- Interner Envelope-Follower; kein separater externer Sidechain-Eingang.
- Eigene Grain-, Scratch-, Resonator-, Feedback- und Reverb-Verfahren. Keine übernommenen Samples, Factory-Presets, Grafiken oder DSP-Quellen.
- Spektrale Effekte nutzen echte FFT/STFT mit festem 512-Sample-Fenster und 128-Sample-Hop. LOSSY ist eine spektrale Codec-Näherung ohne MDCT-Codec. Kein allgemeines Oversampling und kein allgemeines Pitch-Tracking.
- FX-Historien sind auf ungefähr vier Sekunden begrenzt. Die speziellen längeren Aufnahmefenster mancher Originaleffekte sind nicht vollständig umgesetzt. SCANNER liest laufende Historie statt eines separaten Capture-Schalters.
- Serielle, parallele und MAIN-Dry-Pfade gleichen die implementierte Spektrallatenz aus. Änderungen der Kette wirken unmittelbar; es gibt keinen Host, an den Latenz gemeldet wird.
- Die nutzbare Effektzahl hängt von Browser und Gerät ab. Die numerische Prüfung aller 62 Kerne ist keine Zusicherung, dass alle 62 gleichzeitig in Echtzeit laufen.

Details: [Time-DSP](docs/time-implementation.md), [FX-Verfahren](docs/fx-implementation.md), [Audio-/Modulationsarchitektur](docs/audio-architecture.md). Das gelieferte Briefing liegt unverändert unter `docs/research-brief.md`.

## Entwicklung und Prüfung

```powershell
npm.cmd test
npm.cmd run build
```

Die 62 Node-Tests prüfen unter anderem alle Effektkerne, Parameterextreme, FFT-Rekonstruktion, Tonhöhenänderung, Tape-Stop, Freeze, Clock-/Sequencer-Grenzen, Routing, Pickup, Preset-Sicherheit und WAV-Daten. Die 16 Browserprüfungen in `tests/browser-smoke.mjs` und `tests/browser-files-midi.mjs` prüfen echte AudioWorklet-Ausgabe, Bedienwege, Aufnahme, Datei-/Preset-Import, simulierte MIDI-Clock und das responsive Layout. Sie benötigen separat bereitgestelltes Playwright und Chrome; die lokale Runtime wird automatisch gesucht. Einen laufenden lokalen Server vorausgesetzt, können beide Dateien einzeln mit `node` ausgeführt werden.

`npm.cmd run build` schreibt die statische App nach `dist/`. Der Quellcode hat keine Laufzeitabhängigkeiten von CDNs oder Frameworks. Für die Entwicklung genügt der lokale Server; für die Bereitstellung kann `dist/` auf einem HTTPS-Static-Host liegen.

## Modulstruktur

`app.mjs` — Oberfläche und Interaktionen; `styles.css` — Formen und Theme-Variablen; `state.mjs` — Parameter/Preset-Schema; `audio-host.mjs` — Dateien, Eingänge, Transport und WAV; `audio-worklet.mjs` — Audio-Runtime und MAIN; `time-core.mjs` — Time-Engines; `fx-core.mjs` — Effektkette; `spectral.mjs` — FFT/STFT; `effects.mjs` — Effektkatalog und exakte Werteanzeigen; `modulation.mjs` — Clock, Quellen, Ziele und Sequencer; `midi-clock.mjs` — MIDI-Empfang.
