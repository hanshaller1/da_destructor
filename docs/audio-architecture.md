# Audio implementation

DA DESTRUCTOR implements the supplied functional research with original browser DSP. It does not use proprietary plugin code, presets or samples. Input files, recordings, sidechain audio and processing remain local to the browser.

## Audio, master and recording

The `destructor-processor` AudioWorklet accepts two stereo inputs. Input 0 is the musical source; input 1 is a separate sidechain file or live input. The main signal passes through `TimeRack`, `EffectRack`, MAIN's low shelf at 200 Hz, bell at 1 kHz and high shelf at 5 kHz, stereo-linked compressor, equal-power pan, master dry/wet and a peak limiter. EQ gains span ±15 dB. New presets use `main.gainMode:'extended'`: 0 is silence, 0.5 is unity and 1 is +12 dB. Imported older presets retain the former -24…+24 dB mapping through `gainMode:'legacy'`.

AUTO GAIN compares smoothed stereo energy before and after processing. Its compensation matches processed level to the latency-aligned original source, with bounded gain and a gradual response; the manual master gain remains intentional. COMPRESS and AUTO GAIN default to zero. The limiter is sample-transparent through ±0.95 and approaches ±1 smoothly above that range. Finite-value guards prevent invalid samples from propagating.

Playback and bypass use approximately 10 ms smoothing. After a paused transport has faded to silence, the runtime stops calling the time/effect processors, retaining their captured history. Recording taps the post-limiter output before monitor volume. It transfers stereo interleaved Float32 PCM in 4096-frame chunks. Stop, reset and source changes flush the final partial chunk before the completion acknowledgement, and the browser writes a stereo 16-bit WAV.

## Clock and deferred latency

The runtime accumulates musical beat as samples advance. Changing BPM therefore changes its future slope without jumping the current beat. All time engines, sequencers, graphs and clocked effects receive this shared beat separately from the monotonic sample counter.

Web MIDI requires an explicit permission action and selected input, with SysEx disabled. MIDI clock measures the latest 24 intervals. START resets transport, CONTINUE resumes, STOP pauses, and Song Position Pointer performs an explicit seek. Timestamped clock messages project event beat into the AudioContext time domain; bounded drift correction changes the internal beat rate by at most ±5% while converging. Ordinary tempo/clock updates never move beat backwards. An explicit seek can do so. Browser event arrival precision still limits external synchronization; this is not a native DAW PPQ or plugin-host timing API.

With LATENCY COMP enabled, each effect aligns its internal dry path and parallel/L/R branches. MAIN's original-source path matches the combined reported time/effect latency. FFT sizes switch live through warmed, aligned banks and a 20 ms crossfade. During playback each STFT effect reserves 4096 compensation samples; after the pause fade reaches silence this returns to selected-size latency. Same-total-latency reorder applies immediately and retains instances. Only configurations that change the actual chain compensation remain pending until Stop. Ordinary continuous controls continue to affect the audible chain. Automation and modulation use the same live SIZE path. Structural motion snapshots restore FX order, graph topology and sequence configuration on their event sample, including at loop restart. Disabling compensation omits local, branch and master dry alignment while the processors retain their physical algorithmic delay. The meter reports active latency and pending configuration separately.

## Modulation and performance

Four sources offer musical rates or tempo-independent 0.01–100 Hz FREE rates and provide 19 LFO shapes, deterministic random movement with stepped/interpolated output, jitter and smoothing, or envelope following. INTERNAL envelope input is post-time/pre-FX. EXTERNAL uses input 1 independently, including opposite-polarity stereo inputs. GAIN, RISE, FALL and low/high TONE emphasis affect detection.

Sources update every 32 samples. Modulators may target each other or themselves: each tick uses values from the preceding tick, so cycles remain causal, normalized and non-recursive. Each modulator and each of the three graphs has six target slots.

Graphs and FX topology can also be recorded as bounded, validated structural snapshots. Graph endpoints are closed. A point is `[x,y,bend]` or `[x,y,bend,c1x,c1y,c2x,c2y]`; explicit handles use absolute normalized coordinates. Cubic Bezier evaluation inverts the X curve before evaluating Y, so horizontal handle movement changes timing. Reversing playback changes direction from the current graph phase. New graph periods span 1 beat (quarter bar) to 64 beats (16 bars); imported legacy timing remains available.

Four macros and X/Y each have five target slots. Routes support MIN/MAX, START/END, skew, S-curves and triangular movement. A passive controller assignment does not override another source. An actual gesture acquires a target after its mapped position crosses the current effective value. The last controller that picks up a shared destination owns it; other controllers wait for their own crossing. A direct target edit or automation event releases that ownership. A changing automatic source regains control once a manual gesture has been idle for 150 ms. Editing an assignment curve applies immediately. Transport reset preserves picked-up performance values without replaying old gesture events.

Sequencers evaluate every sample. Each retains one to four 16-step patterns and optionally selects an independent 1–64-step length. Additional numeric destinations have MIN/MAX mapping and actual source metering. STRETCH controls speed. STUTTER controls rate, or BendIt repetitions; disabled stutter steps fade to dry while capture history continues. Rate, gate, current step values and on/off states can themselves be replayed or routed.

## Gesture replay and parameter state

Gesture automation uses `{time,path,value,kind?}` events, with time in seconds and normalized values. Events apply at their exact sample before modulation. Replay supports loops, macro/XY gestures, continuous and boolean controls, known string selectors, tonal root, graph point/handle coordinates, sequencer cells, right-channel FX parameters and CHOPPER slice cells. Enum choices come from the application's whitelist, never from imported event data. Transport, arbitrary object properties, arbitrary array lengths and prototype paths are not writable targets. Known FX, graph and sequencer topology use separately validated structural events.

Automation and modulation maintain an effective processing state separately from saved base values. FX paths use stable instance IDs, so reordering preserves assignments. Meter packets include bounded `values` and active `sources` maps, actual LFO/graph phases, automation position and actual per-effect peaks plus 32 waveform samples. UI indications therefore follow the source currently controlling the audible value.

## Spectral processing

`spectral.mjs` implements 512, 1024, 2048 and 4096-point FFTs, square-root Hann analysis/synthesis windows, four-times overlap and exact normalized overlap-add. Algorithmic STFT latency equals the selected FFT size. Identity reconstruction is tested independently at all four sizes.

- CHROMA and WARP redistribute frequency energy with measured instantaneous frequencies and identity phase locking around spectral peaks. CHROMA center follows global key/root when SNAP is active; pitch intervals snap to the selected scale.
- FORMANT SHIFT derives a cepstrally smoothed spectral envelope, shifts that envelope and retains the original harmonic frequencies and phases. DETAIL controls the envelope's retained quefrency detail.
- SIEVE implements prime, Fibonacci, power-of-two, odd and even sieves, plus KEY and CHORD masks that use the selected global root/scale/chord.
- MAGNET provides global scale, global chord, independent row scale/root and externally measured sidechain-peak attraction fields, with focus, drift and glide.
- SEPARATE uses temporal/frequency median statistics, spectral prominence and onset flux to partition tonal, noise and transient energy. Component gains sum transparently at unity; only the tonal component is pitch-shifted, and noise receives independent stereo spreading.
- CONTRAST changes strong/medium/weak partial levels within LOW/HIGH bounds. Per-partial release prolongs amplitudes; maximum SUSTAIN holds them indefinitely with measured-frequency phase advance.
- SMEAR spreads spectral amplitudes down, up or both ways, adds temporal feedback, tilt and phase diffusion, and captures held spectra on the chosen musical division.
- SPECTRAL DELAY stores complex per-bin history up to eight seconds. TIME can be free or synchronized, with tilt, linear/exponential/log/stepped/random/key distributions, spread, blur, gate, damping, low-cut and pitch shift. ALL/LOW/HIGH freeze uses SPLIT and retains measured delayed phase/frequency.
- STILLS selects up to 33 spectral peaks at each musical capture boundary and drives a real stereo oscillator bank. Voice count, blur, wave morph, tension, octave and snapshot feedback act on those oscillators; saw/square discontinuities use polyBLEP correction.

LOSSY uses the separate MDCT encode/decode implementation described in `fx-implementation.md`, rather than a renamed FFT quantizer. Other effect families and time-engine mechanisms are documented in their respective implementation files.

## Verification and platform boundaries

Focused signal tests verify FFT/OLA reconstruction, off-bin octave shift, formant emphasis without harmonic retuning, global scale/chord masks, external peak attraction, oscillator-bank stereo phase, component partition reconstruction, clocked spectral hold, all delay shapes, weak-partial gate, low-cut/band freeze, and spectral sustain. Runtime tests verify sidechain input, typed sample-timed replay, bypass on the real audible path, controller takeover, MIDI phase continuity, auto-gain, delayed structural changes and real effect meters. Browser tests additionally exercise user interaction, worklet loading, files, recordings, sidechain and gesture playback.

Native VST/AU hosting and DAW automation lanes are outside a standalone browser application. Hardware timing precision and available audio/MIDI devices remain browser/OS dependent. These are original algorithms implementing the described mechanisms; no bit-identical sound or undocumented commercial topology is claimed.
