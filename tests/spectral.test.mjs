import test from 'node:test';
import assert from 'node:assert/strict';
import {FFT,FFT_SIZES,SpectralProcessor} from '../spectral.mjs';
const rate=8192,tau=2*Math.PI;
function spectrum(samples){const size=2**Math.floor(Math.log2(samples.length)),re=Float64Array.from(samples.slice(-size)),im=new Float64Array(size);for(let i=0;i<size;i++)re[i]*=.5-.5*Math.cos(tau*i/size);new FFT(size).transform(re,im);return {re,im,size,amplitude:frequency=>Math.hypot(re[Math.round(frequency*size/rate)],im[Math.round(frequency*size/rate)])*4/size};}
function peakFrequency(samples,low=20,high=rate*.45){const analysis=spectrum(samples);let best=0,index=0;for(let k=Math.ceil(low*analysis.size/rate);k<Math.min(analysis.size/2,high*analysis.size/rate);k++){const magnitude=Math.hypot(analysis.re[k],analysis.im[k]);if(magnitude>best){best=magnitude;index=k;}}return index*rate/analysis.size;}
function render(type,params,input,{seconds=3,tonal={root:0,scale:'minor',chord:'minor'},sidechain=null,sync=false}={}){const processor=new SpectralProcessor(type,rate);processor.configure(params,tonal,true,{sync});const samples=new Float64Array(Math.round(seconds*rate));for(let frame=0;frame<samples.length;frame++){const x=input(frame,frame/rate);if(sidechain){const s=sidechain(frame,frame/rate);processor.setSidechain(s,s);}samples[frame]=processor.process(x,x,params,frame,120)[0];}return {processor,samples};}

test('FFT and STFT overlap-add reconstruct stereo at all four supported sizes',()=>{
 for(const [index,size]of FFT_SIZES.entries()){
  const real=Float64Array.from({length:size},(_,i)=>Math.sin(i*.217)+Math.cos(i*.073)*.2),imaginary=Float64Array.from({length:size},(_,i)=>Math.sin(i*.141)*.15),original=real.slice(),oldImaginary=imaginary.slice(),fft=new FFT(size);fft.transform(real,imaginary);fft.transform(real,imaginary,true);for(let i=0;i<size;i++){assert.ok(Math.abs(real[i]-original[i])<1e-10);assert.ok(Math.abs(imaginary[i]-oldImaginary[i])<1e-10);}
  const processor=new SpectralProcessor('IDENTITY',rate),params={size:index/3};processor.configure(params);let maximum=0;
  const source=frame=>Math.sin(frame*.113)*.2+Math.cos(frame*.071)*.1;
  for(let frame=0;frame<size*6;frame++){const result=processor.process(source(frame),source(frame)*-.37,params,frame,120);if(frame>size*3){maximum=Math.max(maximum,Math.abs(result[0]-source(frame-size)),Math.abs(result[1]+source(frame-size)*.37));}}
  assert.equal(processor.latency,size);assert.ok(maximum<1e-9,`N=${size} maximum reconstruction error ${maximum}`);
 }
});
test('phase-locked CHROMA remapping shifts an off-bin sine exactly one octave',()=>{
 const {samples}=render('CHROMA',{size:1/3,warp:1,tilt:.5,center:.08,width:1,gain:.5,gate:0,scan:0},(_frame,time)=>Math.sin(tau*131*time)*.2);
 const frequency=peakFrequency(samples.slice(-8192),180,350);assert.ok(Math.abs(frequency-262)<=2,`measured ${frequency}Hz`);
 const measurement=spectrum(samples.slice(-8192));assert.ok(measurement.amplitude(262)>.04);
});
test('cepstral formant envelope shifts spectral emphasis while harmonics retain their frequencies',()=>{
 const input=(_frame,time)=>{let x=0;for(let harmonic=1;harmonic<=26;harmonic++){const frequency=128*harmonic,amplitude=Math.exp(-(((frequency-1024)/230)**2))*.06+.001;x+=Math.sin(tau*frequency*time)*amplitude;}return x;};
 const neutral=render('FORMANT SHIFT',{size:1,shift:.5,detail:.12,smooth:0},input).samples,shifted=render('FORMANT SHIFT',{size:1,shift:1,detail:.12,smooth:0},input).samples;
 const before=peakFrequency(neutral.slice(-8192),500,3000),after=peakFrequency(shifted.slice(-8192),500,3200);assert.ok(before>=896&&before<=1152,`original formant ${before}`);assert.ok(after>=1664,`shifted formant ${after}`);assert.equal(after%128,0,'harmonic grid remains unchanged');
});
test('SIEVE KEY and CHORD use selected global root, scale and chord',()=>{
 const input=(_frame,time)=>Math.sin(tau*440*time)*.15+Math.sin(tau*415.305*time)*.15;
 const params={size:1,pattern:5/6,ratio:0,smooth:0,rate:0};
 const major=spectrum(render('SIEVE',params,input,{tonal:{root:0,scale:'major',chord:'major'}}).samples.slice(-8192)),minor=spectrum(render('SIEVE',params,input,{tonal:{root:0,scale:'minor',chord:'minor'}}).samples.slice(-8192));
 assert.ok(major.amplitude(440)>minor.amplitude(440)*4);assert.ok(minor.amplitude(415)>major.amplitude(415)*4);
 const chord=spectrum(render('SIEVE',{...params,pattern:1},(_frame,time)=>Math.sin(tau*440*time)*.15+Math.sin(tau*493.883*time)*.15,{tonal:{root:9,scale:'chromatic',chord:'minor'}}).samples.slice(-8192));assert.ok(chord.amplitude(440)>chord.amplitude(494)*5);
});
test('MAGNET sidechain field detects external spectral peaks and attracts the main partial',()=>{
 const {samples,processor}=render('MAGNET',{size:1,field:1,attract:1,glide:0,focus:430/(rate/2),drift:0},(_frame,time)=>Math.sin(tau*430*time)*.2,{sidechain:(_frame,time)=>Math.sin(tau*440*time)*.2});
 assert.ok(Math.abs(processor.sidechainPeaks[0]-440)<2);const frequency=peakFrequency(samples.slice(-8192),400,470);assert.ok(Math.abs(frequency-440)<4,`attracted ${frequency}Hz`);
});
test('STILLS freezes selected partials into a stereo oscillator bank that rings without input',()=>{
 const params={size:1/3,slice:0,voices:0,blur:0,tension:0,octave:.5,wave:0,feedback:0},processor=new SpectralProcessor('STILLS',rate);processor.configure(params);const out=new Float64Array(rate*3);
 let stereoError=0;for(let frame=0;frame<out.length;frame++){const x=frame<rate*.4?Math.sin(tau*256*frame/rate)*.2:0,result=processor.process(x,-x,params,frame,120);out[frame]=result[0];if(frame>rate)stereoError=Math.max(stereoError,Math.abs(result[0]+result[1]));}
 assert.equal(processor.voiceCount,1);assert.ok(Math.abs(processor.voiceFreq[0]-256)<2);assert.ok(spectrum(out.slice(-8192)).amplitude(256)>.1);
 assert.ok(stereoError<1e-9,'snapshot preserves the opposite stereo phase');
});
test('SEPARATE partition reconstructs unity and tonal-only pitch preserves residual noise frequencies',()=>{
 const source=frame=>Math.sin(tau*256*frame/rate)*.15+(Math.sin(frame*78.233)*43758.5453%1)*.025;
 const neutral=render('SEPARATE',{size:1/3,tonal:.5,noise:.5,hits:.5,pitch:.5,spread:0,tight:.5},source),delay=neutral.processor.latency;let error=0;
 for(let frame=rate;frame<neutral.samples.length;frame++)error=Math.max(error,Math.abs(neutral.samples[frame]-source(frame-delay)));
 assert.ok(error<1e-8,`partition reconstruction error ${error}`);
 const pitched=render('SEPARATE',{size:1/3,tonal:1,noise:0,hits:0,pitch:1,spread:0,tight:.5},source).samples;
 assert.ok(Math.abs(peakFrequency(pitched.slice(-8192),400,600)-512)<=2);
});
test('SMEAR HOLD captures once per musical division and releases only at the next boundary',()=>{
 const params={size:1/3,smear:.1,tilt:.5,feedback:0,diff:0,direction:.5,hold:1/7};
 const result=render('SMEAR',params,(_frame,time)=>time<.4?Math.sin(tau*256*time)*.2:0,{seconds:3}).samples;
 const rms=values=>Math.sqrt(values.reduce((sum,value)=>sum+value*value,0)/values.length);
 assert.ok(rms(result.slice(rate,Math.round(rate*1.7)))>.002,'held spectrum remains audible after source stops');
 assert.ok(rms(result.slice(Math.round(rate*2.5)))<1e-8,'next bar captures silence');
});
test('spectral delay uses exact musical lengths at both tempos and supports low-band freeze/low-cut',()=>{
 const params={size:0,time:0,tilt:.5,feedback:0,blur:0,shift:.5,spread:0,damp:0,gate:0,locut:0,shape:0,freeze:0,band:0,split:.5};
 for(const bpm of [60,120]){
  const processor=new SpectralProcessor('SPECTRAL DELAY',rate);processor.configure(params,undefined,false,{sync:true});let peak=0,index=0;
  for(let frame=0;frame<rate;frame++){const output=processor.process(frame===2048?.5:0,0,params,frame,bpm)[0];if(Math.abs(output)>peak){peak=Math.abs(output);index=frame;}}
  assert.equal(index,2048+512+Math.round(.25*60/bpm*rate));assert.ok(peak>.49);
 }
 const processor=new SpectralProcessor('SPECTRAL DELAY',rate),freeze={...params,time:.1,split:Math.log(500/60)/Math.log(200),band:.5};processor.configure(freeze);const out=new Float64Array(rate*3);
 for(let frame=0;frame<out.length;frame++){if(frame===rate)freeze.freeze=1;const x=frame<rate?(Math.sin(tau*256*frame/rate)+Math.sin(tau*1024*frame/rate))*.1:0;out[frame]=processor.process(x,x,freeze,frame,120)[0];}
 const held=spectrum(out.slice(-8192));assert.ok(held.amplitude(256)>.04);assert.ok(held.amplitude(1024)<.002);
 const cut=spectrum(render('SPECTRAL DELAY',{...params,time:.1,locut:.7},(_frame,time)=>(Math.sin(tau*256*time)+Math.sin(tau*1024*time))*.1).samples.slice(-8192));assert.ok(cut.amplitude(1024)>cut.amplitude(256)*20);
});
test('CONTRAST maximum SUSTAIN holds partial amplitudes and measured pitch after the source stops',()=>{
 const source=(_frame,time)=>time<.5?Math.sin(tau*131*time)*.15:0,params={size:1/3,strong:.5,medium:.5,weak:.5,low:0,high:1,smooth:0,sustain:1};
 const held=render('CONTRAST',params,source).samples,normal=render('CONTRAST',{...params,sustain:0},source).samples;
 assert.ok(spectrum(held.slice(-8192)).amplitude(131)>.08);assert.ok(spectrum(normal.slice(-8192)).amplitude(131)<1e-10);
 assert.ok(Math.abs(peakFrequency(held.slice(-8192),100,180)-131)<=1);
});
test('spectral delay SHAPE changes the actual time-frequency response and GATE removes weak partials',()=>{
 const input=(_frame,time)=>Math.sin(tau*(80*time+180*time*time))*.15,params={size:0,time:.3,tilt:1,feedback:.2,blur:0,shift:.5,spread:0,damp:0,locut:0,gate:0,shape:0};
 const reference=render('SPECTRAL DELAY',params,input).samples;
 for(let shape=1;shape<6;shape++){const output=render('SPECTRAL DELAY',{...params,shape:shape/5},input).samples;let energy=0;for(let frame=rate;frame<output.length;frame++)energy+=(output[frame]-reference[frame])**2;assert.ok(energy>.1,`shape ${shape} response differs`);}
 const tones=(_frame,time)=>Math.sin(tau*256*time)*.2+Math.sin(tau*1024*time)*.008;
 const plain=spectrum(render('SPECTRAL DELAY',{...params,time:.1,tilt:.5,feedback:0},tones).samples.slice(-8192)),gated=spectrum(render('SPECTRAL DELAY',{...params,time:.1,tilt:.5,feedback:0,gate:1},tones).samples.slice(-8192));
 assert.ok(plain.amplitude(1024)>gated.amplitude(1024)*10);assert.ok(gated.amplitude(256)>.1);
});
test('SMEAR DOWN and UP distribute energy on the correct side of the original partial',()=>{
 const params={size:0,smear:1,feedback:0,diff:0,tilt:.5,hold:0},tone=(_frame,time)=>Math.sin(tau*1536*time)*.2;
 const centroid=samples=>{const analysis=spectrum(samples.slice(-8192));let sum=0,weight=0;for(let bin=500;bin<2500;bin++){const energy=analysis.re[bin]**2+analysis.im[bin]**2;sum+=bin*energy;weight+=energy;}return sum/weight;};
 const down=centroid(render('SMEAR',{...params,direction:0},tone).samples),up=centroid(render('SMEAR',{...params,direction:1},tone).samples);assert.ok(down<1400,`DOWN centroid ${down}`);assert.ok(up>1650,`UP centroid ${up}`);
});
