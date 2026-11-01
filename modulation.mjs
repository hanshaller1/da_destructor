// Original clock, control routing and modulation. No browser dependencies.
export const MOD_BEAT_LENGTHS = Object.freeze([1 / 16, 1 / 8, 1 / 4, .5, 1, 2, 4, 8, 16, 32, 64]);
export const SEQ_BEAT_LENGTHS = Object.freeze([.25, .5, 1, 2, 4]);
export const LFO_SHAPES = Object.freeze(['sine', 'triangle', 'saw', 'ramp', 'square', 'pulse25', 'pulse75', 'exp', 'log', 'peak', 'valley', 'bump', 'double', 'skew', 'stairs', 'sinefold', 'trapezoid', 'samplehold', 'smoothstep']);
const TAU = Math.PI * 2;
const SEQ_NAMES = Object.freeze(['stutter', 'stretch']);
export const clamp01 = value => Math.max(0, Math.min(1, Number.isFinite(+value) ? +value : 0));
const positive = (value, fallback) => Number.isFinite(+value) && +value > 0 ? +value : fallback;
const copy = value => JSON.parse(JSON.stringify(value));
export function beatLength(rate, sequence = false) {
  const values = sequence ? SEQ_BEAT_LENGTHS : MOD_BEAT_LENGTHS;
  return values[Math.round(clamp01(rate) * (values.length - 1))];
}
export function hash01(index, seed = 1) {
  let n = Math.imul((index | 0) ^ Math.imul(seed + 1, 0x45d9f3b), 0x27d4eb2d);
  n ^= n >>> 15; n = Math.imul(n, 0x85ebca6b); n ^= n >>> 13;
  return (n >>> 0) / 4294967296;
}
export function lfoShape(shape, phase) {
  const p = ((phase % 1) + 1) % 1;
  switch (String(shape).toLowerCase()) {
    case 'triangle': case 'tri': return 1 - Math.abs(p * 2 - 1);
    case 'saw': case 'sawdown': return 1 - p;
    case 'ramp': case 'sawup': return p;
    case 'square': return p < .5 ? 1 : 0;
    case 'pulse25': return p < .25 ? 1 : 0;
    case 'pulse75': return p < .75 ? 1 : 0;
    case 'exp': return p ** 3;
    case 'log': return 1 - (1 - p) ** 3;
    case 'peak': return Math.max(0, 1 - Math.abs(p - .5) * 6);
    case 'valley': return Math.min(1, Math.abs(p - .5) * 6);
    case 'bump': return Math.sin(Math.PI * p) ** 4;
    case 'double': case 'dbl': return .5 - .5 * Math.cos(TAU * 2 * p);
    case 'skew': return p < .2 ? p * 5 : (1 - p) / .8;
    case 'stairs': return Math.floor(p * 8) / 7;
    case 'sample': case 's&h': case 'samplehold': return hash01(Math.floor(p * 8), 45);
    case 'sinefold': return Math.abs(Math.sin(TAU * 2 * p));
    case 'trapezoid': return p < .1 ? p * 10 : p < .5 ? 1 : p < .6 ? 1 - (p - .5) * 10 : 0;
    case 'cosine': return .5 + .5 * Math.cos(TAU * p);
    case 'rectify': return Math.abs(Math.sin(TAU * p));
    case 'smoothstep': return p * p * (3 - 2 * p);
    default: return .5 - .5 * Math.cos(TAU * p);
  }
}

export function mapTarget(value, target = {}) {
  const start = clamp01(target.start ?? 0), end = clamp01(target.end ?? 1);
  let v = Math.abs(end - start) < .000001 ? (value >= end ? 1 : 0) : clamp01((value - start) / (end - start));
  const skew = (clamp01(target.skew ?? .5) - .5) * 2;
  if (skew > 0) v = v ** (1 + skew * 4);
  else if (skew < 0) v = 1 - (1 - v) ** (1 - skew * 4);
  if (target.curve === 's' || target.curve === 'smooth') v = v * v * (3 - 2 * v);
  if (target.curve === 'triangle') v = 1 - Math.abs(2 * v - 1);
  return clamp01((target.min ?? 0) + v * ((target.max ?? 1) - (target.min ?? 0)));
}

function graphPoint(point) {
  return Array.isArray(point) ? {x: clamp01(point[0]), y: clamp01(point[1]), curve: (clamp01(point[2] ?? .5) - .5) * 2} : {x: clamp01(point?.x), y: clamp01(point?.y), curve: (clamp01(point?.curve ?? point?.bend ?? .5) - .5) * 2};
}
export function prepareGraph(points) {
  const result = (Array.isArray(points) ? points : [[0, 0], [.5, 1], [1, 0]]).map(graphPoint).sort((a, b) => a.x - b.x);
  if (!result.length) return [{x: 0, y: 0, curve: 0}, {x: 1, y: 0, curve: 0}];
  if (result[0].x > 0) result.unshift({x: 0, y: result[0].y, curve: 0});
  if (result.at(-1).x < 1) result.push({x: 1, y: result[0].y, curve: 0});
  return result;
}
export function graphValue(points, phase) {
  const p = ((phase % 1) + 1) % 1;
  let index = 0;
  while (index < points.length - 2 && p > points[index + 1].x) index++;
  const a = points[index], b = points[index + 1] ?? a;
  const t = clamp01((p - a.x) / Math.max(.000001, b.x - a.x));
  // Cubic Bezier in value: opposite control offsets keep endpoints exact.
  const bend = Math.max(-1, Math.min(1, a.curve));
  const c1 = clamp01(a.y + (b.y - a.y) / 3 + bend * .6);
  const c2 = clamp01(a.y + (b.y - a.y) * 2 / 3 + bend * .6);
  return clamp01((1 - t) ** 3 * a.y + 3 * (1 - t) ** 2 * t * c1 + 3 * (1 - t) * t * t * c2 + t ** 3 * b.y);
}

export function defaultState() {
  return {
    bpm: 120, playing: false, bypass: false,
    time: {order: 'stretch-vari-stutter', stretch: {on: false, speed: 1, tempo: .5, grain: .4, pitch: .5, spread: .2, scatter: 0, mix: 1, reverse: false, freeze: false, linked: false, sync: true}, vari: {on: false, speed: 1, tempo: .5, mode: 0, wow: 0, saturation: 0, compress: 0, mix: 1, stop: false, scratch: .5, model: 0}, stutter: {on: false, bend: false, sync: true, rate: .45, capture: .5, pitch: .5, ramp: .5, gate: .15, decay: 0, pan: 0, probability: 1, retrigger: 0, smooth: .3, mix: 1, reverse: false, freeze: false, warp: 0, break: 0, reps: .2, width: 0, duck: .5, link: false, pattern: 'EVEN', gateCurve: 'LINEAR'}},
    fx: [], fxMode: 'serial',
    main: {gain: .5, low: .5, mid: .5, high: .5, pan: .5, mix: 1, compress: 0},
    mods: Array.from({length: 4}, () => ({type: 'lfo', shape: 'sine', rate: .4, depth: 1, smooth: .1, jitter: 0, gain: .5, rise: .1, fall: .4, tone: .5, targets: []})),
    graphs: Array.from({length: 3}, () => ({points: [[0, 0], [.5, 1], [1, 0]], rate: .5, reverse: false, targets: []})),
    macros: Array.from({length: 4}, () => ({value: 0, targets: []})),
    xy: {x: .5, y: .5, targetsX: [], targetsY: []},
    seq: {stutter: {on: false, rate: .5, patterns: 1, steps: Array.from({length: 64}, () => ({on: true, value: .5}))}, stretch: {on: false, rate: .5, patterns: 1, steps: Array.from({length: 64}, () => ({on: true, value: 1}))}}
  };
}

export function sanitizeState(raw = {}) {
  const initial = defaultState();
  const merge = (base, data) => {
    if (!data || typeof data !== 'object') return base;
    for (const key of Object.keys(data)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
      const value = data[key];
      if (Array.isArray(value)) base[key] = copy(value);
      else if (value && typeof value === 'object') base[key] = merge(base[key] && typeof base[key] === 'object' ? base[key] : {}, value);
      else if (typeof value === 'number') base[key] = Number.isFinite(value) ? value : 0;
      else if (typeof value === 'boolean' || typeof value === 'string' || value === null) base[key] = value;
    }
    return base;
  };
  const state = merge(initial, raw);
  state.bpm = Math.max(30, Math.min(300, positive(state.bpm, 120)));
  const template = defaultState();
  state.mods = Array.from({length: 4}, (_, i) => ({...template.mods[i], ...(state.mods?.[i] ?? {})}));
  state.graphs = Array.from({length: 3}, (_, i) => ({...template.graphs[i], ...(state.graphs?.[i] ?? {})}));
  state.macros = Array.from({length: 4}, (_, i) => ({value: 0, targets: [], ...(state.macros?.[i] ?? {})}));
  // clamp every continuous parameter; transport/timing counts are validated separately.
  const clampObject = object => {
    for (const key of Object.keys(object)) {
      if (typeof object[key] === 'number') object[key] = clamp01(object[key]);
    }
  };
  Object.values(state.time).forEach(value => { if (value && typeof value === 'object') clampObject(value); });
  clampObject(state.main); state.fx = (Array.isArray(state.fx) ? state.fx : []).slice(0, 62);
  state.fx.forEach(fx => {fx.id = String(fx.id); fx.params ??= {}; clampObject(fx.params); fx.mix = clamp01(fx.mix ?? .5); fx.gain = clamp01(fx.gain ?? .5);});
  state.mods.forEach(mod => {clampObject(mod); mod.targets = Array.isArray(mod.targets) ? mod.targets.slice(0, 6) : [];});
  state.graphs.forEach(graph => {clampObject(graph); graph.targets = Array.isArray(graph.targets) ? graph.targets.slice(0, 6) : [];});
  state.macros.forEach(macro => {macro.value = clamp01(macro.value); macro.targets = Array.isArray(macro.targets) ? macro.targets.slice(0, 5) : [];});
  state.xy.x = clamp01(state.xy.x); state.xy.y = clamp01(state.xy.y);
  state.xy.targetsX = Array.isArray(state.xy.targetsX) ? state.xy.targetsX.slice(0, 5) : [];
  state.xy.targetsY = Array.isArray(state.xy.targetsY) ? state.xy.targetsY.slice(0, 5) : [];
  for (const name of SEQ_NAMES) {
    const seq = state.seq[name]; seq.rate = clamp01(seq.rate); seq.patterns = Math.max(1, Math.min(4, Math.round(+seq.patterns || 1)));
    seq.steps = Array.from({length: 64}, (_, i) => ({on: seq.steps?.[i]?.on !== false, value: clamp01(seq.steps?.[i]?.value ?? (name === 'stretch' ? 1 : .5))}));
  }
  return state;
}

export function resolveTarget(state, path) {
  if (typeof path !== 'string' || path.length > 200) return null;
  const segments = path.split('.');
  if (segments.some(item => item === '__proto__' || item === 'prototype' || item === 'constructor')) return null;
  if (segments[0] === 'fx') {
    const item = state.fx.find(fx => fx.id === segments[1]);
    if (!item || segments.length !== 3 && !(segments.length === 4 && segments[2] === 'params')) return null;
    const key = segments.at(-1);
    const object = key === 'mix' || key === 'gain' ? item : item.params;
    return typeof object?.[key] === 'number' ? {object, key} : null;
  }
  let object = state;
  for (let i = 0; i < segments.length - 1; i++) { object = object?.[segments[i]]; if (!object || typeof object !== 'object') return null; }
  const key = segments.at(-1);
  return typeof object?.[key] === 'number' ? {object, key} : null;
}

export class ModulationEngine {
  constructor(sampleRate = 48000) {
    this.sampleRate = sampleRate;
    this.values = new Float64Array(4); this.graphValues = new Float64Array(3);
    this.env = new Float64Array(4); this.envLow = new Float64Array(4);
    this.envSettings = Array.from({length: 4}, () => ({enabled: false, coefficient: 0, high: false, plain: true, gain: 1, rise: 0, fall: 0}));
    this.phase = new Float64Array(4); this.graphPhase = new Float64Array(3);
    this.lastFrame = -1; this.step = 0; this.steps = {stutter: 0, stretch: 0}; this.pickups = new Map();
    this.configure(defaultState());
  }
  configure(raw) {
    const previous = this.base;
    this.base = sanitizeState(raw); this.effective = copy(this.base);
    this.bindings = []; this.controllerBindings = [];
    const bind = (targets, source, controller = false) => {
      for (const target of targets ?? []) {
        const destination = resolveTarget(this.effective, target.path), origin = resolveTarget(this.base, target.path);
        if (!destination || !origin) continue;
        const binding = {destination, origin, target, source};
        this.bindings.push(binding);
        if (controller) {
          const key = source + ':' + target.path;
          const fingerprint = JSON.stringify(target);
          const oldOrigin = previous ? resolveTarget(previous, target.path) : null;
          let pickup = this.pickups.get(key);
          const manualChanged = oldOrigin && Math.abs(oldOrigin.object[oldOrigin.key] - origin.object[origin.key]) > .000001;
          if (!pickup || pickup.fingerprint !== fingerprint) pickup = {armed: false, last: null, threshold: 0, fingerprint};
          else if (manualChanged) { pickup.armed = true; pickup.threshold = origin.object[origin.key]; }
          pickup.fingerprint = fingerprint; this.pickups.set(key, pickup); binding.pickup = pickup;
          this.controllerBindings.push(binding);
        }
      }
    };
    this.base.mods.forEach((mod, i) => bind(mod.targets, 'm' + i));
    this.base.graphs.forEach((graph, i) => bind(graph.targets, 'g' + i));
    this.base.macros.forEach((macro, i) => bind(macro.targets, 'c' + i, true));
    bind(this.base.xy.targetsX, 'x', true); bind(this.base.xy.targetsY, 'y', true);
    this.preparedGraphs = this.base.graphs.map(graph => prepareGraph(graph.points));
    this.updateEnvelopeSettings();
    this.lastUpdate = -1000;
    return this.effective;
  }
  reset() {
    this.values.fill(0); this.graphValues.fill(0); this.env.fill(0); this.envLow.fill(0); this.phase.fill(0); this.graphPhase.fill(0);
    this.lastFrame = -1; this.lastUpdate = -1000; this.step = 0; this.steps.stutter = 0; this.steps.stretch = 0;
    for (const pickup of this.pickups.values()) {pickup.armed = false; pickup.last = null;}
  }
  // Feed every sample. Source is post-time/pre-FX for INTERNAL envelope mode.
  feedEnvelope(left, right) {
    const input = (left + right) * .5;
    for (let i = 0; i < 4; i++) {
      const settings = this.envSettings[i];
      if (!settings.enabled) continue;
      this.envLow[i] += settings.coefficient * (input - this.envLow[i]);
      const filtered = settings.plain ? input : settings.high ? input - this.envLow[i] : this.envLow[i];
      const peak = Math.abs(filtered) * settings.gain;
      this.env[i] += (peak > this.env[i] ? settings.rise : settings.fall) * (peak - this.env[i]);
    }
  }
  updateEnvelopeSettings() {
    for (let i = 0; i < 4; i++) {
      const mod = this.effective.mods[i], settings = this.envSettings[i];
      settings.enabled = /env|follower/i.test(mod.type);
      const tone = clamp01(mod.tone ?? .5), cutoff = tone < .5 ? 45 * 100 ** (tone * 2) : 120 * 80 ** ((tone - .5) * 2);
      settings.coefficient = 1 - Math.exp(-TAU * Math.min(this.sampleRate * .4, cutoff) / this.sampleRate);
      settings.high = tone >= .5; settings.plain = Math.abs(tone - .5) < .025;
      settings.gain = 10 ** (((mod.gain ?? .5) * 48 - 24) / 20);
      settings.rise = 1 - Math.exp(-1 / (this.sampleRate * (.0005 + clamp01(mod.rise ?? .1) ** 2 * .3)));
      settings.fall = 1 - Math.exp(-1 / (this.sampleRate * (.01 + clamp01(mod.fall ?? .4) ** 2 * 2)));
    }
  }
  tick(frame, bpm = this.base.bpm) {
    const beat = frame / this.sampleRate * bpm / 60;
    if (frame === 0 && this.lastFrame > 0) this.reset();
    if (frame - this.lastUpdate >= 32 || frame < this.lastUpdate) {
      const deltaFrames = this.lastUpdate < 0 || frame < this.lastUpdate ? 0 : frame - this.lastUpdate;
      const deltaBeats = deltaFrames / this.sampleRate * bpm / 60;
      // Snapshot mod-mod values from preceding tick; no algebraic cycles.
      for (let i = 0; i < 4; i++) {
        const mod = this.effective.mods[i], period = beatLength(mod.rate);
        this.phase[i] += deltaBeats / period;
        const jitter = clamp01(mod.jitter ?? 0);
        let cycle = Math.floor(this.phase[i]), p = this.phase[i] - cycle;
        if (jitter > 0) {
          const boundary = .5 + (hash01(cycle, i + 97) - .5) * jitter * .7;
          p = p < boundary ? p / boundary * .5 : .5 + (p - boundary) / (1 - boundary) * .5;
        }
        let value;
        if (/env|follower/i.test(mod.type)) value = clamp01(this.env[i]);
        else if (/rand/i.test(mod.type)) {
          const a = hash01(cycle, i + 1), b = hash01(cycle + 1, i + 1);
          value = mod.bin === true || mod.stepped === true ? a : a + (b - a) * p * p * (3 - 2 * p);
        } else value = lfoShape(mod.shape, p);
        value = clamp01(value * (mod.depth ?? 1));
        const tau = clamp01(mod.smooth ?? 0) ** 2 * .5;
        this.values[i] += tau > .00001 && deltaFrames > 0 ? (1 - Math.exp(-deltaFrames / (this.sampleRate * tau))) * (value - this.values[i]) : value - this.values[i];
      }
      for (let i = 0; i < 3; i++) {
        const graph = this.effective.graphs[i];
        this.graphPhase[i] += deltaBeats / beatLength(graph.rate);
        this.graphValues[i] = graphValue(this.preparedGraphs[i], graph.reverse ? -this.graphPhase[i] : this.graphPhase[i]);
      }
      // Reset destinations to base before applying routes, preventing feedback accumulation.
      for (const binding of this.bindings) binding.destination.object[binding.destination.key] = binding.origin.object[binding.origin.key];
      for (const binding of this.bindings) {
        const source = binding.source;
        const value = source[0] === 'm' ? this.values[+source[1]] : source[0] === 'g' ? this.graphValues[+source[1]] : source[0] === 'c' ? this.base.macros[+source[1]].value : this.base.xy[source];
        const mapped = mapTarget(value, binding.target), pickup = binding.pickup;
        if (pickup?.armed) {
          if (pickup.last !== null && (mapped - pickup.threshold) * (pickup.last - pickup.threshold) <= 0 || Math.abs(mapped - pickup.threshold) <= .006) pickup.armed = false;
          pickup.last = mapped;
          if (pickup.armed) continue;
        } else if (pickup) pickup.last = mapped;
        binding.destination.object[binding.destination.key] = mapped;
      }
      this.updateEnvelopeSettings();
      this.lastUpdate = frame;
    }
    // Sequencers are evaluated per sample for exact clock boundaries.
    for (const name of SEQ_NAMES) {
      const sequence = this.base.seq[name];
      const length = 16 * sequence.patterns;
      const index = Math.floor(beat / beatLength(sequence.rate, true) + 1e-10) % length;
      this.steps[name] = index;
      if (name === 'stutter') this.step = index;
      if (sequence.on) {
        const step = sequence.steps[index];
        if (name === 'stretch') this.effective.time.stretch.speed = step.on ? step.value : this.base.time.stretch.speed;
        else {
          this.effective.time.stutter.on = this.base.time.stutter.on;
          this.effective.time.stutter.seqGate = step.on;
          if (this.base.time.stutter.bend) this.effective.time.stutter.reps = step.value;
          else this.effective.time.stutter.rate = step.value;
        }
      } else if (name === 'stutter') {this.effective.time.stutter.on = this.base.time.stutter.on; this.effective.time.stutter.seqGate = true;}
    }
    this.lastFrame = frame;
    return this.effective;
  }
}
