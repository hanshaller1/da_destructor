// Reproducible engineering probes and audition files, not a claim of commercial
// plugin equivalence or a realtime guarantee for browser/audio-driver hardware.
import {mkdir,writeFile,access} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {performance} from 'node:perf_hooks';
import {Tape,Prism,Nonlinear,ChorusEnsemble} from '../fx-advanced.mjs';
import {SpringReverb} from '../fx-reverb.mjs';
import {PitchTracker} from '../dsp-primitives.mjs';
import {DestructorRuntime} from '../audio-worklet.mjs';
import {createState,makeEffect} from '../state.mjs';

const sr=48000,TAU=2*Math.PI;
let output=path.resolve(process.argv[2]??'outputs/dsp-assessment-v2.1.0'),suffix=1;
while(await access(output).then(()=>true,()=>false))output=path.resolve((process.argv[2]??'outputs/dsp-assessment-v2.1.0')+`-${++suffix}`);
await mkdir(output,{recursive:true});
function source(n,rate=sr){return .17*Math.sin(TAU*110*n/rate)+.1*Math.sin(TAU*1000*n/rate)+.06*Math.sin(TAU*6700*n/rate)+(n%12000<100?.2*Math.exp(-(n%12000)/25):0);}
function wav(samples){const buffer=Buffer.alloc(44+samples.length*2);buffer.write('RIFF');buffer.writeUInt32LE(buffer.length-8,4);buffer.write('WAVEfmt ',8);buffer.writeUInt32LE(16,16);buffer.writeUInt16LE(1,20);buffer.writeUInt16LE(2,22);buffer.writeUInt32LE(sr,24);buffer.writeUInt32LE(sr*4,28);buffer.writeUInt16LE(4,32);buffer.writeUInt16LE(16,34);buffer.write('data',36);buffer.writeUInt32LE(samples.length*2,40);for(let i=0;i<samples.length;i++)buffer.writeInt16LE(Math.round(Math.max(-1,Math.min(1,samples[i]))*32767),44+i*2);return buffer;}
function stats(samples){let square=0,mean=0,peak=0,finite=true;for(let i=0;i<samples.length;i++){const x=samples[i];finite&&=Number.isFinite(x);square+=x*x;mean+=x;peak=Math.max(peak,Math.abs(x));}return {rms:Math.sqrt(square/samples.length),peak,dc:mean/samples.length,finite};}
const report={sampleRate:sr,node:process.version,platform:process.platform,cpu:os.cpus()[0]?.model,logicalCpus:os.cpus().length,method:'Deterministic synthetic multitone/transient probes; stereo 16bit WAVs contain dry first, then each named model. Node block timings are engineering estimates, not physical audio or browser scheduling tests.',models:[],pitch:[],patches:[]};
const families=[
 {name:'tape',models:['GENTLY','NORMAL','HARD','HARSH'],make:()=>new Tape(sr),params:i=>({mode:i/3,drive:.3,bass:.5,noise:0,wow:0,flutter:0,age:.2,hyst:.5,width:.5,hq:1})},
 {name:'prism',models:['SVF','LADDER','DIODE','TRANSISTOR'],make:()=>new Prism(sr),params:i=>({type:i/3,cutoff:.5,res:.4,drive:.3,slope:1,mode:0,drift:0,fm:0})},
 {name:'wavefolder',models:['FOLD','259','SERGE','LOCK','WRAP'],make:()=>new Nonlinear('WAVEFOLDER',sr),params:i=>({model:i/4,drive:.6,folds:.6,shape:.5,bias:.5,hq:1})},
 {name:'ensemble',models:['JUNO','SOLINA','DIMENSION','LUSH'],make:()=>new ChorusEnsemble('ENSEMBLE',sr),params:i=>({type:i/3,rate1:.25,rate2:.6,feedback:.15,width:.7,depth:.5})},
 {name:'spring',models:['SHORT','LONG','RIPPLE','CRASH'],make:()=>new SpringReverb(sr),params:i=>({size:i===0?.2:.7,decay:i===1?.85:.55,damp:.4,ripple:i===2?1:.2,crash:i===3?1:0,tension:.5,pickup:.5})}
];
for(const family of families){
 const seconds=family.name==='spring'?2:1,frames=Math.round(sr*seconds),audio=new Float32Array((frames+sr*.1)*(family.models.length+1)*2),segments=[];
 for(let segment=0;segment<=family.models.length;segment++){
  const effect=segment?family.make():null,params=segment?family.params(segment-1):{};effect?.configure?.({},{});
  const captured=new Float64Array(frames),start=(frames+sr*.1)*segment;
  const before=performance.now();
  for(let n=0;n<frames;n++){const x=family.name==='spring'?(n<sr*.2?source(n):0):source(n),y=effect?effect.process(x,x,params,n,120,false):[x,x];audio[(start+n)*2]=y[0];audio[(start+n)*2+1]=y[1];captured[n]=y[0];}
  const metrics=stats(captured);segments.push({label:segment?family.models[segment-1]:'DRY',startSeconds:start/sr,seconds,metrics,processingMs:performance.now()-before});
 }
 let auditionPeak=0;for(const sample of audio)auditionPeak=Math.max(auditionPeak,Math.abs(sample));const auditionGain=auditionPeak>1?.95/auditionPeak:1;for(let i=0;i<audio.length;i++)audio[i]*=auditionGain;
 const filename=`${family.name}-dry-models.wav`;await writeFile(path.join(output,filename),wav(audio));report.models.push({family:family.name,file:filename,auditionGain,segments});
}
for(const kind of ['monophonic-plus-noise','noise','C-major-chord','percussion']){
 const tracker=new PitchTracker(sr);let seed=12;
 for(let n=0;n<sr*.6;n++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const noise=seed/2147483648-1,t=TAU*n/sr,x=kind==='monophonic-plus-noise'?.2*Math.sin(t*220)+.05*noise:kind==='noise'?.2*noise:kind==='C-major-chord'?.12*(Math.sin(t*220)+Math.sin(t*277.18)+Math.sin(t*329.63)):.5*noise*Math.exp(-(n%6000)/300);tracker.process(x);}
 report.pitch.push({kind,frequency:tracker.frequency,confidence:tracker.confidence,fundamentalRatio:tracker.fundamentalRatio,voiced:tracker.voiced,ambiguous:tracker.ambiguous});
}

const patchDefinitions=[
 {name:'tape-performance',fx:['TAPE','PRISM','SPIRAL'],time:{vari:{on:true,speed:.8,wow:.15,saturation:.1,mix:.7}}},
 {name:'rhythm-performance',fx:['CHOPPER','GATE','SPIRAL'],time:{stutter:{on:true,sync:true,rate:.5,capture:.5,mix:.6}}},
 {name:'granular-memory',fx:['SCATTER','GRANULAR DELAY','DATTORRO'],time:{granular:{on:true,sync:false,size:.5,density:.5,mix:.7}}},
 {name:'spectral-performance',fx:['FORMANT SHIFT','MAGNET','SPECTRAL DELAY'],size:.5},
 {name:'resonator-spring',fx:['CRYSTAL','MODAL','DRIP','SQUASH'],voices:1}
];
for(const rate of [48000,96000])for(const definition of patchDefinitions){
 const state=createState();state.playing=true;state.fx=definition.fx.map(type=>makeEffect(type));for(const [name,parameters]of Object.entries(definition.time??{}))Object.assign(state.time[name],parameters);
 for(const effect of state.fx){effect.mix=.65;if(definition.size!==undefined&&'size'in effect.params)effect.params.size=definition.size;if(effect.type==='CRYSTAL'&&definition.voices!==undefined)effect.params.voices=definition.voices;}
 if(definition.name==='rhythm-performance'){const gate=state.fx.find(f=>f.type==='GATE');gate.params.mode=1;gate.sync=true;}
 const runtime=new DestructorRuntime(rate);runtime.configure(state);const timings=[],frames=rate*2;let peak=0,finite=true;
 for(let frame=0;frame<frames;frame+=128){const before=performance.now();for(let n=frame;n<frame+128;n++){const x=source(n,rate),out=runtime.process(x,x);peak=Math.max(peak,Math.abs(out[0]),Math.abs(out[1]));finite&&=Number.isFinite(out[0])&&Number.isFinite(out[1]);}const elapsed=performance.now()-before;if(frame>=rate*.25)timings.push(elapsed);}
 timings.sort((a,b)=>a-b);const percentile=p=>timings[Math.min(timings.length-1,Math.floor(timings.length*p))],budgetMs=128/rate*1000;
 report.patches.push({name:definition.name,sampleRate:rate,effects:definition.fx,blockSamples:128,budgetMs,medianBlockMs:percentile(.5),p95BlockMs:percentile(.95),p99BlockMs:percentile(.99),overBudgetBlocks:timings.filter(t=>t>budgetMs).length,measuredBlocks:timings.length,maxBlockMs:timings.at(-1),medianBudgetRatio:percentile(.5)/budgetMs,p95BudgetRatio:percentile(.95)/budgetMs,peak,finite});
}
await writeFile(path.join(output,'assessment.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({output,modelFamilies:report.models.length,pitch:report.pitch,patches:report.patches},null,2));
