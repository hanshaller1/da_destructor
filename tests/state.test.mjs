import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,sanitizeState,makeEffect,getPath,setPath,formatValue,factoryPreset,FACTORIES,TONAL_SCALES,parameterKind,getParameterOptions} from '../state.mjs';
import {EFFECTS} from '../effects.mjs';

const roundTrip=state=>sanitizeState(JSON.parse(JSON.stringify(state)));
const route=(path,extra={})=>({path,min:.1,max:.9,start:.2,end:.8,skew:.65,...extra});

test('rejects malformed files while retaining defaults for missing optional fields',()=>{
 for(const input of [null,[],42,'preset',{}, {version:2,time:{},main:{},fx:[]},{version:1,time:[],main:{},fx:[]},{version:1,time:{},main:'oops',fx:[]}])assert.throws(()=>sanitizeState(input));
 const state=sanitizeState({version:1,time:{},main:{},fx:[]});
 assert.equal(state.bpm,120);
 assert.deepEqual(state.tonal,{root:0,scale:'minor',chord:'minor'});
 assert.equal(state.time.vari.speed,1);
});

test('a complete saved preset retains user controls, routes, graph bends, and performance names',()=>{
 const original=createState();original.presetName='My slow tape / Übersee';original.bpm=93.75;original.fxMode='parallel';
 original.tonal={root:9,scale:'dorian',chord:'major'};
 Object.assign(original.time.stretch,{on:true,sync:false,linked:true,speed:.37,grain:.63});
 Object.assign(original.time.vari,{mode:.5,model:1,wow:.27});
 Object.assign(original.time.stutter,{link:true,pattern:'TRIPLET',gateCurve:'EXP',freeze:true});
 const fx=makeEffect('TAPE','fx-user-tape');fx.snap=true;fx.params.drive=.73;fx.mix=.43;original.fx.push(fx);
 original.mods[2].type='rand';original.mods[2].bin=true;original.mods[2].targets=[route('fx.fx-user-tape.params.drive')];
 original.graphs[1].points=[[0,.2,.4],[.3,.7,.8],[1,.2,.5]];original.graphs[1].reverse=true;
 original.macros[0].name='BLÜTE';original.macros[0].value=.62;original.macros[0].targets=[route('time.stretch.speed',{curve:'triangle'})];
 original.xy.x=.31;original.xy.y=.83;original.xy.targetsY=[route('main.pan',{min:.9,max:.1})];
 original.seq.stutter.on=true;original.seq.stutter.patterns=4;original.seq.stutter.steps[63]={on:false,value:.87};
 const restored=roundTrip(original);
 assert.deepEqual(restored,original);
 assert.deepEqual(roundTrip(restored),restored,'sanitization is stable across repeated saves');
});

test('loading a preset never starts transport or enables a saved global bypass',()=>{
 const state=createState();state.playing=true;state.bypass=true;
 const restored=roundTrip(state);assert.equal(restored.playing,false);assert.equal(restored.bypass,false);
});

test('effect catalog defaults produce valid normalized parameter values and separate instances',()=>{
 assert.equal(EFFECTS.length,62);
 for(const descriptor of EFFECTS){const effect=makeEffect(descriptor.id,`fx-${descriptor.id.replaceAll(' ','-')}`);assert.equal(effect.snap,false);for(const value of Object.values(effect.params))assert.ok(Number.isFinite(value)&&value>=0&&value<=1,descriptor.id);}
 const a=makeEffect('TAPE','fx-a'),b=makeEffect('TAPE','fx-b');a.params.drive=.99;assert.notEqual(a.params.drive,b.params.drive);
 assert.equal(makeEffect('UNKNOWN'),null);
});

test('every factory preset survives JSON serialization with its ordered effect chain and routes',()=>{
 for(const name of FACTORIES){const original=factoryPreset(name),restored=roundTrip(original);assert.equal(restored.presetName,name);assert.deepEqual(restored.fx.map(f=>f.type),original.fx.map(f=>f.type));assert.deepEqual(restored.mods.map(m=>m.targets),original.mods.map(m=>m.targets));}
});

test('FX targets resolve by stable ID after reordering, including short legacy parameter paths',()=>{
 const state=createState(),tape=makeEffect('TAPE','fx-tape'),eq=makeEffect('EQ','fx-eq');state.fx=[eq,tape];
 state.mods[0].targets=[route('fx.fx-tape.params.drive'),route('fx.fx-eq.mix'),route('fx.fx-tape.drive'),route('fx.fx-removed.params.drive')];
 const restored=roundTrip(state);assert.equal(restored.mods[0].targets.length,3);
 assert.equal(getPath(restored,'fx.fx-tape.params.drive'),tape.params.drive);
 assert.equal(getPath(restored,'fx.fx-tape.drive'),tape.params.drive);
 assert.equal(setPath(restored,'fx.fx-tape.drive',.81),true);assert.equal(restored.fx[1].params.drive,.81);
});

test('rejects prototype traversal and non-parameter modulation destinations',()=>{
 const state=createState();state.mods[0].targets=['__proto__.polluted','time.constructor.prototype.polluted','fx.length','bpm','version','tonal.root'].map(path=>route(path));
 const restored=roundTrip(state);assert.deepEqual(restored.mods[0].targets,[]);
 for(const path of ['__proto__.polluted','constructor.prototype.polluted','main.__proto__.polluted','main.toString','', 'missing.gain', 'main.gain.child']){
  assert.equal(getPath(restored,path),undefined,path);assert.equal(setPath(restored,path,1),false,path);
 }
 assert.equal(Object.prototype.polluted,undefined);
 assert.equal(setPath(restored,'main.gain',.7),true);assert.equal(restored.main.gain,.7);
});

test('injected unknown keys are discarded without mutating the input or prototype',()=>{
 const raw=JSON.parse(JSON.stringify(createState()));raw.time.stretch.injected=99;raw.main.__proto__={polluted:1};raw.fx=[{type:'TAPE',id:'fx-a',params:{drive:2,unknown:.7},snap:true}];
 const before=JSON.stringify(raw),restored=sanitizeState(raw);
 assert.equal(JSON.stringify(raw),before);assert.equal(restored.time.stretch.injected,undefined);assert.equal(restored.main.polluted,undefined);assert.equal(restored.fx[0].params.unknown,undefined);assert.equal(restored.fx[0].params.drive,1);assert.equal(restored.fx[0].snap,true);
});

test('duplicate effects and invalid effects are removed while duplicate IDs become unambiguous',()=>{
 const state=createState();state.fx=[makeEffect('TAPE','fx-shared'),makeEffect('EQ','fx-shared'),makeEffect('TAPE','fx-second'),{type:'UNKNOWN',id:'fx-unknown'}];
 const restored=roundTrip(state);assert.deepEqual(restored.fx.map(f=>f.type),['TAPE','EQ']);assert.equal(new Set(restored.fx.map(f=>f.id)).size,2);
});

test('all 64 sequencer steps and both sequencers remain independent after import',()=>{
 const state=createState();state.seq.stutter.patterns=4;state.seq.stretch.patterns=3;
 state.seq.stutter.steps=Array.from({length:64},(_,i)=>({on:i%3!==0,value:i/63}));
 const restored=roundTrip(state);assert.deepEqual(restored.seq.stutter.steps,state.seq.stutter.steps);
 assert.equal(restored.seq.stretch.steps.length,64);assert.equal(restored.seq.stretch.patterns,3);
 restored.seq.stutter.steps[0].value=.8;
 assert.equal(restored.seq.stutter.steps[1].value,1/63);assert.equal(restored.seq.stretch.steps[0].value,1);assert.equal(state.seq.stutter.steps[0].value,0);
});

test('bounds parameter values, route counts, graph coordinates, and user text',()=>{
 const state=createState();state.bpm=600;state.main.gain=Infinity;state.main.mix=-5;state.time.vari.wow=7;state.presetName='x'.repeat(100);
 state.macros[0].name='y'.repeat(80);state.mods[0].targets=Array.from({length:12},()=>route('main.pan',{min:-1,max:4}));state.macros[0].targets=state.mods[0].targets;
 state.graphs[0].points=[[.9,2,Infinity],[-1,-3,.2],[.5,.7,.7]];state.seq.stretch.patterns=25;
 const restored=sanitizeState(state);assert.equal(restored.bpm,300);assert.equal(restored.main.gain,.5);assert.equal(restored.main.mix,0);assert.equal(restored.time.vari.wow,1);assert.equal(restored.presetName.length,60);assert.equal(restored.macros[0].name.length,24);assert.equal(restored.mods[0].targets.length,6);assert.equal(restored.macros[0].targets.length,5);assert.equal(restored.mods[0].targets[0].min,0);assert.equal(restored.mods[0].targets[0].max,1);assert.equal(restored.seq.stretch.patterns,4);
 assert.equal(restored.graphs[0].points[0][0],0);assert.equal(restored.graphs[0].points.at(-1)[0],1);for(const p of restored.graphs[0].points)for(const v of p)assert.ok(v>=0&&v<=1);
});

test('tonal root is an integer pitch class and supported scale/chord names persist',()=>{
 const state=createState();state.tonal={root:10.7,scale:'dorian',chord:'major'};assert.deepEqual(roundTrip(state).tonal,{root:11,scale:'dorian',chord:'major'});
 for(const scale of TONAL_SCALES){state.tonal={root:7,scale,chord:'minor'};assert.deepEqual(roundTrip(state).tonal,state.tonal);}
 state.tonal={root:99,scale:'unrecognized',chord:'unrecognized'};assert.deepEqual(roundTrip(state).tonal,{root:11,scale:'minor',chord:'minor'});
 state.tonal.root=-5;assert.equal(roundTrip(state).tonal.root,0);
});

test('time and gain displays describe actual normalized DSP values',()=>{
 assert.equal(formatValue(.5,'gain'),'+0.0 dB');assert.equal(formatValue(0,'gain'),'-24.0 dB');assert.equal(formatValue(1,'fxgain'),'+12.0 dB');assert.equal(formatValue(.5,'pitch'),'+0 st');assert.equal(formatValue(1,'pitch'),'+12 st');
 assert.equal(formatValue(.5,'timecapture'),'1/4');assert.equal(formatValue(0,'timecapture'),'4 BARS · 2 s MAX');assert.equal(formatValue(1,'capture'),'1/64');
 assert.equal(formatValue(0,'stutterrate'),'1/256');assert.equal(formatValue(1,'stutterrate'),'1/4');assert.equal(formatValue(.45,'stutterrate'),'1/32');assert.equal(formatValue(0,'stutterrate',undefined,{sync:false}),'10.0 ms');assert.equal(formatValue(1,'stutterrate',undefined,{sync:false}),'500 ms');
 assert.equal(formatValue(.4,'stretchgrain',undefined,{bpm:120}),'15.6 ms');assert.equal(formatValue(.4,'stretchgrain',undefined,{bpm:60}),'31.3 ms');assert.equal(formatValue(.4,'stretchgrain',undefined,{sync:false}),'43.0 Hz');
 assert.equal(formatValue(0,'bendtime'),'0.13 BT');assert.equal(formatValue(1,'bendtime'),'16.00 BT');assert.equal(formatValue(.8,'reps',undefined,{warp:.75}),'1 · LOCK');
});

test('time enum strings survive safely and legacy named vari modes become canonical numbers',()=>{
 const state=createState();state.time.vari.mode='FWD-REV';state.time.vari.model='BITCRUSH';state.time.stutter.pattern='RAMP UP';state.time.stutter.gateCurve='LOG';
 const restored=roundTrip(state);assert.equal(restored.time.vari.mode,.5);assert.equal(restored.time.vari.model,1);assert.equal(restored.time.stutter.pattern,'RAMP UP');assert.equal(restored.time.stutter.gateCurve,'LOG');
 state.time.stutter.pattern='INVALID';state.time.stutter.gateCurve='INVALID';assert.equal(roundTrip(state).time.stutter.pattern,'EVEN');assert.equal(roundTrip(state).time.stutter.gateCurve,'LINEAR');
});

test('old version-one presets retain legacy timing and gain values without changing normalized controls',()=>{
 const state=createState();delete state.main.gainMode;delete state.time.stretch.timing;delete state.time.vari.timing;delete state.time.stutter.timing;delete state.graphs[0].timing;
 state.main.gain=.8;state.time.stretch.grain=.37;state.time.stutter.capture=.63;
 const restored=roundTrip(state);assert.equal(restored.main.gainMode,'legacy');assert.equal(restored.main.gain,.8);assert.equal(restored.time.stretch.timing,'legacy');assert.equal(restored.time.stretch.grain,.37);assert.equal(restored.time.stutter.capture,.63);assert.equal(restored.graphs[0].timing,'legacy');
 assert.equal(createState().time.stretch.timing,'musical');assert.equal(createState().main.gainMode,'extended');
});

test('new musical and extended gain displays match their documented endpoints',()=>{
 assert.equal(formatValue(0,'stretchgrain',undefined,{timing:'musical'}),'1/16');assert.equal(formatValue(1,'stretchgrain',undefined,{timing:'musical'}),'1/512');
 assert.equal(formatValue(.5,'timecapture',undefined,{timing:'musical',engine:'stretch'}),'1/4');assert.equal(formatValue(0,'timecapture',undefined,{timing:'musical',engine:'stretch'}),'1 BAR');
 assert.equal(formatValue(1/6,'stuttercapture',undefined,{timing:'musical'}),'1/2');assert.equal(formatValue(1,'bendtime',undefined,{timing:'musical'}),'4 BARS');
 assert.equal(formatValue(0,'gain',undefined,{gainMode:'extended'}),'−∞ dB');assert.equal(formatValue(.25,'gain',undefined,{gainMode:'extended'}),'-6.0 dB');assert.equal(formatValue(.5,'gain',undefined,{gainMode:'extended'}),'+0.0 dB');assert.equal(formatValue(1,'gain',undefined,{gainMode:'extended'}),'+12.0 dB');
});

test('common FX stereo controls and external envelope source survive independent channel editing',()=>{
 const state=createState(),effect=makeEffect('PRISM','fx-stereo');effect.lrLock=false;effect.muted=true;effect.sync=true;effect.params.cutoff=.2;effect.paramsR.cutoff=.8;state.fx=[effect];state.mods[0].type='env';state.mods[0].source='external';state.mods[0].targets=[route('fx.fx-stereo.paramsR.cutoff')];state.main.autoGain=.3;state.latencyComp=false;state.clock={source:'midi',deferred:false};
 const restored=roundTrip(state);assert.deepEqual(restored.fx[0],effect);assert.equal(restored.mods[0].source,'external');assert.equal(restored.mods[0].targets[0].path,'fx.fx-stereo.paramsR.cutoff');assert.equal(restored.main.autoGain,.3);assert.equal(restored.latencyComp,false);assert.deepEqual(restored.clock,state.clock);
 const old={...effect};delete old.paramsR;const legacy=roundTrip({...state,fx:[old]}).fx[0];assert.deepEqual(legacy.paramsR,legacy.params);assert.notEqual(legacy.paramsR,legacy.params);
});

test('CHOPPER retains 32 independent slice parameter sets and normalized routing paths',()=>{
 const state=createState(),chopper=makeEffect('CHOPPER','fx-chop');state.fx=[chopper];chopper.slices[31].pitch=.81;chopper.slices[30].ratchet=.5;state.mods[0].targets=[route('fx.fx-chop.slices.31.pitch')];
 const restored=roundTrip(state);assert.equal(restored.fx[0].slices.length,32);assert.equal(getPath(restored,'fx.fx-chop.slices.31.pitch'),.81);assert.equal(restored.mods[0].targets[0].path,'fx.fx-chop.slices.31.pitch');restored.fx[0].slices[0].pitch=.1;assert.equal(restored.fx[0].slices[1].pitch,.5);assert.equal(parameterKind('fx.fx-chop.slices.32.pitch',restored),null);
});

test('real cubic handle coordinates persist while graph endpoints close and invalid handles are removed',()=>{
 const state=createState();state.graphs[0].points=[[0,.2,.5,.05,.7,.2,.6],[.5,.8,.1,.6,.9,.9,.2],[1,.9,.5]];
 const restored=roundTrip(state);assert.deepEqual(restored.graphs[0].points[0],state.graphs[0].points[0]);assert.deepEqual(restored.graphs[0].points[1],state.graphs[0].points[1]);assert.equal(restored.graphs[0].points.at(-1)[1],.2);
 state.graphs[0].points[0][4]=Infinity;const invalid=sanitizeState(state);assert.equal(invalid.graphs[0].points[0].length,3);assert.equal(invalid.graphs[0].timing,'musical');
});

test('automation imports only safe parameter gestures, retains boolean kind, and starts stopped',()=>{
 const state=createState();state.fx=[makeEffect('TAPE','fx-motion')];state.automationPlaying=true;state.automation={duration:5,loop:false,events:[
  {time:3,path:'main.pan',value:2},{time:0,path:'time.vari.on',value:true,kind:'boolean'},{time:2,path:'fx.fx-motion.paramsR.drive',value:.3},{time:1,path:'bypass',value:0,kind:'boolean'},
  {time:1,path:'__proto__.polluted',value:1},{time:1,path:'playing',value:1},{time:1,path:'automationPlaying',value:1},{time:1,path:'fx.length',value:0},{time:6,path:'main.pan',value:.3},{time:-1,path:'main.pan',value:.3},{time:1,path:'main.pan',value:NaN}
 ]};
 const restored=sanitizeState(state);assert.equal(restored.automationPlaying,false);assert.equal(restored.automation.duration,5);assert.equal(restored.automation.loop,false);assert.deepEqual(restored.automation.events,[{time:0,path:'time.vari.on',value:1,kind:'boolean'},{time:1,path:'bypass',value:0,kind:'boolean'},{time:2,path:'fx.fx-motion.paramsR.drive',value:.3},{time:3,path:'main.pan',value:1}]);assert.equal(Object.prototype.polluted,undefined);
 assert.deepEqual(roundTrip(restored).automation,restored.automation);
});

test('known string selectors expose trusted option sets and survive typed normalized automation roundtrip',()=>{
 const state=createState(),paths=['mods.0.type','mods.1.shape','mods.2.source','time.order','time.stretch.timing','time.vari.timing','time.stutter.pattern','time.stutter.gateCurve','time.stutter.scratchPattern','fxMode','tonal.scale','tonal.chord','main.gainMode','graphs.0.timing'];
 state.automation={duration:paths.length,loop:true,events:paths.map((path,i)=>({time:i,path,value:.75,kind:'enum'}))};
 for(const path of paths){const options=getParameterOptions(path,state);assert.ok(Array.isArray(options)&&options.length>=2,path);assert.ok(options.every(value=>typeof value==='string'));assert.equal(parameterKind(path,state),'enum',path);}
 assert.deepEqual(getParameterOptions('mods.0.type',state),['lfo','rand','env']);assert.deepEqual(getParameterOptions('mods.2.source',state),['internal','external']);assert.equal(getParameterOptions('mods.0.shape',state).length,19);assert.deepEqual(getParameterOptions('time.stutter.scratchPattern',state),['AUTO','BABY','TRANSFORMER','TEAR','SCRIBBLE']);
 const restored=roundTrip(state);assert.deepEqual(restored.automation,state.automation);assert.deepEqual(roundTrip(restored).automation,state.automation);
 for(const path of ['time.vari.mode','time.vari.model','main.gain','tonal.root'])assert.equal(getParameterOptions(path,state),null,path);
});

test('tonal pitch class automation retains normalized integer type across file export',()=>{
 const state=createState();state.tonal.root=9;state.automation={duration:3,loop:false,events:[{time:0,path:'tonal.root',value:9/11,kind:'integer'},{time:1,path:'tonal.root',value:1,kind:'integer'},{time:2,path:'tonal.root',value:0,kind:'integer'}]};
 assert.equal(parameterKind('tonal.root',state),'integer');const restored=roundTrip(state);assert.deepEqual(restored.automation,state.automation);assert.equal(restored.tonal.root,9);
});

test('typed events never trust file-supplied enum options or kind declarations',()=>{
 const state=createState();state.automation={duration:2,loop:true,events:[{time:0,path:'mods.0.type',value:1,kind:'enum',options:['__proto__'],payload:{polluted:true}},{time:.5,path:'main.pan',value:.3,kind:'enum',options:['bad']},{time:1,path:'time.stutter.pattern',value:4,kind:'boolean'},{time:1.1,path:'bpm',value:1,kind:'integer'},{time:1.2,path:'playing',value:1,kind:'boolean'},{time:1.3,path:'__proto__.type',value:1,kind:'enum'},{time:1.4,path:'mods.9.type',value:1,kind:'enum'},{time:1.5,path:'mods.0.type',value:'env',kind:'enum'}]};
 const events=sanitizeState(state).automation.events;assert.deepEqual(events,[{time:0,path:'mods.0.type',value:1,kind:'enum'},{time:.5,path:'main.pan',value:.3},{time:1,path:'time.stutter.pattern',value:1,kind:'enum'}]);assert.deepEqual(getParameterOptions('mods.0.type',state),['lfo','rand','env']);assert.equal(Object.prototype.polluted,undefined);
});

test('sequencer and real graph coordinate automation permit only existing bounded parameter paths',()=>{
 const state=createState();state.graphs[0].points[0]=[0,.1,.5,.05,.8,.2,.6];state.automation={duration:3,loop:true,events:[
  {time:0,path:'seq.stutter.steps.63.value',value:.75},{time:.1,path:'seq.stretch.steps.0.on',value:0,kind:'boolean'},{time:.2,path:'graphs.0.points.0.6',value:.45},{time:.3,path:'graphs.0.points.4.1',value:.6},
  {time:1,path:'seq.stutter.steps.64.value',value:.2},{time:1.1,path:'seq.stutter.steps.00.value',value:.2},{time:1.2,path:'graphs.0.points.48.1',value:.2},{time:1.3,path:'graphs.0.points.0.7',value:.2},{time:1.4,path:'seq.stutter.patterns',value:1},{time:1.5,path:'graphs.0.points.length',value:0}
 ]};
 const restored=roundTrip(state);assert.equal(restored.automation.events.length,4);assert.equal(parameterKind('graphs.0.points.0.6',restored),'continuous');assert.equal(parameterKind('graphs.0.points.48.1',restored),null);assert.equal(parameterKind('seq.stutter.steps.64.value',restored),null);assert.equal(parameterKind('seq.stutter.steps.00.value',restored),null);assert.equal(restored.automation.events[1].kind,'boolean');
});
