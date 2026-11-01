import {TimeRack} from './time-core.mjs';
import {EffectRack} from './fx-core.mjs';
import {ModulationEngine, defaultState, clamp01} from './modulation.mjs';

const finite = value => Number.isFinite(value) ? Math.max(-32, Math.min(32, value)) : 0;
const dbGain = db => 10 ** (db / 20);
const SQRT2 = Math.SQRT2;

class StereoBiquad {
  constructor() {this.b0 = 1; this.b1 = this.b2 = this.a1 = this.a2 = 0; this.z = new Float64Array(4); this.out = new Float64Array(2);}
  reset() {this.z.fill(0);}
  set(kind, frequency, db, sampleRate) {
    const A = 10 ** (db / 40), omega = 2 * Math.PI * Math.min(frequency, sampleRate * .45) / sampleRate;
    const c = Math.cos(omega), s = Math.sin(omega), alpha = s / SQRT2, sqrtA = Math.sqrt(A);
    let b0, b1, b2, a0, a1, a2;
    if (kind === 'low') {
      const t = 2 * sqrtA * alpha;
      b0 = A * (A + 1 - (A - 1) * c + t); b1 = 2 * A * (A - 1 - (A + 1) * c); b2 = A * (A + 1 - (A - 1) * c - t);
      a0 = A + 1 + (A - 1) * c + t; a1 = -2 * (A - 1 + (A + 1) * c); a2 = A + 1 + (A - 1) * c - t;
    } else if (kind === 'high') {
      const t = 2 * sqrtA * alpha;
      b0 = A * (A + 1 + (A - 1) * c + t); b1 = -2 * A * (A - 1 + (A + 1) * c); b2 = A * (A + 1 + (A - 1) * c - t);
      a0 = A + 1 - (A - 1) * c + t; a1 = 2 * (A - 1 - (A + 1) * c); a2 = A + 1 - (A - 1) * c - t;
    } else {
      b0 = 1 + alpha * A; b1 = -2 * c; b2 = 1 - alpha * A;
      a0 = 1 + alpha / A; a1 = -2 * c; a2 = 1 - alpha / A;
    }
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = a1 / a0; this.a2 = a2 / a0;
  }
  process(left, right) {
    let output = this.b0 * left + this.z[0];
    this.z[0] = this.b1 * left - this.a1 * output + this.z[1]; this.z[1] = this.b2 * left - this.a2 * output; this.out[0] = finite(output);
    output = this.b0 * right + this.z[2];
    this.z[2] = this.b1 * right - this.a1 * output + this.z[3]; this.z[3] = this.b2 * right - this.a2 * output; this.out[1] = finite(output);
    return this.out;
  }
}

export class MainBus {
  constructor(sampleRate) {
    this.sampleRate = sampleRate; this.low = new StereoBiquad(); this.mid = new StereoBiquad(); this.high = new StereoBiquad();
    this.output = new Float64Array(2); this.smooth = 1 - Math.exp(-1 / (sampleRate * .01)); this.compressorEnvelope = 0;
    this.current = {gain: .5, low: .5, mid: .5, high: .5, pan: .5, mix: 1, compress: 0};
    this.compressorAttack = 1 - Math.exp(-1 / (sampleRate * .004)); this.compressorRelease = 1 - Math.exp(-1 / (sampleRate * .15));
    this.update(this.current);
  }
  reset() {this.low.reset(); this.mid.reset(); this.high.reset(); this.compressorEnvelope = 0;}
  update(main) {
    this.low.set('low', 200, ((main.low ?? .5) - .5) * 30, this.sampleRate);
    this.mid.set('peak', 1000, ((main.mid ?? .5) - .5) * 30, this.sampleRate);
    this.high.set('high', 5000, ((main.high ?? .5) - .5) * 30, this.sampleRate);
    const gain = dbGain(((main.gain ?? .5) - .5) * 48), pan = (main.pan ?? .5) * Math.PI / 2;
    this.gainLeft = gain * Math.cos(pan) * SQRT2; this.gainRight = gain * Math.sin(pan) * SQRT2;
  }
  process(left, right, dryLeft, dryRight, main, frame = 0) {
    const current = this.current, a = this.smooth;
    current.gain += a * ((main.gain ?? .5) - current.gain);
    current.pan += a * ((main.pan ?? .5) - current.pan);
    current.mix += a * ((main.mix ?? 1) - current.mix);
    current.compress += a * ((main.compress ?? 0) - current.compress);
    current.low += a * ((main.low ?? .5) - current.low);
    current.mid += a * ((main.mid ?? .5) - current.mid);
    current.high += a * ((main.high ?? .5) - current.high);
    if ((frame & 31) === 0) this.update(current);
    let pair = this.low.process(left, right); pair = this.mid.process(pair[0], pair[1]); pair = this.high.process(pair[0], pair[1]);
    left = pair[0]; right = pair[1];
    const peak = Math.max(Math.abs(left), Math.abs(right));
    const coefficient = peak > this.compressorEnvelope ? this.compressorAttack : this.compressorRelease;
    this.compressorEnvelope += coefficient * (peak - this.compressorEnvelope);
    if (current.compress > .00001) {
      const over = Math.max(0, 20 * Math.log10(this.compressorEnvelope + 1e-10) + 18), ratio = 1 + current.compress * 9;
      const reduction = dbGain(-over * (1 - 1 / ratio) * current.compress);
      left *= reduction; right *= reduction;
    }
    // Master MIX returns the original source, with latency compensation.
    this.output[0] = finite((dryLeft + (left - dryLeft) * current.mix) * this.gainLeft);
    this.output[1] = finite((dryRight + (right - dryRight) * current.mix) * this.gainRight);
    return this.output;
  }
}

export function limitSample(value) {
  if (!Number.isFinite(value)) return 0;
  const magnitude = Math.abs(value);
  return magnitude <= .95 ? value : Math.sign(value) * (.95 + .05 * Math.tanh((magnitude - .95) / .05));
}

export class DestructorRuntime {
  constructor(sampleRate = 48000) {
    this.sampleRate = sampleRate; this.time = new TimeRack(sampleRate); this.fx = new EffectRack(sampleRate); this.modulation = new ModulationEngine(sampleRate); this.main = new MainBus(sampleRate);
    this.frame = 0; this.samples = 0; this.output = new Float64Array(2); this.playFade = 0; this.bypassFade = 0;
    this.fade = 1 - Math.exp(-1 / (sampleRate * .01));
    this.dryL = new Float32Array(65536); this.dryR = new Float32Array(65536); this.dryWrite = 0; this.latency = 0;
    this.configure(defaultState());
  }
  configure(state) {
    this.state = this.modulation.configure(state);
    this.fx.configure(this.state.fx, this.state.fxMode, this.state.tonal);
    this.latency = Math.max(0, Math.min(65535, Number(this.fx.latency) || 0));
    return this.state;
  }
  reset() {
    this.time.reset(); this.fx.reset(); this.main.reset(); this.modulation.reset();
    this.dryL.fill(0); this.dryR.fill(0); this.dryWrite = 0; this.frame = 0; this.samples = 0; this.playFade = 0;
  }
  process(left, right) {
    left = finite(left); right = finite(right);
    const base = this.modulation.base;
    this.playFade += this.fade * ((base.playing ? 1 : 0) - this.playFade);
    this.bypassFade += this.fade * ((base.bypass ? 1 : 0) - this.bypassFade);
    let effective = this.state;
    if (base.playing) effective = this.modulation.tick(this.frame, base.bpm);
    this.dryL[this.dryWrite] = left; this.dryR[this.dryWrite] = right;
    const dryIndex = (this.dryWrite - this.latency + 65536) & 65535;
    const dryLeft = this.dryL[dryIndex], dryRight = this.dryR[dryIndex]; this.dryWrite = (this.dryWrite + 1) & 65535;
    let pair = this.time.process(base.playing ? left : 0, base.playing ? right : 0, effective.time, this.frame, base.bpm);
    this.modulation.feedEnvelope(pair[0], pair[1]);
    pair = this.fx.process(pair[0], pair[1], this.frame, base.bpm);
    pair = this.main.process(pair[0], pair[1], dryLeft, dryRight, effective.main, this.samples);
    this.output[0] = limitSample((pair[0] + (dryLeft - pair[0]) * this.bypassFade) * this.playFade);
    this.output[1] = limitSample((pair[1] + (dryRight - pair[1]) * this.bypassFade) * this.playFade);
    if (base.playing) this.frame++;
    this.samples++;
    return this.output;
  }
}

const ProcessorBase = globalThis.AudioWorkletProcessor ?? class { constructor() {this.port = {postMessage() {}, onmessage: null};} };
export class DestructorProcessor extends ProcessorBase {
  constructor() {
    super(); this.rate = globalThis.sampleRate ?? 48000; this.runtime = new DestructorRuntime(this.rate);
    this.meterCount = 0; this.peakL = this.peakR = this.energy = 0; this.recording = false; this.recordBuffer = null; this.recordOffset = 0; this.failed = false;
    this.port.onmessage = event => this.message(event.data);
  }
  message(data) {
    try {
      if (data?.type === 'state') {this.runtime.configure(data.state); this.failed = false;}
      else if (data?.type === 'reset') {this.finishRecording(); this.runtime.reset(); this.failed = false;}
      else if (data?.type === 'transport') {
        this.runtime.modulation.base.playing = !!data.playing; this.runtime.state.playing = !!data.playing;
        if (data.restart) this.runtime.reset();
      } else if (data?.type === 'record') {
        if (data.active) {this.finishRecording(false); this.recording = true; this.recordBuffer = new Float32Array(8192); this.recordOffset = 0;}
        else this.finishRecording();
      }
    } catch (error) {this.port.postMessage({type: 'error', message: String(error?.message ?? error)});}
  }
  flushRecording() {
    if (!this.recordBuffer || !this.recordOffset) return;
    const buffer = this.recordOffset === this.recordBuffer.length ? this.recordBuffer : this.recordBuffer.slice(0, this.recordOffset);
    this.port.postMessage({type: 'record', data: buffer}, [buffer.buffer]);
    this.recordBuffer = this.recording ? new Float32Array(8192) : null; this.recordOffset = 0;
  }
  finishRecording(notify = true) {
    const wasRecording = this.recording; this.recording = false; this.flushRecording();
    if (notify && wasRecording) this.port.postMessage({type: 'record-ended'});
  }
  process(inputs, outputs) {
    const output = outputs[0]; if (!output?.length) return true;
    const input = inputs[0] ?? [], inLeft = input[0], inRight = input[1] ?? inLeft;
    const outLeft = output[0], outRight = output[1] ?? output[0];
    try {
      for (let i = 0; i < outLeft.length; i++) {
        const pair = this.failed ? this.runtime.output.fill(0) : this.runtime.process(inLeft?.[i] ?? 0, inRight?.[i] ?? 0);
        outLeft[i] = pair[0]; outRight[i] = pair[1];
        this.peakL = Math.max(this.peakL, Math.abs(pair[0])); this.peakR = Math.max(this.peakR, Math.abs(pair[1])); this.energy += (pair[0] ** 2 + pair[1] ** 2) * .5; this.meterCount++;
        if (this.recording) {
          this.recordBuffer[this.recordOffset++] = pair[0]; this.recordBuffer[this.recordOffset++] = pair[1];
          if (this.recordOffset === this.recordBuffer.length) this.flushRecording();
        }
      }
      if (this.meterCount >= this.rate / 25) {
        const mod = this.runtime.modulation;
        this.port.postMessage({type: 'meter', peakL: this.peakL, peakR: this.peakR, rms: Math.sqrt(this.energy / this.meterCount), beat: this.runtime.frame / this.rate * mod.base.bpm / 60, step: mod.step, steps: {...mod.steps}, mods: Array.from(mod.values), graphs: Array.from(mod.graphValues), latency: this.runtime.latency});
        this.meterCount = 0; this.peakL = this.peakR = this.energy = 0;
      }
    } catch (error) {
      outLeft.fill(0); outRight.fill(0);
      if (!this.failed) this.port.postMessage({type: 'error', message: String(error?.message ?? error)});
      this.failed = true;
    }
    return true;
  }
}
if (typeof globalThis.registerProcessor === 'function') globalThis.registerProcessor('destructor-processor', DestructorProcessor);
