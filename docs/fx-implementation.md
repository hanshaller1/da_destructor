# DA DESTRUCTOR – vollständige FX-Funktionsumsetzung

Die 62 Effektfamilien des Recherche-Briefings sind als eigenständige Stereo-Prozessoren implementiert. Die Regler aus dem dokumentierten Funktionsumfang stehen in `effects.mjs`; zusätzliche Regler erscheinen in der vorhandenen Oberfläche unter ADVANCED. Eigene digitale Modelle ersetzen keine unbekannten Herstelleralgorithmen und versprechen keine Klangidentität.

## Gemeinsamer Signalpfad

`EffectRack.configure(fx, mode, tonal, context)` aktualisiert die Instanzen ohne unnötigen Verlust von Delay- und Hallzuständen. SERIAL verkettet die Prozessoren. PARALLEL speist alle Zweige aus demselben Eingang und mittelt deren Ausgänge. Bei aktivem Latenzausgleich werden Dry-Anteile, parallele Zweige und getrennte L/R-Instanzen zeitlich angeglichen. `latencyComp:false` schaltet diese zusätzlichen Ausgleichsverzögerungen ab; die physikalische DSP-Latenz bleibt ausgewiesen.

ON/OFF und MUTE verwenden einen 10-ms-Wet-Fade. Nach dem OFF-Fade werden Effektkern und Sidechain-Analyse übersprungen. MUTE erhält den Zustand und die Latenz. Beim Einschalten wird der Effektzustand zurückgesetzt, ohne die für den laufenden Dry-Pfad benötigte Historie zu löschen. Jeder Effekt hat einen Gain-Ausgleich von −12 bis +12 dB. L/R LOCK verwendet einen gemeinsamen Stereokern; UNLOCK verarbeitet beide Eingangskanäle mit eigenständigen Parametern und Zuständen. `paramsR` wird beim Import alter Presets aus den tatsächlich gespeicherten linken Werten erzeugt.

SYNC/FREE wählt bei musikalischen Zeit- und Ratenreglern zwischen Beat-Raster und freier Zeit. Die Worklet-Beatphase bleibt über Tempoänderungen erhalten. `getMeters()` liefert gemessene Ausgangsspitzen und 32 echte Wellenformpunkte pro Effekt. Diese Anzeigen verändern keine gespeicherten Basisparameter.

## Distortion

- **BITROT:** Zehn unterschiedliche Quantisierungswege: Classic, Tread, Mu-law, Float, differenzielles PCM, Glide, Error Feedback, kompandierender Codec, stochastische Quantisierung und logarithmische Quantisierung. Das Briefing nennt neun Modelle; LOG ist eine eigene Ergänzung. BITS, freie oder geclockte Sample-and-Hold-Rate, DRIVE, DITHER, JITTER, Capture-Drops ROT, DAC-SMOOTH, rechter Clock-Detune WIDTH, zufällige Bittiefe RANGE und inputabhängige TRACK-Clock sind verarbeitet.
- **CIRCUIT BEND:** Geclockte historische Reads und Stalls, Speicherfehler, 16-/8-/4-Bit-Bus, SHIFT und Clock-Starvation. HQ verarbeitet die nichtlineare Quantisierung im zweifachen FIR-Samplingpfad.
- **DISTORT:** Zwölf eigene Kennlinien, Bias und auf ein Frequenzband begrenzte Anregung; optionales 2×-Oversampling.
- **PLASMA:** Schwellen- und Hold-Zustand eines hysteretisch angeregten Folders mit Frequenz- und Chaos-Modulation; optionales HQ.
- **WAVEFOLDER:** FOLD, 259, SERGE, LOCK und WRAP mit Drive, Folds, Bias und kontinuierlicher Shape-Mischung; optionales HQ.
- **EXCITE:** Parallele Hochtonanregung, Attack-/Release-abhängige Verstärkung und zusätzlicher Bassanteil; optionales HQ.
- **HOWL:** Zwei gestimmte, gedämpfte und weich begrenzte Feedbackschleifen mit bis zur Selbstoszillation reichendem Regen, Drift und Kreuzkopplung. SNAP stimmt die Grundfrequenz.
- **MIRROR:** Folder mit überlappenden, bis ±24 Halbtöne gestimmten Feedback-Grains; optionales HQ.
- **TAPE:** Vier unterschiedliche Sättigungsmodelle, Bassbearbeitung, Magnetisierungs-Gedächtnis HYST, Stereo-WIDTH, Wow/Flutter, Noise, altersabhängige Mehrfachkopie, Höhenverlust und Dropouts. HQ sampelt auch die nichtlineare Gedächtnisschleife zweifach.
- **UNDERTOW:** Zwei unabhängig wählbare Subteiler ÷2…÷8, Misfire, Blend und geglätteter Subpegel. CYCLE zählt Nulldurchgänge. PLL verwendet Grundtonschätzung und eine durch Nulldurchgangs-Phasenfehler nachgeregelte Oszillatorphase. SNAP stimmt die subharmonischen Oszillatoren auf die globale Tonart.

### LOSSY: eigener MDCT-Codec

`codec-mdct.mjs` führt eine echte kritisch abgetastete MDCT aus. Sinusfenster und überlappende inverse Transformation erfüllen TDAC; der unquantisierte Roundtrip rekonstruiert das Eingangssignal bei allen vier Frame-Größen. Die MDCT ist als Halb-Bin-Kosinus-Transformation in eine FFT eingebettet.

Der Encoder berechnet pro Frame aus 6–256 kbps ein Bitbudget. Er schreibt einen tatsächlichen Bitstream mit Band-Skalierung und Bitverteilung oder bei sehr niedrigen Budgets mit sparsamen Koeffizientenpositionen. Der Decoder liest dieses Bitmuster und rekonstruiert daraus die Koeffizienten. Paketverluste, geclockte Packet-Division, Wiederholen, Quantisierungs-Pre-Echo, Frame-Jitter und Tonbegrenzung greifen in diesen Codec-Pfad ein. Es handelt sich um einen eigenen Codec, nicht um MP3/AAC-Kompatibilität. Die Gesamtlatenz bleibt unabhängig von 256-/512-/1024-/2048-Sample-Frames fest bei 2048 Samples.

## Filter und spektrale Prozessoren

- **EQ:** High-Pass, Low-Shelf, Bell, High-Shelf und Low-Pass; Frequenz, Q, Gain und Drive.
- **PRISM:** Vier getrennte Filtermodelle: TPT-SVF, saturierende Moog-artige Rückkopplungskaskade, asymmetrische 303-artige Diodenkaskade und eine asymmetrisch arbeitende Transistorkaskade. LP/BP/HP/Notch, tatsächlich unterschiedliche 6-/12-/18-/24-dB-Pfade, Resonanz, Drive, Drift und Cutoff-Modulation aus dem Audioeingang.
- **TOOTH:** Drei gegeneinander verstimmte Feedback-Kämme, YIN-Pitch-Following, gedämpfte Rückkopplung und transiente Noise-Plucks.
- **COMB:** Eigenes Feedforward-/Feedback-Kammmodell; weitere Originaldetails waren im Briefing nicht dokumentiert.
- **FORMANT:** Fünf parallele Vokalresonanzen, interpolierte Vokale, Q, Shift, Spread, fünf Stimmlagen, Sequenz und Glide.
- **LIQUIFY:** Null bis 32 Allpass-Stufen mit Fokus, Resonanz, Spreizung, Drive und Feedback.
- **TRANSMIT:** Frequenz- und Breitenfilter, Verstimmung, Drive, Kompression, Dauerrauschen, zeitliche Burst-Pakete, Squelch und Dropouts.
- **VESPER:** Drei phasenversetzte Notch-/Allpassnetze, Stufenanzahl, parallele/serielle Kaskadenmischung, Frequenz-/Spread-/Zeitmodulation, Polarität, Feedback und Attack-/Release-Envelope-Steuerung.
- **SIEVE, CHROMA, CONTRAST, SEPARATE, SMEAR, FORMANT SHIFT, MAGNET, STILLS, WARP, SPECTRAL DELAY:** Die gemeinsame Stereo-STFT bietet 512/1024/2048/4096 Punkte und zugehörigen Latenzausgleich. Die Detailprozesse einschließlich tonaler Felder, Sidechain-Peaks, zeitlichem Spektral-Hold, Amplitudenklassen und frequenzselektivem Freeze stehen in `spectral.mjs` und `docs/audio-architecture.md`.

## Pitch, Resonator, Capture und Memory

- **PITCH SHIFT:** Überlappende Pitch-Grains, Fine-Tune, zusätzliche Oktavlage, Stereo-Spread, freies/geclocktes Delay, Feedback-Tone und Spray. Die FREQUENCY-Variante verwendet den echten Hilbert-SSB-Kern, RING einen Träger ohne Seitenbandunterdrückung.
- **FREQ SHIFT:** 127-Tap-Hilbert-FIR mit passendem Realpfad-Delay und Quadraturträgern; unabhängige L/R-Verschiebungen ±500 Hz, Delay, Feedback, SNAP und Pitch-TRACK.
- **TRIAD:** Drei Stimmen fahren Skalenstufen über insgesamt ±2 Oktaven. Glide interpoliert die Leserate. Stagger, Feedback, Loose und Micro beeinflussen getrennte Stimmen.
- **CRYSTAL:** Bis 60 tatsächlich berechnete Resonatormoden; Skala/Grundton, Oktavbereich, Fokus, Bloom, inharmonischer Skew, Wander/Flutter, Slip, Color, fünf Arpeggio-Modi, Arp-Rate, globaler Akkord, Pitch, zeitlicher Strum, transiente Excite-Bursts, Rotation und Stereo-Spread.
- **MODAL:** 24 gedämpfte Moden mit Material, Anschlagsposition, Brightness, Inharmonizität, BOW und tatsächlichem Pitch-FOLLOW.
- **STRINGS:** Bis sechs gekoppelte Resonanzen auf dem globalen Akkord, Oktavlage, Dämpfung, Brightness, BOW und Anregungsposition.
- **SCATTER:** Vier unabhängig gestartete Grains mit gelatchtem Startpunkt, Pitch, Richtung und Stereo-Verteilung. Capture-Freeze, geclockte Größe/Dichte, Scramble und Skalen-/Akkordintervalle sind verarbeitet.
- **CHOPPER:** Zwei echte Aufnahmebänke: Während die aktuelle Bank beschrieben wird, wird die vorherige vollständige Bank gespielt. Je 2–32 Slices besitzen eigene SHUFFLE-, REPEAT-, PITCH-, REVERSE-, GATE- und RATCHET-Werte. Zusätzlich vorhandene globale Regler kombinieren sich mit diesen Werten. Die Slice-Daten liegen in `ref.slices[0..31]`; die Oberfläche bearbeitet jeweils die gewählte Slice.
- **LOOP:** 20 Sekunden Aufnahmehistorie, variabler Loop und bis vier Köpfe, Speed −2×…+2×, Overdub, DROP/SHUF/TRIM/STRCH/ALL, Modify, STAMP und SCAN von 0,25 bis 20 Sekunden. STAMP kopiert den ausgewählten vergangenen Abschnitt in einen getrennten Loopspeicher.
- **SCANNER:** Zwei Grains lesen einen tatsächlich gehaltenen Capture-Speicher. Live-Historie und gehaltene Bank sind getrennt. Transienten oder eine manuelle Capture-Flanke erneuern die Bank. Scan, Size 10 ms…1 s, Shape, Pitch, Spray und bipolares Ducking wirken auf den gehaltenen Klang.
- **STRUM:** Transienten schließen historische Fragmente ab. 2–16 Slots, freie/geclockte Rate, Vorwärts/Rückwärts/Shuffle/Amplituden-Rank/Euklidisch, Pitch, Decay, Sense und Width werden verarbeitet.
- **WENDY:** 16 Sekunden Stereo-Historie, gewähltes Span-Fenster, 1–32 Cuts, Slip, Seek, Wear-Drops, Edge und Width. Ein zusätzlicher Pitch-Regler ermöglicht das im Briefing erwähnte tonale SNAP für historische Fragmente.

## Modulation, Delay und Hall

- **CHORUS:** Vier Delay-Stimmen, Classic/Dim-D/Juno-Charakter, Rate, Depth, Time, Feedback und Width.
- **ENSEMBLE:** Vier oder sechs BBD-Stimmen. Pro Stimme takten echte Bucket-Sample-Ringe mit moduliertem Clock, Sättigung und Rekonstruktionsfilter. Juno/Solina/Dimension/Lush ändern Grundzeit, Stimmenverteilung und Bandbegrenzung.
- **FLANGER:** Separater verzögerter Dry-Bezug und variabler Wet-Pfad erlauben tatsächliches Durchqueren von relativer Delayzeit null. Die feste Latenz beträgt 10 ms. BARBER RISE/FALL verwendet drei zeitversetzte, weich gewichtete Sweep-Bänke, deren Resets verdeckt bleiben.
- **PHASER:** 2–12 Allpass-Stufen. Barber-Sweeps verwenden ebenfalls drei überlappende Bänke und getrennte Richtungen.
- **FISSION:** Die variable Delay-FM läuft in HQ tatsächlich mit doppelter Sample-Rate, nicht bloß durch einen nachgeschalteten Filter. Audio-/Slow-Bereich, Bite, Depth, Stereo-Phase, Feedback, Skew, Beat-Retrigger, Pitch-Following-Verhältnisse und ein gekoppeltes Doppelpendel sind verarbeitet.
- **FLYBY:** Orbit, Pass, Figure-8, Bounce, geglättete Zufallsbewegung und Rotor verändern Weglänge, Laufzeit, Doppler, Pegel und Stereoposition. Distance liegt bei 2–40 m; Air und Rotor verändern Filterung und Rotation.
- **CLANG:** Ringmodulation mit Trägerform, Drive, Stereo-Phase und Grundton-TRACK. **ORBIT** und **TREMOR** verarbeiten freie/geclockte Bewegung, Form, Tiefe und Stereo-Parameter.
- **SPIRAL:** Unabhängige linke/rechte Zeiten, Ping-Pong, Wow, Hiss, Ducking, bis vier Taps, Reverse, Age, Halo sowie unterschiedliche TAPS/SPACE-ECHO/VOLANTE/MIMEOPHON-Kopfverteilungen und Spacing.
- **GRANULAR DELAY:** Tatsächliche 21-Sekunden-Historie mit zwei Pitch-Grains, freien/geclockten Delays und Grain-Raten, Swing, Spray, Pitch −36…+12 st, Random, Skalen-/Akkordintervallen, Tone, Feedback, Reverse, Retune und Akkordwahl.
- **REEL:** Bis vier rückgekoppelte Köpfe, EVEN/TRIP/GOLD/SILV, geclockte 1/32…2/1-Zeiten, Halo, Skew und Age. **CADENCE** hat ein eigenes euklidisches Echo-Tap-Modell, da Originaldetails fehlen.
- **DRIP:** 32 tatsächliche Allpass-Dispersionsstufen, Size, Decay, Damp, Ripple, inputgetriggerter Crash, Tension und Pickup.
- **DATTORRO:** Eigenständig implementiertes Plattennetz nach der publizierten Figure-Eight-Topologie mit vier Eingangsdiffusoren und zwei kreuzgekoppelten Tankzweigen, jeweils moduliertem Allpass, Delay, Dämpfung und weiterem Allpass/Delay. Size, Decay, Diffusion, Predelay, Tone, Modulation und Freeze sind aktiv. Grundlage: [Jon Dattorro, Effect Design Part 1, JAES 45(9), 1997, Figure 1](https://nagasm.org/ASL/Sketch14/fig5/EffectDesignPart1.pdf).
- **AETHER:** Hallnetz mit gepitchtem Oktav-Feedback. **GRANUVERB:** Achtwegiges FDN mit vier gestreuten Pitch-Grains, Größen-/Grain-/Scatter-/Decay-Reglern, diskreten Pitch-Modi und Freeze über 99 %. MIX fährt von Dry über Hall zu Grains.

## Dynamik

**SQUASH** verwendet echte 1-/2-/3-Band-Aufteilung mit bandweisen Hüllkurven, Aufwärts-/Abwärtsbearbeitung und Band-Solo. **GATE** hat Stereo-Detektion, Threshold, Attack, Hold, Release und Floor. **MANGLE CLASSIC** verarbeitet zwei Bänder mit Kompression/Sättigung; **MELT** verwendet drei Bänder mit Upward-Lift, Pump und Grit. **TRANSIENT** trennt schnelle/langsame Hüllkurven mit Pegelnormierung. Der Split von 40 Hz bis 10 kHz trennt Low/High; BAND und SOLO wählen die tatsächlich betroffene beziehungsweise allein ausgegebene Komponente.

## Latenz und praktische Grenzen

Die eigenen FIR-Oversampler verwenden 31 Taps pro Stufe und melden 15 Samples Latenz. Hilbert-Pfade melden 63 Samples, der Flanger 10 ms, LOSSY 2048 Samples und STFT-Prozessoren ihre gewählte FFT-Größe. Diese Werte unterscheiden sich bewusst von nicht zugänglichen Originalimplementierungen. FFT-Größen wechseln bei laufendem Transport über aufgewärmte Kerne und Crossfade bei festem 4096-Sample-Ausgleich je STFT-Effekt. Latenzneutrale Umordnungen wirken sofort; tatsächlich latenzändernde Strukturkonfigurationen werden bis zum Stop zurückgestellt.

Pitch-Tracking ist eine monophone YIN-Schätzung mit zusätzlicher PLL-Phasenregelung beim Subteiler. Chords oder stark geräuschhafte Quellen können mehrdeutige Schätzungen liefern. Endliche Hilbert-/Oversampling-Filter haben begrenzte Bandtrennung; besonders tiefe Frequenzen liegen außerhalb der idealen Seitenbandunterdrückung. Die eigenen nichtlinearen Filter sind digitale Funktionsmodelle, keine zugesicherte Bauteilsimulation.

Der Browsereinsatz enthält weder VST/AU-Hosting noch DAW-Automationsspuren. Control-Automation und Sidechain laufen stattdessen in der Web-Audio-Anwendung. Keine bekannte Funktion wird durch eine bloße, unverdrahtete Bedienbeschriftung ersetzt. Hersteller-Code, Originalpresets und Original-Samples wurden nicht übernommen.

## Verifikation

`tests/fx-core.test.mjs`, `tests/fx-mechanisms.test.mjs`, `tests/fx-modulation.test.mjs` und `tests/codec-mdct.test.mjs` prüfen unter anderem alle 62 Prozessoren, Extremwerte, Reset, Bypass, LR/Mute, Meter, Fourier-/MDCT-Rekonstruktion, echte Codec-Bitbudgets, Pitch-Following bei mehreren Sample-Rates, Seitenbandunterdrückung, messbare Aliasing-Reduktion, vier Filtertopologien und Rolloffs, Audio-FM, Doppelbank-Capture, gehaltene Aufnahme, lange Memory-Fenster, 60 Moden und Bandisolation. Diese technischen Prüfungen sind keine Behauptung, dass alle 62 Effekte bei 192 kHz gleichzeitig auf jedem Rechner in Echtzeit laufen.
