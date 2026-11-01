# Time engines, state, and version-one preset compatibility

DA DESTRUCTOR implements the research brief with original browser DSP. It contains no code, samples, coefficients, or presets from the commercial plugin. Named mechanisms and control ranges describe this implementation; the undocumented proprietary sound is not claimed to be identical.

## Implemented time mechanisms

### STRETCH

The stereo capture buffer feeds two overlapping Hann-windowed grains. In **musical** timing, GRAIN chooses exact note divisions **1/16, 1/32, 1/64, 1/128, 1/256, 1/512**. A grain starts on each selected division and lasts two divisions, providing complementary overlap. Fractional sample periods preserve clock phase instead of rounding every grain independently. Capture subdivisions supply split-size source offsets. Pitch and direction latch at each grain launch, so editing REVERSE/PITCH does not modify a grain already in flight.

FREE uses a continuous 5–100 Hz grain-start scheduler. SPEED advances the read position independently of PITCH; LINKED makes pitch follow speed. SCATTER randomizes launch positions and SPREAD alternates stereo weighting. FREEZE stops capture while reading continues; SPEED 0 also holds the captured material and scan position. Capture timing selects 4, 2, 1, or 0.5 beats. The buffer is capped at 2 s, and the UI identifies capped requests.

### VARISPEED

A stereo ring-buffer read head couples pitch and speed. At normal forward speed, zero wow, centered scratch, and no stop, the musical path uses the current sample directly: **zero added algorithmic delay without saturation**. Other speeds use interpolated history and linear rebase crossfades at the selected capture interval. Forward/reverse mode alternates per capture cycle.

Wow and flutter use recursive 0.5 Hz and 6 Hz sine oscillators. STOP ramps the motor down and fades a stationary read head to avoid DC. SCRATCH changes read rate and direction. A direction reversal waits for a real zero crossing; input without a crossing, such as DC, fades fully to zero before reversal and then recovers.

HEAT and BITCRUSH use a real **2x FIR upsample → nonlinearity → FIR reconstruction** path in musical timing. It adds 15 samples while active. The local dry path receives the same 15-sample delay, and parallel Time branches align that fixed latency before averaging. This latency is exposed as `TimeRack.latency`. Saturation switching can change the fixed algorithmic delay during performance; it is not deferred like an FFT-size change.

### STUTTER

A capture bank and a separate repeat clock decouple **PITCH from repetition duration**. Pitch and cumulative per-repeat ramps move the source read head; the sample clock still closes each repeat at its selected musical/free interval. Capture starts at the current grid position. DOTTED multiplies the period by 1.5, TRIPLET by 2/3, and SWING alternates 4/3 and 2/3 periods. RAMP UP uses eight shortening durations whose sum is exactly eight base periods; RAMP DOWN reverses that sequence. Timing remainders carry forward rather than accumulating rounding drift.

Other real controls include a linear/log/exp gate, repeat decay, stereo ping-pong, trigger probability, seam smoothing, reverse, freeze, and fourteen LINK pairs. Retrigger probability is evaluated at repeat edges inside the larger capture cycle, not at an arbitrary AudioWorklet block boundary. Linear capture crossfades prevent the correlated midpoint boost of equal-power mixing. Sequencer `seqGate` fades to dry without discarding captured history.

### BEND

BEND uses an up-to-18-second stereo bank, subdivided by REPS. WARP has all seven regions: OFF; ±50% WOBBLE; SLIP (2x/0.5x/1x); LURCH (4x/2x/0.5x/0.25x/1x); STALL (0.1x/4x/2x/1x with slower slew approaching the scratch region); SCRATCH; and HAVOC (within ±3 octaves).

SCRATCH provides **BABY, TRANSFORMER, TEAR, and SCRIBBLE** motion/gate programs, each repeating across four bars. AUTO chooses a program per four-bar block. Rate, shape, and depth change at beat boundaries using reproducible position-based variation. Entry/exit and the WARP macro latch on the eighth-note grid. REPS is actually locked to one while scratch is active. The four names correspond to distinct original gesture mechanisms, not copies of proprietary pattern data.

BREAK has OFF, NUDGE, SKIP, SCATTER, and DROPOUT regions. SKIP increases jump probability from 15% to 50%, SCATTER from 50% to 80%, and DROPOUT adds silence probability. The selected subsection and dropout state latch per repeat. WIDTH implements mid/side widening; DUCK controls amplitude-dependent wet/dry ducking. **WINDOW changes the real Tukey taper**, from a short edge taper toward a Hann-like full taper.

Short TIME values retain fractional subsection periods instead of applying a hidden 16-sample floor. At 44.1 kHz, 10 ms / 32 gives 13.78125 samples per repeat; successive edges alternate integer sample intervals while all 32 repeats span the requested 10 ms to within one sample. Gate/window edge lengths scale to those short periods so they remain audible.

## Timing tables and clock API

All knob values are normalized to 0–1; selects use the nearest index unless described otherwise. A quarter note equals one beat.

| Control, musical timing | Actual mapping |
| --- | --- |
| Stretch CAPTURE | 4, 2, 1, 0.5 beats; maximum history 2 s |
| Vari / Stutter CAPTURE | 4, 2, 1, 0.5, 0.25, 0.125, 0.0625 beats |
| Stutter RATE | 1/64, 1/32, 1/16, 1/8, 1/4, 1/2, 1 beats, displayed as note divisions 1/256 through 1/4 |
| Stutter free RATE | `10 + 490 × value` ms |
| Stretch GRAIN | Note divisions 1/16 through 1/512; grain length is two divisions |
| Stretch free GRAIN | `5 + 95 × value` grain starts per second |
| Bend TIME | 0.125, 0.25, 0.5, 1, 2, 4, 8, 16 beats; maximum history 18 s |
| Bend free TIME | `10 + 17990 × value` ms |
| PITCH / PITCH RAMP | `24 × value − 12` semitones; ramp accumulates per repeat with bounded playback rate |
| REPS | `1 + round(31 × value)`, overridden to 1 in active SCRATCH |
| SMOOTH | `5 + 45 × value` ms, bounded by the current slice |
| WIDTH | `1 + 3 × value` mid/side width |
| DUCK / SCRATCH | 0.5 neutral |

LINK RATE:CAPTURE pairs, in beats: `(1/64, .25)`, `(1/32, .25)`, `(1/32, .5)`, `(1/16, .5)`, `(1/16, 1)`, `(1/8, 1)`, `(1/8, 2)`, `(1/4, 1)`, `(1/4, 2)`, `(1/4, 4)`, `(1/2, 2)`, `(1/2, 4)`, `(1, 4)`, `(1, 8)`.

`TimeRack.process(left,right,time,frame,bpm,beatPosition?)` accepts the runtime's accumulated musical beat as its optional sixth argument. The real sample frame remains monotonic for free timing, while capture/grain/scratch grid positions follow the accumulated beat. A tempo change therefore does not recompute past beat position from the new BPM. Web MIDI timing is bounded by browser event arrival precision; no sample-accurate DAW PPQ connection is claimed.

## Preset migration and serialized state

The file format remains **version 1**. New engine states use `timing:'musical'`; imports missing that field receive `timing:'legacy'` without changing their saved normalized knob values. Legacy timing retains the previous nine capture divisions, continuous grain-duration mapping, and continuous synchronized Bend TIME. The independent Stutter repeat clock is a correctness improvement applied to both modes; old pitched Stutter repeats therefore retain their selected rate instead of changing length with pitch.

New MAIN gain uses `gainMode:'extended'`: zero is mute; the lower half maps amplitude `2 × value` up to unity; the upper half maps 0 through +12 dB. Imports without gainMode retain the previous -24 through +24 dB mapping as `gainMode:'legacy'`. Both modes retain 0.5 = 0 dB. New graph periods use `timing:'musical'` (one through 64 beats); old graph periods retain their legacy mapping.

State validates and persists:

- FX `muted`, `lrLock`, `sync`, `snap`, independent `paramsR`, plus 32 independent CHOPPER slice parameter sets. Old effects without paramsR copy their saved left parameters when imported.
- Internal/external envelope source, MAIN auto-gain, latency-compensation preference, and clock source/deferred preference.
- Closed graph endpoints and optional real cubic handles `[x,y,bend,c1x,c1y,c2x,c2y]`. Invalid handle coordinates are removed while valid points remain.
- Automation duration, loop mode, and bounded, sorted `{time,path,value}` gestures. Boolean gestures use numeric 0/1 plus `kind:'boolean'`. String selectors use normalized option indices with `kind:'enum'`; the option list is derived from `getParameterOptions(path,state)`, never from file-provided data. This includes LFO shape/type/source, time pattern/curve/order/timing, FX routing, tonal scale/chord, graph timing, and main gain mode. Tonal root uses `kind:'integer'` and a normalized pitch-class value (`root / 11`). Known numeric/boolean paths include right FX channels, CHOPPER slices, all 64 sequence step values/gates, and the seven coordinates of up to 48 graph points. Transport `playing`, arbitrary object paths, prototypes, and array lengths cannot be automated. Playback always initializes stopped after import.
- Four modulators, three graphs, four named macros, XY assignments, two independent 64-step sequencers, routing curves, and extended scale/chord choices.

## Verification and practical limits

Focused tests prove zero normal-speed tape delay, measured half-speed pitch, tape-stop/release, actual zero/DC direction turns, reduction of a high-frequency saturation alias, local and parallel dry/wet FIR alignment, exact repetition under changing pitch/ramp, octave frequency movement, musical pattern periods, edge-aligned retrigger, note-grid launches and complementary Hann overlap, per-grain latching, four-bar scratch periodicity, eighth-note gating and REPS lock, real WINDOW energy change, fractional short repeats at 8/44.1/48 kHz, and phase preservation through a tempo change. State tests cover full JSON round-trip, migration, independent stereo/slices/steps, external ENV, automation safety, and cubic handles.

Live capture still requires enough source history; the app passes dry audio during warmup. Grain stretch has no formant preservation or hidden transient analysis. Extreme grain/read-speed settings can intentionally sound rough. The normal Varispeed path is zero-delay, while active oversampled saturation has a measured fixed delay. Actual device round-trip latency remains a Web Audio/browser/audio-driver property. The original plugin's undocumented DSP, preset contents, and exact scratch gestures cannot be verified or copied; the documented functions are implemented with original algorithms.
