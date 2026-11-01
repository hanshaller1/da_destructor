import {EFFECTS} from './effects.mjs';

export const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(+n)?+n:a));
export const TIME_CONTROLS={
 stretch:[['speed','SPEED',1,'percent'],['tempo','CAPTURE',.5,'timecapture'],['grain','GRAIN',.4,'stretchgrain'],['pitch','PITCH',.5,'pitch'],['spread','SPREAD',.2,'percent'],['scatter','SCATTER',0,'percent']],
 vari:[['speed','SPEED',1,'percent'],['tempo','CAPTURE',.5,'timecapture'],['wow','WOW / FLUTTER',0,'percent'],['saturation','SATURATION',0,'percent'],['compress','COMPRESS',0,'percent'],['scratch','SCRATCH',.5,'bipolar']],
 stutter:[['rate','RATE',.45,'stutterrate'],['capture','CAPTURE',.5,'stuttercapture'],['pitch','PITCH',.5,'pitch'],['ramp','PITCH RAMP',.5,'pitch'],['gate','GATE',.15,'percent'],['decay','DECAY',0,'percent'],['pan','PAN SPREAD',0,'percent'],['probability','PROBABILITY',1,'percent'],['retrigger','RETRIGGER',0,'percent'],['smooth','SMOOTH',.3,'smooth']],
 bend:[['warp','WARP',0,'warp'],['break','BREAK',0,'fracture'],['reps','REPS',.2,'reps'],['capture','TIME',.5,'bendtime'],['width','WIDTH',0,'width'],['duck','DUCK',.5,'bipolar']]
};
export const TIME_TOGGLES={stretch:[['sync','SYNC'],['linked','LINKED']],vari:[],stutter:[['sync','SYNC'],['link','LINK']],bend:[['sync','SYNC']]};
export const TIME_SELECTS={
 stretch:[],
 vari:[{key:'mode',label:'MODE',options:['FORWARD','FWD-REV','REVERSE'],numeric:true},{key:'model',label:'SAT TYPE',options:['HEAT','BITCRUSH'],numeric:true}],
 stutter:[{key:'pattern',label:'PATTERN',options:['EVEN','DOTTED','TRIPLET','SWING','RAMP UP','RAMP DOWN'],numeric:false},{key:'gateCurve',label:'GATE CURVE',options:['LINEAR','LOG','EXP'],numeric:false}],
 bend:[{key:'gateCurve',label:'GATE CURVE',options:['LINEAR','LOG','EXP'],numeric:false}]
};
export const TIME_CAPTURE_BEATS=[16,8,4,2,1,.5,.25,.125,.0625];
export const TIME_CAPTURE_LABELS=['4 BARS','2 BARS','1 BAR','1/2','1/4','1/8','1/16','1/32','1/64'];
export const TIME_SLICE_LABELS=['1/256','1/128','1/64','1/32','1/16','1/8','1/4'];
const TIME_LINK_LABELS=['1/256 : 1/16','1/128 : 1/16','1/128 : 1/8','1/64 : 1/8','1/64 : 1/4','1/32 : 1/4','1/32 : 1/2','1/16 : 1/4','1/16 : 1/2','1/16 : 1 BAR','1/8 : 1/2','1/8 : 1 BAR','1/4 : 1 BAR','1/4 : 2 BARS'];
export const MAIN_CONTROLS=[['gain','GAIN',.5,'gain'],['low','LOW',.5,'eq'],['mid','MID',.5,'eq'],['high','HIGH',.5,'eq'],['pan','PAN',.5,'bipolar'],['compress','COMPRESS',0,'percent'],['mix','DRY / WET',1,'percent']];
export const SHAPES=['sine','triangle','saw','ramp','square','pulse25','pulse75','exp','log','peak','valley','bump','double','skew','stairs','sinefold','trapezoid','samplehold','smoothstep'];
export const RATES=['1/64','1/32','1/16','1/8','1/4','1/2','1 BAR','2 BARS','4 BARS','8 BARS','16 BARS'];
export const SEQ_RATES=['1/16','1/8','1/4','1/2','1/1'];
const safeKeys=new Set(['__proto__','constructor','prototype']);
const pathParts=path=>typeof path==='string'&&path.length>0&&path.length<=200&&path.split('.').every(k=>k&&!safeKeys.has(k))?path.split('.'):null;
function pathOwner(obj,path){
 const parts=pathParts(path);if(!parts)return null;let o=obj;
 for(const k of parts.slice(0,-1)){
  if(!o||typeof o!=='object')return null;
  if(Array.isArray(o)&&k.startsWith('fx-'))o=o.find(x=>x&&Object.hasOwn(x,'id')&&x.id===k);
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
export const TONAL_SCALES=['chromatic','major','minor','dorian','pentatonic'];
export const TONAL_CHORDS=['major','minor'];
export function createState(){return {
 version:1,bpm:120,playing:false,bypass:false,presetName:'Init',tonal:{root:0,scale:'minor',chord:'minor'},
 time:{order:'stretch-vari-stutter',stretch:{on:false,sync:true,speed:1,tempo:.5,grain:.4,pitch:.5,spread:.2,scatter:0,mix:1,reverse:false,freeze:false,linked:false},vari:{on:false,speed:1,tempo:.5,mode:0,wow:0,saturation:0,compress:0,mix:1,stop:false,scratch:.5,model:0},stutter:{on:false,bend:false,sync:true,link:false,pattern:'EVEN',gateCurve:'LINEAR',rate:.45,capture:.5,pitch:.5,ramp:.5,gate:.15,decay:0,pan:0,probability:1,retrigger:0,smooth:.3,mix:1,reverse:false,freeze:false,warp:0,break:0,reps:.2,width:0,duck:.5}},
 fx:[],fxMode:'serial',main:{gain:.5,low:.5,mid:.5,high:.5,pan:.5,mix:1,compress:0},
 mods:Array.from({length:4},(_,i)=>({type:'lfo',shape:SHAPES[i],rate:.4,depth:1,smooth:.1,jitter:0,bin:false,gain:.5,rise:.1,fall:.3,tone:.5,targets:[]})),
 graphs:Array.from({length:3},()=>({points:[[0,.1],[.25,.9],[.5,.1],[.75,.5],[1,.1]],rate:.6,reverse:false,targets:[]})),
 macros:Array.from({length:4},(_,i)=>({value:0,name:['MUTATE','DISPERSE','ERODE','SPACE'][i],targets:[]})),xy:{x:.5,y:.5,targetsX:[],targetsY:[]},
 seq:Object.fromEntries(['stutter','stretch'].map(k=>[k,{on:false,rate:0,patterns:1,steps:Array.from({length:64},(_,i)=>({on:true,value:k==='stretch'?1:[.45,.45,.65,.45,.45,.8,.45,.5][i%8]}))}]))
};}
export function makeEffect(type,id){const d=EFFECTS.find(e=>e.id===type);if(!d)return null;return {id:id||`fx-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,type,on:true,snap:false,mix:.5,gain:.5,params:Object.fromEntries(d.params.map(p=>[p.key,p.default??.5]))};}
export function formatValue(value,format='percent',options,context={}){
 value=clamp(value);if(options)return options[Math.round(value*(options.length-1))];
 const beat=60/clamp(context.bpm??120,20,400),sr=clamp(context.sampleRate??48000,8000,192000);
 const milliseconds=seconds=>`${(seconds*1000).toFixed(seconds<.1?1:0)} ms`;
 switch(format){
  case 'pitch':case 'semitone':return `${value>=.5?'+':''}${Math.round(value*24-12)} st`;
  case 'gain':return `${value>=.5?'+':''}${(value*48-24).toFixed(1)} dB`;
  case 'fxgain':return `${value>=.5?'+':''}${(value*24-12).toFixed(1)} dB`;
  case 'eq':return `${value>=.5?'+':''}${(value*30-15).toFixed(1)} dB`;
  case 'bipolar':return `${value>=.5?'+':''}${Math.round(value*200-100)}`;
  case 'division':return TIME_SLICE_LABELS[Math.round(value*6)];
  case 'stutterrate':return context.sync===false?milliseconds(.01+value*.49):context.link?TIME_LINK_LABELS[Math.round(value*13)]:TIME_SLICE_LABELS[Math.round(value*6)];
  case 'timecapture':{
   const i=Math.round(value*8),requested=TIME_CAPTURE_BEATS[i]*beat;
   return requested>2?`${TIME_CAPTURE_LABELS[i]} · 2 s MAX`:TIME_CAPTURE_LABELS[i];
  }
  case 'capture':case 'stuttercapture':return context.link&&context.sync!==false?'LINKED':TIME_CAPTURE_LABELS[Math.round(value*8)];
  case 'grain':case 'stretchgrain':{
   if(context.sync===false)return `${(5+value*95).toFixed(1)} Hz`;
   return milliseconds(Math.max(32/sr,Math.min(.4,beat/128*2**(value*5))));
  }
  case 'bendtime':return context.sync===false?milliseconds(.01+value*17.99):`${((1/8)*2**(value*7)).toFixed(2)} BT`;
  case 'smooth':return `${Math.round(5+value*45)} ms`;
  case 'reps':return context.warp>=.7&&context.warp<.85?'1 · LOCK':String(1+Math.round(value*31));
  case 'width':return `${(1+value*3).toFixed(1)}×`;
  case 'warp':return ['OFF','WOBBLE','SLIP','LURCH','STALL','SCRATCH','HAVOC'][value<.1?0:Math.min(6,1+Math.floor((value-.1)/.15))];
  case 'fracture':return value<.1?'OFF':value<.25?'NUDGE':value<.5?'SKIP':value<.7?'SCATTER':'DROPOUT';
  case 'modrate':return RATES[Math.round(value*10)];
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
 if(Number.isFinite(raw.tonal?.root))s.tonal.root=Math.round(clamp(raw.tonal.root,0,11));
 if(TONAL_SCALES.includes(raw.tonal?.scale))s.tonal.scale=raw.tonal.scale;
 if(TONAL_CHORDS.includes(raw.tonal?.chord))s.tonal.chord=raw.tonal.chord;
 if(['stretch-vari-stutter','vari-stretch-stutter','stutter-stretch-vari','parallel'].includes(raw.time.order))s.time.order=raw.time.order;
 for(const selector of TIME_SELECTS.stutter){const value=raw.time.stutter?.[selector.key];if(selector.options.includes(value))s.time.stutter[selector.key]=value;}
 // Older exported states may store the two Varispeed enums by name.
 for(const selector of TIME_SELECTS.vari){const value=raw.time.vari?.[selector.key];if(typeof value==='string'&&selector.options.includes(value))s.time.vari[selector.key]=selector.options.indexOf(value)/(selector.options.length-1);}
 const used=new Set(),ids=new Set();s.fx=raw.fx.slice(0,62).flatMap((f,i)=>{if(!record(f)||used.has(f.type))return [];let id=typeof f.id==='string'&&/^fx-[\w-]{1,70}$/.test(f.id)&&!ids.has(f.id)?f.id:`fx-import-${i}`;while(ids.has(id))id+='-copy';const e=makeEffect(f.type,id);if(!e)return [];used.add(f.type);ids.add(id);copy(e,f);copy(e.params,f.params);return [e];});
 const allowedTarget=path=>{
  const p=pathParts(path);if(!p||path.length>100||typeof getPath(s,path)!=='number')return false;
  if(p[0]==='time')return p.length===3&&['stretch','vari','stutter'].includes(p[1]);
  if(p[0]==='main')return p.length===2;
  if(p[0]==='mods')return p.length===3&&/^[0-3]$/.test(p[1]);
  if(p[0]==='graphs')return p.length===3&&/^[0-2]$/.test(p[1])&&p[2]==='rate';
  if(p[0]==='macros')return p.length===3&&/^[0-3]$/.test(p[1])&&p[2]==='value';
  if(p[0]==='xy')return p.length===2&&(p[1]==='x'||p[1]==='y');
  if(p[0]==='fx'){const item=s.fx.find(f=>f.id===p[1]);return !!item&&((p.length===3&&(p[2]==='mix'||p[2]==='gain'||Object.hasOwn(item.params,p[2])))||(p.length===4&&p[2]==='params'&&Object.hasOwn(item.params,p[3])));}
  return false;
 };
 const targets=(rows,max=6)=>Array.isArray(rows)?rows.slice(0,max).flatMap(t=>{if(!t||!allowedTarget(t.path))return [];return [{path:t.path,min:clamp(t.min??0),max:clamp(t.max??1),start:clamp(t.start??0),end:clamp(t.end??1),skew:clamp(t.skew??.5),...(['linear','s','smooth','triangle'].includes(t.curve)?{curve:t.curve}:{})}];}):[];
 s.mods.forEach((m,i)=>{const r=raw.mods?.[i];copy(m,r);if(['lfo','rand','env'].includes(r?.type))m.type=r.type;if(SHAPES.includes(r?.shape))m.shape=r.shape;m.targets=targets(r?.targets);});
 s.graphs.forEach((g,i)=>{const r=raw.graphs?.[i];copy(g,r);if(Array.isArray(r?.points)&&r.points.length>=2&&r.points.length<=48){g.points=r.points.filter(p=>Array.isArray(p)&&p.length>=2&&p.slice(0,2).every(Number.isFinite)).map(p=>p.length>2?[clamp(p[0]),clamp(p[1]),clamp(p[2]??.5)]:[clamp(p[0]),clamp(p[1])]).sort((a,b)=>a[0]-b[0]);if(g.points.length<2)g.points=[[0,0],[1,0]];g.points[0][0]=0;g.points.at(-1)[0]=1;}g.targets=targets(r?.targets);});
 s.macros.forEach((m,i)=>{copy(m,raw.macros?.[i]);m.name=String(raw.macros?.[i]?.name||m.name).slice(0,24);m.targets=targets(raw.macros?.[i]?.targets,5);});copy(s.xy,raw.xy);s.xy.targetsX=targets(raw.xy?.targetsX,5);s.xy.targetsY=targets(raw.xy?.targetsY,5);
 for(const k of ['stutter','stretch']){const q=s.seq[k],r=raw.seq?.[k];copy(q,r);q.patterns=Math.round(clamp(r?.patterns??1,1,4));q.steps=q.steps.map((v,i)=>({on:typeof r?.steps?.[i]?.on==='boolean'?r.steps[i].on:v.on,value:clamp(r?.steps?.[i]?.value??v.value)}));}
 s.playing=false;s.bypass=false;return s;
}

export function factoryPreset(name){const s=createState();s.presetName=name;const add=(t,mix,p={})=>{const e=makeEffect(t,`fx-factory-${s.fx.length}`);if(e){e.mix=mix;Object.assign(e.params,Object.fromEntries(Object.entries(p).filter(([k])=>Object.hasOwn(e.params,k))));s.fx.push(e);}};
 if(name==='Worn cassette'){Object.assign(s.time.vari,{on:true,wow:.28,saturation:.28,compress:.12});add('TAPE',.65,{drive:.25,noise:.06,wow:.15,flutter:.1});add('SPIRAL',.18);s.mods[0].rate=.7;s.mods[0].targets=[{path:'time.vari.wow',min:.08,max:.33,start:0,end:1,skew:.5}];}
 if(name==='Fractured rhythm'){Object.assign(s.time.stutter,{on:true,rate:.64,capture:.42,decay:.16,pan:.35,probability:.8,mix:.65});s.seq.stutter.on=true;add('BITROT',.22,{bits:.7});add('SPIRAL',.18);s.macros[0].targets=[{path:'time.stutter.rate',min:.35,max:.95,start:0,end:1,skew:.5}];}
 if(name==='Suspended matter'){Object.assign(s.time.stretch,{on:true,speed:.28,grain:.55,spread:.7,scatter:.18,mix:.8});add('DATTORRO',.45);add('CHORUS',.18);s.mods[1].rate=.8;s.mods[1].targets=[{path:'time.stretch.pitch',min:.45,max:.55,start:0,end:1,skew:.5}];}
 if(name==='Circuit ritual'){Object.assign(s.time.stutter,{on:true,bend:true,warp:.58,break:.35,mix:.55});add('CIRCUIT BEND',.23);add('PRISM',.65);add('REEL',.2);s.macros[0].targets=[{path:'time.stutter.warp',min:.1,max:.95,start:0,end:1,skew:.5}];}
 if(name==='Glass transmission'){add('CRYSTAL',.3);add('TRANSMIT',.22);add('AETHER',.4);s.graphs[0].targets=[{path:'main.pan',min:.25,max:.75,start:0,end:1,skew:.5}];}
 return s;}
export const FACTORIES=['Init','Worn cassette','Fractured rhythm','Suspended matter','Circuit ritual','Glass transmission'];
