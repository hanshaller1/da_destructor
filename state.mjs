import {EFFECTS} from './effects.mjs';

export const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(+n)?+n:a));
export const TIME_CONTROLS={
 stretch:[['speed','SPEED',1,'percent'],['tempo','CAPTURE',.5,'timecapture'],['grain','GRAIN',.4,'stretchgrain'],['pitch','PITCH',.5,'pitch'],['spread','SPREAD',.2,'percent'],['scatter','SCATTER',0,'percent'],['grainLength','GRAIN LENGTH',0,'grainlength']],
 vari:[['speed','SPEED',1,'percent'],['tempo','CAPTURE',.5,'timecapture'],['wow','WOW / FLUTTER',0,'percent'],['saturation','SATURATION',0,'percent'],['compress','COMPRESS',0,'percent'],['scratch','SCRATCH',.5,'bipolar']],
 stutter:[['rate','RATE',.45,'stutterrate'],['capture','CAPTURE',1/6,'stuttercapture'],['pitch','PITCH',.5,'pitch'],['ramp','PITCH RAMP',.5,'pitch'],['gate','GATE',.15,'percent'],['decay','DECAY',0,'percent'],['pan','PAN SPREAD',0,'percent'],['probability','PROBABILITY',1,'percent'],['retrigger','RETRIGGER',0,'percent'],['smooth','SMOOTH',.3,'smooth']],
 bend:[['warp','WARP',0,'warp'],['break','BREAK',0,'fracture'],['reps','REPS',.2,'reps'],['capture','TIME',1/6,'bendtime'],['width','WIDTH',0,'width'],['duck','DUCK',.5,'bipolar'],['window','WINDOW',.3,'percent']],
 granular:[['density','DENSITY',.45,'granulardensity'],['size','SIZE',.35,'granularsize'],['pitch','PITCH',.5,'granularpitch'],['position','POSITION',.5,'percent'],['spray','SPRAY',.2,'percent'],['spread','SPREAD',.6,'percent']]
};
export const TIME_TOGGLES={stretch:[['sync','SYNC'],['linked','LINKED']],vari:[],stutter:[['sync','SYNC'],['link','LINK']],bend:[['sync','SYNC']],granular:[['sync','SYNC']]};
export const TIME_SELECTS={
 stretch:[{key:'timing',label:'TIMING',options:['musical','legacy'],numeric:false}],
 vari:[{key:'mode',label:'MODE',options:['FORWARD','FWD-REV','REVERSE'],numeric:true},{key:'model',label:'SAT TYPE',options:['HEAT','BITCRUSH'],numeric:true},{key:'timing',label:'TIMING',options:['musical','legacy'],numeric:false}],
 stutter:[{key:'pattern',label:'PATTERN',options:['EVEN','DOTTED','TRIPLET','SWING','RAMP UP','RAMP DOWN'],numeric:false},{key:'gateCurve',label:'GATE CURVE',options:['LINEAR','LOG','EXP'],numeric:false},{key:'timing',label:'TIMING',options:['musical','legacy'],numeric:false}],
 bend:[{key:'scratchPattern',label:'SCRATCH PATTERN',options:['AUTO','BABY','TRANSFORMER','TEAR','SCRIBBLE'],numeric:false},{key:'gateCurve',label:'GATE CURVE',options:['LINEAR','LOG','EXP'],numeric:false},{key:'timing',label:'TIMING',options:['musical','legacy'],numeric:false}],
 granular:[]
};
export const TIME_CAPTURE_BEATS=[16,8,4,2,1,.5,.25,.125,.0625];
export const TIME_CAPTURE_LABELS=['4 BARS','2 BARS','1 BAR','1/2','1/4','1/8','1/16','1/32','1/64'];
export const TIME_SLICE_LABELS=['1/256','1/128','1/64','1/32','1/16','1/8','1/4'];
export const MUSICAL_CAPTURE_BEATS=[4,2,1,.5,.25,.125,.0625];
export const MUSICAL_CAPTURE_LABELS=['1 BAR','1/2','1/4','1/8','1/16','1/32','1/64'];
export const STRETCH_CAPTURE_BEATS=[4,2,1,.5];
export const STRETCH_CAPTURE_LABELS=['1 BAR','1/2','1/4','1/8'];
export const GRAIN_NOTE_LABELS=['1/16','1/32','1/64','1/128','1/256','1/512'];
export const BEND_NOTE_LABELS=['1/32','1/16','1/8','1/4','1/2','1 BAR','2 BARS','4 BARS'];
const TIME_LINK_LABELS=['1/256 : 1/16','1/128 : 1/16','1/128 : 1/8','1/64 : 1/8','1/64 : 1/4','1/32 : 1/4','1/32 : 1/2','1/16 : 1/4','1/16 : 1/2','1/16 : 1 BAR','1/8 : 1/2','1/8 : 1 BAR','1/4 : 1 BAR','1/4 : 2 BARS'];
export const MAIN_CONTROLS=[['gain','GAIN',.5,'gain'],['low','LOW',.5,'eq'],['mid','MID',.5,'eq'],['high','HIGH',.5,'eq'],['pan','PAN',.5,'bipolar'],['compress','COMPRESS',0,'percent'],['autoGain','AUTO GAIN',0,'percent'],['mix','DRY / WET',1,'percent']];
export const SHAPES=['sine','triangle','saw','ramp','square','pulse25','pulse75','exp','log','peak','valley','bump','double','skew','stairs','sinefold','trapezoid','samplehold','smoothstep'];
export const RATES=['1/64','1/32','1/16','1/8','1/4','1/2','1 BAR','2 BARS','4 BARS','8 BARS','16 BARS'];
export const GRAPH_RATES=['1/4 BAR','1/2 BAR','1 BAR','1½ BARS','2 BARS','3 BARS','4 BARS','6 BARS','8 BARS','12 BARS','16 BARS'];
export const SEQ_RATES=['1/16','1/8','1/4','1/2','1/1'];
const safeKeys=new Set(['__proto__','constructor','prototype']);
const pathParts=path=>typeof path==='string'&&path.length>0&&path.length<=200&&path.split('.').every(k=>k&&!safeKeys.has(k))?path.split('.'):null;
function pathOwner(obj,path){
 const parts=pathParts(path);if(!parts)return null;let o=obj;
 for(const k of parts.slice(0,-1)){
  if(!o||typeof o!=='object')return null;
  if(Array.isArray(o)&&!/^\d+$/.test(k))o=o.find(x=>x&&Object.hasOwn(x,'id')&&x.id===k);
  else if(Object.hasOwn(o,k))o=o[k];else return null;
 }
 if(!o||typeof o!=='object')return null;
 const key=parts.at(-1);
 // Accept the initial engine contract's short FX path as well as UI .params paths.
 if(parts[0]==='fx'&&parts.length===3&&!Object.hasOwn(o,key)&&o.params&&Object.hasOwn(o.params,key))o=o.params;
 return Object.hasOwn(o,key)?{object:o,key}:null;
}
export function getPath(obj,path){const owner=pathOwner(obj,path);return owner?.object[owner.key];}
export function setPath(obj,path,value){const owner=pathOwner(obj,path);if(!owner)return false;owner.object[owner.key]=value;return true;}
const TIME_ORDERS=['stretch-vari-stutter','vari-stretch-stutter','stutter-stretch-vari','parallel'];
const MOD_TYPES=['lfo','rand','env'];
const ENV_SOURCES=['internal','external'];
const TIMING_MODES=['musical','legacy'];
const FX_MODES=['serial','parallel'];
const GAIN_MODES=['extended','legacy'];
export function getParameterOptions(path,state){
 const p=pathParts(path);if(!p||state&&typeof getPath(state,path)!=='string')return null;
 if(path==='time.order')return TIME_ORDERS;
 if(path==='fxMode')return FX_MODES;
 if(path==='tonal.scale')return TONAL_SCALES;
 if(path==='tonal.chord')return TONAL_CHORDS;
 if(path==='main.gainMode')return GAIN_MODES;
 if(p[0]==='mods'&&p.length===3&&/^[0-3]$/.test(p[1]))return p[2]==='type'?MOD_TYPES:p[2]==='shape'?SHAPES:p[2]==='source'?ENV_SOURCES:null;
 if(p[0]==='graphs'&&p.length===3&&/^[0-2]$/.test(p[1])&&p[2]==='timing')return TIMING_MODES;
 if(p[0]==='time'&&p.length===3&&['stretch','vari','stutter'].includes(p[1])){
  const selector=[...TIME_SELECTS[p[1]],...(p[1]==='stutter'?TIME_SELECTS.bend:[])].find(item=>item.key===p[2]&&!item.numeric);
  return selector?.options??null;
 }
 return null;
}
export function parameterKind(path,state){
 const p=pathParts(path);if(!p||!state)return null;if(getParameterOptions(path,state))return 'enum';const value=getPath(state,path);if(typeof value!=='number'&&typeof value!=='boolean')return null;
 if(path==='bypass')return 'boolean';
 if(path==='tonal.root')return 'integer';
 if(p[0]==='time'&&p.length===3&&['stretch','vari','stutter','granular'].includes(p[1]))return typeof value==='boolean'?'boolean':typeof value==='number'?'continuous':null;
 if(p[0]==='main'&&p.length===2)return typeof value==='number'?'continuous':typeof value==='boolean'?'boolean':null;
 if(p[0]==='mods'&&p.length===3&&/^[0-3]$/.test(p[1]))return typeof value==='number'?'continuous':typeof value==='boolean'?'boolean':null;
 if(p[0]==='graphs'&&/^[0-2]$/.test(p[1])){if(p.length===3&&(p[2]==='rate'||p[2]==='reverse'))return typeof value==='boolean'?'boolean':'continuous';if(p.length===5&&p[2]==='points'&&/^\d{1,2}$/.test(p[3])&&Number(p[3])<48&&/^[0-6]$/.test(p[4])&&typeof value==='number')return 'continuous';}
 if(p[0]==='macros'&&p.length===3&&/^[0-3]$/.test(p[1])&&p[2]==='value')return 'continuous';
 if(p[0]==='xy'&&p.length===2&&(p[1]==='x'||p[1]==='y'))return 'continuous';
 if(p[0]==='seq'&&['stutter','stretch'].includes(p[1])){if(p.length===3&&p[2]==='on')return 'boolean';if(p.length===3&&['rate','min','max'].includes(p[2]))return 'continuous';if(p.length===5&&p[2]==='steps'&&/^\d{1,2}$/.test(p[3])&&Number(p[3])<64)return p[4]==='on'?'boolean':p[4]==='value'?'continuous':null;}
 if(p[0]==='fx'){
  const item=state.fx.find(f=>f.id===p[1]);if(!item)return null;
  if(p.length===3){if(['on','muted','lrLock','sync','snap'].includes(p[2]))return 'boolean';if(p[2]==='mix'||p[2]==='gain'||Object.hasOwn(item.params,p[2]))return 'continuous';}
  if(p.length===4&&['params','paramsR'].includes(p[2])&&Object.hasOwn(item[p[2]],p[3]))return 'continuous';
  if(p.length===5&&p[2]==='slices'&&/^\d{1,2}$/.test(p[3])&&Number(p[3])<32&&['shuffle','repeat','pitch','reverse','gate','ratchet'].includes(p[4])&&typeof value==='number')return 'continuous';
 }
 return null;
}
export function canSequenceTarget(path,state){
 const parts=pathParts(path);if(!parts||typeof getPath(state,path)!=='number')return false;
 return ['time','main','fx','mods','graphs','macros','xy'].includes(parts[0])&&parameterKind(path,state)==='continuous';
}
export const TONAL_SCALES=['chromatic','major','minor','dorian','pentatonic'];
export const TONAL_CHORDS=['major','minor','sus2','sus4','diminished','augmented','major7','minor7','dominant7'];
export function createState(){return {
 version:1,bpm:120,playing:false,bypass:false,presetName:'Init',tonal:{root:0,scale:'minor',chord:'minor'},latencyComp:true,
 clock:{source:'internal',deferred:true},automationPlaying:false,automation:{duration:0,loop:true,events:[]},
 time:{order:'stretch-vari-stutter',stretch:{on:false,timing:'musical',sync:true,speed:1,tempo:.5,grain:.4,pitch:.5,spread:.2,scatter:0,grainLength:0,mix:1,reverse:false,freeze:false,linked:false},vari:{on:false,timing:'musical',speed:1,tempo:.5,mode:0,wow:0,saturation:0,compress:0,mix:1,stop:false,scratch:.5,model:0},stutter:{on:false,timing:'musical',bend:false,sync:true,link:false,pattern:'EVEN',gateCurve:'LINEAR',scratchPattern:'AUTO',rate:.45,capture:1/6,pitch:.5,ramp:.5,gate:.15,decay:0,pan:0,probability:1,retrigger:0,smooth:.3,mix:1,reverse:false,freeze:false,warp:0,break:0,reps:.2,width:0,duck:.5,window:.3},granular:{on:false,sync:true,density:.45,size:.35,pitch:.5,position:.5,spray:.2,spread:.6,reverse:false,freeze:false,mix:1}},
 fx:[],fxMode:'serial',main:{gain:.5,gainMode:'extended',low:.5,mid:.5,high:.5,pan:.5,mix:1,compress:0,autoGain:0},
 mods:Array.from({length:4},(_,i)=>({type:'lfo',source:'internal',shape:SHAPES[i],sync:true,freeRate:.4,rate:.4,depth:1,smooth:.1,jitter:0,bin:false,gain:.5,rise:.1,fall:.3,tone:.5,targets:[]})),
 graphs:Array.from({length:3},()=>({points:[[0,.1],[.25,.9],[.5,.1],[.75,.5],[1,.1]],timing:'musical',rate:.6,reverse:false,targets:[]})),
 macros:Array.from({length:4},(_,i)=>({value:0,name:['MUTATE','DISPERSE','ERODE','SPACE'][i],targets:[]})),xy:{x:.5,y:.5,targetsX:[],targetsY:[]},
 seq:Object.fromEntries(['stutter','stretch'].map(k=>[k,{on:false,rate:0,patterns:1,length:0,target:'default',min:0,max:1,steps:Array.from({length:64},(_,i)=>({on:true,value:k==='stretch'?1:[.45,.45,.65,.45,.45,.8,.45,.5][i%8]}))}]))
};}
export function makeEffect(type,id){const d=EFFECTS.find(e=>e.id===type);if(!d)return null;const params=Object.fromEntries(d.params.map(p=>[p.key,p.default??.5]));return {id:id||`fx-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,type,on:true,muted:false,lrLock:true,sync:false,snap:false,mix:.5,gain:.5,params,paramsR:{...params},...(type==='CHOPPER'?{slices:Array.from({length:32},()=>({shuffle:0,repeat:0,pitch:.5,reverse:0,gate:1,ratchet:0}))}:{})};}

// Structural automation is a small, explicit schema, never an arbitrary object path.
export function sanitizeStructureEvent(raw,state){
 if(!raw||raw.kind!=='structure'||!Number.isFinite(raw.time)||raw.time<0||raw.time>86400)return null;
 const event={time:raw.time,kind:'structure',scope:raw.scope};
 if(raw.scope==='fx'){
  if(!Array.isArray(raw.value)||raw.value.length>62)return null;
  const template=createState();template.fx=raw.value;event.value=sanitizeState(template).fx;
 }else if(raw.scope==='graph'){
  if(!Number.isInteger(raw.index)||raw.index<0||raw.index>2||!Array.isArray(raw.value)||raw.value.length<2||raw.value.length>48)return null;
  if(raw.value.some(p=>!Array.isArray(p)||p.length<2||p.length>7||!p.every(Number.isFinite)))return null;
  event.index=raw.index;event.value=raw.value.map(p=>p.map(v=>clamp(v))).sort((a,b)=>a[0]-b[0]);
  event.value[0][0]=0;event.value.at(-1)[0]=1;event.value.at(-1)[1]=event.value[0][1];
 }else if(raw.scope==='sequence'){
  if(!['stretch','stutter'].includes(raw.name)||!raw.value||typeof raw.value!=='object'||Array.isArray(raw.value))return null;
  const value=raw.value,target=value.target==='default'||canSequenceTarget(value.target,state)?value.target:'default';
  event.name=raw.name;event.value={patterns:Math.round(clamp(value.patterns??1,1,4)),length:value.length>0?Math.round(clamp(value.length,1,64)):0,target,min:clamp(value.min??0),max:clamp(value.max??1)};
 }else return null;
 return event;
}
export function applyStructureEvent(state,raw){
 const event=sanitizeStructureEvent(raw,state);if(!event)return false;
 if(event.scope==='fx')state.fx=event.value;
 else if(event.scope==='graph')state.graphs[event.index].points=event.value;
 else Object.assign(state.seq[event.name],event.value);
 return true;
}
export function sanitizeAutomationEvents(events,state,duration=86400){
 const timeline=JSON.parse(JSON.stringify(state)),result=[];
 const sorted=(Array.isArray(events)?events:[]).slice(0,50000).filter(e=>e&&typeof e==='object'&&Number.isFinite(e.time)&&e.time>=0&&e.time<=duration).sort((a,b)=>a.time-b.time||(a.kind==='structure'?-1:0)-(b.kind==='structure'?-1:0));
 let structures=0;
 for(const raw of sorted){
  if(raw.kind==='structure'){
   if(++structures>2048)continue;const event=sanitizeStructureEvent(raw,timeline);if(!event)continue;
   applyStructureEvent(timeline,event);result.push(event);continue;
  }
  const kind=parameterKind(raw.path,timeline);
  if(!kind||typeof raw.value!=='number'&&typeof raw.value!=='boolean'||!Number.isFinite(+raw.value))continue;
  result.push({time:raw.time,path:raw.path,value:kind==='boolean'?(+raw.value>=.5?1:0):clamp(+raw.value),...(['boolean','enum','integer'].includes(kind)?{kind}:{})});
 }
 return result;
}
export function formatValue(value,format='percent',options,context={}){
 value=clamp(value);if(options)return options[Math.round(value*(options.length-1))];
 const beat=60/clamp(context.bpm??120,20,400),sr=clamp(context.sampleRate??48000,8000,192000);
 const milliseconds=seconds=>`${(seconds*1000).toFixed(seconds<.1?1:0)} ms`;
 switch(format){
  case 'pitch':case 'semitone':return `${value>=.5?'+':''}${Math.round(value*24-12)} st`;
  case 'gain':{const db=context.gainMode==='extended'?(value===0?-Infinity:value<.5?20*Math.log10(2*value):(value-.5)*24):value*48-24;return Number.isFinite(db)?`${db>=0?'+':''}${db.toFixed(1)} dB`:'−∞ dB';}
  case 'fxgain':return `${value>=.5?'+':''}${(value*24-12).toFixed(1)} dB`;
  case 'eq':return `${value>=.5?'+':''}${(value*30-15).toFixed(1)} dB`;
  case 'bipolar':return `${value>=.5?'+':''}${Math.round(value*200-100)}`;
  case 'division':return TIME_SLICE_LABELS[Math.round(value*6)];
  case 'stutterrate':return context.sync===false?milliseconds(.01+value*.49):context.link?TIME_LINK_LABELS[Math.round(value*13)]:TIME_SLICE_LABELS[Math.round(value*6)];
  case 'timecapture':{
   const stretch=context.engine==='stretch',musical=context.timing==='musical',values=musical?(stretch?STRETCH_CAPTURE_BEATS:MUSICAL_CAPTURE_BEATS):TIME_CAPTURE_BEATS,labels=musical?(stretch?STRETCH_CAPTURE_LABELS:MUSICAL_CAPTURE_LABELS):TIME_CAPTURE_LABELS;
   const i=Math.round(value*(values.length-1)),requested=values[i]*beat;
   return requested>2?`${labels[i]} · 2 s MAX`:labels[i];
  }
  case 'capture':case 'stuttercapture':return context.link&&context.sync!==false?'LINKED':context.timing==='musical'?MUSICAL_CAPTURE_LABELS[Math.round(value*6)]:TIME_CAPTURE_LABELS[Math.round(value*8)];
  case 'grain':case 'stretchgrain':{
   if(context.sync===false)return `${(5+value*95).toFixed(1)} Hz`;
   if(context.timing==='musical')return GRAIN_NOTE_LABELS[Math.round(value*5)];
   return milliseconds(Math.max(32/sr,Math.min(.4,beat/128*2**(value*5))));
  }
  case 'bendtime':{if(context.sync===false)return milliseconds(.01+value*17.99);const beats=context.timing==='musical'?.125*2**Math.round(value*7):.125*2**(value*7),label=context.timing==='musical'?BEND_NOTE_LABELS[Math.round(value*7)]:`${beats.toFixed(2)} BT`;return beats*beat>18?`${label} · 18 s MAX`:label;}
  case 'smooth':return `${Math.round(5+value*45)} ms`;
  case 'reps':return context.warp>=.7&&context.warp<.85?'1 · LOCK':String(1+Math.round(value*31));
  case 'width':return `${(1+value*3).toFixed(1)}×`;
  case 'warp':return ['OFF','WOBBLE','SLIP','LURCH','STALL','SCRATCH','HAVOC'][value<.1?0:Math.min(6,1+Math.floor((value-.1)/.15))];
  case 'fracture':return value<.1?'OFF':value<.25?'NUDGE':value<.5?'SKIP':value<.7?'SCATTER':'DROPOUT';
  case 'modrate':return RATES[Math.round(value*10)];
  case 'freerate':return `${(.01*10000**value).toFixed(value<.5?2:1)} Hz`;
  case 'grainlength':return `${(8**value).toFixed(1)}×`;
  case 'granularpitch':return `${value>=.5?'+':''}${Math.round(value*48-24)} st`;
  case 'granularsize':return context.sync===false?milliseconds(.01*200**value):['1/64','1/32','1/16','1/8','1/4','1/2','1 BAR'][Math.round(value*6)];
  case 'granulardensity':return context.sync===false?`${(1+value*79).toFixed(1)} Hz`:['1 BAR','1/2','1/4','1/8','1/16','1/32','1/64'][Math.round(value*6)];
  case 'graphrate':return (context.timing==='legacy'?RATES:GRAPH_RATES)[Math.round(value*10)];
  case 'seqrate':return SEQ_RATES[Math.round(value*4)];
  default:return `${Math.round(value*100)} %`;
 }
}

export function sanitizeState(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('Keine gültige Preset-Datei.');
 const record=value=>value&&typeof value==='object'&&!Array.isArray(value);
 if(raw.version!==1||!record(raw.time)||!record(raw.main)||!Array.isArray(raw.fx))throw new Error('Dieses Preset hat kein unterstütztes DA-DESTRUCTOR-Format.');
 const s=createState();
 const copy=(to,from)=>{if(!from||typeof from!=='object')return;for(const k of Object.keys(to)){if(k==='targets'||k==='points'||k==='steps')continue;const v=from[k];if(typeof to[k]==='number'&&Number.isFinite(v))to[k]=clamp(v);else if(typeof to[k]==='boolean'&&typeof v==='boolean')to[k]=v;else if(to[k]&&typeof to[k]==='object'&&!Array.isArray(to[k]))copy(to[k],v);}};
 copy(s.time,raw.time);copy(s.main,raw.main);s.bpm=Number.isFinite(raw.bpm)?clamp(raw.bpm,30,300):s.bpm;s.fxMode=raw.fxMode==='parallel'?'parallel':'serial';s.presetName=String(raw.presetName||'Imported').slice(0,60);
 s.main.gainMode=raw.main.gainMode==='extended'?'extended':'legacy';
 if(typeof raw.latencyComp==='boolean')s.latencyComp=raw.latencyComp;
 if(['internal','midi'].includes(raw.clock?.source))s.clock.source=raw.clock.source;
 if(typeof raw.clock?.deferred==='boolean')s.clock.deferred=raw.clock.deferred;
 if(Number.isFinite(raw.tonal?.root))s.tonal.root=Math.round(clamp(raw.tonal.root,0,11));
 if(TONAL_SCALES.includes(raw.tonal?.scale))s.tonal.scale=raw.tonal.scale;
 if(TONAL_CHORDS.includes(raw.tonal?.chord))s.tonal.chord=raw.tonal.chord;
 if(['stretch-vari-stutter','vari-stretch-stutter','stutter-stretch-vari','parallel'].includes(raw.time.order))s.time.order=raw.time.order;
 for(const engine of ['stretch','vari','stutter']){
  s.time[engine].timing=raw.time[engine]?.timing==='musical'?'musical':'legacy';
  for(const selector of TIME_SELECTS[engine]){const value=raw.time[engine]?.[selector.key];if(typeof value==='string'&&selector.options.includes(value))s.time[engine][selector.key]=selector.numeric?selector.options.indexOf(value)/(selector.options.length-1):value;}
 }
 if(TIME_SELECTS.bend[0].options.includes(raw.time.stutter?.scratchPattern))s.time.stutter.scratchPattern=raw.time.stutter.scratchPattern;
 const used=new Set(),ids=new Set();s.fx=raw.fx.slice(0,62).flatMap((f,i)=>{if(!record(f)||used.has(f.type))return [];let id=typeof f.id==='string'&&/^fx-[\w-]{1,70}$/.test(f.id)&&!ids.has(f.id)?f.id:`fx-import-${i}`;while(ids.has(id))id+='-copy';const e=makeEffect(f.type,id);if(!e)return [];used.add(f.type);ids.add(id);copy(e,f);copy(e.params,f.params);if(!record(f.paramsR))e.paramsR={...e.params};if(e.slices)e.slices.forEach((slice,j)=>copy(slice,f.slices?.[j]));return [e];});
 const allowedTarget=path=>{
  const p=pathParts(path);if(!p||path.length>100||typeof getPath(s,path)!=='number')return false;
  if(p[0]==='time')return p.length===3&&['stretch','vari','stutter','granular'].includes(p[1]);
  if(p[0]==='main')return p.length===2;
  if(p[0]==='mods')return p.length===3&&/^[0-3]$/.test(p[1]);
  if(p[0]==='graphs')return p.length===3&&/^[0-2]$/.test(p[1])&&p[2]==='rate';
  if(p[0]==='macros')return p.length===3&&/^[0-3]$/.test(p[1])&&p[2]==='value';
  if(p[0]==='xy')return p.length===2&&(p[1]==='x'||p[1]==='y');
  if(p[0]==='seq')return p.length===3&&['stretch','stutter'].includes(p[1])&&['rate','min','max'].includes(p[2]);
  if(p[0]==='fx'){const item=s.fx.find(f=>f.id===p[1]);return !!item&&((p.length===3&&(p[2]==='mix'||p[2]==='gain'||Object.hasOwn(item.params,p[2])))||(p.length===4&&['params','paramsR'].includes(p[2])&&Object.hasOwn(item[p[2]],p[3]))||(p.length===5&&p[2]==='slices'&&parameterKind(path,s)==='continuous'));}
  return false;
 };
 const targets=(rows,max=6)=>Array.isArray(rows)?rows.slice(0,max).flatMap(t=>{if(!t||!allowedTarget(t.path))return [];return [{path:t.path,min:clamp(t.min??0),max:clamp(t.max??1),start:clamp(t.start??0),end:clamp(t.end??1),skew:clamp(t.skew??.5),...(['linear','s','smooth','triangle'].includes(t.curve)?{curve:t.curve}:{})}];}):[];
 s.mods.forEach((m,i)=>{const r=raw.mods?.[i];copy(m,r);if(['lfo','rand','env'].includes(r?.type))m.type=r.type;if(['internal','external'].includes(r?.source))m.source=r.source;if(SHAPES.includes(r?.shape))m.shape=r.shape;m.targets=targets(r?.targets);});
 s.graphs.forEach((g,i)=>{const r=raw.graphs?.[i];copy(g,r);g.timing=r?.timing==='musical'?'musical':'legacy';if(Array.isArray(r?.points)&&r.points.length>=2&&r.points.length<=48){g.points=r.points.filter(p=>Array.isArray(p)&&p.length>=2&&p.slice(0,2).every(Number.isFinite)).map(p=>{const q=p.length>2?[clamp(p[0]),clamp(p[1]),clamp(p[2]??.5)]:[clamp(p[0]),clamp(p[1])];if(p.length>=7&&p.slice(3,7).every(Number.isFinite))q.push(...p.slice(3,7).map(v=>clamp(v)));return q;}).sort((a,b)=>a[0]-b[0]);if(g.points.length<2)g.points=[[0,0],[1,0]];g.points[0][0]=0;g.points.at(-1)[0]=1;g.points.at(-1)[1]=g.points[0][1];}g.targets=targets(r?.targets);});
 s.macros.forEach((m,i)=>{copy(m,raw.macros?.[i]);m.name=String(raw.macros?.[i]?.name||m.name).slice(0,24);m.targets=targets(raw.macros?.[i]?.targets,5);});copy(s.xy,raw.xy);s.xy.targetsX=targets(raw.xy?.targetsX,5);s.xy.targetsY=targets(raw.xy?.targetsY,5);
 for(const k of ['stutter','stretch']){const q=s.seq[k],r=raw.seq?.[k];copy(q,r);q.patterns=Math.round(clamp(r?.patterns??1,1,4));q.length=Number.isFinite(r?.length)&&r.length>0?Math.round(clamp(r.length,1,64)):0;q.target=r?.target==='default'||canSequenceTarget(r?.target,s)?r.target:'default';q.steps=q.steps.map((v,i)=>({on:typeof r?.steps?.[i]?.on==='boolean'?r.steps[i].on:v.on,value:clamp(r?.steps?.[i]?.value??v.value)}));}
 const maxDuration=86400,declaredDuration=Number.isFinite(raw.automation?.duration)?clamp(raw.automation.duration,0,maxDuration):0;
 const events=Array.isArray(raw.automation?.events)?raw.automation.events.slice(0,50000):[];
 s.automation.events=sanitizeAutomationEvents(events,s,declaredDuration||maxDuration);
 s.automation.duration=Math.max(declaredDuration,s.automation.events.at(-1)?.time||0);if(typeof raw.automation?.loop==='boolean')s.automation.loop=raw.automation.loop;
 s.playing=false;s.bypass=false;s.automationPlaying=false;return s;
}

export function factoryPreset(name){const s=createState();s.presetName=name;const add=(t,mix,p={})=>{const e=makeEffect(t,`fx-factory-${s.fx.length}`);if(e){e.mix=mix;Object.assign(e.params,Object.fromEntries(Object.entries(p).filter(([k])=>Object.hasOwn(e.params,k))));s.fx.push(e);}};
 if(name==='Worn cassette'){Object.assign(s.time.vari,{on:true,wow:.28,saturation:.28,compress:.12});add('TAPE',.65,{drive:.25,noise:.06,wow:.15,flutter:.1});add('SPIRAL',.18);s.mods[0].rate=.7;s.mods[0].targets=[{path:'time.vari.wow',min:.08,max:.33,start:0,end:1,skew:.5}];}
 if(name==='Fractured rhythm'){Object.assign(s.time.stutter,{on:true,rate:.64,capture:.42,decay:.16,pan:.35,probability:.8,mix:.65});s.seq.stutter.on=true;add('BITROT',.22,{bits:.7});add('SPIRAL',.18);s.macros[0].targets=[{path:'time.stutter.rate',min:.35,max:.95,start:0,end:1,skew:.5}];}
 if(name==='Suspended matter'){Object.assign(s.time.stretch,{on:true,speed:.28,grain:.55,spread:.7,scatter:.18,mix:.8});add('DATTORRO',.45);add('CHORUS',.18);s.mods[1].rate=.8;s.mods[1].targets=[{path:'time.stretch.pitch',min:.45,max:.55,start:0,end:1,skew:.5}];}
 if(name==='Circuit ritual'){Object.assign(s.time.stutter,{on:true,bend:true,warp:.58,break:.35,mix:.55});add('CIRCUIT BEND',.23);add('PRISM',.65);add('REEL',.2);s.macros[0].targets=[{path:'time.stutter.warp',min:.1,max:.95,start:0,end:1,skew:.5}];}
 if(name==='Glass transmission'){add('CRYSTAL',.3);add('TRANSMIT',.22);add('AETHER',.4);s.graphs[0].targets=[{path:'main.pan',min:.25,max:.75,start:0,end:1,skew:.5}];}
 return s;}
export const FACTORIES=['Init','Worn cassette','Fractured rhythm','Suspended matter','Circuit ritual','Glass transmission'];
