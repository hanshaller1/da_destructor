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
  const linear = prepareGraph([[0, 0], [.5,1],[1, 0]]), bent = prepareGraph([[0, 0, 1],[.5,1], [1, 0]]);
  assert.equal(graphValue(linear, 0), 0); assert.ok(Math.abs(graphValue(linear, .25) - .5) < 1e-12);
  assert.ok(graphValue(bent, .25) > .5);
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
  const state = defaultState();state.macros[0].targets = [{path: 'time.stretch.scatter'}];
  const engine = new ModulationEngine(1000); engine.configure(state); engine.tick(0, 120);
  engine.notifyGesture('macros.0.value',.2);engine.tick(1,120);assert.equal(engine.effective.time.stretch.scatter,.2);
  engine.notifyGesture('time.stretch.scatter',.8);engine.tick(32,120);assert.equal(engine.effective.time.stretch.scatter,.8);
  engine.notifyGesture('macros.0.value',.4);engine.tick(64,120);assert.equal(engine.effective.time.stretch.scatter,.8);
  engine.notifyGesture('macros.0.value',.9);engine.tick(96,120);assert.equal(engine.effective.time.stretch.scatter,.9);
});
test('explicit cubic handle X positions shape timing, and graph endpoints close continuously',()=>{
 const graph=prepareGraph([[0,0,.5,.05,.9,.1,1],[.5,1],[1,.8]]),linear=prepareGraph([[0,0],[.5,1],[1,0]]);
 assert.ok(graphValue(graph,.25)>graphValue(linear,.25)+.25);
 assert.ok(Math.abs(graphValue(graph,0)-graphValue(graph,1-1e-6))<1e-4);
 assert.equal(graph.at(-1).y,graph[0].y);
});
test('idle macros do not override ongoing modulation; gestures pick up and moving modulation takes back',()=>{
 const state=defaultState();Object.assign(state.mods[0],{shape:'ramp',rate:.5,smooth:0,targets:[{path:'time.stretch.scatter',min:.3,max:.8}]});state.macros[0].targets=[{path:'time.stretch.scatter'}];
 const engine=new ModulationEngine(1000);engine.configure(state);engine.tick(0,120);assert.equal(engine.effective.time.stretch.scatter,.3);
 assert.equal(engine.getSources()['time.stretch.scatter'],'m0');
 state.macros[0].value=1;engine.configure(state);engine.tick(32,120);assert.ok(engine.effective.time.stretch.scatter<.4,'snapshot change is not a gesture');
 engine.notifyGesture('macros.0.value',.2);engine.tick(64,120);assert.equal(engine.effective.time.stretch.scatter,.2);
 assert.equal(engine.getSources()['time.stretch.scatter'],'c0');
 engine.tick(400,120);assert.ok(engine.effective.time.stretch.scatter>.4,'changing automatic source regained control after touch ended');
 assert.equal(engine.getSources()['time.stretch.scatter'],'m0');
});
test('most recently picked-up macro owns a shared destination and route edits act immediately',()=>{
 const state=defaultState();state.time.stretch.scatter=.5;state.macros[0].targets=[{path:'time.stretch.scatter'}];state.macros[1].targets=[{path:'time.stretch.scatter'}];
 const engine=new ModulationEngine(1000);engine.configure(state);engine.tick(0,120);
 engine.notifyGesture('macros.0.value',.7);engine.tick(1,120);assert.equal(engine.effective.time.stretch.scatter,.7);
 engine.notifyGesture('macros.1.value',.8);engine.tick(2,120);assert.equal(engine.effective.time.stretch.scatter,.8);
 engine.tick(64,120);assert.equal(engine.effective.time.stretch.scatter,.8);
 const edited=structuredClone(engine.base);edited.macros[0].targets[0].max=.5;engine.configure(edited);engine.tick(65,120);assert.equal(engine.effective.time.stretch.scatter,.35);
});
test('routing handles right-channel FX and per-slice automation while rejecting structural/prototype paths',()=>{
 const state=defaultState();state.fx=[{id:'chopper',type:'CHOPPER',params:{pitch:.5},paramsR:{pitch:.5},mix:.5,gain:.5,slices:Array.from({length:32},()=>({pitch:.5}))}];
 for(const path of ['fx.chopper.paramsR.pitch','fx.chopper.slices.31.pitch','time.stutter.on','bypass'])assert.ok(resolveTarget(state,path),path);
 for(const path of ['bpm','version','automation.duration','seq.stutter.patterns','mods.0.targets.0.min','fx.chopper.slices.32.pitch','fx.chopper.params.__proto__'])assert.equal(resolveTarget(state,path),null,path);
 const engine=new ModulationEngine(1000);engine.configure(state);engine.setAutomation('fx.chopper.slices.31.pitch',.9);engine.tick(0,120);assert.equal(engine.effective.fx[0].slices[31].pitch,.9);
});
test('self and cross modulation evaluate once per control tick without recursion or runaway values',()=>{
 const state=defaultState();state.mods[0].targets=[{path:'mods.0.rate',min:.1,max:.7},{path:'mods.1.depth',min:.2,max:.9}];state.mods[1].targets=[{path:'mods.0.depth',min:.3,max:.8}];const engine=new ModulationEngine(1000);engine.configure(state);
 const rates=new Set();for(let frame=0;frame<16000;frame+=32){engine.tick(frame,120);rates.add(engine.effective.mods[0].rate.toFixed(3));for(const value of engine.values)assert.ok(Number.isFinite(value)&&value>=0&&value<=1);}
 assert.ok(rates.size>10);
});
test('transport reset preserves picked-up performance values without replaying stale gestures',()=>{
 const state=defaultState();state.macros[0].targets=[{path:'time.stretch.scatter'}];const engine=new ModulationEngine(1000);engine.configure(state);engine.tick(0,120);engine.notifyGesture('macros.0.value',.8);engine.tick(1,120);assert.equal(engine.effective.time.stretch.scatter,.8);
 engine.reset();engine.tick(0,120);assert.equal(engine.effective.time.stretch.scatter,.8);assert.equal(engine.gestures.size,0);
});
test('automated graph handles rebuild the curve and clearing automation restores the base graph',()=>{
 const state=defaultState();state.graphs[0].points=[[0,0,.5,.05,0,.1,0],[.5,1],[1,0]];const engine=new ModulationEngine(1000);engine.configure(state);engine.tick(0,120);const original=graphValue(engine.preparedGraphs[0],.25);
 engine.setAutomation('graphs.0.points.0.4',1);engine.tick(1,120);assert.ok(graphValue(engine.preparedGraphs[0],.25)>original+.1);engine.clearAutomation();engine.tick(2,120);assert.ok(Math.abs(graphValue(engine.preparedGraphs[0],.25)-original)<1e-9);
});
