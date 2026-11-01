// Three staggered, windowed sweep banks hide the resets of continuous barber sweeps.
const TAU=2*Math.PI,clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(v)?v:a)),fract=v=>v-Math.floor(v);
const divisions=[16,8,4,2,1,.5,.25,.125,.0625,.03125,.015625,.0078125];
class Ring {
 constructor(length){this.n=2**Math.ceil(Math.log2(length+4));this.mask=this.n-1;this.l=new Float32Array(this.n);this.r=new Float32Array(this.n);this.pos=0;}
 read(ch,delay){const p=(this.pos-clamp(delay,1,this.n-3)+this.n)%this.n,i=Math.floor(p),f=p-i,d=ch?this.r:this.l;return d[i]*(1-f)+d[(i+1)&this.mask]*f;}
 write(l,r){this.l[this.pos]=l;this.r[this.pos]=r;this.pos=(this.pos+1)&this.mask;}
 reset(){this.l.fill(0);this.r.fill(0);this.pos=0;}
}
export class ModulationEffect {
 constructor(type,sampleRate){this.type=type;this.sr=sampleRate;this.latency=type==='FLANGER'?Math.ceil(sampleRate*.02):0;this.output=new Float64Array(2);this.ref={};this.dry=type==='FLANGER'?new Ring(sampleRate*.06):null;this.wet=type==='FLANGER'?new Ring(sampleRate*.08):null;this.mem=new Float64Array(72);this.coeff=new Float64Array(72);this.feedback=new Float64Array(2);this.phase=0;this.count=0;}
 configure(ref){this.ref=ref||{};}
 reset(){this.dry?.reset();this.wet?.reset();this.mem.fill(0);this.feedback.fill(0);this.phase=0;this.count=0;}
 process(l,r,p,frame,bpm,sync=false,beat){
  const rate=sync?bpm/60/divisions[Math.round(clamp(p.rate??.3)*11)]:.03+clamp(p.rate??.3)**2*12;
  this.phase=sync&&Number.isFinite(beat)?fract(beat/divisions[Math.round(clamp(p.rate??.3)*11)]):fract(this.phase+rate/this.sr);
  const barber=Math.round(clamp(p.barber??0)*2),direction=barber===2?-1:1,depth=clamp(p.depth??.6),fb=(clamp(p.feedback??(this.type==='FLANGER'?.65:.3))-.5)*1.86;
  if(this.type==='FLANGER'){
   const dryL=this.dry.read(0,this.latency),dryR=this.dry.read(1,this.latency),tzf=(p.tzf??0)>.5,center=tzf?((p.delay??.25)-.5)*.004:.0005+clamp(p.delay??.25)*.006,span=.0003+depth*.006;
   let left=0,right=0,weights=0;
   for(let bank=0;bank<(barber?3:1);bank++){
    const ph=fract(this.phase*direction+bank/3),weight=barber?Math.sin(Math.PI*ph)**2:1,sweep=barber?1-2*ph:Math.sin(TAU*ph),other=barber?1-2*fract(ph+.025):Math.sin(TAU*(ph+.025));
    left+=this.wet.read(0,this.latency+(center+span*sweep)*this.sr)*weight;right+=this.wet.read(1,this.latency+(center+span*other)*this.sr)*weight;weights+=weight;
   }
   left/=Math.max(.001,weights);right/=Math.max(.001,weights);
   this.wet.write(Math.tanh(l+left*fb),Math.tanh(r+right*fb));this.dry.write(l,r);
   this.output[0]=(dryL+left)*.65;this.output[1]=(dryR+right)*.65;
  }else{
   const stages=2+Math.round(clamp(p.stages??.6)*10),center=30*600**clamp(p.center??.5),banks=barber?3:1;
   if((this.count&15)===0)for(let ch=0;ch<2;ch++)for(let bank=0;bank<banks;bank++){
    const ph=fract(this.phase*direction+bank/3+ch*.03),sweep=barber?(ph-.5)*2:Math.sin(TAU*ph),freq=center*2**(sweep*(1+depth*4));
    for(let stage=0;stage<stages;stage++){const f=clamp(freq*2**((stage/stages-.5)*.8),20,this.sr*.43),tan=Math.tan(Math.PI*f/this.sr);this.coeff[ch*36+bank*12+stage]=(tan-1)/(tan+1);}
   }
   for(let ch=0;ch<2;ch++){
    let result=0,weights=0;for(let bank=0;bank<banks;bank++){
     let value=(ch?r:l)+this.feedback[ch]*fb;const ph=fract(this.phase*direction+bank/3+ch*.03),weight=barber?Math.sin(Math.PI*ph)**2:1;
     for(let stage=0;stage<stages;stage++){const idx=ch*36+bank*12+stage,c=this.coeff[idx],out=c*value+this.mem[idx];this.mem[idx]=value-c*out;value=out;}
     result+=value*weight;weights+=weight;
    }
    result/=Math.max(.001,weights);this.feedback[ch]=Math.tanh(result);this.output[ch]=((ch?r:l)+result)*.65;
   }
  }
  this.count++;return this.output;
 }
}
