# DA DESTRUCTOR 2.1 – Integrationsvertrag

Die aktuelle Funktion und Grenzen sind in `docs/feature-coverage.md` und den drei Implementierungsnotizen dokumentiert. `docs/research-brief.md` ist die unveränderte Spezifikation. `docs/completion-contract.md` hält die Zuständigkeiten und Entwicklungsvereinbarungen fest.

## Zustand und Kompatibilität

`state.mjs` erzeugt und validiert den Zustand. Das JSON-Format bleibt Version 1. Numerische Audioparameter sind 0…1; `tonal.root` ist ausdrücklich eine ganzzahlige Pitch-Class 0…11. Optionen kommen aus den bekannten Deskriptoren und `getParameterOptions`. Alte Time-/Graph-Mappings und MAIN-Gain bleiben über die Migration erhalten. Vorhandene Schlüssel und stabile FX-IDs nicht umbenennen.

FX: `{id,type,on,muted,mix,gain,snap,lrLock,sync,params,paramsR}`. CHOPPER besitzt zusätzlich 32 `slices` mit normalisierten Werten. `effects.mjs` liefert vollständige Deskriptoren, `advanced` für Detailbereiche und `canSync` für tatsächlich umschaltbare Prozessoren. Jeder Effekttyp kommt höchstens einmal vor.

Graph-Punkte: `[x,y,bend,c1x,c1y,c2x,c2y]`; die letzten fünf Werte sind optional. Handles sind globale normalisierte Koordinaten. Endpunkte bleiben geschlossen.

Automationsereignisse: `{time,path,value,kind?}`, Zeit in Sekunden, Wert normalisiert. `kind` ist bei booleschen, Enum- und Integer-Zielen entsprechend markiert; bekannte Zielmetadaten entscheiden über die Interpretation. Keine fremden Optionslisten oder strukturellen/prototypischen Pfade zulassen.

## Worklet

Prozessorname `destructor-processor`, Input 0 Stereo-Main, Input 1 Stereo-Sidechain, Output 0 Stereo. Host-Nachrichten:

- `{type:'state',state}` vollständiger Snapshot.
- `{type:'gesture',path,value}` tatsächliche manuelle Geste vor dem Snapshot; Enum/Integer normalisiert.
- `{type:'clock',beat,bpm,playing,timestamp,seek?}`; Zeitstempel in Sekunden der AudioContext-Zeitbasis.
- `{type:'transport',playing,restart?}`, `{type:'reset'}`, `{type:'record',active}`.

Meter enthalten Ausgangspegel, Beat, Sequencerposition, tatsächliche Mod-/Graph-Phasen, Latenz-/Pending-Status, Automationsposition, effektive Zielwerte, aktuelle Quellen und gemessene FX-Wellenformen. Sie schreiben keine gespeicherten Basiswerte zurück. WAV-PCM wird in übertragenen Float32-Stereo-Blöcken geliefert und mit `record-ended` abgeschlossen.

## DSP-Module

`TimeRack.process(l,r,time,frame,bpm,beat?)` und `EffectRack.process(l,r,frame,bpm,beat?)` geben wiederverwendete Paare zurück. `EffectRack.configure(fx,mode,tonal,{latencyComp})`, `.setSidechain(l,r)`, `.getMeters(reset)` und `.reset()` sind die Rack-Schnittstellen. `latency` ist die tatsächlich zu kompensierende Verarbeitungslatenz. Aktivierungszustand, gepufferte Historie und Modulation nicht bei jedem UI-Update zurücksetzen.

`SpectralProcessor.configure(params,tonal,snap,{sync})` wählt die FFT-Größe; `.process(l,r,params,frame,bpm)` verarbeitet Audio. LOSSY verwendet die separate MDCT-Implementierung. FFT-Größen wechseln live über Warmup und Crossfade. Beim Spielen reserviert jeder Spektraleffekt 4096 Samples Ausgleich; tatsächlich latenzändernde Strukturwechsel werden bis Transport-Stop zurückgestellt.

Keine DOM-/Browser-UI-Abhängigkeit in DSP-Modulen, keine Laufzeit-CDNs, keine wiederholten Allokationen im Sample-Kern. Mechanismustests und Browserprüfung gehören zur Funktionsänderung; numerische Stabilität allein belegt keine vollständige Klangfunktion.

## Erweiterungen 2.1

Bekannte Strukturen verwenden `{time,kind:'structure',scope,value,index?,name?}`.
`scope` ist `fx`, `graph` oder `sequence`; ausschließlich schema-validierte
Snapshots sind zulässig. `sanitizeStructureEvent` und `applyStructureEvent`
entscheiden über Imports und Replay. FX-IDs sind innerhalb der Ereignistimeline
stabil. Der Recorder erhält beim Start auch den Ausgangszustand. Meter liefern
`structureRevision` und nur bei Änderung `topology`; die UI übernimmt ausschließlich
diese Strukturfelder, keine effektiven Parameterwerte.

`seq.length:0` erhält die alte Pattern-Länge; 1–64 wählt eigene Steps. `target` ist
`default` oder ein validierter numerischer Parameterpfad; MIN/MAX bilden Werte ab.
`mods.sync:false` verwendet `freeRate` mit 0,01–100 Hz. `time.granular` ist eine
optionale vierte serielle Stufe hinter dem bisherigen Time-Routing. Neue Zustände
lassen sie ausgeschaltet. Zusätzliche Formate und alle Defaults bleiben im
Preset-Format Version 1 kompatibel.
