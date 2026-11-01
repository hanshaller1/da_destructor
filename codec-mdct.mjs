import {FFT} from './spectral.mjs';
import {clamp,param,TAU} from './dsp-primitives.mjs';

class BitStream {
 constructor(bytes=16384){this.data=new Uint8Array(bytes);this.bit=0;this.length=0;}
 clear(){this.data.fill(0);this.bit=0;this.length=0;}
 write(value,bits){for(let i=bits-1;i>=0;i--){if(value&(1<<i))this.data[this.bit>>3]|=1<<(7-(this.bit&7));this.bit++;}this.length=this.bit;}
 read(bits){let value=0;for(let i=0;i<bits;i++){value=(value<<1)|((this.data[this.bit>>3]>>(7-(this.bit&7)))&1);this.bit++;}return value;}
 rewind(){this.bit=0;}
}

// Critically sampled MDCT using an FFT embedding of the half-bin cosine basis.
// Analysis X[k] = sum(x[n] w[n] cos(pi/N (n+.5+N/2)(k+.5))).
// Synthesis is the exact transpose with 2/N scaling and sine-window TDAC.
export class MDCTCodec {
 constructor(sampleRate){this.sr=sampleRate;this.latency=2048;this.sizes=[128,256,512,1024];this.ffts=this.sizes.map(n=>new FFT(n*8));this.windows=this.sizes.map(n=>Float64Array.from({length:n*2},(_,i)=>Math.sin(Math.PI/(2*n)*(i+.5))));this.real=new Float64Array(8192);this.imag=new Float64Array(8192);this.views=this.sizes.map(n=>[this.real.subarray(0,n*8),this.imag.subarray(0,n*8)]);this.input=[new Float32Array(2048),new Float32Array(2048)];this.output=[new Float64Array(8192),new Float64Array(8192)];this.coefficients=[new Float64Array(1024),new Float64Array(1024)];this.previous=[new Float64Array(1024),new Float64Array(1024)];this.bands=new Int32Array(9);this.bits=new Uint8Array(8);this.scales=new Float64Array(8);this.energies=new Float64Array(8);this.streams=[new BitStream(),new BitStream()];this.selected=new Uint8Array(1024);this.result=[0,0];this.identity=false;this.reset();}
 reset(){for(let ch=0;ch<2;ch++){this.input[ch].fill(0);this.output[ch].fill(0);this.previous[ch].fill(0);this.coefficients[ch].fill(0);}this.write=0;this.outPos=0;this.samples=0;this.index??=1;this.seed=0x46341;this.packetCycle=-1;this.packetLost=false;this.encodedBitCount=0;this.lastBudget=0;this.framesEncoded=0;}
 random(){this.seed^=this.seed<<13;this.seed^=this.seed>>>17;this.seed^=this.seed<<5;return(this.seed>>>0)/4294967296;}
 configure(params={}){this.index=Math.round(param(params,'speed',.4)*3);}
 process(l,r,p,frame,bpm,sync=false){if((this.samples&1023)===0)this.index=Math.round(param(p,'speed',.4)*3);const n=this.sizes[this.index];this.result[0]=this.output[0][this.outPos];this.result[1]=this.output[1][this.outPos];this.output[0][this.outPos]=0;this.output[1][this.outPos]=0;this.input[0][this.write]=l;this.input[1][this.write]=r;this.write=(this.write+1)&2047;this.samples++;
  if(this.samples%n===0){const beat=this.clockBeat??frame/this.sr*bpm/60,division=2**Math.round(param(p,'speed',.4)*6),cycle=sync?Math.floor(beat*division):Math.floor(this.samples/n);if(cycle!==this.packetCycle){this.packetCycle=cycle;this.packetLost=this.random()<param(p,'packet',.1);}for(let ch=0;ch<2;ch++)this.renderFrame(ch,p,n);this.framesEncoded++;}
  this.outPos=(this.outPos+1)&8191;return this.result;
 }
 renderFrame(ch,p,n){const fft=this.ffts[this.index],[re,im]=this.views[this.index],window=this.windows[this.index],coef=this.coefficients[ch],old=this.previous[ch],L=n*8;re.fill(0);im.fill(0);for(let i=0;i<n*2;i++)re[2*i+1+n]=this.input[ch][(this.write-2*n+i+2048)&2047]*window[i];fft.transform(re,im);
  for(let k=0;k<n;k++)coef[k]=re[2*k+1];
  if(!this.identity)this.encodeDecode(ch,p,n);
  const repeat=param(p,'repeat',.25),jitter=param(p,'jitter',.15),tone=param(p,'tone',.6),artifact=param(p,'artifact',.3);for(let k=0;k<n;k++){if(this.packetLost&&!this.identity)coef[k]=old[k]*repeat;else if(!this.identity){const cutoff=.05+tone*.95,rolloff=clamp(1-(k/n-cutoff)*12);coef[k]*=rolloff;coef[k]=coef[k]*(1-artifact*.25)+old[k]*artifact*.25;}old[k]=coef[k];}
  re.fill(0);im.fill(0);for(let k=0;k<n;k++){const index=2*k+1;re[index]=coef[k];re[L-index]=coef[k];}fft.transform(re,im,true);const offset=2048-2*n,jitterOffset=this.identity?0:Math.round((this.random()-.5)*jitter*8);for(let i=0;i<2*n;i++){const time=2*i+1+n,y=re[time]*8*window[i],at=(this.outPos+1+offset+i+jitterOffset+8192)&8191;this.output[ch][at]+=Number.isFinite(y)?y:0;}
 }
 encodeSparse(coef,stream,n,budget){const indexBits=Math.ceil(Math.log2(n)),count=Math.min(64,Math.floor(budget/(indexBits+9)));this.selected.fill(0);stream.clear();for(let i=0;i<count;i++){let best=0,magnitude=-1;for(let k=0;k<n;k++)if(!this.selected[k]&&Math.abs(coef[k])>magnitude){best=k;magnitude=Math.abs(coef[k]);}this.selected[best]=1;const code=Math.round(clamp((Math.log2(magnitude/n+2**-24)+24)/28)*255);stream.write(best,indexBits);stream.write(code,8);stream.write(coef[best]<0?1:0,1);}this.encodedBitCount=stream.length;stream.rewind();coef.fill(0);for(let i=0;i<count;i++){const k=stream.read(indexBits),code=stream.read(8),sign=stream.read(1);coef[k]=2**(code/255*28-24)*n*(sign?-1:1);}}
 encodeDecode(ch,p,n){const bitrate=6000+param(p,'bitrate',.35)*250000,budget=Math.max(24,Math.floor(bitrate*n/this.sr/2)),count=budget<192?2:8,coef=this.coefficients[ch],stream=this.streams[ch];this.lastBudget=budget;if(budget<n/2){this.encodeSparse(coef,stream,n,budget);return;}this.bits.fill(0);this.energies.fill(0);this.scales.fill(0);this.bands[0]=0;for(let band=0;band<count;band++){this.bands[band+1]=band===count-1?n:Math.max(this.bands[band]+1,Math.floor(((band+1)/count)**2*n));for(let k=this.bands[band];k<this.bands[band+1];k++){const normalized=coef[k]/n;this.scales[band]=Math.max(this.scales[band],Math.abs(normalized));this.energies[band]+=normalized*normalized;}}
  let remaining=budget-count*12;for(let iteration=0;iteration<96;iteration++){let best=-1,quality=-1;for(let band=0;band<count;band++){const cost=this.bands[band+1]-this.bands[band],utility=this.energies[band]/(4**this.bits[band]*cost);if(cost<=remaining&&this.bits[band]<12&&utility>quality){best=band;quality=utility;}}if(best<0)break;remaining-=this.bands[best+1]-this.bands[best];this.bits[best]++;}
  stream.clear();for(let band=0;band<count;band++){const bits=this.bits[band],scaleCode=Math.round(clamp((Math.log2(this.scales[band]+2**-24)+24)/28)*255),scale=2**(scaleCode/255*28-24);stream.write(bits,4);stream.write(scaleCode,8);if(bits){const levels=(1<<bits)-1;for(let k=this.bands[band];k<this.bands[band+1];k++)stream.write(Math.round(clamp(coef[k]/n/scale*.5+.5)*levels),bits);}}
  this.encodedBitCount=stream.length;stream.rewind();for(let band=0;band<count;band++){const bits=stream.read(4),scaleCode=stream.read(8),scale=2**(scaleCode/255*28-24),levels=(1<<bits)-1;for(let k=this.bands[band];k<this.bands[band+1];k++)coef[k]=bits?(stream.read(bits)/levels*2-1)*scale*n:0;}
 }
}
