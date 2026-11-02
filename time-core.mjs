/* Original stereo time-domain processors. All public controls are normalized. */
import {Oversampler2x} from './dsp-primitives.mjs';
const TAU = Math.PI * 2;
const CAPTURE_BEATS = [16, 8, 4, 2, 1, .5, .25, .125, .0625];
const SLICE_BEATS = [1 / 64, 1 / 32, 1 / 16, 1 / 8, 1 / 4, 1 / 2, 1];
const LINK_PAIRS = [[1 / 64, .25], [1 / 32, .25], [1 / 32, .5], [1 / 16, .5], [1 / 16, 1], [1 / 8, 1], [1 / 8, 2], [1 / 4, 1], [1 / 4, 2], [1 / 4, 4], [1 / 2, 2], [1 / 2, 4], [1, 4], [1, 8]];
const LURCH_RATES = [4, 2, .5, .25, 1];
const SLIP_RATES = [2, .5, 1];
const STALL_RATES = [.1,4,2,1];
const MUSICAL_CAPTURE = [4,2,1,.5,.25,.125,.0625];
const STRETCH_CAPTURE = [4,2,1,.5];
const GRAIN_BEATS = [.25,.125,.0625,.03125,.015625,.0078125];
const BEND_BEATS = [.125,.25,.5,1,2,4,8,16];
const RAMP_DURATIONS = [1.75,1.5,1.25,1,.9,.7,.5,.4];
const TRANSFORM_MASK = [1,0,1,0,1,1,0,1,1,0,0,1,1,0,1,1,1,1,0,1,0,1,0,1,1,0,1,1,0,1,1,0];
const SCRATCH_NAMES = ['BABY','TRANSFORMER','TEAR','SCRIBBLE'];
const SCRATCH_ACCENTS = [1,.8,1.15,.9];
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, Number.isFinite(x) ? x : a));
const norm = (p, k, d) => p[k] === undefined ? d : clamp(p[k]);
const wrap = (x, n) => ((x % n) + n) % n;
const pitchRatio = n => 2 ** ((clamp(n) * 24 - 12) / 12);
const division = (v, list) => list[Math.round(clamp(v) * (list.length - 1))];
const captureBeats = (p,stretch=false) => division(norm(p,'tempo',norm(p,'capture',.5)),p.timing==='musical'?(stretch?STRETCH_CAPTURE:MUSICAL_CAPTURE):CAPTURE_BEATS);
const hash = (index,seed=1) => {let n=Math.imul((index|0)^Math.imul(seed+1,0x45d9f3b),0x27d4eb2d);n^=n>>>15;n=Math.imul(n,0x85ebca6b);return ((n^(n>>>13))>>>0)/4294967296;};
export function tukeyWindow(phase,amount=.3){const alpha=Math.max(.001,clamp(amount));const p=wrap(phase,1);if(p<alpha*.5)return .5*(1+Math.cos(Math.PI*(2*p/alpha-1)));if(p>1-alpha*.5)return .5*(1+Math.cos(Math.PI*(2*p/alpha-2/alpha+1)));return 1;}
export function patternMultiplier(pattern,index){if(pattern==='DOTTED')return 1.5;if(pattern==='TRIPLET')return 2/3;if(pattern==='SWING')return index%2?2/3:4/3;if(pattern==='RAMP UP')return RAMP_DURATIONS[index%8];if(pattern==='RAMP DOWN')return RAMP_DURATIONS[7-index%8];return 1;}
export function scratchVelocity(pattern,beat,rate=1,shape=.5,depth=1){
 const cycle=wrap(beat,16),bar=Math.floor(cycle/4),phase=wrap(cycle*rate,1),sine=Math.sin(TAU*phase),triangle=phase<.5?1:-1,accent=SCRATCH_ACCENTS[bar];
 let velocity;
 if(pattern==='TEAR')velocity=phase<.2?1.8:phase<.32?0:phase<.55?-.9:phase<.7?1.2:phase<.82?0:-1.6;
 else if(pattern==='SCRIBBLE')velocity=Math.sin(TAU*phase*(3+Math.floor(shape*4)))*(1-shape*.4)+Math.sin(TAU*phase*9)*shape*.25;
 else velocity=sine*(1-shape)+triangle*shape;
 return velocity*depth*accent*2;
}
export function scratchGate(pattern,beat){return pattern==='TRANSFORMER'?TRANSFORM_MASK[Math.floor(wrap(beat,16)*2)]:1;}
const sample = (a, x) => {
  const p = wrap(x, a.length), i = Math.floor(p), f = p - i;
  return a[i] + (a[(i + 1) % a.length] - a[i]) * f;
};

class Engine {
  constructor(rate, seconds = 2) {
    this.rate = rate;
    this.size = Math.ceil(rate * seconds) + 8;
    this.l = new Float32Array(this.size);
    this.r = new Float32Array(this.size);
    this.out = new Float64Array(2);
    this.fadeStep = 1 / (rate * .01);
    this.rng = 0x6a09e667;
    this.reset();
  }
  reset() {
    this.l.fill(0); this.r.fill(0);
    this.write = 0; this.filled = 0; this.fade = 0; this.wasOn = false; this.mix = 0;
    this.age = 0; this.rng = 0x6a09e667; this.out.fill(0);
    this.clear();
  }
  clear() {}
  random() {
    let s = this.rng;
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    this.rng = s;
    return (s >>> 0) / 4294967296;
  }
  push(l, r) {
    this.l[this.write] = l; this.r[this.write] = r;
    this.write = (this.write + 1) % this.size;
    this.filled = Math.min(this.filled + 1, this.size - 2);
  }
  begin(p) {
    const on = !!p.on;
    if (on && !this.wasOn) {
      // Logical invalidation avoids clearing a multi-second stereo buffer in the audio callback.
      // Reads in all engines stay inside the freshly captured region (or return zero).
      this.write = 0; this.filled = 0; this.age = 0; this.fade = 0; this.mix = 0;
      this.clear();
    }
    this.wasOn = on;
    this.fade = clamp(this.fade + (on ? this.fadeStep : -this.fadeStep));
    return on || this.fade > 0;
  }
  read(a, position) {
    const pos = wrap(position, this.size);
    if (this.filled < this.size - 2 && pos > this.write - 1) return 0;
    return sample(a, pos);
  }
  finish(l, r, wetL, wetR, mix) {
    this.mix += (this.fade * clamp(mix) - this.mix) / Math.max(1, this.rate * .004);
    const a = this.mix;
    this.out[0] = l + ((Number.isFinite(wetL) ? wetL : 0) - l) * a;
    this.out[1] = r + ((Number.isFinite(wetR) ? wetR : 0) - r) * a;
    return this.out;
  }
  dry(l, r) { this.out[0] = l; this.out[1] = r; return this.out; }
}

class Stretch extends Engine {
  clear() {
    this.scan = 0; this.phaseA = 0; this.phaseB = .5;
    this.posA = this.posB = 0; this.rateA = this.rateB = 1;
    this.lengthA = this.lengthB = Math.max(32, this.rate * .08);
    this.started = false; this.captureStart = 0; this.window = 0;
    this.previousCycle = -1;this.lastHop=-1;this.grainLaunches=0;this.lastLaunchFrame=0;this.hop=0;
  }
  launch(which, p, length, window, frame=0) {
    const scattered = this.scan + (this.random() - .5) * norm(p, 'scatter', 0) * window;
    let pos = this.captureStart + wrap(scattered - this.captureStart, window);
    // Synchronized grains address capture subdivisions rather than drifting freely between them.
    if(p.sync!==false&&p.timing==='musical'){
      const split=Math.max(1,length*.5),offset=wrap(pos-this.captureStart,window);
      pos=this.captureStart+Math.floor(offset/split)*split;
    }
    const ratio = p.linked ? Math.max(.01, norm(p, 'speed', 1)) : pitchRatio(norm(p, 'pitch', .5));
    if (which === 0) { this.posA = pos; this.rateA = ratio * (p.reverse ? -1 : 1); this.lengthA = length; }
    else { this.posB = pos; this.rateB = ratio * (p.reverse ? -1 : 1); this.lengthB = length; }
    this.grainLaunches++;this.lastLaunchFrame=frame;
  }
  process(l, r, p, frame, bpm) {
    if (!this.begin(p)) return this.dry(l, r);
    if ((!p.freeze&&norm(p,'speed',1)>0) || !this.started) this.push(l, r);
    const beat = this.rate * 60 / bpm;
    const desiredWindow = Math.min(this.size - 4, Math.max(64, beat * captureBeats(p,true)));
    const musical=p.sync!==false&&p.timing==='musical';
    const desiredGrain = p.sync === false
      ? this.rate / (5 + norm(p, 'grain', .4) * 95)*(p.timing==='musical'?2:1)
      : musical?beat*division(norm(p,'grain',.4),GRAIN_BEATS)*2:beat * (1 / 128) * 2 ** (norm(p, 'grain', .4) * 5);
    // A separate length control preserves every old GRAIN setting at zero while
    // allowing long, overlapping texture grains without changing pitch or speed.
    const grain = Math.max(16, Math.min(this.rate * 2, desiredGrain * 8 ** norm(p,'grainLength',0)));
    const hop=grain*.5,cell=Math.floor((frame+1e-7)/hop);this.hop=hop;
    if (this.filled < Math.min(desiredWindow, grain * 2 + 4)) return this.dry(l, r);
    const window = Math.min(desiredWindow, this.filled - 2);
    const cycle = Math.floor(frame / desiredWindow);
    if (!this.started || (!p.freeze && cycle !== this.previousCycle)) {
      this.window = window;
      this.captureStart = this.write - window;
      if (!this.started) {
        this.scan = this.captureStart + Math.min(grain, window * .25);
        if(musical){const elapsed=frame-cell*hop;this.phaseA=(elapsed+(cell%2?hop:0))/grain;this.phaseB=(elapsed+(cell%2?0:hop))/grain;}
        this.launch(0, p, grain, window,frame); this.launch(1, p, grain, window,frame);
        this.posA -= this.rateA * grain * this.phaseA;
        this.posB -= this.rateB * grain * this.phaseB;
        this.lastHop=cell;
        this.started = true;
      } else {
        this.scan = this.captureStart + wrap(this.scan - this.captureStart, window);
      }
      this.previousCycle = cycle;
    }
    const currentWindow = this.window || window;
    if(musical&&cell!==this.lastHop){const head=cell%2,elapsed=frame-cell*hop;this.launch(head,p,grain,currentWindow,frame);if(head===0){this.phaseA=elapsed/grain;this.posA+=this.rateA*elapsed;}else{this.phaseB=elapsed/grain;this.posB+=this.rateB*elapsed;}this.lastHop=cell;}
    this.scan = this.captureStart + wrap(this.scan + norm(p, 'speed', 1) - this.captureStart, currentWindow);
    const wa = .5 - .5 * Math.cos(TAU * clamp(this.phaseA)), wb = .5 - .5 * Math.cos(TAU * clamp(this.phaseB));
    const total = Math.max(.001, wa + wb);
    const pa = this.captureStart + wrap(this.posA - this.captureStart, currentWindow);
    const pb = this.captureStart + wrap(this.posB - this.captureStart, currentWindow);
    const aL = sample(this.l, pa), aR = sample(this.r, pa), bL = sample(this.l, pb), bR = sample(this.r, pb);
    const spread = norm(p, 'spread', .2);
    const wetL = (aL * wa * (1 + spread * .45) + bL * wb * (1 - spread * .45)) / total;
    const wetR = (aR * wa * (1 - spread * .45) + bR * wb * (1 + spread * .45)) / total;
    this.posA += this.rateA; this.posB += this.rateB;
    this.phaseA += 1 / this.lengthA; this.phaseB += 1 / this.lengthB;
    if (!musical&&this.phaseA >= 1) { this.phaseA -= 1; this.launch(0, p, grain, currentWindow,frame); }
    if (!musical&&this.phaseB >= 1) { this.phaseB -= 1; this.launch(1, p, grain, currentWindow,frame); }
    return this.finish(l, r, wetL, wetR, norm(p, 'mix', 1));
  }
}

class Varispeed extends Engine {
  constructor(rate){super(rate);this.oversampler=new Oversampler2x();this.shape=x=>{const value=Math.tanh(x*this.saturationDrive)/Math.sqrt(this.saturationDrive);return this.bitcrush?Math.round(value*this.quantSteps)/this.quantSteps:value;};this.wowCos=Math.cos(TAU*.5/rate);this.wowSin=Math.sin(TAU*.5/rate);this.flutterCos=Math.cos(TAU*6/rate);this.flutterSin=Math.sin(TAU*6/rate);}
  clear() {
    this.head = this.oldHead = 0; this.started = false; this.previousCycle = -1;
    this.rebase = 1; this.motor = 1; this.playback = 1; this.env = 0; this.lastWet = 0;
    this.direction = 1; this.pendingDirection = 1; this.scratchValue = 0;
    this.direct=false;this.wowS=0;this.wowC=1;this.flutterS=0;this.flutterC=1;this.turnWait=0;this.turnGain=1;this.lastRaw=0;this.zeroCrossTurns=0;this.mutedTurns=0;this.latency=0;this.saturationDrive=1;this.quantSteps=65536;this.bitcrush=false;this.oversampler?.reset();
  }
  process(l, r, p, frame, bpm) {
    if (!this.begin(p)) return this.dry(l, r);
    this.push(l, r);
    const musical=p.timing==='musical';
    const latency = musical?0:this.rate * .025;
    if (this.filled < latency + 4) return this.dry(l, r);
    const beat = this.rate * 60 / bpm;
    const capture = Math.max(16, Math.min(this.size - 4, beat * captureBeats(p)));
    const cycle = Math.floor(frame / capture);
    const desiredDirect=musical&&norm(p,'speed',1)===1&&norm(p,'scratch',.5)===.5&&norm(p,'wow',0)===0&&!p.stop&&this.motor>.9999&&(p.mode===undefined||p.mode===0||p.mode==='FORWARD');
    if (!this.started) { this.head = this.write - latency-1; this.started = true;this.direct=desiredDirect; }
    else if(desiredDirect&&!this.direct){this.oldHead=this.head;this.head=this.write-1;this.rebase=0;}
    else if(!desiredDirect&&this.direct){this.head=this.write-1;this.rebase=1;}
    else if (!desiredDirect&&cycle !== this.previousCycle) {
      this.oldHead = this.head; this.head = this.write - latency-1;
      this.rebase = 0;
    }
    this.direct=desiredDirect;if(this.direct)this.head=this.write-1;
    this.previousCycle = cycle;
    let mode = typeof p.mode === 'string' ? p.mode : Math.round(clamp(p.mode ?? 0, 0, 2) * (p.mode > 1 ? 1 : 2));
    let direction = mode === 2 || mode === 'REVERSE' ? -1 : mode === 1 || mode === 'FWD-REV' ? (cycle % 2 ? -1 : 1) : 1;
    const scratch = (norm(p, 'scratch', .5) - .5) * 2;
    this.scratchValue += (scratch - this.scratchValue) * (1 - Math.exp(-1 / (this.rate * .003)));
    let rate = norm(p, 'speed', 1) + this.scratchValue * 3;
    if (rate < 0) { direction *= -1; rate = -rate; }
    this.pendingDirection = direction;
    const raw=(this.read(this.l,this.head)+this.read(this.r,this.head))*.5;
    // A real sign crossing permits immediate reversal. DC/very-low signals instead fade to zero.
    if(this.direction!==direction){
      this.turnWait++;
      if(raw*this.lastRaw<=0&&Math.abs(raw-this.lastRaw)<.5||Math.abs(raw)<1e-6){this.direction=direction;this.turnWait=0;this.zeroCrossTurns++;}
      else if(this.turnWait>this.rate*.02){this.turnGain=Math.max(0,this.turnGain-1/(this.rate*.005));if(this.turnGain===0){this.direction=direction;this.turnWait=0;this.mutedTurns++;}}
    }else{this.turnWait=0;this.turnGain=Math.min(1,this.turnGain+1/(this.rate*.005));}
    if(this.direction!==this.pendingDirection&&this.turnGain===0){
      this.oldHead = this.head; this.rebase = 0; this.direction = direction;
    }
    this.lastRaw=raw;
    const motorTarget = p.stop ? 0 : 1;
    this.motor += (motorTarget - this.motor) / (this.rate * (p.stop ? .18 : .1));
    if (p.stop && this.motor < .0005) this.motor = 0;
    const wow = norm(p, 'wow', 0);
    const ws=this.wowS*this.wowCos+this.wowC*this.wowSin;this.wowC=this.wowC*this.wowCos-this.wowS*this.wowSin;this.wowS=ws;
    const fs=this.flutterS*this.flutterCos+this.flutterC*this.flutterSin;this.flutterC=this.flutterC*this.flutterCos-this.flutterS*this.flutterSin;this.flutterS=fs;
    const wobble = 1 + wow * (.035 * this.wowS + .009 * this.flutterS);
    const targetRate = Math.min(4, rate) * this.direction * this.motor * wobble;
    this.playback += (targetRate - this.playback) / (this.rate * .003);
    let wetL = this.direct?l:this.read(this.l, this.head), wetR = this.direct?r:this.read(this.r, this.head);
    if (this.rebase < 1) {
      const a = this.rebase;
      wetL = this.read(this.l, this.oldHead) * (1 - a) + wetL * a;
      wetR = this.read(this.r, this.oldHead) * (1 - a) + wetR * a;
      this.rebase = Math.min(1, this.rebase + 1 / (this.rate * .01));
      this.oldHead += this.playback;
    }
    this.head += this.playback;
    const saturation = norm(p, 'saturation', 0);
    if (saturation > 0) {
      this.saturationDrive=1+saturation*12;this.bitcrush=p.model===1||p.model==='BITCRUSH';this.quantSteps=2**Math.max(2,16-saturation*14);
      if(musical){const saturated=this.oversampler.process(wetL,wetR,this.shape);wetL=saturated[0];wetR=saturated[1];this.latency=this.oversampler.latency;}
      else{wetL=this.shape(wetL);wetR=this.shape(wetR);this.latency=latency;}
    }else this.latency=this.direct?0:latency;
    const peak = Math.max(Math.abs(wetL), Math.abs(wetR));
    this.env += (peak - this.env) / (this.rate * (peak > this.env ? .003 : .12));
    const compress = norm(p, 'compress', 0);
    const gain = (1 + compress * .6) / (1 + Math.max(0, this.env - .2) * compress * 5);
    wetL *= gain; wetR *= gain;
    // A stationary tape head must become silent rather than emit DC.
    const stopFade = Math.min(1, Math.abs(this.playback) * 20);
    wetL *= stopFade*this.turnGain; wetR *= stopFade*this.turnGain;
    this.lastWet = (wetL + wetR) * .5; this.age++;
    // FIR saturation and its local dry signal share the same delay; unity without SAT stays direct.
    const dryL=musical&&saturation>0?this.read(this.l,this.write-1-this.latency):l;
    const dryR=musical&&saturation>0?this.read(this.r,this.write-1-this.latency):r;
    return this.finish(dryL, dryR, wetL, wetR, norm(p, 'mix', 1));
  }
}

class Stutter extends Engine {
  constructor(rate) { super(rate,18); }
  clear(){
    this.anchor=this.oldAnchor=0;this.loopPos=0;this.readPos=0;this.slice=64;this.bankLength=64;
    this.period=64;this.basePeriod=64;this.patternIndex=0;this.cycle=-1;this.repeat=0;
    this.triggered=true;this.started=false;this.captureFade=1;this.warpRate=1;
    this.breakOffset=0;this.dropout=false;this.smoothedRate=1;this.previousBend=false;
    this.latchedWarp=0;this.quantCell=-1;this.scratchActive=false;this.scratchBeat=-1;
    this.scratchName='BABY';this.scratchRate=1;this.scratchShape=.5;this.scratchDepth=.5;this.scratchGain=1;
    this.lastRepeatFrame=-1;this.lastCaptureFrame=-1;this.captureCount=0;this.actualReps=1;this.lastPattern='EVEN';
  }
  alignPeriod(frame,base,pattern,minimum=16){
    const count=pattern==='SWING'?2:pattern==='RAMP UP'||pattern==='RAMP DOWN'?8:1;
    let total=0;for(let i=0;i<count;i++)total+=base*patternMultiplier(pattern,i);
    let position=wrap(frame,total),index=0;
    while(index<count-1&&position>=base*patternMultiplier(pattern,index)){position-=base*patternMultiplier(pattern,index);index++;}
    this.patternIndex=index;this.period=Math.max(minimum,base*patternMultiplier(pattern,index));this.loopPos=position;
  }
  updateScratch(p,frame,beat){
    const beatPosition=frame/beat,cell=Math.floor(beatPosition*2+1e-8),warp=norm(p,'warp',0),previousWarp=this.latchedWarp,wasScratch=this.scratchActive;
    if(this.quantCell<0){this.quantCell=cell;this.latchedWarp=warp>=.7&&warp<.85&&Math.abs(beatPosition*2-cell)>1/beat?0:warp;}
    else if(cell!==this.quantCell){this.quantCell=cell;this.latchedWarp=warp;}
    this.scratchActive=this.latchedWarp>=.7&&this.latchedWarp<.85;
    if(!this.scratchActive){if(previousWarp!==this.latchedWarp||wasScratch){const w=this.latchedWarp;this.warpRate=w>=.85?2**((this.random()*2-1)*3):w>=.55?STALL_RATES[Math.floor(this.random()*4)]:w>=.4?LURCH_RATES[Math.floor(this.random()*5)]:w>=.25?SLIP_RATES[Math.floor(this.random()*3)]:w>=.1?.5+this.random():1;this.scratchGain=1;this.scratchBeat=-1;}return;}
    const beatIndex=Math.floor(beatPosition+1e-8),within=wrap(beatIndex,16);
    if(beatIndex!==this.scratchBeat){
      this.scratchBeat=beatIndex;
      this.scratchName=SCRATCH_NAMES.includes(p.scratchPattern)?p.scratchPattern:SCRATCH_NAMES[Math.floor(hash(Math.floor(beatPosition/16),43)*4)];
      this.scratchRate=2**(Math.floor(hash(within,61)*4)-1);
      this.scratchShape=hash(within,62);this.scratchDepth=.25+hash(within,63)*.75;
    }
    this.warpRate=scratchVelocity(this.scratchName,beatPosition,this.scratchRate,this.scratchShape,this.scratchDepth);
    const target=scratchGate(this.scratchName,beatPosition);this.scratchGain+=(target-this.scratchGain)/Math.max(1,this.rate*.003);
  }
  bendLoop(p){
    const warp=this.latchedWarp,fracture=norm(p,'break',0);
    if(!this.scratchActive){
      if(warp>=.85)this.warpRate=2**((this.random()*2-1)*3);
      else if(warp>=.55)this.warpRate=STALL_RATES[Math.floor(this.random()*4)];
      else if(warp>=.4)this.warpRate=LURCH_RATES[Math.floor(this.random()*5)];
      else if(warp>=.25)this.warpRate=SLIP_RATES[Math.floor(this.random()*3)];
      else if(warp>=.1)this.warpRate=.5+this.random();
      else this.warpRate=1;
      this.scratchGain=1;
    }
    const reps=this.actualReps;
    this.breakOffset=(this.repeat%reps)*this.slice;this.dropout=false;
    if(fracture>=.1&&fracture<.25)this.breakOffset=((this.repeat+1)%reps)*this.slice;
    else if(fracture>=.25){
      const probability=fracture<.5?.15+(fracture-.25)/.25*.35:fracture<.7?.5+(fracture-.5)/.2*.3:.8;
      if(this.random()<probability)this.breakOffset=Math.floor(this.random()*reps)*this.slice;
      if(fracture>=.7)this.dropout=this.random()<.1+(fracture-.7)/.3*.8;
    }
  }
  capture(p,bank,base,frame,beat,retrigger=false){
    this.oldAnchor=this.anchor;this.anchor=this.write-bank-2;this.bankLength=bank;
    this.basePeriod=base;this.slice=p.bend?bank/this.actualReps:base;
    if(!retrigger){this.repeat=0;this.alignPeriod(frame,base,p.bend?'EVEN':p.pattern||'EVEN',p.bend?1:16);}
    this.readPos=this.loopPos;this.captureFade=this.started?0:1;
    this.triggered=this.random()<norm(p,'probability',1);this.started=true;
    this.lastCaptureFrame=frame;this.captureCount++;
    if(p.bend)this.bendLoop(p);
  }
  process(l,r,p,frame,bpm,realFrame=frame){
    if(!this.begin(p))return this.dry(l,r);
    if(!p.freeze||!this.started)this.push(l,r);
    const beat=this.rate*60/bpm,musical=p.timing==='musical';
    if(p.bend)this.updateScratch(p,frame,beat);
    let base=p.sync===false?this.rate*(.01+norm(p,'rate',.45)*.49):beat*division(norm(p,'rate',.45),SLICE_BEATS);
    let captureLength=beat*division(norm(p,'capture',musical?1/6:.5),musical?MUSICAL_CAPTURE:CAPTURE_BEATS);
    if(p.link&&p.sync!==false&&!p.bend){const pair=LINK_PAIRS[Math.round(norm(p,'rate',.45)*13)];base=beat*pair[0];captureLength=beat*pair[1];}
    let bank=base;
    if(p.bend){
      captureLength=p.sync===false?this.rate*(.01+norm(p,'capture',.5)*17.99):beat*(musical?division(norm(p,'capture',.5),BEND_BEATS):(1/8)*2**(norm(p,'capture',.5)*7));
      this.actualReps=this.scratchActive?1:1+Math.round(norm(p,'reps',.2)*31);
      bank=Math.max(16,Math.min(this.size-8,captureLength));base=Math.max(1,bank/this.actualReps);
    }else this.actualReps=1;
    base=Math.max(p.bend?1:16,Math.min(this.size-8,base));bank=Math.max(base,Math.min(this.size-8,bank));
    captureLength=Math.max(base,captureLength);const periodFrame=p.sync===false?realFrame:frame,captureFrame=p.bend&&p.sync===false?realFrame:frame,cycle=Math.floor((captureFrame+1e-7)/captureLength);
    if(this.filled<bank+4)return this.dry(l,r);
    if(this.previousBend!==!!p.bend){this.started=false;this.previousBend=!!p.bend;}
    if(!this.started||!p.freeze&&cycle!==this.cycle)this.capture(p,bank,base,periodFrame,beat);
    const pattern=p.bend?'EVEN':p.pattern||'EVEN';
    if(Math.abs(this.basePeriod-base)>1e-6||this.lastPattern!==pattern){this.basePeriod=base;this.slice=p.bend?bank/this.actualReps:base;this.alignPeriod(periodFrame,base,pattern,p.bend?1:16);this.readPos=this.loopPos;this.oldAnchor=this.anchor;this.captureFade=0;}
    this.lastPattern=pattern;this.cycle=cycle;
    const ramp=(norm(p,'ramp',.5)*24-12)*Math.min(32,this.repeat);
    const ratio=Math.min(16,Math.max(1/16,pitchRatio(norm(p,'pitch',.5))*2**(ramp/12)));
    let targetRate=p.bend?this.warpRate:ratio;if(p.reverse)targetRate*=-1;
    const slew=p.bend&&this.latchedWarp>=.55?(this.latchedWarp<.7?.004+(this.latchedWarp-.55)/.15*.018:.004):.001;
    this.smoothedRate+=(targetRate-this.smoothedRate)/Math.max(1,this.rate*slew);
    const sourceLength=Math.max(p.bend?1:16,this.slice),offset=p.bend?this.breakOffset:0;
    const pos=wrap(this.readPos,sourceLength),address=this.anchor+wrap(offset+pos,this.bankLength);
    const xf=Math.min(sourceLength*.25,this.rate*(.005+norm(p,'smooth',.3)*.045));
    let wetL=sample(this.l,address),wetR=sample(this.r,address);
    if(this.smoothedRate>=0&&pos>sourceLength-xf){const t=(pos-(sourceLength-xf))/xf,next=this.anchor+wrap(offset+pos-sourceLength+xf,this.bankLength);wetL=wetL*(1-t)+sample(this.l,next)*t;wetR=wetR*(1-t)+sample(this.r,next)*t;}
    else if(this.smoothedRate<0&&pos<xf){const t=1-pos/xf,next=this.anchor+wrap(offset+sourceLength-xf+pos,this.bankLength);wetL=wetL*(1-t)+sample(this.l,next)*t;wetR=wetR*(1-t)+sample(this.r,next)*t;}
    if(this.captureFade<1){const a=this.captureFade;wetL=sample(this.l,this.oldAnchor+wrap(offset+pos,this.bankLength))*(1-a)+wetL*a;wetR=sample(this.r,this.oldAnchor+wrap(offset+pos,this.bankLength))*(1-a)+wetR*a;this.captureFade=Math.min(1,a+1/Math.max(16,xf));}
    const phase=clamp(this.loopPos/this.period),gate=norm(p,'gate',.15),open=Math.max(.04,1-gate*.95),edge=Math.max(p.bend?.25:8,Math.min(xf,this.period*.2)*.2);
    let env=phase<open?Math.max(0,Math.min(1,this.loopPos/edge,(open*this.period-this.loopPos)/edge)):0;
    if(p.gateCurve==='EXP')env*=env;else if(p.gateCurve==='LOG')env=Math.sqrt(env);
    env*=(1-norm(p,'decay',0))**Math.min(64,this.repeat*.35);
    if(p.bend){
      env*=tukeyWindow(phase,norm(p,'window',.3))*this.scratchGain;if(this.dropout)env=0;
      const mid=(wetL+wetR)*.5,side=(wetL-wetR)*.5*(1+norm(p,'width',0)*3);wetL=mid+side;wetR=mid-side;
      const duck=(norm(p,'duck',.5)-.5)*2;
      if(duck>0)env/=1+Math.max(Math.abs(l),Math.abs(r))*duck*12;
      else if(duck<0){const amount=1/(1+Math.max(Math.abs(wetL),Math.abs(wetR))*-duck*12);l*=amount;r*=amount;}
    }
    const pan=norm(p,'pan',0)*(this.repeat%2?1:-1);wetL*=env*Math.sqrt(1-pan);wetR*=env*Math.sqrt(1+pan);
    this.readPos+=this.smoothedRate;this.loopPos++;
    if(this.loopPos>=this.period){
      this.loopPos-=this.period;this.repeat++;this.patternIndex++;this.period=Math.max(p.bend?1:16,base*patternMultiplier(pattern,this.patternIndex));this.readPos=this.loopPos*this.smoothedRate;this.lastRepeatFrame=realFrame+1;
      if(!p.freeze&&this.random()<norm(p,'retrigger',0))this.capture(p,bank,base,periodFrame+1,beat,true);
      if(p.bend)this.bendLoop(p);
    }
    return this.finish(l,r,wetL,wetR,p.seqGate===false||!this.triggered?0:norm(p,'mix',1));
  }
}
const OFF = Object.freeze({ on: false });

// Independent granular texture engine. Grains latch source position, direction,
// pitch and length at launch; changing controls never tears an existing grain.
export class GranularTime extends Engine {
  constructor(rate){super(rate,8);this.voices=Array.from({length:16},()=>({age:0,length:0,start:0,ratio:1,pan:0,oldest:0,span:0}));}
  clear(){this.nextLaunch=0;this.lastGrid=-1;this.launches=0;this.voice=0;this.activeVoices=0;this.clock=0;this.freezeReady=false;for(const voice of this.voices??[])voice.length=0;}
  launch(p,length){
    let available=-1;for(let i=0;i<this.voices.length;i++){const index=(this.voice+i)%this.voices.length;if(this.voices[index].age>=this.voices[index].length){available=index;break;}}
    if(available<0)return false;
    const voice=this.voices[available];this.voice=(available+1)%this.voices.length;
    const span=Math.max(4,this.filled-2),oldest=this.write-span;
    voice.age=0;voice.length=length;voice.oldest=oldest;voice.span=span;
    voice.start=oldest+wrap(norm(p,'position',.5)*span+(this.random()-.5)*norm(p,'spray',.2)*span,span);
    voice.ratio=2**((norm(p,'pitch',.5)-.5)*4)*(p.reverse?-1:1);
    voice.pan=(this.random()*2-1)*norm(p,'spread',.6);this.launches++;return true;
  }
  process(l,r,p,frame,bpm,beat){
    if(!this.begin(p))return this.dry(l,r);
    const synced=p.sync!==false,seconds=60/bpm,beats=division(norm(p,'size',.35),[.0625,.125,.25,.5,1,2,4]);
    const length=Math.max(16,Math.min(this.size-8,this.rate*(synced?seconds*beats:.01*200**norm(p,'size',.35))));
    const warmup=Math.min(length,this.rate*.05);
    if(!p.freeze||this.filled<warmup+4)this.push(l,r);
    if(this.filled<warmup+4)return this.dry(l,r);
    const density=division(norm(p,'density',.45),[4,2,1,.5,.25,.125,.0625]),period=synced?this.rate*seconds*density:this.rate/(1+norm(p,'density',.45)*79);
    // Bound launch rate to voice capacity; this changes density, never truncates
    // a sounding grain, even at two-second grains and 80 requested starts/s.
    const boundedPeriod=Math.max(period,length/this.voices.length);
    const clock=synced?(Number.isFinite(beat)?beat:frame/this.rate/seconds)*this.rate*seconds:this.clock;
    const grid=Math.floor((clock+1e-7)/boundedPeriod);
    if((synced&&grid!==this.lastGrid)||(!synced&&this.clock>=this.nextLaunch)){
      this.launch(p,length);this.lastGrid=grid;this.nextLaunch=this.clock+boundedPeriod;
    }
    let left=0,right=0,weight=0,count=0;
    for(const voice of this.voices){
      if(voice.length<=0||voice.age>=voice.length)continue;
      const w=.5-.5*Math.cos(TAU*voice.age/voice.length),position=voice.oldest+wrap(voice.start+voice.age*voice.ratio-voice.oldest,voice.span);
      left+=sample(this.l,position)*w*Math.sqrt(1-voice.pan);right+=sample(this.r,position)*w*Math.sqrt(1+voice.pan);weight+=w;voice.age++;count++;
    }
    this.activeVoices=count;this.clock++;
    // Do not divide by a nearly-zero window: attack and release remain tapered.
    const gain=1/Math.max(1,weight);
    return this.finish(l,r,left*gain,right*gain,norm(p,'mix',1));
  }
}

export class TimeRack {
  constructor(sampleRate = 48000) {
    this.rate = Math.max(8000, Math.min(192000, Number(sampleRate) || 48000));
    this.stretch = new Stretch(this.rate);
    this.vari = new Varispeed(this.rate);
    this.stutter = new Stutter(this.rate);
    this.granular = new GranularTime(this.rate);
    this.out = new Float64Array(2);
    this.alignSize=Math.ceil(this.rate*.025)+32;this.alignL=new Float64Array(this.alignSize*4);this.alignR=new Float64Array(this.alignSize*4);this.alignPos=0;
  }
  reset() { this.stretch.reset(); this.vari.reset(); this.stutter.reset(); this.granular.reset(); this.out.fill(0);this.alignL.fill(0);this.alignR.fill(0);this.alignPos=0; }
  get latency(){return this.vari.fade>0?this.vari.latency:0;}
  process(left, right, time = {}, frame = 0, bpm = 120, beatPosition) {
    left = Number.isFinite(left) ? left : 0; right = Number.isFinite(right) ? right : 0;
    bpm = clamp(bpm, 20, 400);
    const gridFrame=Number.isFinite(beatPosition)?beatPosition*this.rate*60/bpm:frame;
    const s = time.stretch || OFF, v = time.vari || OFF, t = time.stutter || OFF;
    let a, b, c;
    if (time.order === 'parallel') {
      a = this.stretch.process(left, right, s, gridFrame, bpm);
      b = this.vari.process(left, right, v, gridFrame, bpm);
      c = this.stutter.process(left, right, t, gridFrame, bpm,frame);
      // Average deltas, retaining a unity dry path with zero active branches.
      const count = Math.max(1, Number(!!s.on || this.stretch.fade > 0) + Number(!!v.on || this.vari.fade > 0) + Number(!!t.on || this.stutter.fade > 0));
      const n=this.alignSize,w=this.alignPos,delay=Math.min(n-1,Math.round(this.latency)),read=(w-delay+n)%n;
      this.alignL[w]=left;this.alignR[w]=right;this.alignL[n+w]=a[0];this.alignR[n+w]=a[1];this.alignL[2*n+w]=b[0];this.alignR[2*n+w]=b[1];this.alignL[3*n+w]=c[0];this.alignR[3*n+w]=c[1];
      const dryL=this.alignL[read],dryR=this.alignR[read],aL=this.alignL[n+read],aR=this.alignR[n+read],cL=this.alignL[3*n+read],cR=this.alignR[3*n+read];
      const bL=this.vari.fade>0?b[0]:dryL,bR=this.vari.fade>0?b[1]:dryR;
      this.out[0]=dryL+((aL-dryL)+(bL-dryL)+(cL-dryL))/count;
      this.out[1]=dryR+((aR-dryR)+(bR-dryR)+(cR-dryR))/count;
      this.alignPos=(w+1)%n;
    } else if (time.order === 'vari-stretch-stutter') {
      a = this.vari.process(left, right, v, gridFrame, bpm);
      b = this.stretch.process(a[0], a[1], s, gridFrame, bpm);
      c = this.stutter.process(b[0], b[1], t, gridFrame, bpm,frame);
      this.out[0] = c[0]; this.out[1] = c[1];
    } else if (time.order === 'stutter-stretch-vari') {
      a = this.stutter.process(left, right, t, gridFrame, bpm,frame);
      b = this.stretch.process(a[0], a[1], s, gridFrame, bpm);
      c = this.vari.process(b[0], b[1], v, gridFrame, bpm);
      this.out[0] = c[0]; this.out[1] = c[1];
    } else {
      a = this.stretch.process(left, right, s, gridFrame, bpm);
      b = this.vari.process(a[0], a[1], v, gridFrame, bpm);
      c = this.stutter.process(b[0], b[1], t, gridFrame, bpm,frame);
      this.out[0] = c[0]; this.out[1] = c[1];
    }
    const granular=this.granular.process(this.out[0],this.out[1],time.granular||OFF,frame,bpm,beatPosition);
    this.out[0]=granular[0];this.out[1]=granular[1];
    return this.out;
  }
}
