# Analyse des Recherche-Briefings

Das Dokument beschreibt ein Loop-Performance-Instrument mit mehreren Schichten: historische Audioverarbeitung in Time-Engines, ein umsortierbares Stereo-FX-Rack, eine MAIN-Sektion und ein gemeinsames Modulations-/Performance-System. Entscheidend ist der gemeinsame Zustand der Parameter; isolierte Regler ohne durchgehenden Signalfluss würden die Beschreibung nicht erfüllen.

Die konkrete Nutzeranfrage bestimmt die Zielplattform als Webapp und verlangt variable Themes. Das angehängte Bild ist eine Referenz für Form, Rahmen und Einbettung der Bedienelemente. Die App verwendet deshalb eine eigene Seitenstruktur mit Gerätepaneelen, versenkten Selektoren, plastischen Reglern und einer dauerhaft sichtbaren MAIN-Sektion. Die Filterbank-Anordnung der Referenz wurde nicht übernommen.

## Umgesetzte Zuordnung

| Briefing | Umsetzung |
| --- | --- |
| Eingang und Host-Clock | AudioBufferSource oder MediaStreamAudioSource, interner Samplezähler, optionale zeitgestempelte MIDI-Clock mit Phasenkorrektur und Song Position Pointer |
| Drei Time-Engines und Bend-Modus | Stereo-Ringpuffer, Dual-Grains, Tape-Readhead und taktgebundene Capture-Slices; BendIt als Zustand des Stutter-Moduls |
| Vier Effekt-Reihenfolgen | Drei serielle Anordnungen und parallele Summe der Time-Engines |
| 62 Effekte | 62 implementierte Kerne, jeder einmal einfügbar; erweiterte dokumentierte Parameter in Haupt-/Detailbereichen |
| Serial/Parallel und Gain je FX | Instanzbasierte Kette, stabile IDs, Fades, separate Mix-/Gain-Steuerung und Latenzausgleich |
| Spektrale Prozesse | Gemeinsame Stereo-FFT/STFT mit tatsächlicher Overlap-Add-Synthese |
| MAIN und Schutz | 3-Band-EQ, Gain, Pan, Mix und Kompressor mit begrenztem Stereoausgang |
| Animate | Vier umschaltbare Quellen, drei Bézier-Graphen, je sechs Ziele, Modulator-Modulation |
| Sequencer | Je 64 unabhängige Steps für Stretch und Stutter, als 1–4 Patterns mit je 16 Steps |
| Perform | Vier Macros und XY, je fünf Ziele, Routingkurven und Pickup |
| SNAP | Globale Tonart in CONFIG und SNAP je geeigneter FX-Instanz |
| Randomisierung | Würfeln für einzelne Engines/FX oder Bereiche; Stärke 0 sperrt Parameter |
| Presets und Themes | Init, fünf eigene Factory-Presets, lokale User-Presets, sicheres JSON-Format, vier Themes mit frei wählbarem Akzent |
| Ausgabe | Stereo-Wiedergabe und direkte PCM-WAV-Aufnahme nach dem Audio-Master |

## Bewusst aufgelöste Unklarheiten

Die App ist eine eigenständige Interpretation. Die widersprüchlichen Aussagen zu Originalversionen, Preisen oder proprietären Verfahren sind keine Voraussetzung für das Funktionieren der Webapp. Unbekannte Algorithmen wurden selbst entworfen; die Beschreibungen wurden nicht als Beleg für identische Ergebnisse verwendet. Die zunächst reduzierten Parametergruppen und Mechanismen wurden in Version 2.0 vervollständigt. Der aktuelle Abgleich ist in feature-coverage.md und den Implementierungsnotizen dokumentiert. Nicht öffentlich belegte Originaldetails bleiben von den eigenständig implementierten Funktionsmechanismen getrennt.

Ein unabhängiger zweiter Audioeingang bildet den externen Sidechain ab. Samplegetreue Control-Aufnahme und Wiedergabe ersetzen innerhalb der Webapp native DAW-Automationsspuren. MIDI-Zeitstempel korrigieren die fortlaufende Sample-Clock; externe Hardware-Ankunft kann die Webapp nicht samplegenau garantieren. Die eigenen Werkzeuge bleiben auch ohne Datei- oder Mikrofonzugriff mit dem erzeugten Factory-Loop nutzbar.

## Prüfbelege

150 Node-Prüfungen erfassen DSP-Mechanismen, Clock, Zustandsverwaltung, Quellwechsel und Aufnahme. 26 Browserprüfungen verwenden das tatsächliche AudioWorklet und prüfen die bisherigen sowie die erweiterten Bedienwege, nicht stumme WAV-Aufnahmen, Datei-/Preset-Import, externe Sidechain, Bewegungsaufnahme, alle sechs Seiten und Desktop-/Mobilgeometrie. Die MIDI-Eingangslogik wird mit simulierten Clock-Nachrichten geprüft. Eine Prüfung mit dem konkreten Audio-Interface oder MIDI-Gerät des Nutzers steht aus.
