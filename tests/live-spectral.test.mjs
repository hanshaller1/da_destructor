import test from 'node:test';
import assert from 'node:assert/strict';
import {SpectralProcessor} from '../spectral.mjs';
import {DestructorRuntime} from '../audio-worklet.mjs';
import {createState,makeEffect} from '../state.mjs';
const sr=8192,tau=2*Math.PI;
const signal=i=>Math.sin(i*.047)*.12+Math.cos(i*.113)*.07;

test('live FFT switches all four real windows with aligned, gap-free identity crossfades and cached banks',()=>{
 const processor=new SpectralProcessor('IDENTITY',sr),params={size:0};processor.configure(params,undefined,false,{liveSizes:true});
 let frame=0,error=0;
 const block=count=>{for(let i=0;i<count;i++,frame++){const out=processor.process(signal(frame),-signal(frame),params,frame,120);if(frame>8192)error=Math.max(error,Math.abs(out[0]-signal(frame-4096)),Math.abs(out[1]+signal(frame-4096)));}};
 block(12000);
 for(const size of [1/3,2/3,1,0,1,1/3]){params.size=size;block(14000);assert.equal(processor.activeSize,[512,1024,2048,4096][Math.round(size*3)]);assert.equal(processor.latency,4096);}
 assert.ok(error<1e-9,`largest crossfade reconstruction error ${error}`);assert.equal(processor.banks.size,4);
 const banks=[...processor.banks.values()].map(bank=>bank.core);params.size=1;block(14000);assert.deepEqual([...processor.banks.values()].map(bank=>bank.core),banks);
 processor.configure(params,undefined,false,{liveSizes:false});assert.equal(processor.latency,4096);params.size=0;processor.configure(params);assert.equal(processor.latency,512);
});
test('runtime applies same-latency reorder immediately, retaining processor identities and MAIN history',()=>{
 const runtime=new DestructorRuntime(48000),state=createState();state.playing=true;state.fx=[makeEffect('FLANGER','fx-flange'),makeEffect('EQ','fx-eq')];state.main.mix=0;runtime.configure(state);
 for(let i=0;i<3000;i++)runtime.process(signal(i),signal(i));const old=runtime.fx.effects.slice(),write=runtime.dryWrite;
 state.fx.reverse();runtime.configure(state);assert.equal(runtime.pendingLatency,false);assert.equal(runtime.fx.effects[0],old[1]);assert.equal(runtime.fx.effects[1],old[0]);assert.equal(runtime.dryWrite,write);
 const out=runtime.process(.2,.2);assert.ok(Number.isFinite(out[0]));assert.equal(runtime.state.fx[0].type,'EQ');
});
test('FORMANT SHIFT SIZE changes actual FFT while playing via knob, automation and modulation',()=>{
 for(const source of ['knob','automation','modulation']){
  const state=createState(),runtime=new DestructorRuntime(sr);state.playing=true;state.fx=[makeEffect('FORMANT SHIFT','fx-formant')];state.fx[0].mix=1;state.fx[0].params.shift=.5;
  if(source==='automation'){state.automationPlaying=true;state.automation={duration:3,loop:false,events:[{time:.1,path:'fx.fx-formant.params.size',value:1}]};}
  if(source==='modulation'){state.mods[0].shape='square';state.mods[0].rate=0;state.mods[0].targets=[{path:'fx.fx-formant.params.size',min:1,max:1}];}
  runtime.configure(state);for(let i=0;i<14000;i++){if(source==='knob'&&i===1000){state.fx[0].params.size=1;runtime.configure(state);}runtime.process(signal(i),-signal(i));}
  const spectral=runtime.fx.effects[0].left.spectral;assert.equal(spectral.activeSize,4096,source);assert.equal(runtime.pendingLatency,false,source);assert.equal(runtime.getMeterState().fftSizes[0].active,4096);
  state.playing=false;state.fx[0].params.size=0;runtime.configure(state);for(let i=0;i<3000;i++)runtime.process(0,0);assert.equal(runtime.fx.latency,512);
 }
});
test('SEPARATE rejects stationary noise as HITS while retaining pitched and percussive components',()=>{
 let seed=1234567;const count=sr*3,noise=Float64Array.from({length:count},()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/2147483648-1;});
 const sources={tone:i=>Math.sin(tau*256*i/sr)*.15,noise:i=>noise[i]*.15,hits:i=>i%4096<80?noise[i]*.4*Math.exp(-(i%4096)/15):0},measure={};
 for(const [name,input] of Object.entries(sources)){measure[name]=[];for(let part=0;part<3;part++){const params={size:1/3,pitch:.5,tonal:part===0?.5:0,noise:part===1?.5:0,hits:part===2?.5:0,tight:.8,spread:0},processor=new SpectralProcessor('SEPARATE',sr);processor.configure(params);let energy=0;for(let frame=0;frame<count;frame++){const x=input(frame),y=processor.process(x,x,params,frame,120)[0];if(frame>sr)energy+=y*y;}measure[name].push(energy);}}
 assert.ok(measure.tone[0]>measure.tone[1]*1000);assert.ok(measure.noise[1]>measure.noise[0]*40);assert.ok(measure.noise[2]<measure.noise[1]*.001);assert.ok(measure.hits[2]>measure.hits[1]*3);
});


test('structural replay restores FX order, graph topology and sequence length at sample edges and across loops',()=>{
 const rate=1000,state=createState(),runtime=new DestructorRuntime(rate),a=makeEffect('EQ','fx-eq'),b=makeEffect('DISTORT','fx-distort'),initial=[[0,.1],[.5,.9],[1,.1]],changed=[[0,.2],[.3,.8],[.7,.4],[1,.2]];
 state.playing=true;state.fx=[b];state.automationPlaying=true;
 const structure=(time,scope,value,extra={})=>({time,kind:'structure',scope,value,...extra});
 state.automation={duration:.1,loop:true,events:[structure(0,'fx',[a]),structure(0,'graph',initial,{index:0}),structure(0,'sequence',{patterns:1,length:0,target:'default',min:0,max:1},{name:'stretch'}),{time:.01,path:'fx.fx-eq.params.gain',value:.9},structure(.02,'fx',[a,b]),structure(.025,'graph',changed,{index:0}),structure(.026,'sequence',{patterns:3,length:7,target:'main.pan',min:0,max:1},{name:'stretch'}),structure(.04,'fx',[b,a]),structure(.06,'fx',[b])]};
 runtime.configure(state);
 for(let frame=0;frame<=100;frame++){
  runtime.process(0,0);
  if(frame===0)assert.deepEqual(runtime.state.fx.map(effect=>effect.id),['fx-eq']);
  if(frame===10)assert.equal(runtime.state.fx[0].params.gain,.9);
  if(frame===20){assert.deepEqual(runtime.state.fx.map(effect=>effect.id),['fx-eq','fx-distort']);assert.equal(runtime.state.fx[0].params.gain,.9,'scalar override survives topology refresh');}
  if(frame===26){assert.equal(runtime.state.graphs[0].points.length,4);assert.equal(runtime.state.seq.stretch.length,7);const meter=runtime.getMeterState();assert.ok(meter.structureRevision>0);assert.equal(meter.topology.seq.stretch.length,7);assert.equal(runtime.getMeterState().topology,null);}
  if(frame===40)assert.deepEqual(runtime.state.fx.map(effect=>effect.id),['fx-distort','fx-eq']);
  if(frame===60)assert.deepEqual(runtime.state.fx.map(effect=>effect.id),['fx-distort']);
  if(frame===100){assert.deepEqual(runtime.state.fx.map(effect=>effect.id),['fx-eq']);assert.equal(runtime.state.graphs[0].points.length,3);assert.equal(runtime.state.seq.stretch.length,0);}
 }
 assert.deepEqual(state.fx.map(effect=>effect.id),['fx-distort'],'saved UI state is not mutated by replay');
});
