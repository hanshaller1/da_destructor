import test from 'node:test';
import assert from 'node:assert/strict';
import {AudioHost} from '../audio-host.mjs';

const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const settle=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
const buffer=(duration=4)=>({duration,sampleRate:1000,numberOfChannels:2});
function setup({module=Promise.resolve(),decode=async()=>buffer(),media=async()=>({getTracks:()=>[],getAudioTracks:()=>[]})}={}){
 const contexts=[],processors=[];
 class Node{
  connect(target,output=0,input=0){this.target=target;this.connection={output,input};return target;}
  disconnect(){this.disconnected=true;}
  start(_when,offset){this.started=offset;}
  stop(){this.stopped=true;}
 }
 class Context{
  constructor(){contexts.push(this);this.state='suspended';this.sampleRate=1000;this.currentTime=0;this.destination={};this.nodes=[];this.audioWorklet={addModule:()=>module};}
  async resume(){if(this.state==='closed')throw new Error('closed');this.state='running';}
  async close(){this.state='closed';}
  createAnalyser(){return new Node();}
  createGain(){const node=new Node();node.gain={value:0,setTargetAtTime(value){this.value=value;}};return node;}
  createBufferSource(){const node=new Node();this.nodes.push(node);return node;}
  createMediaStreamSource(){const node=new Node();this.nodes.push(node);return node;}
  decodeAudioData(data){return decode(data);}
  createBuffer(channels,length,sampleRate){const data=Array.from({length:channels},()=>new Float32Array(length));return {...buffer(length/sampleRate),getChannelData:channel=>data[channel]};}
 }
 class Processor extends Node{constructor(){super();processors.push(this);this.messages=[];this.port={postMessage:message=>this.messages.push(message),onmessage:null};}}
 globalThis.window={isSecureContext:true,AudioContext:Context};globalThis.AudioWorkletNode=Processor;
 Object.defineProperty(globalThis,'navigator',{value:{mediaDevices:{getUserMedia:media,enumerateDevices:async()=>[]}},configurable:true});
 return {contexts,processors};
}

test('concurrent play awaits one worklet initialization and creates one source',async()=>{
 const gate=deferred(),environment=setup({module:gate.promise}),host=new AudioHost(),state={playing:false};host.buffer=buffer();
 const one=host.play(state),two=host.play(state);await settle();
 assert.equal(environment.contexts.length,1);assert.equal(environment.processors.length,0);assert.equal(host.playing,false);
 gate.resolve();assert.equal(await one,true);assert.equal(await two,true);
 assert.equal(environment.processors.length,1);assert.equal(environment.contexts[0].nodes.length,1);assert.equal(host.playing,true);assert.equal(state.playing,true);
 host.pause();assert.equal(host.source,null);assert.equal(host.playing,false);
});
test('pause during module initialization cancels pending playback',async()=>{
 const gate=deferred(),environment=setup({module:gate.promise}),host=new AudioHost();host.buffer=buffer();
 const pending=host.play({playing:false});host.pause();gate.resolve();assert.equal(await pending,false);
 assert.equal(host.playing,false);assert.equal(environment.contexts[0].nodes.length,0);assert.equal(host.loading,false);
});
test('late live-input permission result after pause stops every track without connecting',async()=>{
 const permission=deferred();let stopped=0;const environment=setup({media:()=>permission.promise}),host=new AudioHost();
 const pending=host.live('chosen-input',{playing:false});await settle();host.pause();
 permission.resolve({getTracks:()=>[{stop(){stopped++;}}],getAudioTracks:()=>[{label:'Interface'}]});
 assert.equal(await pending,false);assert.equal(stopped,1);assert.equal(host.stream,null);assert.equal(host.playing,false);assert.equal(environment.contexts[0].nodes.length,0);
});
test('only latest completed file request wins, oversized loops preserve current audio',async()=>{
 const first=deferred(),second=deferred();setup({decode:data=>data===1?first.promise:second.promise});const host=new AudioHost(),state={playing:false};
 await host.init(state);host.buffer=buffer();host.sourceKind='file';
 const one=host.loadFile({size:1,name:'old.wav',arrayBuffer:async()=>1},state);await settle();
 const two=host.loadFile({size:1,name:'new.wav',arrayBuffer:async()=>2},state);await settle();
 second.resolve(buffer(6));assert.equal(await two,true);first.resolve(buffer(2));assert.equal(await one,false);assert.equal(host.sourceName,'new.wav');assert.equal(host.buffer.duration,6);
 await host.play(state);const activeSource=host.source;host.context.decodeAudioData=async()=>buffer(601);
 await assert.rejects(host.loadFile({size:1,name:'huge.wav',arrayBuffer:async()=>3},state),/10 Minuten/);
 assert.equal(host.playing,true);assert.equal(host.source,activeSource);assert.equal(host.buffer.duration,6);assert.equal(host.loading,false);
});
test('pause flushes recording and WAV contains ordered stereo16 PCM at device rate',async()=>{
 const environment=setup(),host=new AudioHost(),state={playing:false};host.buffer=buffer();await host.play(state);await host.record(state);
 let recorded;host.addEventListener('recorded',event=>recorded=event.detail);
 const port=environment.processors[0].port;
 port.onmessage({data:{type:'record',data:new Float32Array([1,-1,.5,-.5])}});host.pause();
 assert.equal(host.recording,false);assert.ok(environment.processors[0].messages.some(message=>message.type==='record'&&message.active===false));assert.equal(recorded,undefined);
 port.onmessage({data:{type:'record',data:new Float32Array([.25,-.25])}});port.onmessage({data:{type:'record-ended'}});
 const wav=new DataView(await recorded.blob.arrayBuffer());
 assert.equal(wav.getUint16(22,true),2);assert.equal(wav.getUint16(34,true),16);assert.equal(wav.getUint32(24,true),1000);assert.equal(wav.getUint32(40,true),12);
 assert.equal(wav.getInt16(44,true),32767);assert.equal(wav.getInt16(46,true),-32768);assert.equal(wav.getInt16(48,true),16384);assert.equal(wav.getInt16(50,true),-16384);assert.equal(recorded.duration,.003);
});
test('pause cancels pending recording start and close permits fresh initialization',async()=>{
 const environment=setup(),host=new AudioHost(),state={playing:false};host.buffer=buffer();await host.play(state);
 const pending=host.record(state);host.pause();assert.equal(await pending,false);assert.equal(host.recording,false);
 await host.close();assert.equal(environment.contexts[0].state,'closed');assert.equal(host.context,null);
 await host.play(state);assert.equal(environment.contexts.length,2);assert.equal(host.playing,true);
});
test('pause and resume retain file play position and stop prior source',async()=>{
 const environment=setup(),host=new AudioHost(),state={playing:false};host.buffer=buffer();await host.play(state);
 const first=host.source;environment.contexts[0].currentTime=1.75;host.pause();assert.equal(host.position,1.75);assert.equal(first.stopped,true);assert.equal(first.disconnected,true);
 await host.play(state);assert.equal(host.source.started,1.75);assert.notEqual(host.source,first);
});
test('new playback requested during close waits and opens a fresh audio context',async()=>{
 const environment=setup(),host=new AudioHost(),state={playing:false};host.buffer=buffer();await host.play(state);
 const closing=host.close(),playing=host.play(state);await Promise.all([closing,playing]);
 assert.equal(environment.contexts.length,2);assert.equal(environment.contexts[0].state,'closed');assert.equal(host.context.state,'running');assert.equal(host.playing,true);
});

test('independent sidechain file connects input1 and pauses/resumes without replacing the main source',async()=>{
 const environment=setup(),host=new AudioHost(),state={playing:false};host.buffer=buffer(4);await host.play(state);const main=host.source;
 await host.loadSidechain({size:1,name:'kick.wav',arrayBuffer:async()=>1},state);const side=host.sidechain.source;
 assert.equal(host.source,main);assert.deepEqual(side.connection,{output:0,input:1});assert.equal(host.sidechain.name,'kick.wav');
 environment.contexts[0].currentTime=1;host.pause();assert.equal(side.stopped,true);assert.equal(host.sidechain.position,1);assert.equal(host.sidechain.source,null);
 await host.play(state);assert.equal(host.sidechain.source.started,1);host.disconnectSidechain();assert.equal(host.sidechain.kind,'none');assert.equal(host.playing,true);
});
test('late external sidechain permission after pause closes tracks and never connects input1',async()=>{
 const permission=deferred();let stopped=0;const environment=setup({media:()=>permission.promise}),host=new AudioHost(),state={playing:false};host.buffer=buffer();await host.play(state);
 const pending=host.connectSidechain('external',state);await settle();host.pause();permission.resolve({getTracks:()=>[{stop(){stopped++;}}],getAudioTracks:()=>[{label:'Kick input'}]});
 assert.equal(await pending,false);assert.equal(stopped,1);assert.equal(host.sidechain.source,null);assert.equal(environment.contexts[0].nodes.length,1);
});
