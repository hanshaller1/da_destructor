import test from 'node:test';
import assert from 'node:assert/strict';
import {GestureRecorder} from '../automation.mjs';
import {createState,sanitizeState,makeEffect,applyStructureEvent,sanitizeStructureEvent,canSequenceTarget,formatValue} from '../state.mjs';
import {ModulationEngine,freeRateHz} from '../modulation.mjs';

test('structural recording restores initial FX and validates parameter events against their timeline',()=>{
 const state=createState(),tape=makeEffect('TAPE','fx-tape'),eq=makeEffect('EQ','fx-eq');state.fx=[tape];
 const recorder=new GestureRecorder();recorder.start(10,{'fx.fx-tape.params.drive':tape.params.drive},state);
 recorder.capture('fx.fx-tape.params.drive',.8,10.1);
 recorder.captureStructure('fx',[tape,eq],10.2);
 recorder.captureStructure('fx',[eq],10.3);
 state.fx=[eq];state.automation=recorder.stop(10.4);
 const restored=sanitizeState(JSON.parse(JSON.stringify(state)));
 assert.equal(restored.automation.events.filter(e=>e.kind==='structure').length,3);
 assert.ok(restored.automation.events.some(e=>e.path==='fx.fx-tape.params.drive'&&e.time===.1));
 const replay=createState();replay.fx=[eq];
 for(const event of restored.automation.events.filter(e=>e.kind==='structure'))assert.equal(applyStructureEvent(replay,event),true);
 assert.deepEqual(replay.fx.map(f=>f.id),['fx-eq']);
 applyStructureEvent(replay,restored.automation.events[0]);assert.deepEqual(replay.fx.map(f=>f.id),['fx-tape']);
 // Returned nested snapshots are detached from both recorder state and source.
 const fxEvent=state.automation.events.find(e=>e.kind==='structure');fxEvent.value[0].params.drive=0;
 assert.notEqual(recorder.events.find(e=>e.kind==='structure').value[0].params.drive,0);
 assert.notEqual(tape.params.drive,0);
});

test('graph topology and sequence structure roundtrip with safe schemas and closed endpoints',()=>{
 const state=createState(),recorder=new GestureRecorder();recorder.start(0,{},state);
 const points=[[0,.2,.5],[.2,.8,.5],[.7,.3,.5],[1,.9,.5]];
 assert.equal(recorder.captureStructure('graph',points,.1,1),true);
 assert.equal(recorder.captureStructure('sequence',{patterns:4,length:7,target:'main.pan',min:.8,max:.2},.2,'stretch'),true);
 state.automation=recorder.stop(.3);const restored=sanitizeState(state);
 assert.equal(restored.automation.events.length,4);
 for(const event of restored.automation.events)applyStructureEvent(restored,event);
 assert.equal(restored.graphs[1].points.length,4);assert.equal(restored.graphs[1].points.at(-1)[1],.2);
 assert.equal(restored.seq.stretch.length,7);assert.equal(restored.seq.stretch.target,'main.pan');
 const pollution={time:0,kind:'structure',scope:'__proto__',value:{polluted:true}};
 assert.equal(sanitizeStructureEvent(pollution,state),null);
 assert.equal(sanitizeStructureEvent({time:0,kind:'structure',scope:'graph',index:9,value:points},state),null);
 assert.equal(sanitizeStructureEvent({time:0,kind:'structure',scope:'graph',index:0,value:[[0,NaN],[1,0]]},state),null);
 const safe=sanitizeStructureEvent({time:0,kind:'structure',scope:'sequence',name:'stretch',value:{length:200,target:'seq.stutter.patterns',prototype:{polluted:true}}},state);
 assert.equal(safe.value.length,64);assert.equal(safe.value.target,'default');assert.equal(Object.prototype.polluted,undefined);
});

test('independent 5 and 7 step lengths create exact polyrhythmic boundaries',()=>{
 const state=createState();Object.assign(state.seq.stutter,{on:true,length:5,patterns:4});Object.assign(state.seq.stretch,{on:true,length:7,patterns:4});
 const engine=new ModulationEngine(1000);engine.configure(state);
 engine.tick(624,120);assert.equal(engine.steps.stutter,4);assert.equal(engine.steps.stretch,4);
 engine.tick(625,120);assert.equal(engine.steps.stutter,0);assert.equal(engine.steps.stretch,5);
 engine.tick(875,120);assert.equal(engine.steps.stutter,2);assert.equal(engine.steps.stretch,0);
 engine.tick(4375,120);assert.equal(engine.steps.stutter,0);assert.equal(engine.steps.stretch,0);
});

test('extra sequencer destinations map ranges and restore their pre-step value',()=>{
 const state=createState();state.fx=[makeEffect('TAPE','fx-tape')];state.fx[0].params.drive=.6;
 Object.assign(state.seq.stretch,{on:true,length:3,target:'fx.fx-tape.params.drive',min:.2,max:.8});
 state.seq.stretch.steps[0]={on:true,value:.25};state.seq.stretch.steps[1]={on:false,value:1};
 const engine=new ModulationEngine(1000);engine.configure(state);engine.tick(0,120);
 assert.ok(Math.abs(engine.effective.fx[0].params.drive-.35)<1e-12);
 assert.equal(engine.getSources()['fx.fx-tape.params.drive'],'s:stretch');assert.equal(engine.getValues()['fx.fx-tape.params.drive'],engine.effective.fx[0].params.drive);
 engine.tick(125,120);assert.equal(engine.effective.fx[0].params.drive,.6);
 assert.equal(engine.base.fx[0].params.drive,.6);
 assert.equal(engine.getSources()['fx.fx-tape.params.drive'],undefined);
 for(const path of ['bpm','seq.stutter.patterns','fx.length','__proto__.x','tonal.root'])assert.equal(canSequenceTarget(path,state),false,path);
 assert.equal(canSequenceTarget('time.granular.pitch',state),true);
 const restored=sanitizeState({...state,seq:{...state.seq,stutter:{...state.seq.stutter,target:'seq.stretch.length'}}});
 assert.equal(restored.seq.stutter.target,'default');
});

test('free LFO and RAND run in seconds independently of tempo and reset deterministically',()=>{
 assert.equal(freeRateHz(0),.01);assert.equal(freeRateHz(.5),1);assert.equal(freeRateHz(1),100);
 const state=createState();Object.assign(state.mods[0],{sync:false,freeRate:.5,shape:'ramp',smooth:0});Object.assign(state.mods[1],{sync:false,freeRate:.5,type:'rand',smooth:0});
 const slow=new ModulationEngine(1000),fast=new ModulationEngine(1000);slow.configure(state);fast.configure(state);
 slow.tick(0,60);fast.tick(0,180);slow.tick(250,60);fast.tick(250,180);
 assert.equal(slow.values[0],.25);assert.equal(fast.values[0],.25);assert.equal(slow.values[1],fast.values[1]);
 const rand=slow.values[1];slow.reset();slow.tick(0,300);slow.tick(250,300);assert.equal(slow.values[1],rand);
 slow.tick(500,30);assert.equal(slow.values[0],.5);
});

test('overlapping sequence destinations do not accumulate stale step values',()=>{
 const state=createState();state.main.pan=.6;
 for(const name of ['stutter','stretch'])Object.assign(state.seq[name],{on:true,target:'main.pan'});
 state.seq.stutter.steps[0]={on:true,value:.1};state.seq.stretch.steps[0]={on:true,value:.9};
 state.seq.stutter.steps[1].on=state.seq.stretch.steps[1].on=false;
 const engine=new ModulationEngine(1000);engine.configure(state);engine.tick(0,120);assert.equal(engine.effective.main.pan,.9);
 engine.tick(1,120);assert.equal(engine.effective.main.pan,.9);
 engine.tick(125,120);assert.equal(engine.effective.main.pan,.6);
});

test('clearing scalar automation under an active sequence restores the saved base at disabled steps',()=>{
 const state=createState();Object.assign(state.seq.stretch,{on:true,target:'main.pan'});state.main.pan=.6;state.seq.stretch.steps[0]={on:true,value:.9};state.seq.stretch.steps[1].on=false;
 const engine=new ModulationEngine(1000);engine.configure(state);engine.setAutomation('main.pan',.2);engine.tick(0,120);assert.equal(engine.effective.main.pan,.9);
 engine.clearAutomation();engine.tick(125,120);assert.equal(engine.effective.main.pan,.6);
});

test('granular and free-rate settings survive legacy-compatible preset recall',()=>{
 const state=createState();Object.assign(state.time.granular,{on:true,sync:false,pitch:.8,size:.9,freeze:true});state.time.stretch.grainLength=.6;state.mods[2].sync=false;state.mods[2].freeRate=.9;
 state.seq.stutter.length=13;state.seq.stutter.target='time.granular.position';
 const restored=sanitizeState(JSON.parse(JSON.stringify(state)));assert.deepEqual(restored,state);
 const old=createState();delete old.time.granular;delete old.time.stretch.grainLength;delete old.mods[0].sync;delete old.mods[0].freeRate;delete old.seq.stretch.length;old.seq.stretch.patterns=3;
 const migrated=sanitizeState(old);assert.equal(migrated.time.granular.on,false);assert.equal(migrated.time.stretch.grainLength,0);assert.equal(migrated.mods[0].sync,true);assert.equal(migrated.seq.stretch.length,0);
 assert.equal(formatValue(.5,'freerate'),'1.0 Hz');assert.equal(formatValue(1,'granularpitch'),'+24 st');
});

test('grain extension and granular timing displays match the actual DSP mappings',()=>{
 assert.equal(formatValue(0,'grainlength'),'1.0×');assert.equal(formatValue(.5,'grainlength'),'2.8×');assert.equal(formatValue(1,'grainlength'),'8.0×');
 assert.equal(formatValue(0,'granularsize',undefined,{sync:false}),'10.0 ms');
 assert.equal(formatValue(.5,'granularsize',undefined,{sync:false}),'141 ms');
 assert.equal(formatValue(1,'granularsize',undefined,{sync:false}),'2000 ms');
 const size=['1/64','1/32','1/16','1/8','1/4','1/2','1 BAR'],density=[...size].reverse();
 for(let i=0;i<7;i++){
  assert.equal(formatValue(i/6,'granularsize',undefined,{sync:true}),size[i]);
  assert.equal(formatValue(i/6,'granulardensity',undefined,{sync:true}),density[i]);
 }
 assert.equal(formatValue(0,'granulardensity',undefined,{sync:false}),'1.0 Hz');
 assert.equal(formatValue(.5,'granulardensity',undefined,{sync:false}),'40.5 Hz');
 assert.equal(formatValue(1,'granulardensity',undefined,{sync:false}),'80.0 Hz');
});
