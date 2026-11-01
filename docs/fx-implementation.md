# DA DESTRUCTOR – FX-Implementierung

Die Bibliothek enthält 62 eigenständige Stereo-Prozessoren in zehn Kategorien. Die Namen bezeichnen die Funktionsfamilien des Recherche-Briefings. Algorithmen, Kennlinien und Zustandsmodelle wurden für diese Webapp geschrieben. Sie beanspruchen keine Klanggleichheit mit einem kommerziellen Plugin.

## Verarbeitung und Routing

`EffectRack.configure(fx, mode, tonal)` übernimmt die Instanzliste und deren Parameterobjekte. Laufende Modulation verändert diese Objekte unmittelbar. Eine Instanz bleibt bei einer Änderung der Reihenfolge erhalten. SERIAL verkettet die Instanzen. PARALLEL verarbeitet jeden Zweig aus demselben Eingang, gleicht spektrale Latenzunterschiede an und mittelt die Zweige.

Ein Effekt blendet seinen Wet-Anteil beim Ein- und Ausschalten innerhalb von 10 ms ein beziehungsweise aus. Einschalten setzt den DSP-Zustand zurück; die zum Latenzausgleich benötigte Dry-Historie bleibt erhalten. Nach dem Ausschalt-Fade wird der Effektalgorithmus nicht mehr aufgerufen. Spektrale Dry-Verzögerung bleibt bestehen. Der Instanz-Gain reicht von −12 bis +12 dB. Interne Feedbackschleifen und ungültige Werte werden begrenzt; das gemeinsame Master-Limit gehört zum Audio-Worklet.

Die Effektparameter sind bewusst auf drei bis sieben wesentliche Regler pro Effekt reduziert. Das ist kein vollständiger Nachbau aller Spezialparameter des Briefings. Viele Makroregler steuern mehrere DSP-Eigenschaften und zeigen deshalb Prozent. Physikalisch direkte Parameter zeigen ihre tatsächliche Einheit über `formatEffectValue`.

## Algorithmen nach Familie

| Familie | Umsetzung |
| --- | --- |
| BITROT | Sample-and-Hold, quantisierte Bittiefe, Jitter, Dither, einpolige Rekonstruktionsglättung |
| CIRCUIT BEND | Geclockte historische Reads, wiederholte Speichersegmente, Bus-Quantisierung und Clock-Starvation |
| DISTORT / WAVEFOLDER | Zwölf Kennlinien beziehungsweise fünf Folder-Verhalten; Bandbegrenzung und Bias |
| PLASMA | Schwellenabhängiger Bogen-Hüllkurvenzustand, chaotisch moduliertes Folding |
| EXCITE / UNDERTOW | Parallele Hochtonanregung beziehungsweise gezählte Nulldurchgänge für Subharmonische |
| HOWL / MIRROR | Gestimmte Feedback-Delays beziehungsweise gefaltete Pitch-Feedback-Grains |
| TAPE | Fraktionales Wow/Flutter-Delay, sättigende Gedächtnisschleife, Alterungs-Tiefpass und Dropouts |
| EQ / PRISM / FORMANT / TRANSMIT | Biquads, sättigendes Multimode-Filter, fünf parallele Vokalbänder, bandbegrenzter Funkkanal |
| TOOTH / COMB | Dreifacher Feedback-Kamm beziehungsweise Feedforward/Feedback-Kamm |
| LIQUIFY / VESPER / PHASER | Variable Allpass-Kaskaden mit unterschiedlichen Fokus-, Phasen- und Feedbackmodellen |
| PITCH SHIFT / TRIAD | Überlappende Delay-Grains; drei separat gestimmte und versetzte Stimmen |
| FREQ SHIFT | Allpass-Quadratur-Näherung mit Stereo-Trägern und Feedback-Delay |
| SCATTER / SCANNER | Vier gestreute beziehungsweise zwei durch die Audiohistorie fahrende Delay-Grains |
| CHOPPER / STRUM / WENDY | Quantisierte historische Slices mit unterschiedlichen Reihenfolge-, Lücken- und Wiederholungsregeln |
| LOOP | Overdub-Ring mit variabler Leserate und bis zu vier Read-Taps |
| CRYSTAL / MODAL / STRINGS | Zwölf harmonische, 24 inharmonische beziehungsweise bis zu sechs gekoppelte rekursive Resonanzen |
| CHORUS / ENSEMBLE | Vier beziehungsweise vier bis sechs modulierte Delay-Taps |
| FLANGER / FISSION / FLYBY | Kurzes Feedback-Delay, Audio-FM der Delayzeit, Doppler-Delay mit Stereobewegung |
| CLANG / ORBIT / TREMOR | Ringmodulation, Equal-Power-Autopan, Stereo-Tremolo |
| SPIRAL / GRANULAR DELAY / REEL / CADENCE | Tape-Echo, Pitch-Delay-Grains, Mehrkopf-Taps, euklidisch gewichtete Echo-Taps |
| DRIP / DATTORRO / AETHER / GRANUVERB | Achtwegiges orthogonales Feedback-Hallnetzwerk mit jeweils Dispersion, Predelay/Diffusion, Oktav-Feedback oder Pitch-Grains |
| SQUASH / MANGLE | Multibandige Aufwärts-/Abwärtskompression beziehungsweise zusätzliche Sättigung und MELT-Lift |
| GATE / TRANSIENT | Stereo-Hüllkurvengate beziehungsweise schnelle/langsame Hüllkurven zur Attack-/Sustain-Formung |

## Spektrale Effekte

`spectral.mjs` enthält eine eigene iterative FFT und eine echte Stereo-STFT mit 512 Punkten, 128 Samples Hop und vierfach überlappender Wurzel-Hann-Analyse/Synthese. Ein unbearbeitetes Signal wird nach exakt 512 Samples rekonstruiert. Das entspricht bei 48 kHz etwa 10,7 ms pro spektraler Instanz. SERIAL addiert diese Verzögerungen; PARALLEL verwendet die längste Zweigverzögerung. Das Worklet erhält die Rack-Latenz zum Ausgleich des globalen Dry-Pfads.

| Effekt | Spektraler Prozess |
| --- | --- |
| LOSSY | Komplexe Spektralquantisierung, Bandbegrenzung, Frame-Verlust und spektrales Wiederholen |
| SIEVE | Primzahl-, Fibonacci-, Zweierpotenz-, gerade/ungerade oder tonale Bin-Masken |
| CHROMA | Frequenzfokus, Tilt, Gate und Bin-Remapping |
| CONTRAST | Getrennte Verstärkung starker, mittlerer und schwacher Partials mit Nachbar-Glättung |
| SEPARATE | Näherung aus spektraler Peakigkeit und positivem Flux für Ton/Rauschen/Transienten |
| SMEAR | Nachbar-Bin-Unschärfe, zeitliches Feedback, Phasenstreuung und Hold |
| FORMANT SHIFT | Verschiebung einer geglätteten Spektralhülle unter Beibehaltung der Analysephasen |
| MAGNET | Bin-Energie wird zu temperierten beziehungsweise diatonischen Zielfrequenzen verschoben |
| STILLS | Periodisch eingefrorene Amplituden mit fortlaufenden Oszillatorphasen |
| WARP | Power-, lineares, Spiegel- oder Fold-Remapping der Frequenzachse |
| SPECTRAL DELAY | Eigene komplexe Frame-Delaylinie pro Bin mit frequenzabhängiger Länge und Feedback |

## Bewusste Grenzen dieser Fassung

- LOSSY ist eine spektrale Codec-Näherung und kein MDCT-Encoder oder echter Audio-Codec.
- SEPARATE ist eine spektrale Heuristik und keine trainierte Quellentrennung. FORMANT SHIFT verschiebt eine geschätzte Hülle; perfekte Formant- oder Transientenerhaltung wird nicht zugesichert.
- Die FFT-Größe ist fest auf 512 eingestellt. Es gibt keine umschaltbaren 1K–4K-Modi. Frequenz-Remapping verwendet keine vollständige phasenkohärente Phase-Vocoder-Synthese und darf hörbar körnig klingen.
- FREQ SHIFT verwendet eine kompakte Allpass-Näherung; die Unterdrückung des unerwünschten Seitenbandes erreicht keinen spezialisierten Hilbert-Transformer.
- Die Hallnamen bezeichnen Klangfamilien. DATTORRO ist hier ein eigenes FDN-Plattenmodell, keine exakte Rekonstruktion des veröffentlichten Dattorro-Blocks. DRIP ist ein dispersiver Hall und keine mechanische Federsimulation.
- Die nichtlinearen Effekte werden in dieser Fassung nicht oversampelt. Hohe Drive-, Folder- und FM-Werte erzeugen absichtlich auch digitale Aliasing-Artefakte.
- FX-Delayhistorien sind auf ungefähr vier Sekunden ausgelegt; kein 16-/21-Sekunden-Speicher wie in einzelnen Originalfunktionen. SCANNER fährt durch eine Live-Historie; ein separat gelatchter vollständiger Capture-Speicher ist nicht implementiert.
- COMB, CADENCE und weitere im Briefing nur knapp beschriebene Funktionen haben klar definierte eigene Modelle, da keine belastbaren Originaldetails vorliegen.
- SNAP quantisiert unterstützte Pitch-Intervalle oder Frequenzen auf das globale Tonartmodell. Die diskrete FFT-Auflösung begrenzt die Genauigkeit spektraler Tonhöhen. Es gibt weder Audio-Pitch-Tracking noch eine externe spektrale Sidechain.

## Verifikation

`node --test tests/fx-core.test.mjs` prüft 62 eindeutige Katalogeinträge und gültige Defaults, FFT-Roundtrip, finites und begrenztes Stereo-Rendering aller Prozessoren, exakten Off-Bypass einschließlich spektraler Verzögerung, STFT-Rekonstruktion, parallelen Latenzausgleich sowie Extremwerte, Reset, Wiedereinschalten und Zustandsbewahrung beim Umsortieren. Diese numerischen Checks ersetzen keine subjektive Hörbewertung und sind kein Nachweis dafür, dass alle 62 Effekte gleichzeitig auf jedem Rechner in Echtzeit laufen.
