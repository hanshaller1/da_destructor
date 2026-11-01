/* Original stereo time-domain processors. All public controls are normalized. */
const TAU = Math.PI * 2;
const CAPTURE_BEATS = [16, 8, 4, 2, 1, .5, .25, .125, .0625];
const SLICE_BEATS = [1 / 64, 1 / 32, 1 / 16, 1 / 8, 1 / 4, 1 / 2, 1];
const LINK_PAIRS = [[1 / 64, .25], [1 / 32, .25], [1 / 32, .5], [1 / 16, .5], [1 / 16, 1], [1 / 8, 1], [1 / 8, 2], [1 / 4, 1], [1 / 4, 2], [1 / 4, 4], [1 / 2, 2], [1 / 2, 4], [1, 4], [1, 8]];
const LURCH_RATES = [4, 2, .5, .25, 1];
const SLIP_RATES = [2, .5, 1];
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, Number.isFinite(x) ? x : a));
const norm = (p, k, d) => p[k] === undefined ? d : clamp(p[k]);
const wrap = (x, n) => ((x % n) + n) % n;
const pitchRatio = n => 2 ** ((clamp(n) * 24 - 12) / 12);
const division = (v, list) => list[Math.round(clamp(v) * (list.length - 1))];
const sample = (a, x) => {
  const p = wrap(x, a.length), i = Math.floor(p), f = p - i;
  return a[i] + (a[(i + 1) % a.length] - a[i]) * f;
};

class Engine {
  constructor(rate, seconds = 2) {
    this.rate = rate;
    this.size = Math.ceil(rate * seconds) + 8;
    this.l = new Float32Array(this.size);
    this.r = new Float32Array(this.size);
    this.out = new Float64Array(2);
    this.fadeStep = 1 / (rate * .01);
    this.rng = 0x6a09e667;
    this.reset();
  }
  reset() {
    this.l.fill(0); this.r.fill(0);
    this.write = 0; this.filled = 0; this.fade = 0; this.wasOn = false; this.mix = 0;
    this.age = 0; this.rng = 0x6a09e667; this.out.fill(0);
    this.clear();
  }
  clear() {}
  random() {
    let s = this.rng;
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    this.rng = s;
    return (s >>> 0) / 4294967296;
  }
  push(l, r) {
    this.l[this.write] = l; this.r[this.write] = r;
    this.write = (this.write + 1) % this.size;
    this.filled = Math.min(this.filled + 1, this.size - 2);
  }
  begin(p) {
    const on = !!p.on;
    if (on && !this.wasOn) {
      // Logical invalidation avoids clearing a multi-second stereo buffer in the audio callback.
      // Reads in all engines stay inside the freshly captured region (or return zero).
      this.write = 0; this.filled = 0; this.age = 0; this.fade = 0; this.mix = 0;
      this.clear();
    }
    this.wasOn = on;
    this.fade = clamp(this.fade + (on ? this.fadeStep : -this.fadeStep));
    return on || this.fade > 0;
  }
  read(a, position) {
    const pos = wrap(position, this.size);
    if (this.filled < this.size - 2 && (pos > this.write - 2 || pos < 0)) return 0;
    return sample(a, pos);
  }
  finish(l, r, wetL, wetR, mix) {
    this.mix += (this.fade * clamp(mix) - this.mix) / Math.max(1, this.rate * .004);
    const a = this.mix;
    this.out[0] = l + ((Number.isFinite(wetL) ? wetL : 0) - l) * a;
    this.out[1] = r + ((Number.isFinite(wetR) ? wetR : 0) - r) * a;
    return this.out;
  }
  dry(l, r) { this.out[0] = l; this.out[1] = r; return this.out; }
}

class Stretch extends Engine {
  clear() {
    this.scan = 0; this.phaseA = 0; this.phaseB = .5;
    this.posA = this.posB = 0; this.rateA = this.rateB = 1;
    this.lengthA = this.lengthB = Math.max(32, this.rate * .08);
    this.started = false; this.captureStart = 0; this.window = 0;
    this.previousCycle = -1;
  }
  launch(which, p, length, window) {
    const scattered = this.scan + (this.random() - .5) * norm(p, 'scatter', 0) * window;
    const pos = this.captureStart + wrap(scattered - this.captureStart, window);
    const ratio = p.linked ? Math.max(.01, norm(p, 'speed', 1)) : pitchRatio(norm(p, 'pitch', .5));
    if (which === 0) { this.posA = pos; this.rateA = ratio * (p.reverse ? -1 : 1); this.lengthA = length; }
    else { this.posB = pos; this.rateB = ratio * (p.reverse ? -1 : 1); this.lengthB = length; }
  }
  process(l, r, p, frame, bpm) {
    if (!this.begin(p)) return this.dry(l, r);
    if (!p.freeze || !this.started) this.push(l, r);
    const beat = this.rate * 60 / bpm;
    const desiredWindow = Math.min(this.size - 4, Math.max(64, beat * division(norm(p, 'tempo', .5), CAPTURE_BEATS)));
    const desiredGrain = p.sync === false
      ? this.rate / (5 + norm(p, 'grain', .4) * 95)
      : beat * (1 / 128) * 2 ** (norm(p, 'grain', .4) * 5);
    const grain = Math.max(32, Math.min(this.rate * .4, desiredGrain));
    if (this.filled < Math.min(desiredWindow, grain * 2 + 4)) return this.dry(l, r);
    const window = Math.min(desiredWindow, this.filled - 2);
    const cycle = Math.floor(frame / desiredWindow);
    if (!this.started || (!p.freeze && cycle !== this.previousCycle)) {
      this.window = window;
      this.captureStart = this.write - window;
      if (!this.started) {
        this.scan = this.captureStart + Math.min(grain, window * .25);
        this.launch(0, p, grain, window); this.launch(1, p, grain, window);
        this.posB -= this.rateB * grain * .5;
        this.started = true;
      } else {
        this.scan = this.captureStart + wrap(this.scan - this.captureStart, window);
      }
      this.previousCycle = cycle;
    }
    const currentWindow = this.window || window;
    this.scan = this.captureStart + wrap(this.scan + norm(p, 'speed', 1) - this.captureStart, currentWindow);
    const wa = .5 - .5 * Math.cos(TAU * this.phaseA), wb = .5 - .5 * Math.cos(TAU * this.phaseB);
    const total = Math.max(.001, wa + wb);
    const pa = this.captureStart + wrap(this.posA - this.captureStart, currentWindow);
    const pb = this.captureStart + wrap(this.posB - this.captureStart, currentWindow);
    const aL = sample(this.l, pa), aR = sample(this.r, pa), bL = sample(this.l, pb), bR = sample(this.r, pb);
    const spread = norm(p, 'spread', .2);
    const wetL = (aL * wa * (1 + spread * .45) + bL * wb * (1 - spread * .45)) / total;
    const wetR = (aR * wa * (1 - spread * .45) + bR * wb * (1 + spread * .45)) / total;
    this.posA += this.rateA; this.posB += this.rateB;
    this.phaseA += 1 / this.lengthA; this.phaseB += 1 / this.lengthB;
    if (this.phaseA >= 1) { this.phaseA -= 1; this.launch(0, p, grain, currentWindow); }
    if (this.phaseB >= 1) { this.phaseB -= 1; this.launch(1, p, grain, currentWindow); }
    return this.finish(l, r, wetL, wetR, norm(p, 'mix', 1));
  }
}

class Varispeed extends Engine {
  clear() {
    this.head = this.oldHead = 0; this.started = false; this.previousCycle = -1;
    this.rebase = 1; this.motor = 1; this.playback = 1; this.env = 0; this.lastWet = 0;
    this.direction = 1; this.pendingDirection = 1; this.scratchValue = 0;
  }
  process(l, r, p, frame, bpm) {
    if (!this.begin(p)) return this.dry(l, r);
    this.push(l, r);
    const latency = this.rate * .025;
    if (this.filled < latency + 4) return this.dry(l, r);
    const beat = this.rate * 60 / bpm;
    const capture = Math.max(this.rate * .04, Math.min(this.size - 4, beat * division(norm(p, 'tempo', .5), CAPTURE_BEATS)));
    const cycle = Math.floor(frame / capture);
    if (!this.started) { this.head = this.write - latency; this.started = true; }
    else if (cycle !== this.previousCycle) {
      this.oldHead = this.head; this.head = this.write - latency;
      this.rebase = 0;
    }
    this.previousCycle = cycle;
    let mode = typeof p.mode === 'string' ? p.mode : Math.round(clamp(p.mode ?? 0, 0, 2) * (p.mode > 1 ? 1 : 2));
    let direction = mode === 2 || mode === 'REVERSE' ? -1 : mode === 1 || mode === 'FWD-REV' ? (cycle % 2 ? -1 : 1) : 1;
    const scratch = (norm(p, 'scratch', .5) - .5) * 2;
    this.scratchValue += (scratch - this.scratchValue) * (1 - Math.exp(-1 / (this.rate * .003)));
    let rate = norm(p, 'speed', 1) + this.scratchValue * 3;
    if (rate < 0) { direction *= -1; rate = -rate; }
    this.pendingDirection = direction;
    // Defer direction reversal to a near-zero crossing; a short rebase fade remains a fallback.
    if (this.direction !== direction && (Math.abs(this.lastWet) < .025 || this.age % 128 === 0)) {
      this.oldHead = this.head; this.rebase = 0; this.direction = direction;
    }
    const motorTarget = p.stop ? 0 : 1;
    this.motor += (motorTarget - this.motor) / (this.rate * (p.stop ? .18 : .1));
    if (p.stop && this.motor < .0005) this.motor = 0;
    const wow = norm(p, 'wow', 0);
    const wobble = 1 + wow * (.035 * Math.sin(TAU * frame / this.rate * .5) + .009 * Math.sin(TAU * frame / this.rate * 6));
    const targetRate = Math.min(4, rate) * this.direction * this.motor * wobble;
    this.playback += (targetRate - this.playback) / (this.rate * .003);
    let wetL = this.read(this.l, this.head), wetR = this.read(this.r, this.head);
    if (this.rebase < 1) {
      const a = this.rebase;
      wetL = this.read(this.l, this.oldHead) * (1 - a) + wetL * a;
      wetR = this.read(this.r, this.oldHead) * (1 - a) + wetR * a;
      this.rebase = Math.min(1, this.rebase + 1 / (this.rate * .01));
      this.oldHead += this.playback;
    }
    this.head += this.playback;
    const saturation = norm(p, 'saturation', 0);
    if (saturation > 0) {
      const drive = 1 + saturation * 12;
      if (p.model === 1 || p.model === 'BITCRUSH') {
        const steps = 2 ** Math.max(2, 16 - saturation * 14);
        wetL = Math.round(Math.tanh(wetL * drive) * steps) / steps;
        wetR = Math.round(Math.tanh(wetR * drive) * steps) / steps;
      } else {
        wetL = Math.tanh(wetL * drive) / Math.sqrt(drive);
        wetR = Math.tanh(wetR * drive) / Math.sqrt(drive);
      }
    }
    const peak = Math.max(Math.abs(wetL), Math.abs(wetR));
    this.env += (peak - this.env) / (this.rate * (peak > this.env ? .003 : .12));
    const compress = norm(p, 'compress', 0);
    const gain = (1 + compress * .6) / (1 + Math.max(0, this.env - .2) * compress * 5);
    wetL *= gain; wetR *= gain;
    // A stationary tape head must become silent rather than emit DC.
    const stopFade = Math.min(1, Math.abs(this.playback) * 20);
    wetL *= stopFade; wetR *= stopFade;
    this.lastWet = (wetL + wetR) * .5; this.age++;
    return this.finish(l, r, wetL, wetR, norm(p, 'mix', 1));
  }
}

class Stutter extends Engine {
  constructor(rate) { super(rate, 18); }
  clear() {
    this.anchor = this.oldAnchor = 0; this.loopPos = 0; this.slice = 64;
    this.cycle = -1; this.repeat = 0; this.triggered = true; this.started = false;
    this.captureFade = 1; this.warpRate = 1; this.breakOffset = 0; this.dropout = false;
    this.smoothedRate = 1; this.previousBend = false;
  }
  bendLoop(p, frame, beat) {
    const warp = norm(p, 'warp', 0), fracture = norm(p, 'break', 0);
    let ratio = 1;
    if (warp >= .85) ratio = 2 ** ((this.random() * 2 - 1) * 3);
    else if (warp >= .7) {
      const q = Math.floor(frame / (beat * .5)) % 8;
      const pattern = q % 4;
      ratio = pattern === 0 ? -1 : pattern === 1 ? 2 : pattern === 2 ? -.5 : .5;
    } else if (warp >= .55) ratio = this.random() < .5 ? .1 : this.random() < .5 ? 4 : 2;
    else if (warp >= .4) ratio = LURCH_RATES[Math.floor(this.random() * 5)];
    else if (warp >= .25) ratio = SLIP_RATES[Math.floor(this.random() * 3)];
    else if (warp >= .1) ratio = .5 + this.random();
    this.warpRate = ratio;
    const reps = warp >= .7 && warp < .85 ? 1 : 1 + Math.round(norm(p, 'reps', .2) * 31);
    this.breakOffset = 0; this.dropout = false;
    if (fracture >= .1) {
      const sub = this.slice / reps;
      if (fracture < .25) this.breakOffset = (this.repeat % reps) * sub;
      else if (this.random() < Math.min(.9, fracture)) this.breakOffset = Math.floor(this.random() * reps) * sub;
      if (fracture >= .7) this.dropout = this.random() < (fracture - .7) * 2.4;
    }
  }
  capture(p, slice, frame, beat) {
    this.oldAnchor = this.anchor;
    this.anchor = this.write - slice - 2;
    this.slice = slice; this.loopPos = 0; this.repeat = 0;
    this.captureFade = this.started ? 0 : 1;
    this.triggered = this.random() <= norm(p, 'probability', 1);
    this.started = true;
    if (p.bend) this.bendLoop(p, frame, beat);
  }
  process(l, r, p, frame, bpm) {
    if (!this.begin(p)) return this.dry(l, r);
    if (!p.freeze || !this.started) this.push(l, r);
    const beat = this.rate * 60 / bpm;
    let slice = p.sync === false
      ? this.rate * (.01 + norm(p, 'rate', .45) * .49)
      : beat * division(norm(p, 'rate', .45), SLICE_BEATS);
    let linkedCapture = 0;
    if (p.link && p.sync !== false && !p.bend) {
      const pair = LINK_PAIRS[Math.round(norm(p, 'rate', .45) * 13)];
      slice = beat * pair[0]; linkedCapture = beat * pair[1];
    }
    const pattern = p.pattern || 'EVEN';
    if (pattern === 'DOTTED') slice *= 1.5;
    else if (pattern === 'TRIPLET') slice *= 2 / 3;
    else if (pattern === 'SWING') slice *= Math.floor(frame / Math.max(16, slice)) % 2 ? .8 : 1.2;
    else if (pattern === 'RAMP UP') slice *= 2 ** (-(Math.floor(frame / beat) % 4) * .5);
    else if (pattern === 'RAMP DOWN') slice *= 2 ** ((Math.floor(frame / beat) % 4) * .5);
    if (p.bend) {
      const captureLength = p.sync === false ? this.rate * (.01 + norm(p, 'capture', .5) * 17.99)
        : beat * (1 / 8) * 2 ** (norm(p, 'capture', .5) * 7);
      const reps = norm(p, 'warp', 0) >= .7 && norm(p, 'warp', 0) < .85 ? 1 : 1 + Math.round(norm(p, 'reps', .2) * 31);
      slice = captureLength / reps;
    }
    slice = Math.max(16, Math.min(this.size - 8, Math.round(slice)));
    const captureWindow = p.bend ? Math.max(slice, p.sync === false ? this.rate * (.01 + norm(p, 'capture', .5) * 17.99) : beat * (1 / 8) * 2 ** (norm(p, 'capture', .5) * 7))
      : linkedCapture || beat * division(norm(p, 'capture', .5), CAPTURE_BEATS);
    const cycle = Math.floor(frame / Math.max(slice, captureWindow));
    if (this.filled < slice + 4) return this.dry(l, r);
    if (this.previousBend !== !!p.bend) { this.started = false; this.previousBend = !!p.bend; }
    if (!this.started || (!p.freeze && cycle !== this.cycle)) this.capture(p, slice, frame, beat);
    this.cycle = cycle;
    if (!this.triggered) return this.dry(l, r);
    const ramp = (norm(p, 'ramp', .5) * 24 - 12) * Math.min(32, this.repeat);
    const ratio = Math.min(16, Math.max(1 / 16, pitchRatio(norm(p, 'pitch', .5)) * 2 ** (ramp / 12)));
    let targetRate = p.bend ? this.warpRate : ratio;
    if (p.reverse) targetRate *= -1;
    const slew = p.bend && norm(p, 'warp', 0) > .55 ? .012 : .001;
    this.smoothedRate += (targetRate - this.smoothedRate) / Math.max(1, this.rate * slew);
    const pos = wrap(this.loopPos + this.breakOffset, this.slice);
    const xf = Math.min(this.slice * .25, this.rate * (.005 + norm(p, 'smooth', .3) * .045));
    let wetL = sample(this.l, this.anchor + pos), wetR = sample(this.r, this.anchor + pos);
    if (this.smoothedRate >= 0 && pos > this.slice - xf) {
      const t = (pos - (this.slice - xf)) / xf;
      wetL = wetL * (1 - t) + sample(this.l, this.anchor + pos - (this.slice - xf)) * t;
      wetR = wetR * (1 - t) + sample(this.r, this.anchor + pos - (this.slice - xf)) * t;
    } else if (this.smoothedRate < 0 && pos < xf) {
      const t = 1 - pos / xf;
      wetL = wetL * (1 - t) + sample(this.l, this.anchor + this.slice - xf + pos) * t;
      wetR = wetR * (1 - t) + sample(this.r, this.anchor + this.slice - xf + pos) * t;
    }
    if (this.captureFade < 1) {
      const a = this.captureFade;
      wetL = sample(this.l, this.oldAnchor + pos) * (1 - a) + wetL * a;
      wetR = sample(this.r, this.oldAnchor + pos) * (1 - a) + wetR * a;
      this.captureFade = Math.min(1, this.captureFade + 1 / Math.max(16, xf));
    }
    const phase = pos / this.slice;
    const gate = norm(p, 'gate', .15), open = Math.max(.04, 1 - gate * .95);
    let env = phase < open ? Math.min(1, phase * this.slice / Math.max(8, xf * .2), (open - phase) * this.slice / Math.max(8, xf * .2)) : 0;
    if (p.gateCurve === 'EXP') env *= env;
    else if (p.gateCurve === 'LOG') env = Math.sqrt(Math.max(0, env));
    env *= (1 - norm(p, 'decay', 0)) ** Math.min(64, this.repeat * .35);
    if (p.bend) {
      // Tukey window hides discontinuities at pitch/rate/direction changes.
      const edge = Math.min(.2, xf / this.slice);
      const t = phase < edge ? phase / edge : phase > 1 - edge ? (1 - phase) / edge : 1;
      env *= .5 - .5 * Math.cos(Math.PI * clamp(t));
      if (this.dropout) env = 0;
      const mid = (wetL + wetR) * .5, side = (wetL - wetR) * .5 * (1 + norm(p, 'width', 0) * 3);
      wetL = mid + side; wetR = mid - side;
      const duck = (norm(p, 'duck', .5) - .5) * 2;
      if (duck > 0) env /= 1 + Math.max(Math.abs(l), Math.abs(r)) * duck * 12;
      else if (duck < 0) { const d = 1 / (1 + Math.max(Math.abs(wetL), Math.abs(wetR)) * -duck * 12); l *= d; r *= d; }
    }
    const pan = norm(p, 'pan', 0) * (this.repeat % 2 ? 1 : -1);
    wetL *= env * Math.sqrt(1 - pan); wetR *= env * Math.sqrt(1 + pan);
    this.loopPos += this.smoothedRate;
    if (this.loopPos >= this.slice || this.loopPos < 0) {
      this.loopPos = wrap(this.loopPos, this.slice);
      // Keep the musical period exact; the edge envelope masks the crossfade seam.
      this.repeat++;
      if (!p.freeze && this.random() < norm(p, 'retrigger', 0)) this.capture(p, this.slice, frame, beat);
      if (p.bend) this.bendLoop(p, frame, beat);
    }
    return this.finish(l, r, wetL, wetR, p.seqGate === false ? 0 : norm(p, 'mix', 1));
  }
}

const OFF = Object.freeze({ on: false });

export class TimeRack {
  constructor(sampleRate = 48000) {
    this.rate = Math.max(8000, Math.min(192000, Number(sampleRate) || 48000));
    this.stretch = new Stretch(this.rate);
    this.vari = new Varispeed(this.rate);
    this.stutter = new Stutter(this.rate);
    this.out = new Float64Array(2);
  }
  reset() { this.stretch.reset(); this.vari.reset(); this.stutter.reset(); this.out.fill(0); }
  process(left, right, time = {}, frame = 0, bpm = 120) {
    left = Number.isFinite(left) ? left : 0; right = Number.isFinite(right) ? right : 0;
    bpm = clamp(bpm, 20, 400);
    const s = time.stretch || OFF, v = time.vari || OFF, t = time.stutter || OFF;
    let a, b, c;
    if (time.order === 'parallel') {
      a = this.stretch.process(left, right, s, frame, bpm);
      b = this.vari.process(left, right, v, frame, bpm);
      c = this.stutter.process(left, right, t, frame, bpm);
      // Average deltas, retaining a unity dry path with zero active branches.
      const count = Math.max(1, Number(!!s.on || this.stretch.fade > 0) + Number(!!v.on || this.vari.fade > 0) + Number(!!t.on || this.stutter.fade > 0));
      this.out[0] = left + ((a[0] - left) + (b[0] - left) + (c[0] - left)) / count;
      this.out[1] = right + ((a[1] - right) + (b[1] - right) + (c[1] - right)) / count;
    } else if (time.order === 'vari-stretch-stutter') {
      a = this.vari.process(left, right, v, frame, bpm);
      b = this.stretch.process(a[0], a[1], s, frame, bpm);
      c = this.stutter.process(b[0], b[1], t, frame, bpm);
      this.out[0] = c[0]; this.out[1] = c[1];
    } else if (time.order === 'stutter-stretch-vari') {
      a = this.stutter.process(left, right, t, frame, bpm);
      b = this.stretch.process(a[0], a[1], s, frame, bpm);
      c = this.vari.process(b[0], b[1], v, frame, bpm);
      this.out[0] = c[0]; this.out[1] = c[1];
    } else {
      a = this.stretch.process(left, right, s, frame, bpm);
      b = this.vari.process(a[0], a[1], v, frame, bpm);
      c = this.stutter.process(b[0], b[1], t, frame, bpm);
      this.out[0] = c[0]; this.out[1] = c[1];
    }
    return this.out;
  }
}
