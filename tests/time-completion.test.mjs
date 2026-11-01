import test from 'node:test';
import assert from 'node:assert/strict';
import {TimeRack,tukeyWindow,patternMultiplier,scratchVelocity,scratchGate} from '../time-core.mjs';

const SR=12000,beat=SR*.5;
const sine=(n,f=400)=>Math.sin(n/SR*Math.PI*2*f)*.3;
function toneMagnitude(samples,frequency,sr=SR){let re=0,im=0;for(let i=0;i<samples.length;i++){re+=samples[i]*Math.cos(2*Math.PI*frequency*i/sr);im+=samples[i]*Math.sin(2*Math.PI*frequency*i/sr);}return Math.hypot(re,im)/samples.length;}
function repeatEdges(p,samples=SR*1.8){const rack=new TimeRack(SR),edges=[];let previous=-1;for(let n=0;n<samples;n++){rack.process(sine(n),sine(n),{stutter:p},n,120);if(rack.stutter.lastRepeatFrame!==previous&&rack.stutter.lastRepeatFrame>=0){previous=rack.stutter.lastRepeatFrame;edges.push(previous);}}return {rack,edges};}

test('musical Varispeed at normal rate preserves every input sample with zero algorithmic delay',()=>{
 const rack=new TimeRack(SR),p={vari:{on:true,timing:'musical',speed:1,mix:1,wow:0,saturation:0,compress:0}};
 for(let n=0;n<SR;n++){const input=n===3800?.9:sine(n);const out=rack.process(input,-input,p,n,120);assert.ok(Math.abs(out[0]-input)<1e-12);assert.ok(Math.abs(out[1]+input)<1e-12);}
 assert.equal(rack.vari.latency,0);
});

test('scratch direction turns use a real zero crossing or a complete output fade for DC',()=>{
 for(const dc of [false,true]){const rack=new TimeRack(SR),p={vari:{on:true,timing:'musical',speed:1,mix:1,mode:0}};let flipped=false;
  for(let n=0;n<SR;n++){if(n===7000)p.vari.mode=1;const previous=rack.vari.direction;rack.process(dc?.2:sine(n,83),dc?.2:sine(n,83),p,n,120);if(previous!==rack.vari.direction){flipped=true;if(dc)assert.equal(rack.vari.turnGain,0);}}
  assert.equal(flipped,true);if(dc)assert.ok(rack.vari.mutedTurns>0);else assert.ok(rack.vari.zeroCrossTurns>0);
 }
});

test('2x tape saturation suppresses the aliased fifth harmonic of a high input tone',()=>{
 const sr=48000,rack=new TimeRack(sr),p={vari:{on:true,timing:'musical',speed:1,saturation:1,mix:1}},processed=new Float32Array(sr/4),plain=new Float32Array(processed.length);
 for(let n=0;n<sr/2;n++){const x=Math.sin(2*Math.PI*7000*n/sr)*.7;const out=rack.process(x,x,p,n,120);if(n>=sr/4){processed[n-sr/4]=out[0];plain[n-sr/4]=Math.tanh(x*13)/Math.sqrt(13);}}
 const oversampled=toneMagnitude(processed,13000,sr),unfiltered=toneMagnitude(plain,13000,sr);
 assert.ok(oversampled<unfiltered*.4,`13kHz alias ${oversampled} vs ${unfiltered}`);assert.equal(rack.vari.latency,15);
});

test('Varispeed dry/wet are delay-aligned when the FIR tape saturator is active',()=>{
 const sr=48000,racks=[new TimeRack(sr),new TimeRack(sr),new TimeRack(sr)],mixes=[0,.5,1],audio=mixes.map(()=>new Float32Array(sr/4));
 for(let n=0;n<sr/2;n++)for(let i=0;i<3;i++){const x=Math.sin(2*Math.PI*8000*n/sr)*.005,p={vari:{on:true,timing:'musical',speed:1,saturation:.001,mix:mixes[i]}};const out=racks[i].process(x,x,p,n,120);if(n>=sr/4)audio[i][n-sr/4]=out[0];}
 let residual=0,energy=0;for(let i=0;i<audio[0].length;i++){const predicted=(audio[0][i]+audio[2][i])*.5;residual+=(audio[1][i]-predicted)**2;energy+=audio[0][i]**2;}
 assert.ok(residual<energy*1e-10,'half mix equals the coherent sum of aligned dry and wet');
 assert.ok(toneMagnitude(audio[1],8000,sr)>toneMagnitude(audio[0],8000,sr)*.85,'no high-frequency comb cancellation');
});

test('parallel time branches align the saturator FIR latency before averaging',()=>{
 const sr=48000,parallel=new TimeRack(sr),reference=new TimeRack(sr),vari={on:true,timing:'musical',speed:1,saturation:.01,mix:1},p={order:'parallel',vari,stretch:{on:true,timing:'musical',speed:1,mix:0}};
 for(let n=0;n<sr/2;n++){const input=Math.sin(2*Math.PI*8000*n/sr)*.02,wet=reference.process(input,input,{vari},n,120)[0],out=parallel.process(input,input,p,n,120)[0];if(n>sr/4){const dry=Math.sin(2*Math.PI*8000*(n-15)/sr)*.02;assert.ok(Math.abs(out-(dry+wet)*.5)<1e-8);}}
});

test('stutter repeat edges remain sample-clock exact under pitch and cumulative pitch ramps',()=>{
 let reference;
 for(const pitch of [0,.5,1]){const {edges}=repeatEdges({on:true,timing:'musical',rate:.5,capture:0,pitch,ramp:.8,gate:0,mix:1});assert.ok(edges.length>8);for(let i=1;i<edges.length;i++)assert.equal(edges[i]-edges[i-1],750);if(reference)assert.deepEqual(edges,reference);reference=edges;}
});

test('stutter octave pitch changes the tone without changing repeat duration',()=>{
 const rack=new TimeRack(SR),p={stutter:{on:true,timing:'musical',rate:.5,capture:0,pitch:1,ramp:.5,gate:0,mix:1,smooth:0}},audio=new Float32Array(SR);
 for(let n=0;n<SR*2;n++){const out=rack.process(sine(n),sine(n),p,n,120);if(n>=SR)audio[n-SR]=out[0];}
 assert.ok(toneMagnitude(audio,800)>toneMagnitude(audio,400)*4,'dominant energy moves to the octave');
});

test('dotted, triplet, swing, and ramps have musical period sequences',()=>{
 const rate=(.05-.01)/.49,base=600;
 for(const [pattern,period] of [['DOTTED',900],['TRIPLET',400]]){const {edges}=repeatEdges({on:true,sync:false,rate,capture:0,pitch:.5,pattern,mix:1});for(let i=1;i<edges.length;i++)assert.ok(Math.abs(edges[i]-edges[i-1]-period)<=1,pattern);}
 const {edges}=repeatEdges({on:true,sync:false,rate,capture:0,pitch:.5,pattern:'SWING',mix:1});const durations=edges.slice(1).map((x,i)=>x-edges[i]);assert.ok(durations.every(d=>Math.abs(d-400)<=1||Math.abs(d-800)<=1));for(let i=1;i<durations.length;i++)assert.ok(Math.abs(durations[i]+durations[i-1]-1200)<=1);
 let sum=0;for(let i=0;i<8;i++){assert.equal(patternMultiplier('RAMP UP',i),patternMultiplier('RAMP DOWN',7-i));sum+=patternMultiplier('RAMP UP',i)*base;}assert.equal(sum,base*8);
});

test('retrigger captures occur on repeat edges rather than arbitrary block boundaries',()=>{
 const rack=new TimeRack(SR),p={stutter:{on:true,timing:'musical',rate:.5,capture:0,retrigger:1,mix:1}};let count=0,previous=0;
 for(let n=0;n<SR;n++){rack.process(sine(n),sine(n),p,n,120);if(rack.stutter.captureCount!==previous){if(previous>0){assert.equal(rack.stutter.lastCaptureFrame%750,0);count++;}previous=rack.stutter.captureCount;}}
 assert.ok(count>8);
});

test('musical grain starts land on exact note divisions with complementary Hann overlap',()=>{
 for(let j=0;j<6;j++){
  const rack=new TimeRack(SR),p={stretch:{on:true,timing:'musical',sync:true,grain:j/5,tempo:1,speed:.5,pitch:.5,spread:0,scatter:0,mix:1}},hop=beat*.25/(2**j);let previous=0,launches=0;
  for(let n=0;n<SR;n++){rack.process(.2,.2,p,n,120);const s=rack.stretch;if(s.grainLaunches>previous){if(previous>0){assert.ok(Math.abs(s.lastLaunchFrame/hop-Math.round(s.lastLaunchFrame/hop))<=1/hop+1e-5,`division${j}: frame${s.lastLaunchFrame}`);launches++;}previous=s.grainLaunches;}if(s.started){const wa=.5-.5*Math.cos(2*Math.PI*Math.min(1,s.phaseA)),wb=.5-.5*Math.cos(2*Math.PI*Math.min(1,s.phaseB));assert.ok(Math.abs(wa+wb-1)<.02,`Hann overlap ${wa+wb}`);}}
  assert.ok(launches>=4);assert.equal(rack.stretch.hop,hop);
 }
});

test('active grain direction and pitch latch until its next launch',()=>{
 const rack=new TimeRack(SR),p={stretch:{on:true,timing:'musical',grain:0,tempo:1,speed:.3,pitch:.5,mix:1}};let frame=0;
 while(!rack.stretch.started&&frame<SR){rack.process(sine(frame),sine(frame),p,frame,120);frame++;}
 for(let i=0;i<100;i++,frame++)rack.process(sine(frame),sine(frame),p,frame,120);
 const beforeA=rack.stretch.rateA,beforeB=rack.stretch.rateB;
 p.stretch.reverse=true;p.stretch.pitch=1;rack.process(sine(frame),sine(frame),p,frame,120);
 assert.equal(rack.stretch.rateA,beforeA);assert.equal(rack.stretch.rateB,beforeB);
 for(let n=frame+1;n<frame+SR/2;n++)rack.process(sine(n),sine(n),p,n,120);
 assert.equal(rack.stretch.rateA,-2);assert.equal(rack.stretch.rateB,-2);
});

test('all four named scratch motifs repeat over four bars and retain distinct motion/gating',()=>{
 const signatures=[];
 for(const pattern of ['BABY','TRANSFORMER','TEAR','SCRIBBLE']){
  const points=[];for(let k=0;k<128;k++){const phase=k/8+.031;const a=scratchVelocity(pattern,phase,2,.6,.8),b=scratchVelocity(pattern,phase+16,2,.6,.8);assert.ok(Math.abs(a-b)<1e-10);assert.equal(scratchGate(pattern,phase),scratchGate(pattern,phase+16));points.push(Math.round(a*1000)+scratchGate(pattern,phase)*10000);}signatures.push(points.join(','));
 }
 assert.equal(new Set(signatures).size,4);
});

test('Bend scratch entry/exit is eighth-note quantized, locks reps and updates per beat',()=>{
 const rack=new TimeRack(SR),p={stutter:{on:true,bend:true,timing:'musical',sync:true,capture:0,reps:1,warp:0,scratchPattern:'TEAR',mix:1}},s=rack.stutter;
 for(let n=0;n<beat*2;n++){if(n===beat+500)p.stutter.warp=.75;if(n===beat*1.5+500)p.stutter.warp=0;rack.process(sine(n),sine(n),p,n,120);if(n>beat+500&&n<beat*1.5)assert.equal(s.scratchActive,false);if(n===beat*1.5){assert.equal(s.scratchActive,true);assert.equal(s.actualReps,1);assert.equal(s.scratchName,'TEAR');}if(n===beat*1.5+600)assert.equal(s.scratchActive,true);}
 rack.process(0,0,p,beat*2,120);assert.equal(s.scratchActive,false);assert.equal(s.actualReps,32);
});

test('Bend WINDOW changes the real Tukey taper and captured playback energy',()=>{
 assert.equal(tukeyWindow(0,.3),0);assert.equal(tukeyWindow(.5,.3),1);assert.ok(tukeyWindow(.05,.9)<tukeyWindow(.05,.1));
 function renderWindow(window){const rack=new TimeRack(SR),p={stutter:{on:true,bend:true,timing:'musical',capture:0,reps:0,warp:0,break:0,window,gate:0,mix:1}};let sum=0;for(let n=0;n<SR;n++){const x=rack.process(.3,.3,p,n,120)[0];if(n>SR/2)sum+=x*x;}return sum;}
 assert.ok(renderWindow(.9)<renderWindow(.1)*.8);
});

test('Bend shortest TIME retains all 32 fractional repeat periods at common and low sample rates',()=>{
 for(const sr of [8000,44100,48000]){
  const rack=new TimeRack(sr),p={stutter:{on:true,bend:true,timing:'musical',sync:false,capture:0,reps:1,warp:0,break:0,window:.1,gate:0,mix:1}},bank=sr*.01,expected=bank/32,s=rack.stutter;
  let initial=-1,edges=0,last=-1,span=0,energy=0;
  for(let n=0;n<sr*.1;n++){
   const out=rack.process(.3,.3,p,n,120);assert.ok(Number.isFinite(out[0]));
   if(!s.started)continue;
   assert.equal(s.actualReps,32);assert.ok(Math.abs(s.period-expected)<1e-12,`${sr}Hz: ${s.period} vs ${expected}`);
   if(initial<0){p.stutter.freeze=true;initial=s.lastRepeatFrame;}
   if(s.lastRepeatFrame>=0&&s.lastRepeatFrame!==last){if(last>=0){const delta=s.lastRepeatFrame-last;assert.ok(delta===Math.floor(expected)||delta===Math.ceil(expected));}last=s.lastRepeatFrame;if(edges===0)initial=last;if(edges===32)span=last-initial;edges++;}
   energy+=out[0]**2;
  }
  assert.ok(Math.abs(span-bank)<=1,`${sr}Hz: 32 repeats span ${span} vs ${bank}`);assert.ok(energy>.001,'short repeats remain audible');
 }
});

test('accumulated musical beat preserves grid phase across a tempo change',()=>{
 const rack=new TimeRack(SR),p={stutter:{on:true,timing:'musical',rate:.5,capture:0,pitch:1,warp:.75,bend:false,mix:1}};let position=0;
 for(let n=0;n<SR*2;n++){const bpm=n<10000?120:60;rack.process(sine(n),sine(n),p,n,bpm,position);if(rack.stutter.started){const expected=(position/.125)%1,actual=rack.stutter.loopPos/rack.stutter.period;const error=Math.min(Math.abs(actual-expected),1-Math.abs(actual-expected));assert.ok(error<3/rack.stutter.period,`phase error ${error} at ${n}`);}position+=bpm/(60*SR);}
});
