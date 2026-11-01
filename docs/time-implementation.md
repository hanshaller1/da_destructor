# Time engines: implementation and limits

DA DESTRUCTOR contains an independent implementation of the researched functions. It does not contain the original plugin's code, samples, presets, or DSP coefficients, and no sound-identical reproduction is claimed.

## Implemented signal paths

- **STRETCH** reads two overlapping Hann-windowed grains from a stereo capture region. Grain starts latch pitch and direction. Speed moves the scan position, pitch changes the within-grain read rate. LINKED makes the read rate follow SPEED and ignores the separate PITCH control. SCATTER offsets grain starts; SPREAD alternates their stereo weighting. FREEZE stops recording while grains continue reading the captured region.
- **VARISPEED** uses one variable-speed stereo read head, with short linear crossfades when its capture window reanchors. Speed and pitch remain coupled. Wow and flutter are sine modulation at 0.5 Hz and 6 Hz. The wet path includes optional soft saturation or quantization and a peak-envelope compressor. STOP ramps the motor down; a near-stationary read head fades out to avoid DC. SCRATCH modifies playback rate, including direction reversal, with zero-crossing preference and a bounded fallback.
- **STUTTER** captures from stereo history and repeats a slice. It supports free/synchronized slice length, capture interval, per-repeat pitch ramps, a gate and selectable gate curve, repeat decay, alternating pan, trigger probability, retrigger probability, reverse, and freeze. The fourteen LINK choices couple slice and capture timing. Six PATTERN modes change the requested slice duration. Sequence gates fade to dry without discarding captured history.
- **BEND** shares Stutter's capture/history engine. WARP chooses progressively wider rate/direction changes, including clocked scratch motifs. BREAK chooses subsection offsets and probability of silence. REPS controls subsection count. WIDTH applies mid/side widening, DUCK applies an amplitude-dependent wet/dry duck, and a fixed Tukey-style edge window suppresses clicks.
- The three serial orderings and parallel routing use the same processors. Parallel routing averages active branch deltas around the original dry signal. Inactive engines do not run their processing loops. Enabled engines use a nominal 10 ms fade plus a short mix smoother. Output arrays are reused.

## Exact control mapping

All continuous controls are normalized to 0–1. Musical fractions below are note values in 4/4. A quarter note is one beat.

| Control | Mapping |
| --- | --- |
| Stretch/Vari CAPTURE and Stutter CAPTURE | Nine nearest-index choices: 16, 8, 4, 2, 1, 0.5, 0.25, 0.125, 0.0625 beats. Display: 4 BARS, 2 BARS, 1 BAR, 1/2, 1/4, 1/8, 1/16, 1/32, 1/64. Stretch and Vari clamp their requested window to their 2 s buffers. Stutter has 18 s of history. |
| Stutter synchronized RATE | Seven nearest-index choices: 1/64, 1/32, 1/16, 1/8, 1/4, 1/2, 1 beats. Display: 1/256, 1/128, 1/64, 1/32, 1/16, 1/8, 1/4. |
| Stutter free RATE | `10 + 490 × value` ms. |
| Stretch synchronized GRAIN | Grain length is `beatDuration / 128 × 2^(5 × value)`, continuously adjustable. It is bounded to 32 samples–400 ms. The UI displays the resulting milliseconds at the current BPM. At 120 BPM and value 0.4, this is 15.625 ms. |
| Stretch free GRAIN | Repetition rate `5 + 95 × value` Hz; grain length is its reciprocal. |
| BEND synchronized TIME | Capture length `(1/8) × 2^(7 × value)` beats, continuously adjustable from 0.125 to 16 beats. The UI displays beats. |
| BEND free TIME | `10 + 17990 × value` ms. |
| Pitch / pitch ramp | `24 × value − 12` semitones. Ramp accumulates per repetition and playback rate is bounded. |
| REPS | `1 + round(31 × value)`, except SCRATCH zone locks the actual count to 1. |
| SMOOTH | Requested seam window `5 + 45 × value` ms, limited to one quarter of the current slice length. |
| WIDTH | Mid/side width `1 + 3 × value`. |
| DUCK and SCRATCH | 0.5 is neutral. |
| Vari MODE | Numeric 0 = FORWARD, 0.5 = FWD-REV, 1 = REVERSE. The core also accepts those uppercase strings. FWD-REV alternates each capture cycle. |
| Vari SAT TYPE | Numeric 0 = HEAT, 1 = BITCRUSH, or those uppercase strings. |

LINK RATE:CAPTURE pairs, in beats, are: `(1/64, .25)`, `(1/32, .25)`, `(1/32, .5)`, `(1/16, .5)`, `(1/16, 1)`, `(1/8, 1)`, `(1/8, 2)`, `(1/4, 1)`, `(1/4, 2)`, `(1/4, 4)`, `(1/2, 2)`, `(1/2, 4)`, `(1, 4)`, `(1, 8)`.

## Deliberate limits and differences

- These are live history-buffer effects. They require a short initial capture; during warmup the original signal passes through. Freeze does not load a whole sample into a separate time-stretch model.
- The grain stretcher has no formant preservation, transient analysis, or phase-vocoder processing. Extremely small grains, reverse, and scatter intentionally produce coloration.
- Varispeed's initial read latency is approximately 25 ms. Capture reanchoring changes the audio history position. There is no claim of zero algorithmic latency or equivalence to analog tape physics; saturation does not use oversampling.
- Stutter pitch changes the source traversal and therefore the repeat duration. At neutral pitch, the repeat duration matches the selected musical slice exactly. Capture boundaries are derived from the runtime sample clock; this browser app does not receive a DAW's host PPQ.
- Swing and ramp pattern durations are original deterministic approximations. They are not a copied preset bank or an exact transcription of the researched plugin's patterns.
- BEND scratch uses eight-step directional motifs rather than reproductions of the named Baby/Transformer/Tear/Scribble implementations. Extreme-rate choices are selected at loop boundaries. The window shape is fixed; no separate WINDOW control is implemented.
- Smooth wet/dry and capture fades reduce discontinuities, but extreme feedback from later effects, aggressive grain settings, or modulation can still produce intentional harsh transients. The shared main bus provides output limiting.
- Tests verify finite stereo output, clean bypass, measured half-speed pitch, tape-stop/release, frozen capture, exact neutral-pitch repeat timing, no stale audio on rearm, sequence gate history, and routing differences. They do not establish perceptual parity with the commercial product.
