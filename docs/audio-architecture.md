# Audio implementation

DA DESTRUCTOR is an independent browser audio instrument based on the supplied functional research, not a port of proprietary DSP. Audio stays in the browser; live input uses the browser's microphone/audio-device permission.

The `destructor-processor` AudioWorklet receives stereo Web Audio input. It passes it through `TimeRack`, `EffectRack`, three-band MAIN EQ, a stereo-linked compressor, equal-power pan, global dry/wet and a transparent-until-0.95 peak limiter. MAIN gain spans -24 to +24 dB; each EQ gain spans -15 to +15 dB. Playback and bypass fade over approximately 10 ms. Finite-value guards prevent corrupt audio from propagating. The recording tap is post-limiter, before browser monitor gain, and transfers interleaved stereo PCM in 4096-frame chunks; the partial last chunk is flushed before the completion acknowledgement.

EffectRack reports spectral latency. MAIN's original-source dry reference uses a matching delay, so global dry/wet and bypass do not combine different spectral time positions. A new chain's latency applies on configuration; structural chain edits can change latency immediately. The browser does not expose a plugin host's automatic delay compensation to other applications.

The sample counter advances while playing. Tempo is internal, 30–300 BPM, or follows an explicitly selected Web MIDI input. The optional MIDI follower requests permission only from the ENABLE MIDI action, with SysEx disabled. It estimates BPM from the latest 24 MIDI-clock intervals; START resets, CONTINUE resumes and STOP pauses transport. Clock pulses update tempo at most 20 times per second. Device removal stops the follower, and reconnection reattaches only the input the user had selected. This is a tempo/transport follower, not sample-locked external PPQ synchronization. A transport reset clears captured buffers, tails, modulation phases and sequencer position. Pause retains transport phase. There is no separate external sidechain bus.

## Modulation

Four independent sources support 19 LFO shapes, reproducible random movement (stepped or cubic-interpolated) and envelope following. Envelope input is post-time/pre-FX, with adjustable input gain, attack, release and low/high frequency emphasis. LFO/random controls update every 32 samples; destination engines smooth audible parameter changes. Source-to-source routing uses the preceding control tick to break feedback cycles deterministically. A source has six destinations.

Three looping graphs use editable points with cubic Bezier value interpolation. The optional third coordinate is a normalized curve bend: 0.5 is linear, 0 and 1 bend in opposite directions. Each graph has six destinations. Clocked cycle lengths are 1/64, 1/32, 1/16, 1/8, 1/4, 1/2 notes and 1, 2, 4, 8, 16 bars in 4/4.

Four macros and X/Y each have five destinations. A route supports minimum, maximum, start, end and skew (0.5 linear). Manual edits to a previously controlled destination engage pickup: the controller must cross the edited value before taking control. Editing the route curve takes effect immediately. When several sources address the same destination the stable order is LFO/RAND/ENV, graphs, macros, X, then Y; the last assignment takes precedence. Modulation uses a separate effective state and never rewrites saved base values.

The two sequencers have one to four 16-step patterns, with 1/16 through 1/1 note step lengths. Every step boundary is computed per sample. STRETCH controls speed; disabled steps return the stored base speed. STUTTER controls rate (or BendIt repetitions), and disabled steps return dry audio while retaining capture history. It does not repeatedly reset the capture engine.

FX destinations accept `fx.<stable-id>.<parameter>` and `fx.<stable-id>.params.<parameter>`, and direct `mix`/`gain` paths. Reordering the chain therefore preserves assignments. Numeric controls are normalized 0–1. Invalid/prototype paths are rejected, routing counts are bounded, and malformed continuous values are clamped.

## Verification limits

Node tests exercise sample math, routing, synchronization and state behavior. Browser checks are needed to verify AudioWorklet module loading, actual audio-device access, interaction and recording downloads. No claim of bit-identical sound, original presets, original algorithm topology, or sample-accurate external hardware/host synchronization is made.

