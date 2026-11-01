import test from 'node:test';
import assert from 'node:assert/strict';
import { TimeRack } from '../time-core.mjs';

const RATE = 12000;
function signal(n, right = false) { return Math.sin(n / RATE * Math.PI * 2 * (right ? 431 : 220)) * .3; }
function render(time, seconds = 1.5, hook) {
  const rack = new TimeRack(RATE), l = new Float32Array(RATE * seconds), r = new Float32Array(l.length);
  for (let n = 0; n < l.length; n++) {
    hook?.(n, time);
    const out = rack.process(signal(n), signal(n, true), time, n, 120);
    assert.ok(Number.isFinite(out[0]) && Number.isFinite(out[1]), `finite at ${n}`);
    l[n] = out[0]; r[n] = out[1];
  }
  return { l, r, rack };
}
function energy(a, from = RATE / 2) { let v = 0; for (let n = from; n < a.length; n++) v += a[n] * a[n]; return v / Math.max(1, a.length - from); }
function difference(a, b) { let sum = 0; for (let n = RATE / 2; n < a.length; n++) sum += Math.abs(a[n] - b[n]); return sum / (a.length - RATE / 2); }

test('all disabled engines preserve stereo exactly and reuse output pair', () => {
  const rack = new TimeRack(RATE), first = rack.process(.123, -.456, {}, 0, 120);
  assert.equal(first[0], .123); assert.equal(first[1], -.456);
  assert.equal(rack.process(-.2, .4, {}, 1, 120), first);
  assert.equal(first[0], -.2); assert.equal(first[1], .4);
});

test('each time engine produces finite non-silent stereo and changes the sound', () => {
  const dry = render({});
  for (const [engine, params] of Object.entries({
    stretch: { speed: .2, pitch: .65, scatter: .3, spread: .5 },
    vari: { speed: .47, wow: .3, saturation: .2, scratch: .5 },
    stutter: { rate: .3, capture: .7, pitch: .62, decay: .15, pan: .5 }
  })) {
    const out = render({ [engine]: { on: true, mix: 1, ...params } });
    assert.ok(energy(out.l) > .00001, `${engine} non-silent`);
    assert.ok(difference(out.l, dry.l) > .01, `${engine} changes signal`);
    assert.ok(difference(out.l, out.r) > .01, `${engine} retains stereo`);
  }
});

test('varispeed playback rate shifts measured sine frequency', () => {
  const { l } = render({ vari: { on: true, speed: .5, tempo: 0, mix: 1 } }, 1.5);
  let crossings = 0;
  for (let n = RATE / 2; n < l.length - 1; n++) if (l[n] <= 0 && l[n + 1] > 0) crossings++;
  assert.ok(crossings >= 105 && crossings <= 115, `half-speed should be 110 Hz; measured ${crossings}`);
});

test('tape stop ramps down to silence and release returns', () => {
  const p = { vari: { on: true, speed: 1, mix: 1, stop: false } };
  const out = render(p, 4, (n, t) => { if (n === RATE / 2) t.vari.stop = true; if (n === RATE * 3) t.vari.stop = false; });
  let stopped = 0, resumed = 0;
  for (let n = RATE * 2.5; n < RATE * 3; n++) stopped += out.l[n] ** 2;
  for (let n = RATE * 3.5; n < RATE * 4; n++) resumed += out.l[n] ** 2;
  assert.ok(stopped / (RATE * .5) < .00001, `stop RMS ${Math.sqrt(stopped / (RATE * .5))}`);
  assert.ok(resumed / (RATE * .5) > .001);
});

test('stutter zero probability is dry passthrough', () => {
  const out = render({ stutter: { on: true, probability: 0, mix: 1 } });
  for (let n = 0; n < out.l.length; n++) assert.ok(Math.abs(out.l[n] - signal(n)) < 1e-7);
});

test('stutter repeats retain exact grid period at neutral pitch', () => {
  const rack = new TimeRack(RATE), p = { stutter: { on: true, rate: .5, capture: 0, pitch: .5, smooth: 1 } };
  for (let n = 0; n < RATE; n++) rack.process(signal(n), signal(n), p, n, 120);
  const s = rack.stutter, firstRepeat = s.repeat;
  for (let n = RATE; n < RATE + s.slice; n++) rack.process(signal(n), signal(n), p, n, 120);
  assert.equal(s.repeat - firstRepeat, 1, 'one slice period produces exactly one repeat');
});

test('rearming with silence never reuses invalid audio from an earlier take', () => {
  const rack = new TimeRack(RATE), p = { vari: { on: true, mode: 'REVERSE', speed: .9, tempo: 0 } };
  for (let n = 0; n < RATE; n++) rack.process(signal(n), signal(n), p, n, 120);
  p.vari.on = false;
  for (let n = 0; n < RATE / 10; n++) rack.process(0, 0, p, n, 120);
  p.vari.on = true;
  for (let n = 0; n < RATE; n++) {
    const out = rack.process(0, 0, p, n, 120);
    assert.equal(out[0], 0); assert.equal(out[1], 0);
  }
});

test('sequencer gate preserves capture history while fading to dry', () => {
  const rack = new TimeRack(RATE), p = { stutter: { on: true, sync: false, rate: .2, capture: 0, seqGate: true } };
  for (let n = 0; n < RATE; n++) rack.process(signal(n), signal(n), p, n, 120);
  const filled = rack.stutter.filled;
  p.stutter.seqGate = false;
  for (let n = RATE; n < RATE + RATE / 5; n++) rack.process(signal(n), signal(n), p, n, 120);
  assert.ok(rack.stutter.filled > filled, 'capturing continues through disabled sequence steps');
  const n = RATE + RATE / 5, out = rack.process(signal(n), signal(n), p, n, 120);
  assert.ok(Math.abs(out[0] - signal(n)) < 1e-6, 'gate settles to dry');
});

test('freeze captures historical audio and does not follow a silent input', () => {
  const rack = new TimeRack(RATE);
  const p = { stutter: { on: true, sync: false, rate: .2, capture: .5, freeze: false, mix: 1, gate: 0 } };
  let heldEnergy = 0;
  for (let n = 0; n < RATE * 2; n++) {
    if (n === RATE) p.stutter.freeze = true;
    const x = n < RATE ? signal(n) : 0;
    const out = rack.process(x, x, p, n, 120);
    if (n > RATE * 1.5) heldEnergy += out[0] ** 2;
  }
  assert.ok(heldEnergy > 1, 'frozen buffer continues after input stops');
});

test('all BendIt warp and fracture zones stay finite across reconfiguration and reset', () => {
  const p = { order: 'parallel', stretch: { on: true, freeze: false, pitch: .9, scatter: 1, spread: 1 }, vari: { on: true, speed: .1, wow: 1, compress: 1, saturation: 1, model: 1 }, stutter: { on: true, bend: true, rate: .2, capture: .25, warp: 0, break: 0, reps: .8, width: 1, duck: .9 } };
  const out = render(p, 2, (n, t) => { t.stutter.warp = (Math.floor(n / 1000) % 8) / 7; t.stutter.break = (Math.floor(n / 1400) % 6) / 5; });
  assert.ok(energy(out.l) > 0);
  out.rack.reset();
  for (let n = 0; n < 1000; n++) {
    const a = out.rack.process(0, 0, p, n, 120);
    assert.equal(a[0], 0); assert.equal(a[1], 0);
  }
});

test('serial routing orders produce distinct output', () => {
  const base = () => ({ stretch: { on: true, speed: .4, pitch: .7, scatter: .4 }, vari: { on: true, speed: .7, saturation: .7 }, stutter: { on: true, rate: .4, pitch: .3 } });
  const a = render({ ...base(), order: 'stretch-vari-stutter' });
  const b = render({ ...base(), order: 'stutter-stretch-vari' });
  assert.ok(difference(a.l, b.l) > .005);
});
