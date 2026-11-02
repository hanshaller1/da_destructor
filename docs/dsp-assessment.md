# DSP- und Leistungsbewertung 2.1

Stand: 2. November 2026. Reproduzierbar mit `node scripts/assess-dsp.mjs`.
Maschine: AMD Ryzen 7 5700X 8-Core Processor             ; Node v24.20.0. Die Ausführung misst den
Produktionskern `DestructorRuntime` nach Warmup in 128-Sample-Blöcken. Deadline:
2,667 ms bei 48 kHz, 1,333 ms bei 96 kHz. Die Messung erfolgt offline unter Node,
nicht als Nachweis von AudioWorklet-/Treiber-Dropouts. Einzelne Maxima enthalten
auch Betriebssystem-/JIT-Schwankungen. Rohdaten: `dsp-assessment-v2.1.json`.

| Patch | Rate | Median ms | P95 ms | P99 ms | Blöcke über Budget |
| --- | --- | --- | --- | --- | --- |
| tape-performance | 48 kHz | 0.554 | 0.664 | 0.860 | 0/656 |
| rhythm-performance | 48 kHz | 0.312 | 0.424 | 0.579 | 0/656 |
| granular-memory | 48 kHz | 0.443 | 0.581 | 0.713 | 0/656 |
| spectral-performance | 48 kHz | 0.184 | 2.516 | 4.020 | 22/656 |
| resonator-spring | 48 kHz | 1.217 | 2.105 | 2.560 | 1/656 |
| tape-performance | 96 kHz | 0.586 | 0.990 | 1.186 | 7/1312 |
| rhythm-performance | 96 kHz | 0.320 | 0.619 | 0.742 | 1/1312 |
| granular-memory | 96 kHz | 0.439 | 0.696 | 0.867 | 1/1312 |
| spectral-performance | 96 kHz | 0.175 | 2.473 | 3.058 | 328/1312 |
| resonator-spring | 96 kHz | 1.234 | 1.867 | 2.310 | 247/1312 |

Spektral- und Resonator-/Feder-Patches können das Blockbudget überschreiten,
besonders bei 96 kHz. Die Medianzeit allein wäre hier irreführend. Keine Zusage
für alle 62 Effekte gleichzeitig, maximale Qualität oder beliebige Hardware.

## Qualität und Mechanismen

- Pitch: verrauschter Monoton um 220 Hz wird mit rund 219,6 Hz erkannt. Rauschen,
  untonale Percussion und ein mehrdeutiger Akkord geben die Schätzung frei;
  kein festgehaltener Phantom-Grundton. Das bleibt monophones Tracking.
- SEPARATE: adaptive Spektralfluss-Schwelle reduziert HITS-Fehlzuordnung bei
  stationärem Rauschen und erhält getestete transiente/tonale Komponenten.
  Komponenten bei neutralem Gain summieren sich weiter zum Original. Dies ist
  keine instrumentenweise Quellentrennung.
- Tape/PRISM: die Bewertung zeigte störenden Gleichanteil asymmetrischer Modelle.
  Eine sanfte 5-Hz-Ausgangskopplung reduzierte den gemessenen Mittelwert bei
  Tape HARSH von 0,0221 auf 0,0018, bei PRISM DIODE von 0,1062 auf 0,0030 und
  TRANSISTOR von 0,0609 auf 0,0018. Ein eigener 30-Hz-Test schützt den Basspfad.
- Nicht-FFT-Latenz: Flanger von 20 auf 10 ms reduziert; alle unterstützten positiven
  und negativen relativen Sweeps bleiben kausal. FIR-Oversampling 15 Samples und
  Hilbert 63 Samples bleiben erhalten, um die gemessene Filterqualität zu bewahren.
- Fünf synthetische Stereo-WAVs vergleichen Dry und Tape-/PRISM-/Wavefolder-/BBD-/
  Feder-Modelle mit gemeinsamem Familienpegel. Sie liegen unter
  `outputs/dsp-assessment-v2.1-final/`. Sie dienen der weiteren Hörbewertung;
  eine subjektive Gleichheit mit Originalgeräten wurde nicht geprüft.

## Physische Geräte

Der Nutzer bestätigte am 2. November, dass keine passenden Geräte angeschlossen
sind. Physische MIDI-Clock, Live-Audio und Live-Sidechain bleiben ungetestet.
Datei-Sidechain und simulierte MIDI-Nachrichten werden im Browser geprüft.
