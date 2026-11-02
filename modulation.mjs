// Original clock, control routing and modulation. No browser dependencies.
import {getParameterOptions,canSequenceTarget,sanitizeAutomationEvents} from './state.mjs';
export const MOD_BEAT_LENGTHS = Object.freeze([1 / 16, 1 / 8, 1 / 4, .5, 1, 2, 4, 8, 16, 32, 64]);
export const SEQ_BEAT_LENGTHS = Object.freeze([.25, .5, 1, 2, 4]);
export const GRAPH_BEAT_LENGTHS = Object.freeze([1, 2, 4, 6, 8, 12, 16, 24, 32, 48, 64]);
export const LFO_SHAPES = Object.freeze(['sine', 'triangle', 'saw', 'ramp', 'square', 'pulse25', 'pulse75', 'exp', 'log', 'peak', 'valley', 'bump', 'double', 'skew', 'stairs', 'sinefold', 'trapezoid', 'samplehold', 'smoothstep']);
const TAU = Math.PI * 2;
const SEQ_NAMES = Object.freeze(['stutter', 'stretch']);
export const clamp01 = value => Math.max(0, Math.min(1, Number.isFinite(+value) ? +value : 0));
const positive = (value, fallback) => Number.isFinite(+value) && +value > 0 ? +value : fallback;
const copy = value => JSON.parse(JSON.stringify(value));
export const freeRateHz=rate=>.01*10000**clamp01(rate);
export function beatLength(rate, sequence = false) {
  const values = sequence ? SEQ_BEAT_LENGTHS : MOD_BEAT_LENGTHS;
  return values[Math.round(clamp01(rate) * (values.length - 1))];
}
export function hash01(index, seed = 1) {
  let n = Math.imul((index | 0) ^ Math.imul(seed + 1, 0x45d9f3b), 0x27d4eb2d);
  n ^= n >>> 15; n = Math.imul(n, 0x85ebca6b); n ^= n >>> 13;
  return (n >>> 0) / 4294967296;
}
export function lfoShape(shape, phase) {
  const p = ((phase % 1) + 1) % 1;
  switch (String(shape).toLowerCase()) {
    case 'triangle': case 'tri': return 1 - Math.abs(p * 2 - 1);
    case 'saw': case 'sawdown': return 1 - p;
    case 'ramp': case 'sawup': return p;
    case 'square': return p < .5 ? 1 : 0;
    case 'pulse25': return p < .25 ? 1 : 0;
    case 'pulse75': return p < .75 ? 1 : 0;
    case 'exp': return p ** 3;
    case 'log': return 1 - (1 - p) ** 3;
    case 'peak': return Math.max(0, 1 - Math.abs(p - .5) * 6);
    case 'valley': return Math.min(1, Math.abs(p - .5) * 6);
    case 'bump': return Math.sin(Math.PI * p) ** 4;
    case 'double': case 'dbl': return .5 - .5 * Math.cos(TAU * 2 * p);
    case 'skew': return p < .2 ? p * 5 : (1 - p) / .8;
    case 'stairs': return Math.floor(p * 8) / 7;
    case 'sample': case 's&h': case 'samplehold': return hash01(Math.floor(p * 8), 45);
    case 'sinefold': return Math.abs(Math.sin(TAU * 2 * p));
    case 'trapezoid': return p < .1 ? p * 10 : p < .5 ? 1 : p < .6 ? 1 - (p - .5) * 10 : 0;
    case 'cosine': return .5 + .5 * Math.cos(TAU * p);
    case 'rectify': return Math.abs(Math.sin(TAU * p));
    case 'smoothstep': return p * p * (3 - 2 * p);
    default: return .5 - .5 * Math.cos(TAU * p);
  }
}

export function mapTarget(value, target = {}) {
  const start = clamp01(target.start ?? 0), end = clamp01(target.end ?? 1);
  let v = Math.abs(end - start) < .000001 ? (value >= end ? 1 : 0) : clamp01((value - start) / (end - start));
  const skew = (clamp01(target.skew ?? .5) - .5) * 2;
  if (skew > 0) v = v ** (1 + skew * 4);
  else if (skew < 0) v = 1 - (1 - v) ** (1 - skew * 4);
  if (target.curve === 's' || target.curve === 'smooth') v = v * v * (3 - 2 * v);
  if (target.curve === 'triangle') v = 1 - Math.abs(2 * v - 1);
  return clamp01((target.min ?? 0) + v * ((target.max ?? 1) - (target.min ?? 0)));
}

function graphPoint(point) {
  const p=Array.isArray(point)?{x:point[0],y:point[1],curve:point[2],c1x:point[3],c1y:point[4],c2x:point[5],c2y:point[6]}:point??{};
  const result={x:clamp01(p.x),y:clamp01(p.y),curve:(clamp01(p.curve??p.bend??.5)-.5)*2};
  if([p.c1x,p.c1y,p.c2x,p.c2y].every(Number.isFinite)){result.c1x=clamp01(p.c1x);result.c1y=clamp01(p.c1y);result.c2x=clamp01(p.c2x);result.c2y=clamp01(p.c2y);}
  return result;
}
export function prepareGraph(points) {
  const result = (Array.isArray(points) ? points : [[0, 0], [.5, 1], [1, 0]]).map(graphPoint).sort((a, b) => a.x - b.x);
  if (!result.length) return [{x: 0, y: 0, curve: 0}, {x: 1, y: 0, curve: 0}];
  if (result[0].x > 0) result.unshift({x: 0, y: result[0].y, curve: 0});
  if (result.at(-1).x < 1) result.push({x: 1, y: result[0].y, curve: 0});
  result[0].x=0;result.at(-1).x=1;result.at(-1).y=result[0].y;
  return result;
}
export function graphValue(points, phase) {
  const p = ((phase % 1) + 1) % 1;
  let index = 0;
  while (index < points.length - 2 && p > points[index + 1].x) index++;
  const a = points[index], b = points[index + 1] ?? a;
  let t = clamp01((p - a.x) / Math.max(.000001, b.x - a.x));
  // Cubic Bezier in value: opposite control offsets keep endpoints exact.
  const bend = Math.max(-1, Math.min(1, a.curve));
  const explicit=Number.isFinite(a.c1x),c1=explicit?a.c1y:clamp01(a.y+(b.y-a.y)/3+bend*.6),c2=explicit?a.c2y:clamp01(a.y+(b.y-a.y)*2/3+bend*.6);
  if(explicit){const x1=Math.max(a.x,Math.min(b.x,a.c1x)),x2=Math.max(x1,Math.min(b.x,a.c2x));let low=0,high=1;for(let i=0;i<24;i++){t=(low+high)*.5;const x=(1-t)**3*a.x+3*(1-t)**2*t*x1+3*(1-t)*t*t*x2+t**3*b.x;if(x<p)low=t;else high=t;}}
  return clamp01((1 - t) ** 3 * a.y + 3 * (1 - t) ** 2 * t * c1 + 3 * (1 - t) * t * t * c2 + t ** 3 * b.y);
}

export function defaultState() {
  return {
    bpm: 120, playing: false, bypass: false,tonal:{root:0,scale:'minor',chord:'minor'},latencyComp:true, automationPlaying:false,automation:{duration:0,loop:true,events:[]},
    time: {order: 'stretch-vari-stutter', stretch: {on: false, speed: 1, tempo: .5, grain: .4, pitch: .5, spread: .2, scatter: 0, grainLength:0, mix: 1, reverse: false, freeze: false, linked: false, sync: true}, vari: {on: false, speed: 1, tempo: .5, mode: 0, wow: 0, saturation: 0, compress: 0, mix: 1, stop: false, scratch: .5, model: 0}, stutter: {on: false, bend: false, sync: true, rate: .45, capture: .5, pitch: .5, ramp: .5, gate: .15, decay: 0, pan: 0, probability: 1, retrigger: 0, smooth: .3, mix: 1, reverse: false, freeze: false, warp: 0, break: 0, reps: .2, width: 0, duck: .5, link: false, pattern: 'EVEN', gateCurve: 'LINEAR'},granular:{on:false,sync:true,density:.45,size:.35,pitch:.5,position:.5,spray:.2,spread:.6,reverse:false,freeze:false,mix:1}},
    fx: [], fxMode: 'serial',
    main: {gain: .5,gainMode:'legacy',low: .5, mid: .5, high: .5, pan: .5, mix: 1, compress: 0,autoGain:0},
    mods: Array.from({length: 4}, () => ({type: 'lfo',source:'internal',shape: 'sine', sync:true,freeRate:.4,rate: .4, depth: 1, smooth: .1, jitter: 0, gain: .5, rise: .1, fall: .4, tone: .5, targets: []})),
    graphs: Array.from({length: 3}, () => ({points: [[0, 0], [.5, 1], [1, 0]], rate: .5, reverse: false, targets: []})),
    macros: Array.from({length: 4}, () => ({value: 0, targets: []})),
    xy: {x: .5, y: .5, targetsX: [], targetsY: []},
    seq: {stutter: {on: false, rate: .5, patterns: 1,length:0,target:'default',min:0,max:1, steps: Array.from({length: 64}, () => ({on: true, value: .5}))}, stretch: {on: false, rate: .5, patterns: 1,length:0,target:'default',min:0,max:1, steps: Array.from({length: 64}, () => ({on: true, value: 1}))}}
  };
}

export function sanitizeState(raw = {}) {
  const initial = defaultState();
  const merge = (base, data) => {
    if (!data || typeof data !== 'object') return base;
    for (const key of Object.keys(data)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
      const value = data[key];
      if (Array.isArray(value)) base[key] = copy(value);
      else if (value && typeof value === 'object') base[key] = merge(base[key] && typeof base[key] === 'object' ? base[key] : {}, value);
      else if (typeof value === 'number') base[key] = Number.isFinite(value) ? value : 0;
      else if (typeof value === 'boolean' || typeof value === 'string' || value === null) base[key] = value;
    }
    return base;
  };
  const state = merge(initial, raw);
  state.bpm = Math.max(30, Math.min(300, positive(state.bpm, 120)));
  const template = defaultState();
  state.mods = Array.from({length: 4}, (_, i) => ({...template.mods[i], ...(state.mods?.[i] ?? {})}));
  state.graphs = Array.from({length: 3}, (_, i) => ({...template.graphs[i], ...(state.graphs?.[i] ?? {})}));
  state.macros = Array.from({length: 4}, (_, i) => ({value: 0, targets: [], ...(state.macros?.[i] ?? {})}));
  // clamp every continuous parameter; transport/timing counts are validated separately.
  const clampObject = object => {
    for (const key of Object.keys(object)) {
      if (typeof object[key] === 'number') object[key] = clamp01(object[key]);
    }
  };
  Object.values(state.time).forEach(value => { if (value && typeof value === 'object') clampObject(value); });
  clampObject(state.main); state.fx = (Array.isArray(state.fx) ? state.fx : []).slice(0, 62);
  state.fx.forEach(fx => {fx.id = String(fx.id); fx.params ??= {};fx.paramsR??=copy(fx.params);clampObject(fx.params);clampObject(fx.paramsR);fx.mix = clamp01(fx.mix ?? .5); fx.gain = clamp01(fx.gain ?? .5);});
  state.mods.forEach(mod => {clampObject(mod); mod.targets = Array.isArray(mod.targets) ? mod.targets.slice(0, 6) : [];});
  state.graphs.forEach(graph => {clampObject(graph); graph.targets = Array.isArray(graph.targets) ? graph.targets.slice(0, 6) : [];});
  state.macros.forEach(macro => {macro.value = clamp01(macro.value); macro.targets = Array.isArray(macro.targets) ? macro.targets.slice(0, 5) : [];});
  state.xy.x = clamp01(state.xy.x); state.xy.y = clamp01(state.xy.y);
  state.xy.targetsX = Array.isArray(state.xy.targetsX) ? state.xy.targetsX.slice(0, 5) : [];
  state.xy.targetsY = Array.isArray(state.xy.targetsY) ? state.xy.targetsY.slice(0, 5) : [];
  for (const name of SEQ_NAMES) {
    const seq = state.seq[name]; seq.rate = clamp01(seq.rate); seq.patterns = Math.max(1, Math.min(4, Math.round(+seq.patterns || 1)));seq.length=Number.isFinite(seq.length)&&seq.length>0?Math.max(1,Math.min(64,Math.round(seq.length))):0;seq.target=seq.target==='default'||canSequenceTarget(seq.target,state)?seq.target:'default';seq.min=clamp01(seq.min??0);seq.max=clamp01(seq.max??1);
    seq.steps = Array.from({length: 64}, (_, i) => ({on: seq.steps?.[i]?.on !== false, value: clamp01(seq.steps?.[i]?.value ?? (name === 'stretch' ? 1 : .5))}));
  }
  state.automation.events=sanitizeAutomationEvents(state.automation?.events,state,Math.max(.01,Math.min(86400,+state.automation?.duration||86400)));
  return state;
}

export function resolveTarget(state, path) {
  if (typeof path !== 'string' || path.length > 200) return null;
  const segments = path.split('.');
  if (segments.some(item => item === '__proto__' || item === 'prototype' || item === 'constructor')) return null;
  if(path==='bypass')return{object:state,key:'bypass',kind:'boolean'};
  if(path==='tonal.root'&&state.tonal)return{object:state.tonal,key:'root',kind:'integer'};
  const options=getParameterOptions(path,state);
  if(options){let object=state;for(const segment of segments.slice(0,-1)){object=object?.[segment];if(!object||typeof object!=='object')return null;}return{object,key:segments.at(-1),kind:'enum',options};}
  if (segments[0] === 'fx') {
    const item = state.fx.find(fx => fx.id === segments[1]);
    if(!item)return null;
    if(segments[2]==='slices'){
      if(segments.length!==5||!/^\d+$/.test(segments[3])||+segments[3]>31||!['shuffle','repeat','pitch','reverse','gate','ratchet'].includes(segments[4]))return null;
      const object=item.slices?.[+segments[3]],key=segments[4];return typeof object?.[key]==='number'?{object,key,kind:'continuous'}:null;
    }
    if(segments.length!==3&&!(segments.length===4&&['params','paramsR'].includes(segments[2])))return null;
    const key = segments.at(-1);
    const object=['mix','gain','on','muted','lrLock','sync','snap'].includes(key)&&segments.length===3?item:segments[2]==='paramsR'?item.paramsR:item.params;
    return ['number','boolean'].includes(typeof object?.[key])?{object,key,kind:typeof object[key]==='boolean'?'boolean':'continuous'}:null;
  }
  const legal=segments[0]==='main'&&segments.length===2&&!['gainMode'].includes(segments[1])||segments[0]==='time'&&segments.length===3&&['stretch','vari','stutter','granular'].includes(segments[1])||segments[0]==='mods'&&segments.length===3&&/^[0-3]$/.test(segments[1])||segments[0]==='graphs'&&/^[0-2]$/.test(segments[1])&&(segments.length===3&&['rate','reverse'].includes(segments[2])||segments[2]==='points'&&segments.length===5&&/^\d+$/.test(segments[3])&&/^[0-6]$/.test(segments[4]))||segments[0]==='macros'&&segments.length===3&&/^[0-3]$/.test(segments[1])&&segments[2]==='value'||segments[0]==='xy'&&segments.length===2&&['x','y'].includes(segments[1])||segments[0]==='seq'&&['stretch','stutter'].includes(segments[1])&&(segments.length===3&&['rate','on','min','max'].includes(segments[2])||segments.length===5&&segments[2]==='steps'&&/^\d+$/.test(segments[3])&&+segments[3]<64&&['on','value'].includes(segments[4]));
  if(!legal)return null;
  let object = state;
  for (let i = 0; i < segments.length - 1; i++) { object = object?.[segments[i]]; if (!object || typeof object !== 'object') return null; }
  const key = segments.at(-1);
  return ['number','boolean'].includes(typeof object?.[key])?{object,key,kind:typeof object[key]==='boolean'?'boolean':'continuous'}:null;
}

const writeDestination=(binding,value)=>{binding.object[binding.key]=binding.kind==='boolean'?value>=.5:binding.kind==='enum'?binding.options[Math.round(clamp01(value)*(binding.options.length-1))]:binding.kind==='integer'?Math.round(clamp01(value)*11):clamp01(value);};
const readDestination=binding=>binding.kind==='boolean'?Number(binding.object[binding.key]):binding.kind==='enum'?Math.max(0,binding.options.indexOf(binding.object[binding.key]))/(binding.options.length-1):binding.kind==='integer'?binding.object[binding.key]/11:binding.object[binding.key];
const controllerSource=path=>/^macros\.[0-3]\.value$/.test(path)?'c'+path.split('.')[1]:path==='xy.x'?'x':path==='xy.y'?'y':null;

export class ModulationEngine{
 constructor(sampleRate=48000){
  this.sampleRate=sampleRate;this.values=new Float64Array(4);this.graphValues=new Float64Array(3);this.env=new Float64Array(4);this.envLow=new Float64Array(4);
  this.envSettings=Array.from({length:4},()=>({enabled:false,external:false,coefficient:0,high:false,plain:true,gain:1,rise:0,fall:0}));
  this.phase=new Float64Array(4);this.graphPhase=new Float64Array(3);this.lastFrame=-1;this.lastUpdate=-1000;this.lastBeat=0;this.step=0;this.steps={stutter:0,stretch:0};
  this.pickups=new Map();this.owners=new Map();this.gestures=new Map();this.automationOverrides=new Map();this.serial=0;this.lastEffective=new Map();this.controlTime=0;this.configure(defaultState());
 }
 configure(raw){
  const previous=this.base;this.base=sanitizeState(raw);this.effective=copy(this.base);this.bindings=[];this.controllerBindings=[];this.graphDirty=[false,false,false];
  const bind=(targets,source,controller=false)=>{
   for(const target of targets??[]){
    if(typeof target?.path!=='string')continue;
    const destination=resolveTarget(this.effective,target.path),origin=resolveTarget(this.base,target.path);if(!destination||!origin)continue;
    const binding={destination,origin,target,source};this.bindings.push(binding);
    if(controller){
     const key=source+':'+target.path,fingerprint=JSON.stringify(target),oldOrigin=previous?resolveTarget(previous,target.path):null;let pickup=this.pickups.get(key);
     if(!pickup)pickup={latched:false,lastMapped:null,seen:0,lastTouch:-Infinity,fingerprint,force:false};
     else if(pickup.fingerprint!==fingerprint){pickup.force=true;pickup.latched=true;}
     else if(oldOrigin&&Math.abs(readDestination(oldOrigin)-readDestination(origin))>1e-7){pickup.latched=false;if(this.owners.get(target.path)===key)this.owners.delete(target.path);}
     pickup.fingerprint=fingerprint;this.pickups.set(key,pickup);binding.key=key;binding.pickup=pickup;this.controllerBindings.push(binding);
    }
   }
  };
  this.base.mods.forEach((source,i)=>bind(source.targets,'m'+i));this.base.graphs.forEach((source,i)=>bind(source.targets,'g'+i));
  this.base.macros.forEach((source,i)=>bind(source.targets,'c'+i,true));bind(this.base.xy.targetsX,'x',true);bind(this.base.xy.targetsY,'y',true);
  this.automaticValues=new Map();for(const binding of this.bindings)if(!binding.pickup){let automatic=this.automaticValues.get(binding.target.path);if(!automatic){automatic={value:0};this.automaticValues.set(binding.target.path,automatic);}binding.automatic=automatic;}
  const validControllers=new Set(this.controllerBindings.map(binding=>binding.key));for(const[path,key]of this.owners)if(!validControllers.has(key))this.owners.delete(path);
  this.sequenceBindings={};this.preparedGraphs=this.base.graphs.map(graph=>prepareGraph(graph.points));this.updateEnvelopeSettings();this.forceUpdate=true;return this.effective;
 }
 reset(){
  this.values.fill(0);this.graphValues.fill(0);this.env.fill(0);this.envLow.fill(0);this.phase.fill(0);this.graphPhase.fill(0);this.lastFrame=-1;this.lastUpdate=-1000;this.lastBeat=0;this.controlTime=0;this.step=0;this.steps.stutter=this.steps.stretch=0;this.automationOverrides.clear();this.gestures.clear();this.forceUpdate=true;
  for(const pickup of this.pickups.values()){pickup.seen=0;pickup.force=false;pickup.lastTouch=pickup.latched?0:-Infinity;}
 }
 seekBeat(beat){for(let i=0;i<4;i++)if(this.effective.mods[i].sync!==false)this.phase[i]=beat/beatLength(this.effective.mods[i].rate);for(let i=0;i<3;i++){const graph=this.effective.graphs[i],period=graph.timing==='musical'?GRAPH_BEAT_LENGTHS[Math.round(clamp01(graph.rate)*10)]:beatLength(graph.rate);this.graphPhase[i]=beat/period*(graph.reverse?-1:1);}this.lastBeat=beat;this.forceUpdate=true;}
 notifyGesture(path,value,automation=false){
  this._restoreSequences();
  const source=controllerSource(path),destination=resolveTarget(automation?this.effective:this.base,path);if(!destination)return false;
  if(typeof value==='string'&&destination.kind==='enum')value=Math.max(0,destination.options.indexOf(value))/(destination.options.length-1);
  if(!automation){writeDestination(destination,value);const active=resolveTarget(this.effective,path);if(active)writeDestination(active,value);}
  if(source)this.gestures.set(source,{serial:++this.serial,value:clamp01(value),time:this.controlTime});
  else{
   const owner=this.owners.get(path);if(owner){const pickup=this.pickups.get(owner);if(pickup)pickup.latched=false;this.owners.delete(path);}
   this.lastEffective.set(path,clamp01(value));
  }
  if(path.startsWith('graphs.')&&path.includes('.points.'))this.graphDirty[+path.split('.')[1]]=true;
  this.forceUpdate=true;return true;
 }
 setAutomation(path,value){
  this._restoreSequences();
  const destination=resolveTarget(this.effective,path);if(!destination)return false;const normalized=clamp01(value);this.automationOverrides.set(path,normalized);writeDestination(destination,normalized);this.notifyGesture(path,normalized,true);return true;
 }
 clearAutomation(){this._restoreSequences();for(const[path]of this.automationOverrides){const origin=resolveTarget(this.base,path),destination=resolveTarget(this.effective,path);if(origin&&destination)writeDestination(destination,readDestination(origin));if(path.startsWith('graphs.')&&path.includes('.points.'))this.graphDirty[+path.split('.')[1]]=true;}this.automationOverrides.clear();this.forceUpdate=true;}
 feedEnvelope(left,right,sideLeft=0,sideRight=0){
  const internal=Math.abs(left)>=Math.abs(right)?left:right,external=Math.abs(sideLeft)>=Math.abs(sideRight)?sideLeft:sideRight;
  for(let i=0;i<4;i++){
   const settings=this.envSettings[i];if(!settings.enabled)continue;const input=settings.external?external:internal;
   this.envLow[i]+=settings.coefficient*(input-this.envLow[i]);const filtered=settings.plain?input:settings.high?input-this.envLow[i]:this.envLow[i],peak=Math.abs(filtered)*settings.gain;
   this.env[i]+=(peak>this.env[i]?settings.rise:settings.fall)*(peak-this.env[i]);
  }
 }
 updateEnvelopeSettings(){
  for(let i=0;i<4;i++){
   const mod=this.effective.mods[i],settings=this.envSettings[i];settings.enabled=/env|follower/i.test(mod.type);settings.external=mod.source==='external';
   const tone=clamp01(mod.tone??.5),cutoff=tone<.5?45*100**(tone*2):120*80**((tone-.5)*2);settings.coefficient=1-Math.exp(-TAU*Math.min(this.sampleRate*.4,cutoff)/this.sampleRate);settings.high=tone>=.5;settings.plain=Math.abs(tone-.5)<.025;settings.gain=10**(((mod.gain??.5)*48-24)/20);
   settings.rise=1-Math.exp(-1/(this.sampleRate*(.0005+clamp01(mod.rise??.1)**2*.3)));settings.fall=1-Math.exp(-1/(this.sampleRate*(.01+clamp01(mod.fall??.4)**2*2)));
  }
 }
 _controllerValue(source){return source[0]==='c'?this.effective.macros[+source[1]].value:this.effective.xy[source];}
 _restoreSequences(){for(let i=SEQ_NAMES.length-1;i>=0;i--){const previous=this.sequenceBindings?.[SEQ_NAMES[i]];if(previous?.applied){writeDestination(previous.binding,previous.savedValue);previous.applied=false;}}}
 tick(frame,bpm=this.base.bpm,coherentBeat=null){
  const beat=Number.isFinite(coherentBeat)?coherentBeat:frame/this.sampleRate*bpm/60;this.controlTime=frame/this.sampleRate;
  this._restoreSequences();
  if(frame===0&&this.lastFrame>0)this.reset();
  if(this.forceUpdate||frame-this.lastUpdate>=32||frame<this.lastUpdate){
   const deltaFrames=this.lastUpdate<0||frame<this.lastUpdate?0:frame-this.lastUpdate,deltaBeats=this.lastUpdate<0?0:Math.max(0,beat-this.lastBeat);
   // The preceding control tick supplies mod-mod values. No unbounded recursion.
   for(let i=0;i<4;i++){
    const mod=this.effective.mods[i];this.phase[i]+=mod.sync===false?deltaFrames/this.sampleRate*freeRateHz(mod.freeRate??mod.rate):deltaBeats/beatLength(mod.rate);const cycle=Math.floor(this.phase[i]);let p=this.phase[i]-cycle;const jitter=clamp01(mod.jitter??0);
    if(jitter>0){const boundary=.5+(hash01(cycle,i+97)-.5)*jitter*.7;p=p<boundary?p/boundary*.5:.5+(p-boundary)/(1-boundary)*.5;}
    let value;if(/env|follower/i.test(mod.type))value=clamp01(this.env[i]);else if(/rand/i.test(mod.type)){const a=hash01(cycle,i+1),b=hash01(cycle+1,i+1);value=mod.bin===true||mod.stepped===true?a:a+(b-a)*p*p*(3-2*p);}else value=lfoShape(mod.shape,p);
    value=clamp01(value*(mod.depth??1));const tau=clamp01(mod.smooth??0)**2*.5;this.values[i]+=tau>.00001&&deltaFrames>0?(1-Math.exp(-deltaFrames/(this.sampleRate*tau)))*(value-this.values[i]):value-this.values[i];
   }
   for(let i=0;i<3;i++){
    const graph=this.effective.graphs[i];if(this.graphDirty[i]){this.preparedGraphs[i]=prepareGraph(graph.points);this.graphDirty[i]=false;}
    const period=graph.timing==='musical'?GRAPH_BEAT_LENGTHS[Math.round(clamp01(graph.rate)*10)]:beatLength(graph.rate);this.graphPhase[i]+=deltaBeats/period*(graph.reverse?-1:1);this.graphValues[i]=graphValue(this.preparedGraphs[i],this.graphPhase[i]);
   }
   for(const binding of this.bindings)writeDestination(binding.destination,readDestination(binding.origin));
   for(const[path,value]of this.automationOverrides){const destination=resolveTarget(this.effective,path);if(destination)writeDestination(destination,value);}
   for(const binding of this.bindings){
    if(binding.pickup)continue;const value=binding.source[0]==='m'?this.values[+binding.source[1]]:this.graphValues[+binding.source[1]],mapped=mapTarget(value,binding.target);writeDestination(binding.destination,mapped);binding.automatic.value=mapped;
    if(binding.target.path.startsWith('graphs.')&&binding.target.path.includes('.points.'))this.graphDirty[+binding.target.path.split('.')[1]]=true;
   }
   for(const binding of this.controllerBindings){
    const {pickup,target,source,key}=binding,gesture=this.gestures.get(source),input=this._controllerValue(source),mapped=mapTarget(input,target),fresh=gesture&&gesture.serial>pickup.seen;
    const previousOwner=this.owners.get(target.path),automatic=this.automaticValues.get(target.path),automaticValue=automatic?.value,automaticChanged=automatic&&(pickup.autoReference===undefined||Math.abs(automaticValue-pickup.autoReference)>1e-6);
    const current=previousOwner&&previousOwner!==key?(this.lastEffective.get(target.path)??readDestination(binding.destination)):readDestination(binding.destination);
    // A moving external source regains control once the manual gesture has ended.
    if(pickup.latched&&previousOwner===key&&automaticChanged&&this.controlTime-pickup.lastTouch>.15){pickup.latched=false;this.owners.delete(target.path);}
    if(fresh||pickup.force){
     const before=pickup.lastMapped??mapTarget(source[0]==='c'?(this.base.macros[+source[1]].value):this.base.xy[source],target),crosses=(mapped-current)*(before-current)<=0||Math.abs(mapped-current)<.008;
     if(pickup.force||pickup.latched&&previousOwner===key||crosses){
      pickup.latched=true;this.owners.set(target.path,key);for(const other of this.controllerBindings)if(other.target.path===target.path&&other.key!==key)other.pickup.latched=false;
     }
     pickup.lastTouch=this.controlTime;pickup.autoReference=automaticValue;pickup.seen=gesture?.serial??pickup.seen;pickup.force=false;
    }
    if(pickup.latched&&this.owners.get(target.path)===key)writeDestination(binding.destination,mapped);
    pickup.lastMapped=mapped;
   }
   for(const binding of this.bindings)this.lastEffective.set(binding.target.path,readDestination(binding.destination));
   this.updateEnvelopeSettings();this.lastUpdate=frame;this.lastBeat=beat;this.forceUpdate=false;
  }
  for(const name of SEQ_NAMES){
   const sequence=this.effective.seq[name],length=sequence.length>0?sequence.length:16*sequence.patterns,index=((Math.floor(beat/beatLength(sequence.rate,true)+1e-10)%length)+length)%length;this.steps[name]=index;if(name==='stutter')this.step=index;
   const path=sequence.target&&sequence.target!=='default'?sequence.target:name==='stretch'?'time.stretch.speed':this.effective.time.stutter.bend?'time.stutter.reps':'time.stutter.rate';
   let cached=this.sequenceBindings[name];if(!cached||cached.path!==path){cached={path,binding:resolveTarget(this.effective,path)};this.sequenceBindings[name]=cached;}
   if(sequence.on){const step=sequence.steps[index],binding=cached.binding;if(name==='stutter')this.effective.time.stutter.seqGate=step.on;if(binding&&step.on){cached.savedValue=readDestination(binding);cached.applied=true;writeDestination(binding,(sequence.min??0)+step.value*((sequence.max??1)-(sequence.min??0)));}}
   else if(name==='stutter')this.effective.time.stutter.seqGate=true;
  }
  this.lastFrame=frame;return this.effective;
 }
 getValues(){const result={};for(const binding of this.bindings)result[binding.target.path]=readDestination(binding.destination);for(const[path]of this.automationOverrides){const destination=resolveTarget(this.effective,path);if(destination)result[path]=readDestination(destination);}for(const name of SEQ_NAMES){const cached=this.sequenceBindings[name];if(cached?.applied)result[cached.path]=readDestination(cached.binding);}return result;}
 getSources(){const result={};for(const[path]of this.automationOverrides)result[path]='automation';for(const binding of this.bindings)if(!binding.pickup)result[binding.target.path]=binding.source;for(const binding of this.controllerBindings)if(binding.pickup.latched&&this.owners.get(binding.target.path)===binding.key)result[binding.target.path]=binding.source;for(const name of SEQ_NAMES){const cached=this.sequenceBindings[name];if(cached?.applied)result[cached.path]='s:'+name;}return result;}
}
