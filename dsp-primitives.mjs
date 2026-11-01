export const TAU=2*Math.PI;
export const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
export const param=(p,k,d=.5)=>Number.isFinite(p?.[k])?clamp(p[k]):d;
export const SCALES={chromatic:[0,1,2,3,4,5,6,7,8,9,10,11],major:[0,2,4,5,7,9,11],minor:[0,2,3,5,7,8,10],dorian:[0,2,3,5,7,9,10],pentatonic:[0,2,4,7,9]};
export const CHORDS={major:[0,4,7],minor:[0,3,7],sus2:[0,2,7],sus4:[0,5,7],diminished:[0,3,6],augmented:[0,4,8],major7:[0,4,7,11],minor7:[0,3,7,10],dominant7:[0,4,7,10]};
export const chordNotes=tonal=>CHORDS[tonal?.chord]||CHORDS.minor;
export function snapNote(note,tonal={}){const notes=SCALES[tonal.scale]||SCALES.minor,root=Number(tonal.root)||0;let best=note,distance=100;for(let n=Math.floor(note)-12;n<=Math.ceil(note)+12;n++)if(notes.includes(((n-root)%12+12)%12)&&Math.abs(n-note)<distance){best=n;distance=Math.abs(n-note);}return best;}
export function scaleDegree(degree,tonal={}){const notes=SCALES[tonal.scale]||SCALES.minor,n=Math.round(degree),octave=Math.floor(n/notes.length);return octave*12+notes[((n%notes.length)+notes.length)%notes.length];}
export class DelayLine {
 constructor(samples,stereo=true){let n=1;while(n<samples+4)n*=2;this.length=n;this.mask=n-1;this.l=new Float32Array(n);this.r=stereo?new Float32Array(n):this.l;this.pos=0;this.written=0;}
 read(ch,delay){const x=this.pos-clamp(delay,0,this.length-3),i=Math.floor(x),f=x-i,a=ch?this.r:this.l;return a[i&this.mask]*(1-f)+a[(i+1)&this.mask]*f;}
 at(ch,position){const i=Math.floor(position),f=position-i,a=ch?this.r:this.l;return a[i&this.mask]*(1-f)+a[(i+1)&this.mask]*f;}
 write(l,r=l){this.l[this.pos]=Number.isFinite(l)?l:0;this.r[this.pos]=Number.isFinite(r)?r:0;this.pos=(this.pos+1)&this.mask;this.written++;}
 reset(){this.l.fill(0);if(this.r!==this.l)this.r.fill(0);this.pos=0;this.written=0;}
}

// Decimated YIN difference/CMND tracker. Analysis happens at 10–20 ms intervals.
export class PitchTracker {
 constructor(sampleRate){this.decimation=Math.max(1,Math.floor(sampleRate/12000));this.sr=sampleRate/this.decimation;this.buffer=new Float32Array(1024);this.work=new Float64Array(640);this.difference=new Float64Array(384);this.reset();}
 reset(){this.buffer.fill(0);this.pos=0;this.count=0;this.sum=0;this.dc=0;this.samples=0;this.frequency=0;this.confidence=0;this.analysisCount=0;}
 process(input){this.dc+=(input-this.dc)*.001;this.sum+=input-this.dc;if(++this.count<this.decimation)return this.frequency;this.buffer[this.pos]=this.sum/this.decimation;this.pos=(this.pos+1)&1023;this.count=0;this.sum=0;this.samples++;if(this.samples>=640&&(this.samples&127)===0)this.analyze();return this.frequency;}
 analyze(){const n=256,max=Math.min(380,Math.floor(this.sr/35)),min=Math.max(2,Math.floor(this.sr/2000));for(let i=0;i<n+max;i++)this.work[i]=this.buffer[(this.pos-n-max+i)&1023];let energy=0;for(let i=0;i<n;i++)energy+=this.work[i]*this.work[i];if(energy/n<1e-8){this.confidence*=.8;if(this.confidence<.1)this.frequency=0;return;}let cumulative=0;this.difference[0]=1;for(let tau=1;tau<=max;tau++){let sum=0;for(let j=0;j<n;j++){const d=this.work[j]-this.work[j+tau];sum+=d*d;}cumulative+=sum;this.difference[tau]=sum*tau/(cumulative+1e-20);}let selected=0,best=1;for(let tau=min;tau<max;tau++){const d=this.difference[tau];if(d<best){best=d;selected=tau;}if(d<.16&&d<=this.difference[tau-1]){while(tau+1<=max&&this.difference[tau+1]<this.difference[tau])tau++;selected=tau;best=this.difference[tau];break;}}this.analysisCount++;if(best>.35||selected===0){this.confidence*=.9;return;}const left=this.difference[selected-1],center=this.difference[selected],right=this.difference[Math.min(max,selected+1)],delta=.5*(left-right)/(left-2*center+right+1e-20),hz=this.sr/(selected+clamp(delta,-.5,.5));this.frequency=this.frequency>0?this.frequency*.25+hz*.75:hz;this.confidence=clamp(1-best);}
}

// 127-tap odd-symmetric Hilbert FIR and matched real delay: true analytic signal.
// 63 samples latency; sideband rejection is testable across the audio band.
export class HilbertSSB {
 constructor(sampleRate,taps=127){this.sr=sampleRate;this.taps=taps;this.center=(taps-1)/2;this.coeff=new Float64Array(taps);for(let i=0;i<taps;i++){const m=i-this.center,window=.42-.5*Math.cos(TAU*i/(taps-1))+.08*Math.cos(2*TAU*i/(taps-1));this.coeff[i]=m!==0&&Math.abs(m)%2===1?2/(Math.PI*m)*window:0;}this.buffer=[new Float64Array(taps),new Float64Array(taps)];this.out=[0,0];this.reset();}
 reset(){this.buffer[0].fill(0);this.buffer[1].fill(0);this.pos=0;this.phaseL=0;this.phaseR=0;}
 process(l,r,shiftL,shiftR){const n=this.taps,p=this.pos;this.buffer[0][p]=l;this.buffer[1][p]=r;let ql=0,qr=0;for(let j=0;j<n;j+=2){const i=(p-j+n)%n,c=this.coeff[j];ql+=this.buffer[0][i]*c;qr+=this.buffer[1][i]*c;}const real=(p-this.center+n)%n;this.out[0]=this.buffer[0][real]*Math.cos(this.phaseL)-ql*Math.sin(this.phaseL);this.out[1]=this.buffer[1][real]*Math.cos(this.phaseR)-qr*Math.sin(this.phaseR);this.phaseL=(this.phaseL+TAU*shiftL/this.sr)%TAU;this.phaseR=(this.phaseR+TAU*shiftR/this.sr)%TAU;this.pos=(p+1)%n;return this.out;}
}

// Two-times FIR oversampling. Both interpolation and reconstruction are low-pass.
// The callback is a stable function supplied once by the owning effect.
export class Oversampler2x {
 constructor(){this.latency=15;this.taps=31;this.coeff=new Float64Array(this.taps);let sum=0;for(let i=0;i<this.taps;i++){const m=i-15,c=m===0?.5:Math.sin(Math.PI*.5*m)/(Math.PI*m),w=.42-.5*Math.cos(TAU*i/30)+.08*Math.cos(2*TAU*i/30);this.coeff[i]=c*w;sum+=this.coeff[i];}for(let i=0;i<31;i++)this.coeff[i]/=sum;this.up=[new Float64Array(31),new Float64Array(31)];this.down=[new Float64Array(31),new Float64Array(31)];this.out=[0,0];this.reset();}
 reset(){for(let ch=0;ch<2;ch++){this.up[ch].fill(0);this.down[ch].fill(0);}this.pos=0;}
 process(l,r,shape){let yl=0,yr=0;for(let phase=0;phase<2;phase++){const p=this.pos;this.up[0][p]=phase===0?l*2:0;this.up[1][p]=phase===0?r*2:0;for(let ch=0;ch<2;ch++){let x=0;for(let i=0;i<31;i++)x+=this.up[ch][(p-i+31)%31]*this.coeff[i];this.down[ch][p]=shape(x,ch,phase);let y=0;for(let i=0;i<31;i++)y+=this.down[ch][(p-i+31)%31]*this.coeff[i];if(phase===0){if(ch)yr=y;else yl=y;}}this.pos=(p+1)%31;}this.out[0]=yl;this.out[1]=yr;return this.out;}
}

export class MultimodeFilter {
 constructor(sampleRate){this.sr=sampleRate;this.s=new Float64Array(24);this.out=[0,0];}
 reset(){this.s.fill(0);}
 process(x,ch,cutoff,resonance,drive,type,mode,poles){const sr=this.sr,f=clamp(cutoff,15,sr*.44),offset=ch*12,s=this.s,g=Math.tan(Math.PI*f/sr),k=2-1.96*clamp(resonance),gain=1+drive*8;let y;
  if(type===0){if(poles===1){const input=Math.tanh(x*gain),alpha=g/(1+g);s[offset+2]+=(input-s[offset+2])*alpha;return mode===2?input-s[offset+2]:mode===3?input: s[offset+2];}const a1=1/(1+g*(g+k)),a2=g*a1,a3=g*a2,v3=Math.tanh(x*gain)-s[offset+1],v1=a1*s[offset]+a2*v3,v2=s[offset+1]+a2*s[offset]+a3*v3;s[offset]=2*v1-s[offset];s[offset+1]=2*v2-s[offset+1];const hp=Math.tanh(x*gain)-k*v1-v2;y=mode===0?v2:mode===1?v1:mode===2?hp:hp+v2;if(poles===1)y=mode===0?s[offset+2]+(x-s[offset+2])*(g/(1+g)):mode===2?x-s[offset+2]:y;s[offset+2]+=(v2-s[offset+2])*clamp(g/(1+g));if(poles>=3){const a=g/(1+g);s[offset+3]+=(y-s[offset+3])*a;y=mode===2?y-s[offset+3]:s[offset+3];if(poles===4){s[offset+4]+=(y-s[offset+4])*a;y=mode===2?y-s[offset+4]:s[offset+4];}}}
  else{const a=1-Math.exp(-TAU*f/sr),feedback=resonance*(type===1?3.95:type===2?4.4:3.7),last=s[offset+7],input=Math.tanh(x*gain-last*feedback);let current=input;for(let i=0;i<4;i++){const at=offset+4+i,previous=s[at],nonlinear=type===1?Math.tanh(current):type===2?(current>=0?Math.tanh(current*1.5):Math.tanh(current*.7)):(current>=0?current:current*.25),memory=type===3?Math.tanh(previous*1.2):previous;current=previous+a*(nonlinear-memory);s[at]=clamp(current,-4,4);}const lp=s[offset+3+poles];let hp=input;for(let i=0;i<poles;i++){const at=offset+8+i;s[at]+=(hp-s[at])*a;hp-=s[at];}const bp=s[offset+4]-s[offset+7];y=mode===0?lp:mode===1?bp:mode===2?hp:hp+lp*.5;}
  return Number.isFinite(y)?y:0;
 }
}
