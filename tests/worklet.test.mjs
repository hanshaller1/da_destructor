import test from 'node:test';
import assert from 'node:assert/strict';
import {MainBus, DestructorRuntime, DestructorProcessor, limitSample} from '../audio-worklet.mjs';
import {defaultState} from '../modulation.mjs';
import {EFFECTS} from '../effects.mjs';

test('neutral MAIN is sample-transparent in stereo and limiter preserves normal levels', () => {
  const bus = new MainBus(48000), state = defaultState().main;
  for (let frame = 0; frame < 10000; frame++) {
    const l = Math.sin(frame * .07) * .6, r = Math.cos(frame * .041) * .3;
    const result = bus.process(l, r, l, r, state, frame);
    assert.ok(Math.abs(result[0] - l) < 1e-10); assert.ok(Math.abs(result[1] - r) < 1e-10);
    assert.equal(limitSample(l), l);
  }
});
test('MAIN low shelf boosts lows while high frequencies stay substantially closer to unity', () => {
  const measure = frequency => {
    const bus = new MainBus(48000), main = {...defaultState().main, low: 1}; let energy = 0;
    for (let frame = 0; frame < 24000; frame++) {const x = Math.sin(frame * 2 * Math.PI * frequency / 48000) * .05; const y = bus.process(x, x, x, x, main, frame); if (frame >= 12000) energy += y[0] ** 2;}
    return Math.sqrt(energy / 12000);
  };
  const low = measure(50), high = measure(6000);
  assert.ok(low > high * 4); assert.ok(high > .03 && high < .045);
});
test('limiter remains finite and bounded without clipping normal levels', () => {
  for (const sample of [-Infinity, Infinity, NaN, -10000, -2, -.98, -.5, 0, .5, .98, 2, 10000]) {
    const output = limitSample(sample); assert.ok(Number.isFinite(output)); assert.ok(Math.abs(output) <= 1);
    if (Math.abs(sample) <= .95) assert.equal(output, sample);
  }
  assert.ok(limitSample(.99) < .99 && limitSample(.99) > .95);
});
test('complete neutral runtime preserves stereo source after start fade', () => {
  const runtime = new DestructorRuntime(48000), state = defaultState(); state.playing = true; runtime.configure(state);
  for (let frame = 0; frame < 12000; frame++) runtime.process(0, 0);
  for (let frame = 0; frame < 1000; frame++) {
    const l = Math.sin(frame * .09) * .4, r = Math.cos(frame * .041) * .2, result = runtime.process(l, r);
    assert.ok(Math.abs(result[0] - l) < 1e-8); assert.ok(Math.abs(result[1] - r) < 1e-8);
  }
});
test('pause stops the internal clock, fades to silence, and reset starts at zero', () => {
  const runtime = new DestructorRuntime(48000), state = defaultState(); state.playing = true; runtime.configure(state);
  for (let i = 0; i < 1000; i++) runtime.process(.2, .2);
  state.playing = false; runtime.configure(state); const frame = runtime.frame;
  let output;
  for (let i = 0; i < 12000; i++) output = runtime.process(.2, .2);
  assert.equal(runtime.frame, frame); assert.ok(Math.abs(output[0]) < 1e-10);
  runtime.reset(); assert.equal(runtime.frame, 0); assert.equal(runtime.playFade, 0);
});
test('MAIN dry reference follows spectral chain latency', () => {
  const descriptor = EFFECTS.find(effect => effect.id === 'CHROMA');
  const runtime = new DestructorRuntime(48000), state = defaultState(); state.playing = true; state.main.mix = 0;
  state.fx = [{id: 'latency', type: 'CHROMA', on: true, mix: 1, gain: .5, params: Object.fromEntries(descriptor.params.map(param => [param.key, param.default]))}];
  runtime.configure(state); assert.ok(runtime.latency > 0 && runtime.latency < 65536);
  for (let i = 0; i < 12000; i++) runtime.process(0, 0);
  const samples = [];
  for (let i = 0; i < runtime.latency + 2; i++) samples.push(runtime.process(i === 0 ? .3 : 0, i === 0 ? -.2 : 0)[0]);
  assert.ok(samples.slice(0, runtime.latency).every(value => Math.abs(value) < 1e-8));
  assert.ok(Math.abs(samples[runtime.latency] - .3) < 1e-7);
});
test('worklet recording delivers full and partial interleaved chunks before completion', () => {
  const processor = new DestructorProcessor(), messages = []; processor.port.postMessage = message => messages.push(message);
  const state = defaultState(); state.playing = true; processor.message({type: 'state', state}); processor.message({type: 'record', active: true});
  const input = [new Float32Array(128).fill(.2), new Float32Array(128).fill(-.1)];
  for (let block = 0; block < 33; block++) processor.process([input], [[new Float32Array(128), new Float32Array(128)]]);
  processor.message({type: 'record', active: false});
  const recordings = messages.filter(message => message.type === 'record');
  assert.equal(recordings.length, 2); assert.equal(recordings[0].data.length, 8192); assert.equal(recordings[1].data.length, 256);
  assert.equal(messages.at(-1).type, 'record-ended');
  assert.ok(recordings.every(message => message.data.every(Number.isFinite)));
  assert.ok(recordings[0].data[6000] > 0 && recordings[0].data[6001] < 0);
});
