# Funktionsabgleich der Vervollständigung

Stand: DA DESTRUCTOR 2.1, 2. November 2026. Grundlage ist das gelieferte Recherchebriefing. Die Gegenüberstellung bezieht sich auf beschriebene Funktionen; nicht öffentlich dokumentierte proprietäre Algorithmen und darin nur als geplant oder unbestätigt bezeichnete Erweiterungen sind keine verifizierbare Gleichheitsanforderung.

| Früher offener Bereich | Umsetzung und Nachweis |
| --- | --- |
| Externer Sidechain | Getrennter zweiter Worklet-Eingang, eigener Datei-/Live-Host; ENV und MAGNET empfangen ihn. Signaltest und echter Browser-Dateitest. |
| Pitch-Tracking | Decimierter YIN in den vorgesehenen Tracking-Pfaden, PLL beim Subteiler; harmonikreiche Grundtöne bei mehreren Sampleraten geprüft. |
| Oversampling/HQ | Tatsächliche 2×-FIR-Interpolation und Dezimation; FISSION rechnet auch das Delaynetz bei doppelter Rate. Aliasing-Reduktion gemessen. |
| Stereo / gemeinsame FX-Steuerung | Unabhängige Parameter, L/R-Lock, synchrones Live-Mute/Mix/Gain auf beiden Kanälen; tatsächliche pro-FX-Wellenform und Peaks. |
| Freie/geclockte FX-Raten | Umschalter nur bei den 25 tatsächlich umschaltbaren Prozessoren. Fest beatgebundene Capture- und Hold-Prozesse bleiben musikalisch. |
| MAIN | Auto Gain anhand gemessener Wet-/Dry-Energie; neuer Gain-Bereich −∞…+12 dB mit 0 dB in der Mitte; alter Bereich bei importierten Presets verfügbar. |
| Time-Engines | Exakte Grain-Notenraster, Sample-/Pitch-unabhängige Stutter-Wiederholung, vier Scratch-Programme, Achtel-Quantisierung, editierbares Fenster. Mechanismusprüfungen statt reiner Sichtprüfung. |
| MIDI / Clock | Aufsummierter Beat, Zeitstempelkorrektur, Transport und Song Position Pointer. Externe Präzision bleibt API-/Geräteabhängig. |
| Graph / Takeover | Geschlossene Endpunkte, echte zweidimensionale Handles, Modulator-Modulation, aktuelle Quellenanzeige und Pickup gegenüber mehreren Quellen. |
| Kurven / Regler | Live-Vorschau beim Slot-Edit, Wiederherstellen bei CANCEL, Sperre bei jeder Macro-Zuweisung auch neben LFO-Zuweisungen. Browserprüfungen. |
| Control-Automation | Samplegetreuer Replay kontinuierlicher/boolescher/typisierter Auswahlwerte, Grundton, Graph-Koordinaten und Sequencer-Zellen. Loop und Wiederholung im Browser geprüft. |
| Random Setup | Vollständige numerische Engine-/FX-Auswahl einschließlich Bend und Slice-Zellen, signierte Stärke, Wahrscheinlichkeit und Null-Sperre; globale und eigene Setups. |
| BITROT / TAPE / UNDERTOW | Zehn Quantizer-Modelle mit Zusatzkontrollen, vier Tape-Modelle/Bass/Hysterese/Width, zweiter Divider und PLL-Modus. |
| PRISM / FREQ SHIFT | Vier funktional unterschiedliche Filtertopologien, vier Steilheiten, echte Cutoff-Audio-FM; Hilbert-SSB mit gemessener Seitenbandunterdrückung. |
| FFT / Spektral | Vier FFT-Größen mit eigenständig geprüftem Overlap-Add, phasengekoppeltes Remapping, cepstrale Formanthülle, HPSS-artige Partition und globale KEY/CHORD-Felder. |
| LOSSY | Echte MDCT, Bitbudget, binäre Quantizer-Payloads und Decode/TDAC; Identitätsrekonstruktion und Bitraten geprüft. |
| CRYSTAL / TRIAD / MODAL | Bis 60 Moden, Arp/Strum/Rotation und Zusatzbewegung; skalierte Harmonizer-Stufen mit Glide; FOLLOW am tatsächlichen Pitch-Tracker. |
| CHOPPER / LOOP / SCANNER | Zwei Aufnahmebänke, individuelle Slice-Parameter und Ratchets; fünf Loop-Modi plus STAMP/SCAN/Overdub; separat gehaltene Scanner-Aufnahme. |
| Lange Speicher | WENDY 16 s, LOOP-Rückschau 20 s und GRANULAR DELAY 21 s. Speicherinhalt und Abspielmechanismen geprüft. |
| Flanger / Phaser / FISSION | Relativer Through-Zero-Durchgang, getrennte Barber-Richtungen mit drei überlappenden Bänken; Slow/Audio-FM, Retrig, Ratios und Doppelpendel. |
| SPIRAL / Spectral Delay | Stereozeiten, Kopfmodelle, Taps/Reverse; echte per-Bin-Historie, sechs Verteilungen, Gate/Low-Cut/Band-Freeze und musikalische Zeiten. |
| Hall / Dynamik | Eigenes Dattorro-Figure-Eight-Netz, 32-stufige Federdispersion, FDN/Pitch-Grains; echte Frequenzband-Aufteilung bei SQUASH/MANGLE/TRANSIENT. |
| Presets / UI | Dateiformat kompatibel, alte Zeitzuordnungen erhalten, Preset-Kategorien und Themen unverändert nutzbar; Details statt eines Redesigns. |

## Verbleibende Abgrenzung

Native Plugin-Formate, DAW-Host-Automationsspuren und Host-Latenzmeldung sind keine Schnittstellen dieser eigenständigen Browser-App. Die entsprechende Browser-Bedienung ist implementiert. Es wird keine bit- oder klangidentische Reproduktion unbekannter Originalverfahren behauptet. Die zusätzlich umgesetzten Roadmap-Punkte sind eigene Erweiterungen: Granular-Time-Engine, verlängerte Stretch-Grains, 1–64-Step-Längen und zusätzliche Ziele, FREE-LFO/RAND sowie TRANCE-GATE. Die Tatsache ihrer Umsetzung belegt keine entsprechende ausgelieferte Originalfunktion.

Die unabhängige Prüfung fand während der Umsetzung weitere Verdrahtungsfehler (unter anderem BYPASS-Replay, Stereo-Mute und SNAP in Spezialmodi). Sie wurden vor der Gesamtprüfung behoben. Die konkreten technischen Tests stehen in den Implementierungsnotizen und unter `tests/`.

## Ergänzung 2.1

Live-SIZE mit vorgewärmten FFT-Bänken und Crossfade, latenzneutrale Live-Umordnung,
diskrete Randomisierung und strukturelle Gestenaufnahme schließen die zuletzt
bestätigten Funktionslücken. Drei zusätzliche Entwicklungsbereiche sind in
`../TODO.md` sowie `dsp-assessment.md` mit ihren Grenzen dokumentiert. Die physische
Geräteprüfung bleibt offen; passende Geräte sind laut Nutzer nicht angeschlossen.
