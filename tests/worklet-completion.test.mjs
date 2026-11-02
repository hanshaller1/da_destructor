import test from 'node:test';
import assert from 'node:assert/strict';
import {MainBus,DestructorRuntime,DestructorProcessor} from '../audio-worklet.mjs';
import {defaultState} from '../modulation.mjs';
import {EFFECTS} from '../effects.mjs';
const effect=(type,id)=>({id,type,on:true,mix:.5,gain:.5,params:Object.fromEntries(EFFECTS.find(item=>item.id===type).params.map(parameter=>[parameter.key,parameter.default])),lrLock:true});

test('MAIN auto-gain compensates measured processed level without removing intentional master gain',()=>{
 const main={...defaultState().main,autoGain:1},bus=new MainBus(1000);let pair;
 for(let frame=0;frame<10000;frame++)pair=bus.process(.4,.4,.1,.1,main,frame);
 assert.ok(Math.abs(pair[0]-.1)<1e-6);assert.ok(Math.abs(bus.autoCompensation-.25)<1e-6);
 main.gainMode='extended';main.gain=1;for(let frame=10000;frame<14000;frame++)pair=bus.process(.4,.4,.1,.1,main,frame);
 assert.ok(Math.abs(pair[0]-.1*10**(12/20))<1e-5);
 main.gain=0;for(let frame=14000;frame<18000;frame++)pair=bus.process(.4,.4,.1,.1,main,frame);assert.ok(Math.abs(pair[0])<1e-10);
});
test('second worklet input drives EXTERNAL envelope independently of the silent main input',()=>{
 const processor=new DestructorProcessor(),state=defaultState();state.playing=true;Object.assign(state.mods[0],{type:'env',source:'external',rise:0,fall:0,smooth:0,targets:[{path:'main.pan',min:0,max:1}]});processor.message({type:'state',state});
 for(let block=0;block<20;block++)processor.process([[new Float32Array(128),new Float32Array(128)],[new Float32Array(128).fill(.8),new Float32Array(128).fill(-.8)]],[[new Float32Array(128),new Float32Array(128)]]);
 assert.ok(processor.runtime.modulation.values[0]>.79);assert.ok(processor.runtime.getMeterState().values['main.pan']>.79);assert.equal(processor.runtime.modulation.base.main.pan,.5);
});
test('automation events apply at their exact sample before modulation and retain saved base values',()=>{
 const runtime=new DestructorRuntime(1000),state=defaultState();state.playing=true;state.automationPlaying=true;state.automation={duration:.04,loop:true,events:[{time:0,path:'main.pan',value:0},{time:.013,path:'main.pan',value:.9},{time:.017,path:'time.stutter.on',value:1,kind:'boolean'}]};runtime.configure(state);
 for(let frame=0;frame<13;frame++){runtime.process(0,0);assert.equal(runtime.state.main.pan,0);}
 runtime.process(0,0);assert.equal(runtime.state.main.pan,.9);assert.equal(runtime.modulation.base.main.pan,.5);
 for(let frame=14;frame<=17;frame++)runtime.process(0,0);assert.equal(runtime.state.time.stutter.on,true);assert.equal(runtime.modulation.base.time.stutter.on,false);
 for(let frame=18;frame<=40;frame++)runtime.process(0,0);assert.equal(runtime.state.main.pan,0);assert.ok(runtime.getMeterState().automationPosition<.003);
});
test('tempo changes accumulate beat phase and timestamped MIDI corrections stay monotonic',()=>{
 const runtime=new DestructorRuntime(1000),state=defaultState();state.playing=true;runtime.configure(state);for(let frame=0;frame<500;frame++)runtime.process(0,0);assert.ok(Math.abs(runtime.beat-1)<1e-10);
 state.bpm=60;runtime.configure(state);for(let frame=0;frame<10;frame++)runtime.process(0,0);assert.ok(Math.abs(runtime.beat-1.01)<1e-10);
 runtime.setClock({beat:1.02,bpm:60,playing:true,timestamp:runtime.contextTime});let previous=runtime.beat;
 for(let frame=0;frame<1000;frame++){runtime.process(0,0);assert.ok(runtime.beat>previous);assert.ok(runtime.beat-previous<=.001051);previous=runtime.beat;}
 assert.ok(Math.abs(runtime.clockError)<.004);const frame=runtime.frame;runtime.setClock({beat:.25,bpm:60,playing:true,timestamp:runtime.contextTime,seek:true});assert.equal(runtime.beat,.25);assert.equal(runtime.frame,frame);
});
test('only actual chain-latency changes queue; SIZE remains live even with pending topology',()=>{
 const runtime=new DestructorRuntime(48000),state=defaultState();state.playing=true;state.fx=[effect('CHROMA','chroma')];runtime.configure(state);assert.equal(runtime.fx.latency,4096);
 state.fx[0].params.size=1;state.fx[0].params.tilt=.7;state.fx.push(effect('LOSSY','lossy'));runtime.configure(state);
 assert.equal(runtime.pendingLatency,true);assert.equal(runtime.fx.latency,4096);assert.equal(runtime.state.fx.length,1);assert.equal(runtime.state.fx[0].params.size,1);assert.equal(runtime.state.fx[0].params.tilt,.7);
 state.playing=false;runtime.configure(state);assert.equal(runtime.pendingLatency,false);assert.equal(runtime.fx.latency,6144);assert.equal(runtime.state.fx.length,2);
});
test('latency-compensation disable returns MAIN dry immediately and meters contain actual FX samples',()=>{
 const runtime=new DestructorRuntime(48000),state=defaultState();state.playing=true;state.latencyComp=false;state.fx=[effect('CHROMA','chroma')];state.main.mix=0;runtime.configure(state);
 for(let frame=0;frame<12000;frame++)runtime.process(0,0);assert.equal(runtime.latency,0);assert.ok(Math.abs(runtime.process(.25,-.2)[0]-.25)<1e-7);
 state.playing=false;state.main.mix=1;state.fx=[effect('TAPE','tape')];runtime.configure(state);state.playing=true;runtime.configure(state);for(let frame=0;frame<4000;frame++)runtime.process(Math.sin(frame*.1)*.1,Math.cos(frame*.1)*.1);
 const meter=runtime.getMeterState().fxMeters[0];assert.equal(meter.id,'tape');assert.equal(meter.wave.length,32);assert.ok(meter.peakL>0&&meter.peakR>0);assert.ok(meter.wave.some(value=>Math.abs(value)>1e-5));
});
test('recorded BYPASS automation changes the real audible path while saved base bypass stays off',()=>{
 const runtime=new DestructorRuntime(1000),state=defaultState();state.playing=true;state.main.gain=0;state.automationPlaying=true;state.automation={duration:1,loop:false,events:[{time:0,path:'bypass',value:0,kind:'boolean'},{time:.1,path:'bypass',value:1,kind:'boolean'}]};runtime.configure(state);let before=0,after=0;
 for(let frame=0;frame<400;frame++){const output=runtime.process(.2,.2)[0];if(frame===99)before=output;if(frame===399)after=output;}
 assert.ok(before<.02&&before>.01);assert.ok(after>.1999);assert.equal(runtime.modulation.base.bypass,false);assert.equal(runtime.getMeterState().values.bypass,1);
});
test('typed replay changes LFO source, tonal root, engine routing and the currently sounding sequencer step',()=>{
 const runtime=new DestructorRuntime(1000),state=defaultState();state.playing=true;state.automationPlaying=true;state.automation={duration:1,loop:false,events:[{time:0,path:'mods.0.type',value:1,kind:'enum'},{time:0,path:'mods.0.source',value:1,kind:'enum'},{time:0,path:'tonal.root',value:9/11,kind:'integer'},{time:0,path:'tonal.scale',value:.75,kind:'enum'},{time:0,path:'seq.stretch.on',value:1,kind:'boolean'},{time:.013,path:'seq.stretch.steps.0.value',value:.2},{time:.015,path:'time.order',value:1,kind:'enum'}]};runtime.configure(state);
 for(let frame=0;frame<=15;frame++)runtime.process(0,0,.7,-.7);
 assert.equal(runtime.state.mods[0].type,'env');assert.equal(runtime.state.mods[0].source,'external');assert.equal(runtime.state.tonal.root,9);assert.equal(runtime.state.tonal.scale,'dorian');assert.equal(runtime.state.time.order,'parallel');assert.equal(runtime.state.time.stretch.speed,.2);assert.ok(runtime.modulation.values[0]>.2);
 assert.equal(runtime.modulation.base.mods[0].type,'lfo');assert.equal(runtime.modulation.base.tonal.root,0);
});
test('only genuinely latency-changing automated graph modes wait for stop',()=>{
 const runtime=new DestructorRuntime(48000),state=defaultState();state.playing=true;state.fx=[effect('CHROMA','chroma'),effect('SIEVE','sieve')];state.automationPlaying=true;state.automation={duration:1,loop:false,events:[{time:0,path:'fxMode',value:1,kind:'enum'},{time:0,path:'fx.chroma.lrLock',value:0,kind:'boolean'}]};runtime.configure(state);runtime.process(0,0);
 assert.equal(runtime.fx.mode,'serial');assert.equal(runtime.pendingMode,'parallel');assert.equal(runtime.fx.effects[0].ref.lrLock,false);assert.equal(runtime.pendingLatency,true);
 runtime.configure(state);runtime.setTransport(false);assert.equal(runtime.fx.mode,'parallel');assert.equal(runtime.pendingLatency,false);
});
test('a later automated SIZE request cancels an obsolete warming window without a Stop',()=>{
 const runtime=new DestructorRuntime(48000),state=defaultState();state.playing=true;state.fx=[effect('CHROMA','chroma')];state.automationPlaying=true;state.automation={duration:1,loop:false,events:[{time:0,path:'fx.chroma.params.size',value:1},{time:.01,path:'fx.chroma.params.size',value:.05}]};runtime.configure(state);runtime.process(0,0);assert.equal(runtime.pendingLatency,false);assert.equal(runtime.fx.effects[0].left.spectral.requestedSize,4096);
 for(let frame=1;frame<=480;frame++)runtime.process(0,0);assert.equal(runtime.pendingLatency,false);assert.equal(runtime.fx.effects[0].left.spectral.incoming,null);runtime.setTransport(false);for(let frame=0;frame<10000;frame++)runtime.process(0,0);assert.equal(runtime.fx.latency,512);
});
