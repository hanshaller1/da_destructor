import test from 'node:test';
import assert from 'node:assert/strict';
import {PitchTracker} from '../dsp-primitives.mjs';
import {TimeRack,GranularTime} from '../time-core.mjs';
import {Dynamics,Prism,Tape,Undertow} from '../fx-advanced.mjs';
import {ModulationEffect} from '../fx-modulation.mjs';
const sr=16000,TAU=2*Math.PI;
function rng(){let seed=12;return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2147483648-1;};}

test('pitch confidence accepts noisy monophonic tone but rejects an absent chord subharmonic',()=>{
 for(const rate of [16000,44100,48000,96000]){
  const tracker=new PitchTracker(rate),noise=rng();
  for(let i=0;i<rate*.4;i++)tracker.process(.2*Math.sin(TAU*220*i/rate)+.04*noise());
  assert.ok(tracker.voiced);assert.ok(Math.abs(tracker.frequency-220)<3);assert.ok(tracker.confidence>.75);
  for(let i=0;i<rate*.3;i++){const t=TAU*i/rate;tracker.process(.12*(Math.sin(220*t)+Math.sin(277.18*t)+Math.sin(329.63*t)));}
  assert.equal(tracker.frequency,0,`false chord bass at ${rate}`);assert.equal(tracker.voiced,false);assert.ok(tracker.ambiguous);
 }
});

test('noise, unpitched percussion and silence release a stale pitch without a frequency jump',()=>{
 for(const kind of ['noise','percussion','silence']){
  const tracker=new PitchTracker(sr),noise=rng();
  for(let i=0;i<sr*.3;i++)tracker.process(.2*Math.sin(TAU*440*i/sr));
  assert.ok(tracker.frequency>430);
  for(let i=0;i<sr*.4;i++)tracker.process(kind==='silence'?0:noise()*.3*(kind==='percussion'?Math.exp(-(i%2400)/50):1));
  assert.equal(tracker.frequency,0,kind);assert.ok(tracker.confidence<.35,kind);
  tracker.process(NaN);tracker.process(Infinity);assert.ok(Number.isFinite(tracker.frequency));
 }
});

test('PLL sub-divider fades its generated sub when tracking becomes uncertain',()=>{
 const effect=new Undertow(sr),p={lock:1,level:1,divide:.2,divideb:.5};effect.configure({},{});const noise=rng();
 for(let i=0;i<sr*.4;i++){const x=.2*Math.sin(TAU*220*i/sr);effect.process(x,x,p);}
 assert.ok(effect.trackingGain>.99);
 let residual=0;
 for(let i=0;i<sr*.4;i++){const x=noise()*.2,y=effect.process(x,x,p)[0];if(i>sr*.3)residual+=Math.abs(y-x);}
 assert.equal(effect.pitch.frequency,0);assert.ok(effect.trackingGain<1e-8);assert.ok(residual<.001);
});

test('independent granular engine preserves held audio and latches sounding grain parameters',()=>{
 const rack=new TimeRack(sr),params={on:true,sync:false,density:.6,size:.5,pitch:.5,position:.4,spray:0,spread:.5,freeze:false,mix:1};
 let changed=0;
 for(let i=0;i<sr;i++){const input=.2*Math.sin(TAU*220*i/sr),out=rack.process(input,input,{granular:params},i,120);if(i>sr*.5)changed+=Math.abs(out[0]-input);}
 assert.ok(changed>100);assert.ok(rack.granular.launches>20);assert.ok(rack.granular.activeVoices>1);
 const active=rack.granular.voices.find(v=>v.age>0&&v.age<v.length),oldRatio=active.ratio,oldLength=active.length;
 params.pitch=1;params.reverse=true;params.freeze=true;const written=rack.granular.filled;
 rack.process(0,0,{granular:params},sr,120);assert.equal(active.ratio,oldRatio);assert.equal(active.length,oldLength);
 let energy=0;for(let i=sr+1;i<sr*2;i++)energy+=rack.process(0,0,{granular:params},i,120)[0]**2;
 assert.equal(rack.granular.filled,written);assert.ok(energy>1);assert.ok(rack.granular.voices.some(v=>v.ratio<0));
 rack.reset();assert.equal(rack.granular.filled,0);assert.equal(rack.granular.launches,0);
});

test('granular sync schedules note-grid launches and bounds voices without truncation',()=>{
 const engine=new GranularTime(sr),p={on:true,sync:true,density:1,size:1,mix:1};let previous=0;
 for(let i=0;i<sr*3;i++){engine.process(Math.sin(i*.1)*.2,0,p,i,120,i/sr*2);if(engine.launches>previous){assert.ok(engine.activeVoices<=16);previous=engine.launches;}for(const v of engine.voices)assert.ok(v.age<=v.length+1);}
 assert.ok(previous>=15);assert.ok(engine.activeVoices>5);
});

test('long Stretch grains extend eightfold while the legacy default length is preserved',()=>{
 const a=new TimeRack(sr),b=new TimeRack(sr),p={on:true,sync:false,timing:'musical',grain:.2,speed:.5,pitch:.5,mix:1};
 for(let i=0;i<sr*2;i++){const x=Math.sin(i*.1)*.2;a.process(x,x,{stretch:p},i,120);b.process(x,x,{stretch:{...p,grainLength:1}},i,120);}
 assert.ok(b.stretch.lengthA>a.stretch.lengthA*7.9);assert.ok(b.stretch.lengthA<=sr*2);
});

test('Trance GATE runs beat-locked ADSR with sustain, release, free rate and deterministic reset',()=>{
 const gate=new Dynamics('GATE',sr),p={mode:1,rate:2/9,length:.5,attack:.1,decay:.2,sustain:.35,release:.1,floor:0};gate.configure({},{});
 let high=0,low=0,sustain=0,maxJump=0,last=0;
 const render=[];
 for(let i=0;i<sr*2;i++){gate.clockBeat=i/sr*2;const y=gate.process(1,1,p,i,120,true)[0];render.push(y);high=Math.max(high,y);if(y<.01)low++;if(Math.abs(y-.35)<1e-6)sustain++;maxJump=Math.max(maxJump,Math.abs(y-last));last=y;}
 assert.equal(gate.gateTriggers,4);assert.ok(high>.99);assert.ok(low>sr/4);assert.ok(sustain>sr/4);assert.ok(maxJump<.1);
 gate.reset();for(let i=0;i<sr*2;i++){gate.clockBeat=i/sr*2;assert.equal(gate.process(1,1,p,i,120,true)[0],render[i]);}
 gate.reset();delete gate.clockBeat;for(let i=0;i<sr*2;i++)gate.process(1,1,{...p,rate:1},i,120,false);assert.equal(gate.gateTriggers,40);
});

test('10ms through-zero reference retains causal unclipped positive and negative relative sweeps',()=>{
 for(const rate of [8000,44100,48000,192000])for(const delay of [0,.5,1]){
  const effect=new ModulationEffect('FLANGER',rate);let min=Infinity,max=0;
  effect.wet.read=(ch,d)=>{min=Math.min(min,d);max=Math.max(max,d);return 0;};
  for(let i=0;i<2000;i++)effect.process(0,0,{tzf:1,delay,depth:1,barber:.5,feedback:.5},i,120);
  assert.equal(effect.latency,Math.ceil(rate*.01));assert.ok(min>1);assert.ok(min<effect.latency&&max>effect.latency);
 }
});

test('asymmetric tape/filter models remove DC without sacrificing a 30Hz bass fundamental',()=>{
 for(const kind of ['TAPE','DIODE','TRANSISTOR']){
  const effect=kind==='TAPE'?new Tape(sr):new Prism(sr),params=kind==='TAPE'?{mode:1,drive:.3,wow:0,flutter:0,noise:0}:{type:kind==='DIODE'?2/3:1,cutoff:.7,res:.2,slope:1,drive:.2};effect.configure({},{});
  let sum=0,energy=0,re=0,im=0;
  for(let i=0;i<sr;i++){const x=.2*Math.sin(TAU*30*i/sr),y=effect.process(x,x,params,i)[0];if(i>=sr/2){sum+=y;energy+=y*y;re+=y*Math.cos(TAU*30*i/sr);im+=y*Math.sin(TAU*30*i/sr);}}
  assert.ok(Math.abs(sum/(sr/2))<.003,`${kind} DC ${sum/(sr/2)}`);assert.ok(Math.hypot(re,im)/(sr/2)>.015,`${kind} lost bass`);assert.ok(energy>1);
 }
});
