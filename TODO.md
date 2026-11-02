# DA DESTRUCTOR – offene Punkte nach Version 2.0

Stand: 2. November 2026 – DA DESTRUCTOR 2.1. Grundlage: Abgleich des aktuellen Quellstands mit
[Recherche-Briefing](docs/research-brief.md). Alle 62 Effektfamilien sind vorhanden;
die folgenden Punkte unterscheiden verbleibende Funktionslücken, begrenzte
Verfahren, Browser-Abgrenzungen und lediglich geplante Originalfunktionen.

Die bestehende Geräteoberfläche mit variablem Theming ist bei weiteren Arbeiten
beizubehalten. Die umgesetzten Punkte sind markiert. Geräteabhängige Prüfungen bleiben ausdrücklich offen.

## Priorität 1 – konkrete Funktionslücken

- [x] **FFT-Größe während der Wiedergabe wechseln.** Insbesondere FORMANT SHIFT
  verlangt laut Briefing live umschaltbare 512/1024/2048/4096 Punkte und eine
  modulierbare SIZE. Früher hielt die Runtime die aktive Größe bis zum Stop fest; der Live-Pfad ist jetzt umgesetzt.
  DSP-Umschaltung und Behandlung der Ausgleichslatenz getrennt lösen, mit einem
  hörbar sauberen Übergang zwischen den Verarbeitungsgrößen.
  - Abnahme: SIZE-Änderungen per Regler, Modulation und Gesten-Replay wirken bei
    laufendem Transport; es bleiben keine veralteten Pending-Werte zurück.
  - Einstieg: `audio-worklet.mjs`, `spectral.mjs`, `fx-core.mjs`.

- [x] **FX-Umordnung bei unveränderter Gesamtlatenz sofort anwenden.** Die frühere
  strukturelle Vergleichslogik stellte auch reine Umordnungen zurück,
  sobald ein beteiligter Effekt Latenz besitzt. Beispielsweise blieb der Tausch
  von FLANGER und EQ bis zum Stop ausstehend; dies wirkt jetzt live.
  - Abnahme: Umordnung wirkt während der Wiedergabe; vorhandene Effektzustände und
    Zuweisungen bleiben erhalten. Tatsächlich latenzändernde Fälle werden separat
    behandelt, einschließlich Parallelbetrieb und unabhängiger L/R-Pfade.
  - Einstieg: `audio-worklet.mjs`, `fx-core.mjs`.

## Weitere funktionale Erweiterungen

- [x] **Random Setup auf nichtnumerische Parameter erweitern.** Boolesche Schalter
  und textbasierte Time-Auswahlen, etwa REVERSE, FREEZE, SYNC und PATTERN,
  berücksichtigen. Numerische Modellwahlen und Slice-Werte sind bereits enthalten.
  - Für diskrete Werte die Bedeutung bipolarer Stärke festlegen; Wahrscheinlichkeit
    und Stärke 0 als Sperre beibehalten. Bestehende Random-Setups kompatibel laden.
  - Einstieg: `app.mjs` (`randomRows`, `randomizeRows`), `state.mjs`.

- [x] **Umfang der Gestenaufnahme prüfen und gegebenenfalls erweitern.** Aktuell
  werden Parameterwerte einschließlich vieler Schalter/Auswahlen, Sequencer-Zellen
  und Graph-Koordinaten aufgenommen. FX hinzufügen/entfernen/umordnen, Graph-Punkte
  hinzufügen/löschen sowie Änderungen der Pattern-Anzahl werden nicht aufgenommen.
  - Solche Strukturereignisse benötigen ein eigenes, sicher validiertes Schema
    samt konsistenter Wiedergabe und Preset-Migration.
  - Das Briefing belegt keine vollständige Aufnahme dieser Strukturänderungen im
    Original. Dies ist eine mögliche App-Erweiterung, keine bestätigte
    Gleichheitsanforderung.
  - Einstieg: `automation.mjs`, `state.mjs`, `app.mjs`, `audio-worklet.mjs`.

## DSP-Qualität und verbleibende Vereinfachungen

- [x] **Pitch-Tracking mit schwierigen Quellen bewerten.** Die vorhandene
  YIN-Erkennung ist monophon. Akkorde, Schlagzeug und verrauschtes Material können
  mehrdeutige Ergebnisse liefern; Vertrauensbewertung und robustes Verhalten bei
  unsicherer Erkennung prüfen.
- [x] **SEPARATE mit unterschiedlichen Quellen bewerten.** TONAL/NOISE/HITS sind
  spektrale Schätzungen, keine zuverlässige Trennung beliebiger Instrumente.
  Übersprechen und Transientenartefakte gezielt untersuchen.
- [x] **Eigene Analog-/Gerätemodelle klanglich bewerten.** Tape, Filter, Wavefolder,
  BBD und Federhall sind digitale Funktionsmodelle. Bauteilgenauigkeit und
  Klangidentität zum Original sind nicht nachgewiesen. Ebenso sind Scratch-Kurven
  und undokumentierte Spezialmodelle eigene Auslegungen, keine verifizierten
  Originalabstimmungen.
- [x] **Zusätzliche Nicht-FFT-Latenzen weiter reduzieren, soweit sinnvoll.**
  FIR-Oversampling, Hilbert-Shifter und Through-Zero-Flanger besitzen zusätzliche
  Verzögerung. Interner Ausgleich ist vorhanden; die Briefing-Aussage von null
  Samples außerhalb FFT wird dennoch nicht durchgehend erreicht. Qualität und
  kausale Grenzen der Verfahren bei Änderungen berücksichtigen.

## Browser-Abgrenzungen und noch ausstehende Geräteprüfung

Diese Punkte sind keine fehlenden Bedienelemente der aktuellen Webapp:

- Native VST3/AU/AUv3-Einbindung, DAW-Automationsspuren und Latenzmeldung an einen
  Plugin-Host benötigen eine zusätzliche native Integration.
- Web-MIDI liefert keine zugesicherte samplegenaue DAW-PPQ-Anbindung. Gerätezugriff,
  verfügbare Sampleraten und reale Ein-/Ausgangslatenz hängen von Browser, OS und
  Hardware ab.
- [ ] Physische MIDI-Clock/Transport- und Audio-/Sidechain-Geräte prüfen.
  **Extern blockiert:** Der Nutzer hat am 2. November bestätigt, dass keine
  geeigneten Geräte angeschlossen sind. Nicht als geprüft oder erledigt gewertet.
- [x] Realtime-Leistung repräsentativer anspruchsvoller Patches messen; die
  bisherigen Mechanismusprüfungen garantieren nicht alle 62 Effekte gleichzeitig
  bei maximaler Qualität oder 192 kHz.

## Optional – im Briefing nur geplant oder unbestätigt

Keine bestätigten Lücken gegenüber dem beschriebenen ausgelieferten Original:

- [x] Beliebige Sequencer-Längen über verkettete 1–4 × 16 Steps hinaus.
- [x] Weitere Sequencer-Ziele.
- [x] Freie/ms-Raten für LFO und Random.
- [x] Zusätzliche granulare Time-Engine und längere Stretch-Grains.
- [x] Trance-Gate mit ADSR.

## Prüfhinweis

Die bisherigen DSP-/Browserprüfungen belegen die jeweils geprüften Mechanismen,
keine vollständige Originalgleichheit. Die Live-SIZE-Rückstellung und die
Rückstellung von FLANGER/EQ-Umordnung wurden beim Abgleich direkt an der Runtime
bestätigt. Weitere Arbeiten mit gezielten Signal- und Bedienprüfungen abnehmen;
Original-DSP, Presets und unbekannte Detailverfahren sind nicht als Referenzcode
verfügbar.

## Umsetzung vom 2. November 2026

- Live-FFT: aktive und neue Größe laufen während Warmup und 20-ms-Überblendung
  parallel; rasche Anfragen werden zusammengeführt. Beim Spielen reserviert jeder
  STFT-Effekt 4096 Ausgleichssamples. Nach Stop und Ausblenden wird die aktuelle
  ausgewählte Latenz freigegeben. Neue FFT-Bänke beginnen mit eigener Historie.
- Latenzneutrales Umsortieren erhält die vorhandenen Effektinstanzen und Zuweisungen.
- Diskrete Randomisierung: Betrag der Stärke bestimmt die Wechselchance; positive
  Stärke geht vorwärts, negative rückwärts durch bekannte Auswahlwerte.
- Strukturaufnahme stellt ursprüngliche FX-/Graph-/Sequencer-Strukturen beim Loop
  wieder her und prüft importierte Ereignisse gegen ihre zeitliche Struktur.
- Sequencer: unabhängige 1–64 Steps und zusätzliche numerische Ziele mit MIN/MAX;
  Länge 0 erhält beim Import die früheren 1–4 Pattern-Ketten.
- FREE-LFO/RAND: 0,01–100 Hz. Granular: eigene vierte Time-Stufe, 8 s Historie,
  bis 16 überlappende Grains. Stretch: bis achtfache Grain-Länge.
- GATE: zusätzlicher TRANCE-Modus mit tatsächlicher ADSR-Hüllkurve und FREE/SYNC.
- Pitch-Konfidenz verwirft nachgewiesene Phantom-Grundtöne und gibt unsichere
  Schätzungen frei; UNDERTOW PLL blendet dann zum Dry-Pfad zurück.
- SEPARATE: adaptive Transientenschwelle reduziert falsche HITS bei stationärem
  Rauschen. Dies bleibt eine spektrale Schätzung.
- Nachgewiesener DC in asymmetrischen Tape-/PRISM-Modellen wird am Ausgang
  reduziert. Modellbewertung und Offline-Leistungsmessung sind reproduzierbar mit
  `node scripts/assess-dsp.mjs`; keine Zusage von Klang- oder Bauteilgleichheit.
- Flanger-Referenzlatenz: 10 statt 20 ms; FIR-Oversampling 15 und Hilbert 63 Samples
  bleiben zugunsten der Filterqualität erhalten. Null-Latenz für diese Verfahren
  wird nicht behauptet.
- Leistungsprüfung: fünf Produktionspfad-Patches bei 48/96 kHz, 128-Sample-Blöcke,
  Warmup, Median/P95/P99 und Budgetüberschreitungen. Besonders 96-kHz-Spektral- und
  Resonator-Patches können das Blockbudget überschreiten. Kein Hardware- oder
  Browser-Dropoutnachweis; Details im Prüfbericht.
