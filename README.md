# DA DESTRUCTOR 2.0

Stereo-Audioinstrument für den Browser auf Grundlage des gelieferten Recherchebriefings. Die bestehende Geräteoberfläche mit sechs Seiten, eingefassten Panels, plastischen Reglern und dauerhaft sichtbarem MAIN bleibt erhalten. Vier Themes, freie Akzentfarbe und UI-Skalierung sind zur Laufzeit verfügbar.

## Start

Node.js 20 oder neuer genügt; es gibt keine zu installierenden Laufzeitabhängigkeiten.

```powershell
npm.cmd start
```

Dann `http://127.0.0.1:4173` öffnen. Unter Windows alternativ `Start-Destructor.cmd` starten. AudioWorklet, Live-Audio und MIDI benötigen localhost oder HTTPS. **START AUDIO** startet den eigenen 120-BPM-Demo-Loop. Dateien können über PLAY / LOAD oder Drag-and-drop geladen werden. Audio bleibt lokal im Browser.

## Bedienung und Erweiterungen

- **TIME:** Stereo-Stretch mit musikalischem Grain-Raster, unabhängigem Pitch und Freeze; Varispeed mit Tape-Stop, Scratch, Wow/Flutter und 2×-Sättigung; Stutter mit festem Wiederholungsraster unabhängig vom Pitch; BendIt mit vier benannten, über vier Takte laufenden Scratch-Programmen und editierbarem Tukey-WINDOW. Weitere Optionen liegen hinter `···`, Random-Setup hinter dem Zahnrad. Die drei seriellen Reihenfolgen und Parallelbetrieb bleiben verfügbar.
- **FX RACK:** Alle 62 Effektfamilien haben Audioprozessoren. DETAILS öffnet die zusätzlichen Parameter. L/R LOCK koppelt die Regler; ohne Lock können LEFT und RIGHT unabhängig bearbeitet werden. MUTE und Bypass sind getrennt. SYNC erscheint bei den 24 Effekten mit tatsächlich umschaltbarer freier/geclockter Rate. Jeder Effekt besitzt Gain, Mix und eine gemessene Ausgangsvisualisierung. CHOPPER bietet zusätzlich einen Editor für 32 Slices.
- **Neue DSP-Mechanismen:** Echte MDCT-Codierung für LOSSY, Pitch-Tracking, 2×-Oversampling, Hilbert-Frequenzverschiebung, vier PRISM-Filtertopologien, vier Tape-Modelle, 60 CRYSTAL-Moden, echter Through-Zero-Flanger, gegenläufige Barber-Sweeps, lange Historien, getrennte Capture-Bänke, gehaltene Aufnahmen, Loop-Modi, bandselektive Dynamik und getrennte Hallstrukturen.
- **Spektralverarbeitung:** FFT-Größen 512/1024/2048/4096, phasenkohärentes Remapping, Formanthüllkurven, Ton/Rausch/Transienten-Aufteilung, echte Snapshot-Oszillatoren, globale KEY-/CHORD-Masken, externe MAGNET-Peaks und per-Bin-Delay mit musikalischen Zeiten und Band-Freeze.
- **ANIMATE:** Vier LFO-/Random-/Envelope-Quellen mit je sechs Zielen und drei geschlossene Bézier-Graphen mit je sechs Zielen. HANDLES zeigt die direkt ziehbaren Kurvenhandles; Shift-Ziehen bleibt für Segmentkrümmung verfügbar. Das Zahnrad wählt musikalische oder ältere Preset-Zeiten. Modulatoren können andere Modulatoren steuern.
- **Sequencer:** Je 1–4 verkettete Patterns mit 16 Steps für Stretch und Stutter/Bend. Klick schaltet einen Step, Ziehen verändert seinen Wert. FILL, CLEAR, INVERT und Würfeln bearbeiten das aktuelle Pattern. Übergänge werden pro Sample berechnet.
- **PERFORM:** Vier benennbare Macros und XY mit je fünf Zielen. Pickup berücksichtigt laufende Modulation und konkurrierende Controller. Zugewiesene Regler sind gesperrt; ein Badge zeigt die aktuell steuernde Quelle und führt zu ihr. Rechtsklick öffnet die Zuweisung. Bestehende Slot-Kurven werden beim Ziehen unmittelbar hörbar; CANCEL stellt die Zuweisung wieder her.
- **REC MOTION / PLAY MOTION:** Bewegungen der Regler, Macros, XY, boolescher Schalter, bekannter Auswahlfelder, Sequencer-Werte und Graph-Koordinaten aufnehmen und im Audiotakt wiedergeben. LOOP wiederholt die Aufnahme. Presets enthalten die Bewegung. Aufnahmebegrenzung: zehn Minuten beziehungsweise 50.000 Events. Eine neue Aufnahme ersetzt den bisherigen Take erst beim Speichern des Takes.
- **EXTERNAL SIDECHAIN:** Unter PLAY / LOAD einen unabhängigen Audioeingang oder eine separate Audiodatei verbinden. ENV kann INTERNAL oder EXTERNAL verwenden; MAGNET kann sich an externen Spektralpeaks orientieren. Der Sidechain wird nicht zum hörbaren Ausgang gemischt.
- **MAIN / CONFIG:** Gain, Low/Mid/High, Pan, Compressor, Dry/Wet und Limiter. Auto Gain gleicht die gemessene Bearbeitungs-Pegeländerung aus und steht unter CONFIG. Dort befinden sich auch der Gain-Bereich, globale Tonart und Latenzausgleich. Änderungen der latenztragenden FX-Struktur werden bei laufendem Transport bis zum Stop vorgemerkt.
- **MIDI:** Explizite Freigabe und Eingangswahl in CONFIG. Clock, START, CONTINUE, STOP und Song Position Pointer werden verarbeitet. Die Sample-Clock akkumuliert musikalische Zeit und korrigiert Drift begrenzt anhand der Zeitstempel eingehender MIDI-Nachrichten.
- **REC WAV:** Der bearbeitete Stereoausgang wird nach dem Limiter und vor der Monitor-Lautstärke als 16-Bit-PCM-WAV aufgenommen. Stop, Pause und Quellenwechsel schließen die Aufnahme ab.

Regler: vertikal ziehen, Shift für Feineinstellung, Mausrad oder Pfeiltasten, Doppelklick zum Standardwert, Rechtsklick zur Zuweisung. Leertaste startet/pausiert; Escape stoppt und leert die Audiospeicher. Die Bedienhilfe bleibt über `?` erreichbar.

## Presets und Kompatibilität

Init, kategorisierte eigene Factory-Presets und User-Presets stehen im Kopfbereich. Speichern legt einen neuen Namen an und verwendet bei Konflikten einen Suffix. JSON-Import/-Export überträgt vollständige Parameter, Routings, Sequencer und Bewegungen; Audiodateien und Gerätefreigaben sind davon getrennt. Bei vollem Browserspeicher wird ein neu gespeichertes User-Preset als JSON-Datei angeboten.

Das Preset-Format bleibt Version 1. Alte Dateien erhalten ergänzte Standardfelder und unabhängige rechte Parameterkopien. Ihre bisherigen Time-/Graph-Zuordnungen und der frühere Gain-Bereich bleiben als LEGACY erhalten. MUSICAL beziehungsweise der neue Gain-Bereich können in den Details/CONFIG gewählt werden. Die verbesserten Algorithmen und das korrigierte Stutter-Pitch-Timing können alte Presets hörbar verändern; es wird keine Klangidentität zur alten Implementierung zugesichert.

## Umfang und verbleibende Grenzen

Die bekannten, beschriebenen Mechanismen wurden eigenständig umgesetzt. Das ist keine Kopie des DSP, der Presets oder Samples eines kommerziellen Plugins. Wo das Briefing selbst keine belastbaren Details enthält, etwa bei COMB/CADENCE und einzelnen Originalmodellen, ist keine exakte Originalgleichheit verifizierbar.

Eine eigenständige Webapp besitzt keine VST3/AU/AUv3-Schnittstelle und keine nativen DAW-Automationsspuren oder Host-Latenzmeldung. Entsprechende Aufgaben übernimmt hier die interne Clock, Web-MIDI-Synchronisation, Control-Automation und WAV-Ausgabe. Die Genauigkeit externer MIDI-Ankunft, Gerätezugriff und reale Ein-/Ausgangslatenz hängen von Browser, Betriebssystem und Audiohardware ab. Physische MIDI-/Audiohardware wurde nicht geprüft. Monophones Pitch-Tracking kann bei Akkorden oder stark geräuschhaften Quellen mehrdeutig sein; endliche Filter und kleine FFT-Fenster besitzen die üblichen Auflösungsgrenzen. Die technischen Tests garantieren keinen gleichzeitigen Echtzeitbetrieb aller 62 Effekte bei maximaler Qualität auf jedem Gerät.

Details: [Funktionsabgleich](docs/feature-coverage.md), [Time-DSP](docs/time-implementation.md), [FX-DSP](docs/fx-implementation.md), [Audio/Modulation](docs/audio-architecture.md), [Prüfstand](docs/validation.md). Das gelieferte Briefing liegt unverändert unter `docs/research-brief.md`.

## Entwicklung

```powershell
npm.cmd test
npm.cmd run test:browser
npm.cmd run build
```

Die Browserprüfungen benötigen einen bereits laufenden lokalen Server sowie Playwright und Chrome/Edge. Sie suchen die vorhandene lokale Runtime; alternativ `PLAYWRIGHT_MODULE`, `CHROME_PATH` und `BASE_URL` setzen. Es wird kein Browser heruntergeladen. `npm.cmd run build` erzeugt die statische HTTPS-bereite App in `dist/`.

Die Module bleiben unabhängig vom UI-Framework: `state.mjs` Parameter/Preset-Schema, `audio-host.mjs` Dateien/Eingänge/WAV, `audio-worklet.mjs` Signalpfad/Clock/Replay, `time-core.mjs` Time-Engines, `fx-core.mjs` Rack, `fx-advanced.mjs` zusätzliche Effektmechanismen, `fx-reverb.mjs` Hall, `fx-modulation.mjs` Flanger/Phaser, `dsp-primitives.mjs` Pitch/Filter/Hilbert/FIR, `codec-mdct.mjs` LOSSY, `spectral.mjs` FFT/STFT, `modulation.mjs` Quellen/Takeover/Sequencer, `automation.mjs` Gestenaufnahme und `midi-clock.mjs` MIDI-Empfang.
