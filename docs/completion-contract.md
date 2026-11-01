# Completion work contract

Preserve existing UI/forms/theme and version-1 preset compatibility. Extend existing modules and real processing; no decorative controls. Exact commercial DSP parity is not a requirement or claim. Implement documented functional mechanisms rather than substitute labels. Platform-only exclusions are VST/AU hosting, DAW lanes and unobservable original algorithms. All application modules remain local ESM, no CDN dependencies.

## Ownership

- fx_dsp: effects.mjs, fx-core.mjs, own new fx*.mjs / codec*.mjs / dsp*.mjs helpers, tests/fx*.test.mjs and tests/codec*.test.mjs, docs/fx-implementation.md.
- audio_runtime: modulation.mjs, spectral.mjs, audio-worklet.mjs, tests/modulation*.test.mjs, tests/spectral*.test.mjs, tests/worklet*.test.mjs, docs/audio-architecture.md.
- time_dsp: time-core.mjs, state.mjs, tests/time*.test.mjs, tests/state*.test.mjs, docs/time-implementation.md.
- root: app.mjs, styles.css, audio-host.mjs, midi-clock.mjs, automation.mjs, UI/browser tests, packaging/README/brief coverage.

Coordinate directly before cross-module changes. Agents may request bounded API additions from other owners. No Git commits/push (root publishing workflow only).

## Shared additions

- Common FX instance fields: `muted:false`, `lrLock:true`, `sync:false`, `paramsR:{...same defaults...}`. When locked use params for both; UI chooses L/R when unlocked, writes paramsR for right. DSP can process two mono instances when unlocked. Gain/mix/mute remain stereo. MIDI/audio sidechain is independent input.
- Additional FX descriptors use same `params[]` numeric normalized convention; optional `advanced:true` permits primary/advanced groups. Every existing key/default stays backwards compatible. `formatEffectValue` handles exact units; optional `{bpm,sampleRate,sync,...}` context. Effects agent owns descriptors for spectral effects too, coordinate parameter names.
- SpectralProcessor API remains `constructor(type,sampleRate)`, `.process(l,r,params,frame,bpm)`, `.latency`, `.reset()`. Add optional `.configure(params,tonal,snap)` or detect SIZE discretely. FFT SIZE param key `size` normalized 0/⅓/⅔/1 =>512/1024/2048/4096. LOSSY can use own MDCT helper instead of spectral kernel.
- Worklet input0 main stereo; input1 external sidechain stereo. `DestructorRuntime.process(l,r,sideL=0,sideR=0)` passes external source to modulation and FX. FX optional `.setSidechain(l,r)` and `.sidechainPeaks` for spectral attraction.
- ENV source `mods[i].source:'internal'|'external'`. Main `autoGain:0..1` default0, existing gain mapping preserve old values unless migrate carefully.
- Deferred structural FX latency: default enabled `latencyComp:true` state field. Latency-changing FFT SIZE/order/parallel changes while playing queue configuration until transport stop. UI can show meter `pendingLatency`/pending label. Keep audible current graph consistent; smooth processing/mute.
- MIDI phase messages from host: `{type:'clock',beat,bpm,playing,timestamp}` where timestamp=AudioContext.currentTime seconds at event reception. Worklet clock uses sample counter and bounded drift correction, no claim beyond Web MIDI arrival precision. All time engines receive coherent beat-derived frame without backwards jumps. Internal tempo changes must accumulate beat rather than recompute frame*bpm.
- Automation: root `automation.mjs` records normalized `{time,path,value}` events in state `automation:{duration:0,loop:true,events:[]}` (times seconds). Worklet reads state `automationPlaying:false`; automation replay runs in AudioWorklet per sample before modulation, sends effective values in meter optionally. Root record events through unified changed() path, including macros/XY, file export includes events. Recorder is gesture/control automation, separate WAV recording.
- Parameter meter: optional `values:{path:effectiveValue}` bounded to active routed destinations and automation paths; `fxMeters:[{id,peakL,peakR,wave:Array(32)}]` for actual effect visualizers. Actual values must not rewrite saved base values.
- Graph endpoints closed, optional cubic handles `[x,y,bend,c1x,c1y,c2x,c2y]` or object handles if agreed with state/UI owners. Root will preserve simple Shift-bend and add visible draggable handle UI; state sanitizer must retain real handles.
- Routing min/max/start/end/skew supports curved mapping and triangle. Controller takeover must detect changes in effective value due to other sources, only apply on actual macro/XY gesture then latch until overridden; manual control lock is UI with assignment-edit access.
- Random strengths root registry in localStorage signed[-1,1];0 lock. Include ALL continuous controls, mixes/gains and Bend entries; per-engine/effect setup dialogs.

Each agent writes tests proving mechanisms (pitch tracking, codec reconstruction, filter frequency response, band isolation, cycle timing, long memory, etc.). Existing tests need legitimate changes only when intentional spec corrections alter behavior. Report feature coverage against the brief and exact remaining limitations; do not silently classify feasible work as impossible.
