// Stereo STFT with 4x overlap, sqrt-Hann analysis/synthesis and phase-locked remapping.
const TAU=2*Math.PI,clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(x)?x:a));
const val=(p,k,d=.5)=>Number.isFinite(p?.[k])?clamp(p[k]):d;
const wrap=x=>x-TAU*Math.round(x/TAU),pc=x=>(x%12+12)%12;
const SCALES={major:[0,2,4,5,7,9,11],minor:[0,2,3,5,7,8,10],dorian:[0,2,3,5,7,9,10],pentatonic:[0,2,4,7,9],chromatic:[0,1,2,3,4,5,6,7,8,9,10,11]};
const CHORDS={major:[0,4,7],minor:[0,3,7],diminished:[0,3,6],augmented:[0,4,8],sus2:[0,2,7],sus4:[0,5,7],major7:[0,4,7,11],minor7:[0,3,7,10],dominant7:[0,4,7,10],dim7:[0,3,6,9],sixth:[0,4,7,9],minor6:[0,3,7,9]};
export const FFT_SIZES=Object.freeze([512,1024,2048,4096]);
export const SPECTRAL_TYPES=new Set(['SIEVE','CHROMA','CONTRAST','SEPARATE','SMEAR','FORMANT SHIFT','MAGNET','STILLS','WARP','SPECTRAL DELAY']);
export const fftSize=value=>FFT_SIZES[Math.round(clamp(value)*3)];
const seeded=(i,seed=7)=>{let n=Math.imul(i^seed,0x45d9f3b);n^=n>>>16;return(n>>>0)/4294967296;};
const median=(values,count)=>{for(let i=1;i<count;i++){const v=values[i];let j=i-1;while(j>=0&&values[j]>v){values[j+1]=values[j];j--;}values[j+1]=v;}return values[count>>1];};
export class FFT{
 constructor(size=512){if(size<2||size>16384||size&(size-1))throw new Error('FFT size must be a power of two,2–16384.');this.size=size;this.bits=new Uint16Array(size);this.cos=new Float64Array(size/2);this.sin=new Float64Array(size/2);const bits=Math.log2(size);for(let i=0;i<size;i++){let j=i,r=0;for(let b=0;b<bits;b++){r=(r<<1)|(j&1);j>>=1;}this.bits[i]=r;}for(let i=0;i<size/2;i++){this.cos[i]=Math.cos(TAU*i/size);this.sin[i]=Math.sin(TAU*i/size);}}
 transform(re,im,inverse=false){const n=this.size;for(let i=0;i<n;i++){const j=this.bits[i];if(j>i){let t=re[i];re[i]=re[j];re[j]=t;t=im[i];im[i]=im[j];im[j]=t;}}for(let size=2;size<=n;size*=2){const half=size/2,stride=n/size;for(let first=0;first<n;first+=size)for(let j=0;j<half;j++){const k=j*stride,c=this.cos[k],s=this.sin[k]*(inverse?1:-1),a=first+j,b=a+half,tr=re[b]*c-im[b]*s,ti=re[b]*s+im[b]*c;re[b]=re[a]-tr;im[b]=im[a]-ti;re[a]+=tr;im[a]+=ti;}}if(inverse)for(let i=0;i<n;i++){re[i]/=n;im[i]/=n;}}
}

export class SpectralProcessor{
 constructor(type,sampleRate){this.type=type;this.sr=sampleRate;this.tonal={root:0,scale:'minor',chord:'minor'};this.snap=false;this.sync=false;this.sidechainPeaks=new Float64Array(8);this.sidechainMagnitudes=new Float64Array(8);this.result=[0,0];this._allocate(512);}
 _allocate(n){
  this.n=n;this.hop=n/4;this.bins=n/2+1;this.latency=n;this.mask=n-1;this.outMask=n*4-1;this.fft=new FFT(n);
  const pair=(length,Type=Float64Array)=>[new Type(length),new Type(length)];
  this.input=pair(n);this.output=pair(n*4);this.sideInput=new Float64Array(n);this.sideRe=new Float64Array(n);this.sideIm=new Float64Array(n);
  this.re=new Float64Array(n);this.im=new Float64Array(n);this.a=new Float64Array(this.bins);this.b=new Float64Array(this.bins);this.mag=new Float64Array(this.bins);this.angles=new Float64Array(this.bins);this.inst=new Float64Array(this.bins);this.env=new Float64Array(this.bins);
  this.mapping=new Float64Array(this.bins);this.amps=new Float64Array(this.bins);this.peaks=new Int32Array(this.bins);this.previous=pair(this.bins);this.previousPhase=pair(this.bins);this.saved=pair(this.bins);this.phase=pair(this.bins);this.mapState=pair(this.bins);
  this.hpss=pair(this.bins*9);this.hpssScratch=new Float64Array(19);this.hitEnv=new Float64Array(2);
  this.sustainEnvelope=pair(this.bins);this.sustainInst=pair(this.bins);this.contrastPeak=new Float64Array(2);
  this.frozenMag=pair(this.bins);this.frozenPhase=pair(this.bins);this.frozenInst=pair(this.bins);this.wasFrozen=pair(this.bins,Uint8Array);this.delayOldPhase=pair(this.bins);this.delaySynthPhase=pair(this.bins);
  this.historyFrames=this.type==='SPECTRAL DELAY'?Math.ceil(this.sr*8/this.hop)+3:0;
  this.history=this.historyFrames?pair(this.historyFrames*this.bins*2,Float32Array):null;
  this.window=Float64Array.from({length:n},(_,i)=>Math.sqrt(.5-.5*Math.cos(TAU*i/n)));this.windowSum=this.window.reduce((sum,x)=>sum+x,0);
  this.cepRe=new Float64Array(n);this.cepIm=new Float64Array(n);
  this.voiceFreq=new Float64Array(33);this.voiceAmp=pair(33);this.voiceTarget=pair(33);this.voicePhase=pair(33);this.voiceTri=pair(33);this.voicePeak=new Int32Array(33);this.voiceCount=0;
  this.snapshotMag=pair(this.bins);this.snapshotInst=pair(this.bins);this.snapshotPhase=pair(this.bins);this.reset();
 }
 configure(params={},tonal=this.tonal,snap=this.snap,context={}){const size=fftSize(val(params,'size',0));if(size!==this.n)this._allocate(size);this.tonal=tonal??this.tonal;this.snap=!!snap;this.sync=!!context.sync;this.params=params;return this.latency;}
 reset(){
  for(const field of ['input','output','previous','previousPhase','saved','phase','hpss','sustainEnvelope','sustainInst','frozenMag','frozenPhase','frozenInst','wasFrozen','delayOldPhase','delaySynthPhase','voiceAmp','voiceTarget','voicePhase','voiceTri','snapshotMag','snapshotInst','snapshotPhase'])for(const array of this[field]??[])array.fill(0);
  for(const array of this.mapState??[])array.fill(NaN);for(const array of this.history??[])array.fill(0);
  this.sideInput.fill(0);this.sidechainPeaks.fill(0);this.sidechainMagnitudes.fill(0);this.voiceFreq.fill(0);this.hitEnv.fill(0);
  this.contrastPeak.fill(0);
  this.write=0;this.outPos=0;this.samples=0;this.frames=0;this.seed=0x49567;this.lastSlice=-1;this.holdSlice=[-1,-1];this.sideLeft=0;this.sideRight=0;this.voiceCount=0;this.clockBeat=null;
 }
 random(){this.seed^=this.seed<<13;this.seed^=this.seed>>>17;this.seed^=this.seed<<5;return(this.seed>>>0)/4294967296;}
 setSidechain(left,right){this.sideLeft=Number.isFinite(left)?left:0;this.sideRight=Number.isFinite(right)?right:0;}
 scaleNotes(){return SCALES[this.tonal?.scale]??SCALES.minor;}
 chordNotes(){return CHORDS[this.tonal?.chord]??CHORDS.minor;}
 nearestNote(note,notes=this.scaleNotes(),root=Number(this.tonal?.root)||0){let nearest=Math.round(note),distance=Infinity;for(let pitch=Math.floor(note)-12;pitch<=Math.ceil(note)+12;pitch++)if(notes.includes(pc(pitch-root))&&Math.abs(pitch-note)<distance){nearest=pitch;distance=Math.abs(pitch-note);}return nearest;}
 snapInterval(interval){return this.nearestNote(interval,this.scaleNotes(),0);}
 _sidechainAnalysis(){
  if(this.type!=='MAGNET')return;
  for(let i=0;i<this.n;i++){this.sideRe[i]=this.sideInput[(this.write+i)&this.mask]*this.window[i];this.sideIm[i]=0;}
  this.fft.transform(this.sideRe,this.sideIm);this.sidechainPeaks.fill(0);this.sidechainMagnitudes.fill(0);
  for(let k=1;k<this.bins-1;k++){
   const amplitude=Math.hypot(this.sideRe[k],this.sideIm[k]);if(amplitude<=Math.hypot(this.sideRe[k-1],this.sideIm[k-1])||amplitude<Math.hypot(this.sideRe[k+1],this.sideIm[k+1]))continue;
   for(let index=0;index<8;index++)if(amplitude>this.sidechainMagnitudes[index]){
    for(let j=7;j>index;j--){this.sidechainMagnitudes[j]=this.sidechainMagnitudes[j-1];this.sidechainPeaks[j]=this.sidechainPeaks[j-1];}
    const prev=Math.hypot(this.sideRe[k-1],this.sideIm[k-1]),next=Math.hypot(this.sideRe[k+1],this.sideIm[k+1]),delta=clamp(.5*(prev-next)/(prev-2*amplitude+next||1),-.5,.5);
    this.sidechainMagnitudes[index]=amplitude;this.sidechainPeaks[index]=(k+delta)*this.sr/this.n;break;
   }
  }
 }
 _analysis(ch){
  let maximum=1e-12,total=0,flux=0;const prior=this.previous[ch],oldPhase=this.previousPhase[ch];
  for(let k=0;k<this.bins;k++){
   const re=this.re[k],im=this.im[k],magnitude=Math.hypot(re,im),angle=Math.atan2(im,re);this.a[k]=re;this.b[k]=im;this.mag[k]=magnitude;this.angles[k]=angle;
   this.inst[k]=k+wrap(angle-oldPhase[k]-TAU*k*this.hop/this.n)*this.n/(TAU*this.hop);oldPhase[k]=angle;
   maximum=Math.max(maximum,magnitude);total+=magnitude;flux+=Math.max(0,magnitude-prior[k]);
  }
  this.maximum=maximum;this.total=total;this.flux=flux/Math.max(total,1e-12);
 }
 _remap(ch,clear=true){
  const {re,im,a,b,mag,angles,mapping,amps,inst,bins,hop,n}=this,synth=this.phase[ch],prior=this.previous[ch];
  if(clear){re.fill(0);im.fill(0);}
  // Identity phase locking: all bins around a local maximum retain their relative phase.
  let last=0;for(let k=0;k<bins;k++){if(k>0&&k<bins-1&&mag[k]>=mag[k-1]&&mag[k]>mag[k+1])last=k;this.peaks[k]=last;}
  let next=bins-1;for(let k=bins-1;k>=0;k--){if(k>0&&k<bins-1&&mag[k]>=mag[k-1]&&mag[k]>mag[k+1])next=k;if(Math.abs(next-k)<Math.abs(this.peaks[k]-k))this.peaks[k]=next;}
  for(let k=0;k<bins;k++){
   const slope=k>0&&k<bins-1?(mapping[k+1]-mapping[k-1])*.5:1;
   const frequency=mapping[k]+(inst[k]-k)*slope;
   synth[k]=prior[k]<this.maximum*.0001?angles[k]:synth[k]+TAU*frequency*hop/n;
   if(Math.abs(synth[k])>1e6)synth[k]=wrap(synth[k]);
  }
  for(let k=0;k<bins;k++){
   const destination=mapping[k];if(destination<0||destination>=bins-1||!Number.isFinite(destination))continue;
   const index=Math.floor(destination),fraction=destination-index,peak=this.peaks[k],phase=synth[peak]+wrap(angles[k]-angles[peak]),amplitude=amps[k];
   const real=Math.cos(phase)*amplitude,imaginary=Math.sin(phase)*amplitude;
   re[index]+=real*(1-fraction);im[index]+=imaginary*(1-fraction);re[index+1]+=real*fraction;im[index+1]+=imaginary*fraction;
  }
 }
 _formantEnvelope(detail){
  const floor=this.maximum*1e-7;for(let k=0;k<this.bins;k++){this.cepRe[k]=Math.log(this.mag[k]+floor);this.cepIm[k]=0;}
  for(let k=1;k<this.bins-1;k++){this.cepRe[this.n-k]=this.cepRe[k];this.cepIm[this.n-k]=0;}
  this.fft.transform(this.cepRe,this.cepIm,true);
  const keep=Math.max(4,Math.round(6+detail*Math.min(100,this.n/16)));
  for(let q=keep+1;q<this.n-keep;q++){this.cepRe[q]=0;this.cepIm[q]=0;}
  this.fft.transform(this.cepRe,this.cepIm);for(let k=0;k<this.bins;k++)this.env[k]=Math.exp(clamp(this.cepRe[k],-30,30));
 }
 _separate(p,ch){
  const memory=this.hpss[ch],slot=this.frames%9,scratch=this.hpssScratch,prior=this.previous[ch],tonalGain=val(p,'tonal',.7)*2,noiseGain=val(p,'noise',.35)*2,hitsGain=val(p,'hits',.5)*2;
  const decay=Math.exp(-this.hop/(this.sr*(.008+(1-val(p,'tight',.3))**2*.3)));this.hitEnv[ch]=Math.max(this.flux,this.hitEnv[ch]*decay);
  this.re.fill(0);this.im.fill(0);const interval=(val(p,'pitch',.5)-.5)*24,ratio=2**((this.snap?this.snapInterval(interval):interval)/12);
  for(let k=0;k<this.bins;k++){
   memory[slot*this.bins+k]=this.mag[k];for(let frame=0;frame<9;frame++)scratch[frame]=memory[frame*this.bins+k];const horizontal=median(scratch,9);
   for(let offset=-8;offset<=8;offset++)scratch[offset+8]=this.mag[Math.max(0,Math.min(this.bins-1,k+offset))];const vertical=median(scratch,17);
   const prominence=clamp((this.mag[k]/(vertical+this.maximum*.0001)-1.5)/3),persistence=clamp(horizontal/(this.mag[k]+1e-12)),harmonic=prominence*(.2+.8*persistence);
   const attack=clamp(Math.max(this.hitEnv[ch],(this.mag[k]-prior[k])/(this.mag[k]+1e-12))*(.6+val(p,'tight',.3))),hit=(1-harmonic)*attack,noise=Math.max(0,1-harmonic-hit);
   const rotation=(ch?1:-1)*val(p,'spread',.3)*Math.sin(k*2.399963)*Math.PI*.75,nr=this.a[k]*Math.cos(rotation)-this.b[k]*Math.sin(rotation),ni=this.a[k]*Math.sin(rotation)+this.b[k]*Math.cos(rotation);
   this.re[k]=nr*noise*noiseGain+this.a[k]*hit*hitsGain;this.im[k]=ni*noise*noiseGain+this.b[k]*hit*hitsGain;
   this.mapping[k]=k*ratio;this.amps[k]=this.mag[k]*harmonic*tonalGain;
  }
  if(Math.abs(ratio-1)<1e-8)for(let k=0;k<this.bins;k++){const gain=this.amps[k]/(this.mag[k]+1e-12);this.re[k]+=this.a[k]*gain;this.im[k]+=this.b[k]*gain;}
  else this._remap(ch,false);
 }
 _spectralDelay(p,ch,beat,bpm){
  const bins=this.bins,history=this.history[ch],now=this.frames%this.historyFrames,feedback=val(p,'feedback',.35)*.98,shape=Math.round(val(p,'shape',0)*5),shift=(val(p,'shift',.5)-.5)*24,ratio=2**((this.snap?this.snapInterval(shift):shift)/12);
  const seconds=this.sync?[.25,.5,1,2,4][Math.round(val(p,'time',.4)*4)]*60/bpm:.01+val(p,'time',.4)**2*7.99;
  const lowCut=val(p,'locut',0)===0?0:20*100**val(p,'locut',0),split=60*200**val(p,'split',.5),band=Math.round(val(p,'band',0)*2),freeze=val(p,'freeze',0)>.5;
  for(let k=0;k<bins;k++){
   const x=k/(bins-1),hz=k*this.sr/this.n,tilt=2*val(p,'tilt',.5)-1;let distribution=tilt>=0?1-tilt*(1-x):1+tilt*x;
   if(shape===1)distribution*=distribution;else if(shape===2)distribution=Math.sqrt(distribution);else if(shape===3)distribution=Math.round(distribution*7)/7;else if(shape===4)distribution=seeded(k,83);else if(shape===5){const note=hz>0?this.nearestNote(69+12*Math.log2(hz/440)):0;distribution=pc(note-(this.tonal?.root??0))/11;}
   distribution=clamp(distribution+(seeded(k,17)-.5)*val(p,'blur',.15)*.3+ch*val(p,'spread',.6)*.12,.01,1);
   const delay=clamp(Math.round(seconds*this.sr/this.hop*distribution),1,this.historyFrames-1),read=((now-delay+this.historyFrames)%this.historyFrames*bins+k)*2,write=(now*bins+k)*2;
   let real=history[read],imaginary=history[read+1];const selected=band===0||band===1&&hz<split||band===2&&hz>=split,angle=Math.atan2(imaginary,real),instant=k+wrap(angle-this.frozenPhase[ch][k]-TAU*k*this.hop/this.n)*this.n/(TAU*this.hop);
   if(freeze&&selected){
    if(!this.wasFrozen[ch][k]){this.frozenMag[ch][k]=Math.hypot(real,imaginary);this.frozenPhase[ch][k]=angle;this.frozenInst[ch][k]=instant;}
    else this.frozenPhase[ch][k]+=TAU*this.frozenInst[ch][k]*this.hop/this.n;
    real=Math.cos(this.frozenPhase[ch][k])*this.frozenMag[ch][k];imaginary=Math.sin(this.frozenPhase[ch][k])*this.frozenMag[ch][k];this.wasFrozen[ch][k]=1;
   }else{this.wasFrozen[ch][k]=0;this.frozenPhase[ch][k]=angle;this.frozenInst[ch][k]=instant;}
   const damping=1-val(p,'damp',.3)*x*.95;this.re[k]=real*damping;this.im[k]=imaginary*damping;
   if(!(freeze&&selected)){
    const incoming=this.mag[k]>=this.maximum*val(p,'gate',0)*.2&&hz>=lowCut;
    history[write]=clamp((incoming?this.a[k]:0)+this.re[k]*feedback,-1000,1000);history[write+1]=clamp((incoming?this.b[k]:0)+this.im[k]*feedback,-1000,1000);
   }
  }
  if(Math.abs(ratio-1)>.00001){
   // Phase-vocoder synthesis on delayed bins; preserve measured delayed frequency.
   this.a.set(this.re.subarray(0,bins));this.b.set(this.im.subarray(0,bins));this.re.fill(0);this.im.fill(0);
   for(let k=1;k<bins-1;k++){
    const phase=Math.atan2(this.b[k],this.a[k]),instant=k+wrap(phase-this.delayOldPhase[ch][k]-TAU*k*this.hop/this.n)*this.n/(TAU*this.hop);this.delayOldPhase[ch][k]=phase;
    this.delaySynthPhase[ch][k]+=TAU*instant*ratio*this.hop/this.n;const target=k*ratio;if(target>=bins-1)continue;const index=Math.floor(target),fraction=target-index,amplitude=Math.hypot(this.a[k],this.b[k]),r=Math.cos(this.delaySynthPhase[ch][k])*amplitude,i=Math.sin(this.delaySynthPhase[ch][k])*amplitude;
    this.re[index]+=r*(1-fraction);this.im[index]+=i*(1-fraction);this.re[index+1]+=r*fraction;this.im[index+1]+=i*fraction;
   }
  }
 }
 modify(p,ch,frame,bpm){
  this._analysis(ch);const {re,im,mag,a,b,bins,n}=this,save=this.saved[ch],beat=Number.isFinite(this.clockBeat)?this.clockBeat:frame/this.sr*bpm/60;
  switch(this.type){
   case 'SIEVE':{
    const mode=Math.round(val(p,'pattern',0)*6),stride=1+Math.round(val(p,'ratio',.4)*12),offset=Math.floor(beat*(.25+val(p,'rate',.4)*8)),smooth=val(p,'smooth',.3);
    for(let k=0;k<bins;k++){
     const number=Math.floor(k/stride)+offset;let on;
     if(mode===0){on=number>=2;for(let divisor=2;divisor*divisor<=number&&on;divisor++)if(number%divisor===0)on=false;}
     else if(mode===1){const q=number%145;on=q===0||q===1||q===2||q===3||q===5||q===8||q===13||q===21||q===34||q===55||q===89||q===144;}
     else if(mode===2)on=number>0&&(number&(number-1))===0;else if(mode===3)on=number%2===1;else if(mode===4)on=number%2===0;
     else{const note=Math.round(69+12*Math.log2(Math.max(1,k*this.sr/n)/440));on=(mode===5?this.scaleNotes():this.chordNotes()).includes(pc(note-(this.tonal?.root??0)));}
     save[k]+=(Number(on)-save[k])*(1-.96*smooth);re[k]*=save[k];im[k]*=save[k];
    }break;
   }
   case 'CHROMA':{
    const scanPeriod=[16,8,4,2,1,.5][Math.round(val(p,'scan',0)*5)],width=.025+val(p,'width',.5)*.6,tilt=(val(p,'tilt',.5)-.5)*3,interval=(val(p,'warp',.5)-.5)*24,ratio=2**((this.snap?this.snapInterval(interval):interval)/12);let center=clamp(val(p,'center',.5)+(val(p,'scan',0)>0?Math.sin(TAU*beat/scanPeriod)*.35:0));
    if(this.snap){const hz=Math.max(20,center*this.sr*.5),note=this.nearestNote(69+12*Math.log2(hz/440));center=440*2**((note-69)/12)/(this.sr*.5);}
    for(let k=0;k<bins;k++){const x=k/(bins-1),focus=Math.exp(-(((x-center)/width)**2)),gain=mag[k]<this.maximum*val(p,'gate',.05)*.08?0:(.12+focus*val(p,'gain',.65)*2)*2**(tilt*(x-.5));this.mapping[k]=k*ratio;this.amps[k]=mag[k]*gain;if(Math.abs(ratio-1)<1e-8){re[k]*=gain;im[k]*=gain;}}
    if(Math.abs(ratio-1)>=1e-8)this._remap(ch);break;
   }
   case 'CONTRAST':{
    const low=val(p,'low',.05)*(bins-1),high=val(p,'high',.95)*(bins-1),sustain=val(p,'sustain',.3),release=sustain>=.999?1:Math.exp(-this.hop/(this.sr*(.005+sustain*sustain*4))),envelope=this.sustainEnvelope[ch];this.contrastPeak[ch]=Math.max(this.maximum,this.contrastPeak[ch]*release);
    for(let k=0;k<bins;k++)if(k>=low&&k<=high){
     const amplitude=sustain===0?mag[k]:Math.max(mag[k],envelope[k]*release);envelope[k]=amplitude;const rel=amplitude/Math.max(this.contrastPeak[ch],1e-12),target=val(p,rel>.3?'strong':rel>.04?'medium':'weak',.5)*2,neighbor=(mag[Math.max(0,k-1)]+mag[Math.min(bins-1,k+1)])/(2*this.maximum),adjacent=val(p,neighbor>.3?'strong':neighbor>.04?'medium':'weak',.5)*2,gain=target*(1-val(p,'smooth',.4))+adjacent*val(p,'smooth',.4);
     if(mag[k]>=amplitude*.95||sustain===0){this.phase[ch][k]=this.angles[k];this.sustainInst[ch][k]=this.inst[k];}else this.phase[ch][k]+=TAU*this.sustainInst[ch][k]*this.hop/n;
     re[k]=Math.cos(this.phase[ch][k])*amplitude*gain;im[k]=Math.sin(this.phase[ch][k])*amplitude*gain;
    }break;
   }
   case 'SEPARATE':this._separate(p,ch);break;
   case 'SMEAR':{
    const span=1+Math.round(val(p,'smear',.45)*Math.min(64,bins/8)),feedback=val(p,'feedback',.3)*.98,direction=Math.round(val(p,'direction',.5)*2),hold=val(p,'hold',0),period=[4,2,1,.5,.25,.125,.0625][Math.max(0,Math.round(hold*7)-1)],slice=Math.floor(beat/period),capture=hold===0||this.holdSlice[ch]!==slice;
    for(let k=0;k<bins;k++){
     let sum=0,count=0;for(let j=-span;j<=span;j++){if(direction===0&&j<0||direction===2&&j>0)continue;sum+=mag[Math.max(0,Math.min(bins-1,k+j))];count++;}
     if(capture)save[k]=(sum/count)*(1-feedback)+save[k]*feedback;
     this.phase[ch][k]+=TAU*(this.previous[ch][k]>this.maximum*.001?this.inst[k]:k)*this.hop/n+(this.random()-.5)*val(p,'diff',.3)*.3;
     const amp=save[k]*2**((val(p,'tilt',.5)-.5)*k/(bins-1)*2);re[k]=Math.cos(this.phase[ch][k])*amp;im[k]=Math.sin(this.phase[ch][k])*amp;
    }this.holdSlice[ch]=slice;break;
   }
   case 'FORMANT SHIFT':{
    this._formantEnvelope(val(p,'detail',.5));const ratio=2**((val(p,'shift',.65)-.5)*2),smooth=val(p,'smooth',.4);
    for(let k=0;k<bins;k++){const source=k/ratio,index=Math.min(bins-1,Math.floor(source)),fraction=source-index,target=this.env[index]*(1-fraction)+this.env[Math.min(bins-1,index+1)]*fraction,gain=clamp(target/(this.env[k]+this.maximum*1e-7),.025,16);save[k]+=(gain-save[k])*(1-smooth*.94);re[k]*=save[k];im[k]*=save[k];}break;
   }
   case 'MAGNET':{
    const field=Math.round(val(p,'field',0)*3),rowScale=Object.keys(SCALES)[Math.round(val(p,'scale',.25)*4)],notes=field===1?this.chordNotes():field===2?SCALES[rowScale]:this.scaleNotes(),root=field===2?Math.round(val(p,'root',0)*11):this.tonal?.root??0,glide=1-val(p,'glide',.3)*.98;
    for(let k=0;k<bins;k++){
     const hz=Math.max(1,this.inst[k]*this.sr/n),note=69+12*Math.log2(hz/440);let target=440*2**((this.nearestNote(note,notes,root)-69)/12);
     if(field===3&&this.sidechainPeaks[0]>0){let distance=Infinity;for(let i=0;i<8&&this.sidechainPeaks[i]>0;i++){if(this.sidechainMagnitudes[i]<this.sidechainMagnitudes[0]*.05)continue;const candidate=this.sidechainPeaks[i],delta=Math.abs(Math.log(candidate/hz));if(delta<distance){distance=delta;target=candidate;}}}
     const focus=.15+.85*Math.exp(-(((k/(bins-1)-val(p,'focus',.5))/.4)**2)),desired=k+(target*n/this.sr-k)*val(p,'attract',.65)*focus+Math.sin(this.frames*.03+k)*val(p,'drift',.1)*.3;
     if(!Number.isFinite(this.mapState[ch][k]))this.mapState[ch][k]=desired;else this.mapState[ch][k]+=(desired-this.mapState[ch][k])*glide;
     this.mapping[k]=this.mapState[ch][k];this.amps[k]=mag[k];
    }this._remap(ch);break;
   }
   case 'WARP':{
    const mode=Math.round(val(p,'curve',0)*3),pivot=.02+val(p,'pivot',.45)*.96,stretch=.3+val(p,'stretch',.65)*2,glide=1-val(p,'glide',.3)*.98;
    for(let k=0;k<bins;k++){const x=k/(bins-1);let y;if(mode===0)y=pivot+Math.sign(x-pivot)*Math.abs(x-pivot)**stretch;else if(mode===1)y=pivot+(x-pivot)*stretch;else if(mode===2)y=pivot-(x-pivot)*stretch;else y=Math.abs(((x*stretch+pivot)%2)-1);let target=y*(bins-1);if(this.snap&&target>0){const note=69+12*Math.log2(target*this.sr/n/440);target=440*2**((this.nearestNote(note)-69)/12)*n/this.sr;}if(!Number.isFinite(this.mapState[ch][k]))this.mapState[ch][k]=target;else this.mapState[ch][k]+=(target-this.mapState[ch][k])*glide;this.mapping[k]=this.mapState[ch][k];this.amps[k]=mag[k]*2**((val(p,'tilt',.5)-.5)*x*2);}this._remap(ch);break;
   }
   case 'SPECTRAL DELAY':this._spectralDelay(p,ch,beat,bpm);break;
   case 'STILLS':this.snapshotMag[ch].set(mag);this.snapshotInst[ch].set(this.inst);this.snapshotPhase[ch].set(this.angles);break;
  }
  this.previous[ch].set(mag);for(let k=0;k<bins;k++)if(!Number.isFinite(re[k])||!Number.isFinite(im[k]))re[k]=im[k]=0;
 }
 _snapshotVoices(p,beat){
  if(this.samples<this.n)return;
  const period=[16,8,4,2,1,.5,.25,.125][Math.round(val(p,'slice',.4)*7)],slice=Math.floor(beat/period);if(slice===this.lastSlice)return;this.lastSlice=slice;
  const count=1+Math.round(val(p,'voices',.5)*32),mags=this.snapshotMag;this.voicePeak.fill(0);this.voiceCount=count;let peakMaximum=0;for(let k=1;k<this.bins;k++)peakMaximum=Math.max(peakMaximum,(mags[0][k]+mags[1][k])*.5);
  for(let voice=0;voice<count;voice++){
   let best=0,amplitude=0;
   for(let k=1;k<this.bins-1;k++){const m=(mags[0][k]+mags[1][k])*.5;if(m<1e-10||m<peakMaximum*.001||m<amplitude||m<(mags[0][k-1]+mags[1][k-1])*.5||m<(mags[0][k+1]+mags[1][k+1])*.5)continue;let used=false;for(let previous=0;previous<voice;previous++)if(Math.abs(this.voicePeak[previous]-k)<2){used=true;break;}if(!used){best=k;amplitude=m;}}
   this.voicePeak[voice]=best;const measured=(this.snapshotInst[0][best]+this.snapshotInst[1][best])*.5,previousFrequency=this.voiceFreq[voice];
   this.voiceFreq[voice]=best?Math.max(1,measured*this.sr/this.n):previousFrequency;
   for(let ch=0;ch<2;ch++){if(Math.abs(previousFrequency-this.voiceFreq[voice])>Math.max(1,previousFrequency*.1)||this.voiceAmp[ch][voice]<1e-7)this.voicePhase[ch][voice]=((this.snapshotPhase[ch][best]/TAU)%1+1)%1;this.voiceTarget[ch][voice]=(best?mags[ch][best]*2/this.windowSum:0)*(1-val(p,'feedback',.2)*.8)+this.voiceTarget[ch][voice]*val(p,'feedback',.2)*.8;}
  }
  for(let voice=count;voice<33;voice++){this.voiceTarget[0][voice]=0;this.voiceTarget[1][voice]=0;}
 }
 _polyBlep(phase,delta){if(phase<delta){const x=phase/delta;return x+x-x*x-1;}if(phase>1-delta){const x=(phase-1)/delta;return x*x+x+x+1;}return 0;}
 _voices(p){
  const octave=2**Math.round((val(p,'octave',.5)-.5)*4),blur=val(p,'blur',.3),tension=val(p,'tension',.3),wave=val(p,'wave',0)*3,model=Math.floor(wave),fraction=wave-model,slew=1-Math.exp(-1/(this.sr*.008));let left=0,right=0;
  for(let voice=0;voice<33;voice++){
   const freq=clamp(this.voiceFreq[voice]*octave*(1+tension*voice*.002+(seeded(voice,19)-.5)*blur*.018),0,this.sr*.45),delta=freq/this.sr;
   for(let ch=0;ch<2;ch++){
    this.voiceAmp[ch][voice]+=(this.voiceTarget[ch][voice]-this.voiceAmp[ch][voice])*slew;let phase=this.voicePhase[ch][voice];phase=(phase+delta)%1;this.voicePhase[ch][voice]=phase;
    const sine=Math.sin(TAU*phase),triangle=1-4*Math.abs(phase-.5),saw=2*phase-1-this._polyBlep(phase,delta),square=(phase<.5?1:-1)+this._polyBlep(phase,delta)-this._polyBlep((phase+.5)%1,delta);
    const a=model===0?sine:model===1?triangle:model===2?saw:square,b=model===0?triangle:model===1?saw:square,sample=(a+(b-a)*fraction)*this.voiceAmp[ch][voice];if(ch)right+=sample;else left+=sample;
   }
  }
  this.output[0][(this.outPos+this.n)&this.outMask]+=left;this.output[1][(this.outPos+this.n)&this.outMask]+=right;
 }
 process(left,right,p={},frame=0,bpm=120,beat=null){
  if(Number.isFinite(beat))this.clockBeat=beat;
  // configure is called on state changes by EffectRack; direct users can change SIZE here.
  const desired=fftSize(val(p,'size',0));if(desired!==this.n)this.configure(p,this.tonal,this.snap,{sync:this.sync});
  this.result[0]=this.output[0][this.outPos];this.result[1]=this.output[1][this.outPos];this.output[0][this.outPos]=0;this.output[1][this.outPos]=0;
  this.input[0][this.write]=Number.isFinite(left)?left:0;this.input[1][this.write]=Number.isFinite(right)?right:0;this.sideInput[this.write]=(this.sideLeft+this.sideRight)*.5;this.write=(this.write+1)&this.mask;this.samples++;
  if(this.samples%this.hop===0){
   this._sidechainAnalysis();
   for(let ch=0;ch<2;ch++){
    for(let i=0;i<this.n;i++){this.re[i]=this.input[ch][(this.write+i)&this.mask]*this.window[i];this.im[i]=0;}
    this.fft.transform(this.re,this.im);this.modify(p,ch,frame,bpm);
    if(this.type!=='STILLS'){
     for(let k=1;k<this.n/2;k++){this.re[this.n-k]=this.re[k];this.im[this.n-k]=-this.im[k];}this.im[0]=this.im[this.n/2]=0;this.fft.transform(this.re,this.im,true);
     for(let i=0;i<this.n;i++)this.output[ch][(this.outPos+1+i)&this.outMask]+=this.re[i]*this.window[i]*.5;
    }
   }
   if(this.type==='STILLS')this._snapshotVoices(p,Number.isFinite(this.clockBeat)?this.clockBeat:frame/this.sr*bpm/60);this.frames++;
  }
  if(this.type==='STILLS')this._voices(p);
  this.outPos=(this.outPos+1)&this.outMask;return this.result;
 }
}
