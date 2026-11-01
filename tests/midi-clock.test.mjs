import test from 'node:test';
import assert from 'node:assert/strict';
import {MidiClock} from '../midi-clock.mjs';

function fixture(){
 const first={id:'first',name:'Drum machine',state:'connected',onmidimessage:null},second={id:'second',name:'Interface',state:'connected',onmidimessage:null};
 const access={inputs:new Map([[first.id,first],[second.id,second]]),onstatechange:null};let options,calls=0;
 const clock=new MidiClock({navigator:{async requestMIDIAccess(value){calls++;options=value;return access;}},now:()=>100});
 return {clock,first,second,access,get options(){return options;},get calls(){return calls;}};
}
test('MIDI permission is explicit, sysex disabled, and no input attaches automatically',async()=>{
 const f=fixture();assert.equal(f.calls,0);assert.equal(f.clock.enabled,false);await f.clock.enable();await f.clock.enable();
 assert.equal(f.calls,1);assert.deepEqual(f.options,{sysex:false});assert.equal(f.clock.inputs.length,2);assert.equal(f.first.onmidimessage,null);
 f.clock.selectInput('first');assert.equal(typeof f.first.onmidimessage,'function');assert.equal(f.clock.selectedId,'first');
 f.clock.selectInput('second');assert.equal(f.first.onmidimessage,null);assert.equal(typeof f.second.onmidimessage,'function');
 f.clock.disconnect();assert.equal(f.second.onmidimessage,null);assert.equal(f.clock.selectedId,'');
});
test('24 MIDI intervals measure tempo, start resets, continue preserves position, stop stops',()=>{
 const {clock}=fixture(),events=[];clock.addEventListener('transport',event=>events.push(event.detail));
 clock.receive([0xFA],0);for(let pulse=0;pulse<=24;pulse++)clock.receive([0xF8],pulse*60000/(120*24));
 assert.equal(clock.bpm,120);assert.equal(clock.intervalCount,24);assert.equal(clock.playing,true);assert.equal(clock.pulses,25);
 clock.receive([0xFC],600);assert.equal(clock.playing,false);clock.receive([0xFB],700);assert.equal(clock.playing,true);assert.equal(clock.pulses,25);
 clock.receive([0xFA],800);assert.equal(clock.pulses,0);assert.deepEqual(events.map(event=>[event.kind,event.playing,event.restart]),[['start',true,true],['stop',false,false],['continue',true,false],['start',true,true]]);
});
test('tempo uses sliding last24 intervals and stays clamped30..300',()=>{
 const {clock}=fixture();let timestamp=0;clock.receive([0xF8],timestamp);
 for(let i=0;i<24;i++){timestamp+=25;clock.receive([0xF8],timestamp);}assert.equal(clock.bpm,100);
 for(let i=0;i<24;i++){timestamp+=12.5;clock.receive([0xF8],timestamp);}assert.equal(clock.bpm,200);
 for(let i=0;i<24;i++){timestamp+=2;clock.receive([0xF8],timestamp);}assert.equal(clock.bpm,300);
 for(let i=0;i<24;i++){timestamp+=100;clock.receive([0xF8],timestamp);}assert.equal(clock.bpm,30);
 clock.receive([0xF8],timestamp-200);assert.equal(clock.intervalCount,0);assert.ok(Number.isFinite(clock.bpm));
});
test('unplug stops follower and detaches input; reconnect retains explicitly chosen device',async()=>{
 const f=fixture(),events=[];f.clock.addEventListener('transport',event=>events.push(event.detail));await f.clock.enable();f.clock.selectInput('first');
 f.first.onmidimessage({data:[0xFA],timeStamp:0});assert.equal(f.clock.playing,true);
 f.first.state='disconnected';f.access.onstatechange();assert.equal(f.clock.playing,false);assert.equal(f.first.onmidimessage,null);assert.equal(events.at(-1).kind,'disconnect');
 f.first.state='connected';f.access.onstatechange();assert.equal(typeof f.first.onmidimessage,'function');f.clock.disable();assert.equal(f.first.onmidimessage,null);assert.equal(f.clock.enabled,false);
});
test('unsupported and rejected permissions give readable errors',async()=>{
 await assert.rejects(new MidiClock({navigator:{}}).enable(),/unterstützt Web MIDI nicht/);
 await assert.rejects(new MidiClock({navigator:{requestMIDIAccess:async()=>{const error=new Error();error.name='NotAllowedError';throw error;}}}).enable(),/nicht freigegeben/);
});
