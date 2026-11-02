import {TimeRack} from './time-core.mjs';
import {EffectRack} from './fx-core.mjs';
import {ModulationEngine, defaultState, sanitizeState, resolveTarget, clamp01} from './modulation.mjs';
import {SPECTRAL_TYPES} from './spectral.mjs';
import {effectLatencyHint} from './effects.mjs';
import {applyStructureEvent} from './state.mjs';

const finite = value => Number.isFinite(value) ? Math.max(-32, Math.min(32, value)) : 0;
const dbGain = db => 10 ** (db / 20);
const SQRT2 = Math.SQRT2;

class StereoBiquad {
  constructor() {this.b0 = 1; this.b1 = this.b2 = this.a1 = this.a2 = 0; this.z = new Float64Array(4); this.out = new Float64Array(2);}
  reset() {this.z.fill(0);}
  set(kind, frequency, db, sampleRate) {
    const A = 10 ** (db / 40), omega = 2 * Math.PI * Math.min(frequency, sampleRate * .45) / sampleRate;
    const c = Math.cos(omega), s = Math.sin(omega), alpha = s / SQRT2, sqrtA = Math.sqrt(A);
    let b0, b1, b2, a0, a1, a2;
    if (kind === 'low') {
      const t = 2 * sqrtA * alpha;
      b0 = A * (A + 1 - (A - 1) * c + t); b1 = 2 * A * (A - 1 - (A + 1) * c); b2 = A * (A + 1 - (A - 1) * c - t);
      a0 = A + 1 + (A - 1) * c + t; a1 = -2 * (A - 1 + (A + 1) * c); a2 = A + 1 + (A - 1) * c - t;
    } else if (kind === 'high') {
      const t = 2 * sqrtA * alpha;
      b0 = A * (A + 1 + (A - 1) * c + t); b1 = -2 * A * (A - 1 + (A + 1) * c); b2 = A * (A + 1 + (A - 1) * c - t);
      a0 = A + 1 - (A - 1) * c + t; a1 = 2 * (A - 1 - (A + 1) * c); a2 = A + 1 - (A - 1) * c - t;
    } else {
      b0 = 1 + alpha * A; b1 = -2 * c; b2 = 1 - alpha * A;
      a0 = 1 + alpha / A; a1 = -2 * c; a2 = 1 - alpha / A;
    }
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = a1 / a0; this.a2 = a2 / a0;
  }
  process(left, right) {
    let output = this.b0 * left + this.z[0];
    this.z[0] = this.b1 * left - this.a1 * output + this.z[1]; this.z[1] = this.b2 * left - this.a2 * output; this.out[0] = finite(output);
    output = this.b0 * right + this.z[2];
    this.z[2] = this.b1 * right - this.a1 * output + this.z[3]; this.z[3] = this.b2 * right - this.a2 * output; this.out[1] = finite(output);
    return this.out;
  }
}

export class MainBus {
  constructor(sampleRate) {
    this.sampleRate = sampleRate; this.low = new StereoBiquad(); this.mid = new StereoBiquad(); this.high = new StereoBiquad();
    this.output = new Float64Array(2); this.smooth = 1 - Math.exp(-1 / (sampleRate * .01)); this.compressorEnvelope = 0;
    this.current = {gain: .5,gainMode:'legacy',low: .5, mid: .5, high: .5, pan: .5, mix: 1, compress: 0,autoGain:0};
    this.dryEnergy=0;this.wetEnergy=0;this.levelCoefficient=1-Math.exp(-1/(sampleRate*.2));this.autoCompensation=1;
    this.compressorAttack = 1 - Math.exp(-1 / (sampleRate * .004)); this.compressorRelease = 1 - Math.exp(-1 / (sampleRate * .15));
    this.update(this.current);
  }
  reset() {this.low.reset(); this.mid.reset(); this.high.reset(); this.compressorEnvelope = 0;this.dryEnergy=this.wetEnergy=0;this.autoCompensation=1;}
  update(main) {
    this.low.set('low', 200, ((main.low ?? .5) - .5) * 30, this.sampleRate);
    this.mid.set('peak', 1000, ((main.mid ?? .5) - .5) * 30, this.sampleRate);
    this.high.set('high', 5000, ((main.high ?? .5) - .5) * 30, this.sampleRate);
    const value=main.gain??.5,gain=main.gainMode==='extended'?(value<.5?value*2:dbGain((value-.5)*24)):dbGain((value-.5)*48),pan=(main.pan??.5)*Math.PI/2;
    this.gainLeft = gain * Math.cos(pan) * SQRT2; this.gainRight = gain * Math.sin(pan) * SQRT2;
  }
  process(left, right, dryLeft, dryRight, main, frame = 0) {
    const current = this.current, a = this.smooth;
    current.gain += a * ((main.gain ?? .5) - current.gain);
    current.pan += a * ((main.pan ?? .5) - current.pan);
    current.mix += a * ((main.mix ?? 1) - current.mix);
    current.compress += a * ((main.compress ?? 0) - current.compress);
    current.low += a * ((main.low ?? .5) - current.low);
    current.mid += a * ((main.mid ?? .5) - current.mid);
    current.high += a * ((main.high ?? .5) - current.high);
    current.autoGain+=a*((main.autoGain??0)-current.autoGain);current.gainMode=main.gainMode??'legacy';
    if ((frame & 31) === 0) this.update(current);
    let pair = this.low.process(left, right); pair = this.mid.process(pair[0], pair[1]); pair = this.high.process(pair[0], pair[1]);
    left = pair[0]; right = pair[1];
    const peak = Math.max(Math.abs(left), Math.abs(right));
    const coefficient = peak > this.compressorEnvelope ? this.compressorAttack : this.compressorRelease;
    this.compressorEnvelope += coefficient * (peak - this.compressorEnvelope);
    if (current.compress > .00001) {
      const over = Math.max(0, 20 * Math.log10(this.compressorEnvelope + 1e-10) + 18), ratio = 1 + current.compress * 9;
      const reduction = dbGain(-over * (1 - 1 / ratio) * current.compress);
      left *= reduction; right *= reduction;
    }
    this.dryEnergy+=this.levelCoefficient*((dryLeft*dryLeft+dryRight*dryRight)*.5-this.dryEnergy);
    this.wetEnergy+=this.levelCoefficient*((left*left+right*right)*.5-this.wetEnergy);
    const target=this.dryEnergy>1e-8&&this.wetEnergy>1e-8?Math.max(.125,Math.min(8,Math.sqrt(this.dryEnergy/this.wetEnergy))):1;
    this.autoCompensation+=this.levelCoefficient*(target-this.autoCompensation);
    if(current.autoGain>1e-6){const gain=this.autoCompensation**current.autoGain;left*=gain;right*=gain;}
    // Master MIX returns the original source, with latency compensation.
    this.output[0] = finite((dryLeft + (left - dryLeft) * current.mix) * this.gainLeft);
    this.output[1] = finite((dryRight + (right - dryRight) * current.mix) * this.gainRight);
    return this.output;
  }
}

export function limitSample(value) {
  if (!Number.isFinite(value)) return 0;
  const magnitude = Math.abs(value);
  return magnitude <= .95 ? value : Math.sign(value) * (.95 + .05 * Math.tanh((magnitude - .95) / .05));
}

const copyState=value=>JSON.parse(JSON.stringify(value));
const structure=(state,rate)=>JSON.stringify([state.latencyComp!==false,state.fxMode,state.fx.map(effect=>[effect.id,effect.type,effectLatencyHint(effect.type,effect.params,rate),effect.lrLock===false?effectLatencyHint(effect.type,effect.paramsR??effect.params,rate):0])]);
const chainLatency=(state,rate,live=state.playing)=>{
 if(state.latencyComp===false)return 0;
 const lengths=state.fx.map(effect=>SPECTRAL_TYPES.has(effect.type)&&live?4096:Math.max(effectLatencyHint(effect.type,effect.params,rate),effect.lrLock===false?effectLatencyHint(effect.type,effect.paramsR??effect.params,rate):0));
 return state.fxMode==='parallel'?Math.max(0,...lengths):lengths.reduce((sum,length)=>sum+length,0);
};

export class DestructorRuntime{
 constructor(sampleRate=48000){
  this.sampleRate=sampleRate;this.time=new TimeRack(sampleRate);this.fx=new EffectRack(sampleRate);this.modulation=new ModulationEngine(sampleRate);this.main=new MainBus(sampleRate);
  this.frame=0;this.samples=0;this.beat=0;this.contextTime=0;this.clockError=0;this.externalClock=null;this.output=new Float64Array(2);this.playFade=0;this.bypassFade=0;this.fade=1-Math.exp(-1/(sampleRate*.01));
  this.dryL=new Float32Array(524288);this.dryR=new Float32Array(524288);this.dryMask=this.dryL.length-1;this.dryWrite=0;this.latency=0;this.pendingLatency=false;this.pendingState=null;this.pendingLocks=new Map();this.pendingMode=null;
  this.automationSample=0;this.automationIndex=0;this.automationDone=false;this.automationSignature='';this.automationWasPlaying=false;this.structureRevision=0;this.lastMeterRevision=0;
  this.configure(defaultState());
 }
 configure(raw){
  const desired=sanitizeState(raw),currentBase=this.modulation.base;
  if(!desired.playing){if(this.pendingMode)desired.fxMode=this.pendingMode;for(const effect of desired.fx)if(this.pendingLocks.has(effect.id))effect.lrLock=this.pendingLocks.get(effect.id);}
  this.desiredState=copyState(desired);let audible=desired;
  const defer=this.structure&&currentBase?.playing&&desired.playing&&chainLatency(currentBase,this.sampleRate)!==chainLatency(desired,this.sampleRate);
  if(defer){
   this.pendingState=copyState(desired);audible=copyState(desired);audible.fxMode=currentBase.fxMode;audible.latencyComp=currentBase.latencyComp;
   audible.fx=currentBase.fx.map(old=>{
    const updated=desired.fx.find(effect=>effect.id===old.id&&effect.type===old.type);if(!updated)return copyState(old);
    return copyState(updated);
   });this.pendingLatency=true;
  }else{
   this.pendingState=null;if(!desired.playing){this.pendingLocks.clear();this.pendingMode=null;}this.pendingLatency=!!this.pendingMode||this.pendingLocks.size>0;
   // Keep the original-source history across live, same-latency reorders.
   this.structure=structure(audible,this.sampleRate);
  }
  const automationSignature=JSON.stringify(audible.automation??{}),automationStart=audible.automationPlaying&&!this.automationWasPlaying;
  if(automationSignature!==this.automationSignature||automationStart){this.automationSample=0;this.automationIndex=0;this.automationDone=false;this.modulation.clearAutomation();}
  if(!audible.automationPlaying)this.modulation.clearAutomation();
  this.automationSignature=automationSignature;this.automationWasPlaying=!!audible.automationPlaying;
  this.state=this.modulation.configure(audible);this.releaseSpectralBudget=!this.state.playing&&this.playFade>1e-8;
  this.activeFxMode=this.state.fxMode;this.activeLocks=this.state.fx.map(effect=>({effect,value:effect.lrLock!==false}));
  this.controlTargets=new Set([...this.modulation.bindings.map(binding=>binding.target.path),...(this.state.automation?.events??[]).map(event=>event.path)]);
  this.fx.configure(this.state.fx,this.state.fxMode,this.state.tonal,{latencyComp:this.state.latencyComp!==false,liveSizes:!!this.state.playing||this.releaseSpectralBudget});
  this.latency=this.state.latencyComp===false?0:Math.min(this.dryMask,Number(this.fx.latency)||0);
  if(desired.clock?.source==='internal'){this.externalClock=null;this.clockError=0;}
  return this.state;
 }
 setTransport(playing,restart=false){
  if(!!playing!==!!this.modulation.base.playing||!playing&&(this.pendingState||this.pendingLocks.size||this.pendingMode)){const state=copyState(this.pendingState??this.desiredState??this.modulation.base);state.playing=!!playing;this.configure(state);}
  this.modulation.base.playing=!!playing;this.state.playing=!!playing;if(this.desiredState)this.desiredState.playing=!!playing;if(restart)this.reset();
 }
 reset(){
  this.time.reset();this.fx.reset();this.main.reset();this.modulation.reset();this.dryL.fill(0);this.dryR.fill(0);this.dryWrite=0;
  this.frame=0;this.beat=0;this.clockError=0;this.playFade=0;this.automationSample=0;this.automationIndex=0;this.automationDone=false;
 }
 setClock(message){
  if(!Number.isFinite(+message.beat)||!Number.isFinite(+message.bpm))return;
  const bpm=Math.max(30,Math.min(300,+message.bpm)),age=Number.isFinite(message.timestamp)?Math.max(0,Math.min(.5,this.contextTime-message.timestamp)):0,target=+message.beat+(message.playing?age*bpm/60:0);
  this.externalClock={bpm,playing:!!message.playing};
  if(message.seek){this.beat=Math.max(0,target);this.modulation.seekBeat(this.beat);this.clockError=0;}
  else this.clockError=target-this.beat;
 }
 gesture(path,value){return this.modulation.notifyGesture(path,typeof value==='boolean'?Number(value):value);}
 _applyStructure(event){
  const next=copyState(this.modulation.base);if(!applyStructureEvent(next,event))return false;
  this.state=this.modulation.configure(next);this.activeFxMode=this.state.fxMode;
  this.activeLocks=this.state.fx.map(effect=>({effect,value:effect.lrLock!==false}));
  this.controlTargets=new Set([...this.modulation.bindings.map(binding=>binding.target.path),...(this.state.automation?.events??[]).map(event=>event.path).filter(Boolean)]);
  this.fx.configure(this.state.fx,this.state.fxMode,this.state.tonal,{latencyComp:this.state.latencyComp!==false,liveSizes:!!this.state.playing||this.releaseSpectralBudget});
  this.structure=structure(this.state,this.sampleRate);this.structureRevision++;return true;
 }
 _automation(){
  const base=this.modulation.base,clip=base.automation;if(!base.automationPlaying||this.automationDone||!clip?.events?.length)return;
  const length=Math.max(1,Math.round((Number(clip.duration)||.01)*this.sampleRate));
  if(this.automationSample>=length){if(clip.loop!==false){this.automationSample%=length;this.automationIndex=0;this.modulation.clearAutomation();}else{this.automationDone=true;return;}}
  const time=this.automationSample/this.sampleRate;
  while(this.automationIndex<clip.events.length){const event=clip.events[this.automationIndex];if(Number(event.time)>time+1e-10)break;if(event.kind==='structure')this._applyStructure(event);else this.modulation.setAutomation(event.path,event.value);this.automationIndex++;}
  this.automationSample++;
 }
 process(left,right,sideLeft=0,sideRight=0){
  left=finite(left);right=finite(right);sideLeft=finite(sideLeft);sideRight=finite(sideRight);const base=this.modulation.base,bpm=this.externalClock?.bpm??base.bpm;
  this.playFade+=this.fade*((base.playing?1:0)-this.playFade);
  if(!base.playing&&this.playFade<1e-8){this.playFade=0;if(this.releaseSpectralBudget){this.releaseSpectralBudget=false;this.configure(this.desiredState);}this.output[0]=this.output[1]=0;this.samples++;this.contextTime+=1/this.sampleRate;return this.output;}
  if(base.playing)this._automation();let effective=this.state;if(base.playing)effective=this.modulation.tick(this.frame,bpm,this.beat);
  const controlUpdated=base.playing&&this.modulation.lastUpdate===this.frame;
  this.bypassFade+=this.fade*((effective.bypass?1:0)-this.bypassFade);
  let reconfigure=false;
  if(effective.fxMode!==this.activeFxMode){
   if(chainLatency(effective,this.sampleRate)!==this.fx.latency&&effective.latencyComp!==false){this.pendingMode=effective.fxMode;effective.fxMode=this.activeFxMode;}
   else{this.activeFxMode=effective.fxMode;this.pendingMode=null;reconfigure=true;}
  }else if(controlUpdated&&this.controlTargets.has('fxMode'))this.pendingMode=null;
  for(const active of this.activeLocks)if((active.effect.lrLock!==false)!==active.value){
   if(chainLatency(effective,this.sampleRate)!==this.fx.latency&&effective.latencyComp!==false){this.pendingLocks.set(active.effect.id,active.effect.lrLock!==false);active.effect.lrLock=active.value;}
   else{active.value=active.effect.lrLock!==false;this.pendingLocks.delete(active.effect.id);reconfigure=true;}
  }else if(controlUpdated&&this.controlTargets.has(`fx.${active.effect.id}.lrLock`))this.pendingLocks.delete(active.effect.id);
  if(reconfigure)this.fx.configure(effective.fx,effective.fxMode,effective.tonal,{latencyComp:effective.latencyComp!==false,liveSizes:!!base.playing});
  this.pendingLatency=!!this.pendingState||!!this.pendingMode||this.pendingLocks.size>0;
  this.dryL[this.dryWrite]=left;this.dryR[this.dryWrite]=right;
  let pair=this.time.process(base.playing?left:0,base.playing?right:0,effective.time,this.frame,bpm,this.beat);
  this.modulation.feedEnvelope(pair[0],pair[1],sideLeft,sideRight);this.fx.setSidechain?.(sideLeft,sideRight);pair=this.fx.process(pair[0],pair[1],this.frame,bpm,this.beat);
  const totalLatency=effective.latencyComp===false?0:Math.min(this.dryMask,(Number(this.fx.latency)||0)+(Number(this.time.latency)||0));this.latency=totalLatency;
  const dryIndex=(this.dryWrite-totalLatency)&this.dryMask,dryLeft=this.dryL[dryIndex],dryRight=this.dryR[dryIndex];this.dryWrite=(this.dryWrite+1)&this.dryMask;
  pair=this.main.process(pair[0],pair[1],dryLeft,dryRight,effective.main,this.samples);
  this.output[0]=limitSample((pair[0]+(dryLeft-pair[0])*this.bypassFade)*this.playFade);this.output[1]=limitSample((pair[1]+(dryRight-pair[1])*this.bypassFade)*this.playFade);
  if(base.playing){const nominal=bpm/(60*this.sampleRate),correction=this.externalClock?Math.max(-nominal*.05,Math.min(nominal*.05,this.clockError*.001)):0;this.beat+=nominal+correction;this.clockError-=correction;this.frame++;}
  this.samples++;this.contextTime+=1/this.sampleRate;return this.output;
 }
 getMeterState(){const base=this.modulation.base,topology=this.structureRevision!==this.lastMeterRevision?{fx:copyState(base.fx),graphs:base.graphs.map(graph=>copyState(graph.points)),seq:Object.fromEntries(Object.entries(base.seq).map(([name,sequence])=>[name,Object.fromEntries(['patterns','length','target','min','max'].filter(key=>sequence[key]!==undefined).map(key=>[key,sequence[key]]))]))}:null;this.lastMeterRevision=this.structureRevision;return {structureRevision:this.structureRevision,topology,beat:this.beat,latency:this.latency,pendingLatency:this.pendingLatency,clockDrift:this.clockError,automationPosition:this.automationSample/this.sampleRate,automationPlaying:!!this.modulation.base.automationPlaying&&!this.automationDone,values:this.modulation.getValues(),sources:this.modulation.getSources(),modPhases:Array.from(this.modulation.phase,phase=>(phase%1+1)%1),graphPhases:Array.from(this.modulation.graphPhase,phase=>(phase%1+1)%1),fxMeters:this.fx.getMeters?.(true)??[],fftSizes:this.fx.getSpectralState?.()??[]};}
}

const ProcessorBase = globalThis.AudioWorkletProcessor ?? class { constructor() {this.port = {postMessage() {}, onmessage: null};} };
export class DestructorProcessor extends ProcessorBase {
  constructor() {
    super(); this.rate = globalThis.sampleRate ?? 48000; this.runtime = new DestructorRuntime(this.rate);
    this.meterCount = 0; this.peakL = this.peakR = this.energy = 0; this.recording = false; this.recordBuffer = null; this.recordOffset = 0; this.failed = false;
    this.port.onmessage = event => this.message(event.data);
  }
  message(data) {
    try {
      if (data?.type === 'state') {this.runtime.configure(data.state); this.failed = false;}
      else if (data?.type === 'reset') {this.finishRecording(); this.runtime.reset(); this.failed = false;}
      else if (data?.type === 'transport') {
        this.runtime.setTransport(!!data.playing,!!data.restart);
      }else if(data?.type==='clock'){
        this.runtime.setClock(data);
      }else if(data?.type==='gesture'){
        this.runtime.gesture(data.path,data.value);
      } else if (data?.type === 'record') {
        if (data.active) {this.finishRecording(false); this.recording = true; this.recordBuffer = new Float32Array(8192); this.recordOffset = 0;}
        else this.finishRecording();
      }
    } catch (error) {this.port.postMessage({type: 'error', message: String(error?.message ?? error)});}
  }
  flushRecording() {
    if (!this.recordBuffer || !this.recordOffset) return;
    const buffer = this.recordOffset === this.recordBuffer.length ? this.recordBuffer : this.recordBuffer.slice(0, this.recordOffset);
    this.port.postMessage({type: 'record', data: buffer}, [buffer.buffer]);
    this.recordBuffer = this.recording ? new Float32Array(8192) : null; this.recordOffset = 0;
  }
  finishRecording(notify = true) {
    const wasRecording = this.recording; this.recording = false; this.flushRecording();
    if (notify && wasRecording) this.port.postMessage({type: 'record-ended'});
  }
  process(inputs, outputs) {
    const output = outputs[0]; if (!output?.length) return true;
    const input = inputs[0] ?? [], inLeft = input[0], inRight = input[1] ?? inLeft;
    const side=inputs[1]??[],sideLeft=side[0],sideRight=side[1]??sideLeft;
    const outLeft = output[0], outRight = output[1] ?? output[0];
    try {
      if(Number.isFinite(globalThis.currentTime))this.runtime.contextTime=globalThis.currentTime;
      for (let i = 0; i < outLeft.length; i++) {
        const pair = this.failed ? this.runtime.output.fill(0) : this.runtime.process(inLeft?.[i] ?? 0, inRight?.[i] ?? 0,sideLeft?.[i]??0,sideRight?.[i]??0);
        outLeft[i] = pair[0]; outRight[i] = pair[1];
        this.peakL = Math.max(this.peakL, Math.abs(pair[0])); this.peakR = Math.max(this.peakR, Math.abs(pair[1])); this.energy += (pair[0] ** 2 + pair[1] ** 2) * .5; this.meterCount++;
        if (this.recording) {
          this.recordBuffer[this.recordOffset++] = pair[0]; this.recordBuffer[this.recordOffset++] = pair[1];
          if (this.recordOffset === this.recordBuffer.length) this.flushRecording();
        }
      }
      if (this.meterCount >= this.rate / 25) {
        const mod = this.runtime.modulation;
        this.port.postMessage({type: 'meter', peakL: this.peakL, peakR: this.peakR, rms: Math.sqrt(this.energy / this.meterCount),step: mod.step, steps: {...mod.steps}, mods: Array.from(mod.values), graphs: Array.from(mod.graphValues),...this.runtime.getMeterState()});
        this.meterCount = 0; this.peakL = this.peakR = this.energy = 0;
      }
    } catch (error) {
      outLeft.fill(0); outRight.fill(0);
      if (!this.failed) this.port.postMessage({type: 'error', message: String(error?.message ?? error)});
      this.failed = true;
    }
    return true;
  }
}
if (typeof globalThis.registerProcessor === 'function') globalThis.registerProcessor('destructor-processor', DestructorProcessor);
