import test from 'node:test';
import assert from 'node:assert/strict';
import {ModulationEngine, defaultState, lfoShape, LFO_SHAPES, mapTarget, prepareGraph, graphValue, sanitizeState, resolveTarget} from '../modulation.mjs';

test('all LFO shapes stay normalized at wraps and arbitrary phases', () => {
  assert.equal(LFO_SHAPES.length, 19);
  for (const shape of LFO_SHAPES) for (let i = -100; i <= 100; i++) {
    const value = lfoShape(shape, i * .037); assert.ok(Number.isFinite(value) && value >= 0 && value <= 1, shape);
  }
});
test('target curves honor range, reversed intervals, start/end, skew and triangle', () => {
  assert.equal(mapTarget(0, {min: .2, max: .8}), .2);
  assert.equal(mapTarget(1, {min: .2, max: .8}), .8);
  assert.equal(mapTarget(.5, {min: 1, max: 0}), .5);
  assert.equal(mapTarget(.1, {start: .2, end: .8}), 0);
  assert.equal(mapTarget(.9, {start: .2, end: .8}), 1);
  assert.ok(mapTarget(.5, {skew: 1}) < .5);
  assert.equal(mapTarget(.5, {curve: 'triangle'}), 1);
});
test('graph handles are actual cubic curves with exact endpoints', () => {
  const linear = prepareGraph([[0, 0], [1, 1]]), bent = prepareGraph([[0, 0, 1], [1, 1]]);
  assert.equal(graphValue(linear, 0), 0); assert.ok(Math.abs(graphValue(linear, .5) - .5) < 1e-12);
  assert.ok(graphValue(bent, .5) > .5);
  assert.ok(graphValue(bent, -.1) >= 0);
});
test('sanitization restores fixed source counts and rejects unsafe paths', () => {
  const state = sanitizeState({mods: [], graphs: [], macros: [], main: {gain: NaN}, bpm: 999});
  assert.equal(state.mods.length, 4); assert.equal(state.graphs.length, 3); assert.equal(state.macros.length, 4); assert.equal(state.bpm, 300);
  assert.equal(state.main.gain, 0); assert.equal(resolveTarget(state, '__proto__.bad'), null);
});
test('routes address stable FX ids, never mutate base, and support mod-mod', () => {
  const state = defaultState(); state.playing = true;
  state.fx = [{id: 'independent-7', type: 'TAPE', on: true, mix: .5, gain: .5, params: {drive: .2}}];
  state.mods[0] = {...state.mods[0], shape: 'square', rate: 0, smooth: 0, targets: [{path: 'fx.independent-7.drive', min: .3, max: .9}, {path: 'mods.1.rate', min: .1, max: .2}]};
  const engine = new ModulationEngine(1000); engine.configure(state); engine.tick(0, 120);
  assert.ok(Math.abs(engine.effective.fx[0].params.drive - .9) < 1e-12); assert.equal(engine.base.fx[0].params.drive, .2);
  assert.equal(engine.effective.mods[1].rate, .2);
  engine.tick(32, 120); assert.ok(Number.isFinite(engine.values[1]));
});
test('random modulation is deterministic across clock reset', () => {
  const state = defaultState(); state.mods[0].type = 'rand'; state.mods[0].smooth = 0;
  const engine = new ModulationEngine(1000); engine.configure(state);
  const values = [];
  for (let frame = 0; frame <= 32000; frame += 32) {engine.tick(frame, 120); if (!(frame % 1000)) values.push(engine.values[0]);}
  engine.reset(); const repeated = [];
  for (let frame = 0; frame <= 32000; frame += 32) {engine.tick(frame, 120); if (!(frame % 1000)) repeated.push(engine.values[0]);}
  assert.deepEqual(values, repeated); assert.ok(new Set(values).size > 4);
});
test('sequencer boundaries are exact samples and chain up to64steps', () => {
  const state = defaultState(); state.time.stutter.on = true; state.seq.stutter.on = true; state.seq.stutter.rate = 0; state.seq.stutter.patterns = 4;
  state.seq.stutter.steps[1] = {on: false, value: .9}; state.seq.stutter.steps[63] = {on: true, value: .1};
  const engine = new ModulationEngine(1000); engine.configure(state);
  engine.tick(124, 120); assert.equal(engine.steps.stutter, 0); assert.equal(engine.effective.time.stutter.on, true);
  engine.tick(125, 120); assert.equal(engine.steps.stutter, 1); assert.equal(engine.effective.time.stutter.on, true); assert.equal(engine.effective.time.stutter.seqGate, false);
  engine.tick(7875, 120); assert.equal(engine.steps.stutter, 63); assert.equal(engine.effective.time.stutter.rate, .1);
  engine.tick(8000, 120); assert.equal(engine.steps.stutter, 0);
});
test('envelope follows attacks and releases with configured times', () => {
  const state = defaultState(); state.mods[0].type = 'env'; state.mods[0].rise = 0; state.mods[0].fall = 0; state.mods[0].smooth = 0;
  const engine = new ModulationEngine(48000); engine.configure(state);
  for (let frame = 0; frame < 4800; frame++) {engine.feedEnvelope(.5, .5); engine.tick(frame, 120);}
  assert.ok(engine.values[0] > .49 && engine.values[0] < .51);
  for (let frame = 4800; frame < 9600; frame++) {engine.feedEnvelope(0, 0); engine.tick(frame, 120);}
  assert.ok(engine.values[0] < .001);
});
test('macro pickup waits for crossing after a manual destination edit', () => {
  const state = defaultState(); state.macros[0].value = .2; state.macros[0].targets = [{path: 'time.stretch.scatter'}];
  const engine = new ModulationEngine(1000); engine.configure(state); engine.tick(0, 120); assert.equal(engine.effective.time.stretch.scatter, .2);
  state.time.stretch.scatter = .8; engine.configure(state); engine.tick(32, 120); assert.equal(engine.effective.time.stretch.scatter, .8);
  state.macros[0].value = .4; engine.configure(state); engine.tick(64, 120); assert.equal(engine.effective.time.stretch.scatter, .8);
  state.macros[0].value = .9; engine.configure(state); engine.tick(96, 120); assert.equal(engine.effective.time.stretch.scatter, .9);
});
