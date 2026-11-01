export class AudioHost extends EventTarget {
 constructor(){
  super();this.context=null;this.processor=null;this.buffer=null;this.source=null;this.stream=null;this.playing=false;this.position=0;this.startTime=0;
  this.sourceKind='demo';this.sourceName='FACTORY LOOP / 120 BPM';this.monitor=.75;this.recordChunks=[];this.recording=false;this.loading=false;
  this._intent=0;this._initPromise=null;this._playPromise=null;this._recordPromise=null;this._recordStopPromise=null;this._recordStopResolve=null;this._closePromise=null;
 }
 emit(type,detail){this.dispatchEvent(new CustomEvent(type,{detail}));}
 send(state=this.state){
  if(!state)return;this.state=state;state.playing=this.playing;
  this.processor?.port.postMessage({type:'state',state:structuredClone(state)});
 }
 async init(state){
  if(this._closePromise)await this._closePromise;
  if(state)this.state=state;
  if(this.context?.state==='closed'){this.context=null;this.processor=null;this._initPromise=null;}
  if(this._initPromise)return this._initPromise;
  if(this.context&&this.processor){await this.context.resume();return true;}
  if(!window.isSecureContext)throw new Error('Audio benötigt localhost oder HTTPS. Bitte über den lokalen Server öffnen.');
  const Context=window.AudioContext||window.webkitAudioContext;
  if(!Context)throw new Error('Dieser Browser unterstützt Web Audio nicht.');
  const context=new Context({latencyHint:'interactive'});this.context=context;
  const promise=(async()=>{
   try{
    await context.audioWorklet.addModule(new URL('./audio-worklet.mjs',import.meta.url));
    if(this.context!==context||context.state==='closed')return false;
    const processor=new AudioWorkletNode(context,'destructor-processor',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[2],channelCount:2,channelCountMode:'explicit'});
    this.processor=processor;
    processor.onprocessorerror=()=>{
     if(this.processor!==processor)return;
     this.pause();this.finishRecording();this.processor=null;
     processor.disconnect();void context.close().catch(()=>{});
     this.emit('error','Die Audio-Engine wurde angehalten. Audio erneut starten, um sie neu zu initialisieren.');
    };
    this.analyser=context.createAnalyser();this.analyser.fftSize=2048;
    this.output=context.createGain();this.output.gain.value=this.monitor;
    processor.connect(this.analyser);this.analyser.connect(this.output);this.output.connect(context.destination);
    processor.port.onmessage=({data})=>{
     if(this.processor!==processor)return;
     if(data.type==='meter')this.emit('meter',data);
     else if(data.type==='error')this.emit('error',data.message);
     else if(data.type==='record')this.recordChunks.push(new Float32Array(data.data));
     else if(data.type==='record-ended')this.finishRecording();
    };
    this.send();await context.resume();this.emit('ready');return true;
   }catch(error){
    await context.close().catch(()=>{});
    if(this.context===context){this.context=null;this.processor=null;this.analyser=null;this.output=null;}
    throw error;
   }finally{if(this._initPromise===promise)this._initPromise=null;}
  })();
  this._initPromise=promise;return promise;
 }
 _nextIntent(state){this._intent++;this._playPromise=null;if(state)this.state=state;return this._intent;}
 _current(token,context=this.context){return token===this._intent&&!!context&&context===this.context&&context.state!=='closed';}
 async play(state=this.state){
  if(state)this.state=state;
  if(this._playPromise)return this._playPromise;
  if(this.playing&&this.context?.state!=='closed'){await this.init(state);return true;}
  const token=this._nextIntent(state);this.loading=true;
  const promise=(async()=>{
   try{
    await this.init(state);if(!this._current(token)||!this.processor)return false;
    if(this.sourceKind==='live'){
     if(!await this._connectLive(this.deviceId,token))return false;
    }else{
     if(!this.buffer)this.buffer=this.generateDemo();
     this.spawnBuffer();
    }
    if(!this._current(token))return false;
    this.playing=true;this.send();this.emit('transport',true);return true;
   }catch(error){
    if(token!==this._intent)return false;
    if(token===this._intent){this.playing=false;this.detachSource();this.stopStream();this.send();this.emit('transport',false);}
    throw error;
   }finally{if(token===this._intent)this.loading=false;if(this._playPromise===promise)this._playPromise=null;}
  })();this._playPromise=promise;return promise;
 }
 spawnBuffer(){
  this.detachSource();const source=this.context.createBufferSource();source.buffer=this.buffer;source.loop=true;source.connect(this.processor);
  this.position=((this.position%this.buffer.duration)+this.buffer.duration)%this.buffer.duration;
  source.start(0,this.position);this.startTime=this.context.currentTime-this.position;this.source=source;
 }
 _pauseTransport(){
  this.stopRecording();
  if(this.playing&&this.buffer&&this.sourceKind!=='live'&&this.context)this.position=(this.context.currentTime-this.startTime)%this.buffer.duration;
  this.playing=false;this.detachSource();this.stopStream();this.send();this.emit('transport',false);
 }
 pause(){this._nextIntent();this.loading=false;this._pauseTransport();}
 _resetTransport(){this._pauseTransport();this.position=0;this.processor?.port.postMessage({type:'reset'});}
 reset(){this._nextIntent();this.loading=false;this._resetTransport();}
 detachSource(){
  const source=this.source;this.source=null;if(!source)return;
  try{source.stop?.();}catch{}
  try{source.disconnect();}catch{}
 }
 stopStream(){const stream=this.stream;this.stream=null;for(const track of stream?.getTracks()??[])track.stop();}
 async loadFile(file,state=this.state){
  if(!file)return false;
  if(file.size>150*1024*1024)throw new Error('Bitte eine Audiodatei unter 150 MB wählen.');
  const token=this._nextIntent(state);this.loading=true;
  try{
   await this.init(state);if(!this._current(token))return false;
   const context=this.context,data=await file.arrayBuffer();if(!this._current(token,context))return false;
   const buffer=await context.decodeAudioData(data);if(!this._current(token,context))return false;
   if(!Number.isFinite(buffer.duration)||buffer.duration<=0)throw new Error('Die Audiodatei enthält keinen abspielbaren Ton.');
   if(buffer.duration>600)throw new Error('Bitte einen Loop unter 10 Minuten wählen.');
   this._resetTransport();this.buffer=buffer;this.sourceKind='file';this.sourceName=file.name;
   this.emit('source',{name:file.name,duration:buffer.duration,channels:buffer.numberOfChannels,sampleRate:buffer.sampleRate});return true;
  }catch(error){if(token!==this._intent)return false;throw error;}
  finally{if(token===this._intent)this.loading=false;}
 }
 async demo(state=this.state){
  const token=this._nextIntent(state);this.loading=true;
  try{
   await this.init(state);if(!this._current(token))return false;
   const buffer=this.generateDemo();this._resetTransport();this.buffer=buffer;this.sourceKind='demo';this.sourceName='FACTORY LOOP / 120 BPM';
   this.emit('source',{name:this.sourceName,duration:buffer.duration,channels:2,sampleRate:buffer.sampleRate});return true;
  }finally{if(token===this._intent)this.loading=false;}
 }
 async live(deviceId,state=this.state){
  const token=this._nextIntent(state);this.loading=true;
  try{
   await this.init(state);if(!this._current(token))return false;
   this._resetTransport();if(!await this._connectLive(deviceId,token))return false;
   this.sourceKind='live';this.deviceId=deviceId;this.buffer=null;this.playing=true;this.send();this.emit('transport',true);return true;
  }catch(error){if(token===this._intent){this.playing=false;this.send();this.emit('transport',false);}throw error;}
  finally{if(token===this._intent)this.loading=false;}
 }
 async _connectLive(deviceId,token){
  if(!navigator.mediaDevices?.getUserMedia)throw new Error('Dieser Browser stellt keinen Audio-Eingang bereit.');
  let stream;
  try{
   stream=await navigator.mediaDevices.getUserMedia({audio:{deviceId:deviceId?{exact:deviceId}:undefined,echoCancellation:false,noiseSuppression:false,autoGainControl:false,channelCount:2}});
   if(!this._current(token)||!this.processor){for(const track of stream.getTracks())track.stop();return false;}
   const source=this.context.createMediaStreamSource(stream);source.connect(this.processor);this.stream=stream;this.source=source;this.sourceKind='live';this.deviceId=deviceId;this.buffer=null;
   this.sourceName=stream.getAudioTracks()[0]?.label||'LIVE AUDIO INPUT';this.emit('source',{name:this.sourceName,live:true});return true;
  }catch(error){
   if(stream&&stream!==this.stream)for(const track of stream.getTracks())track.stop();
   if(token!==this._intent)return false;
   throw new Error(error.name==='NotAllowedError'?'Audio-Eingang wurde nicht freigegeben. Erlaube den Mikrofonzugriff im Browser.':`Audio-Eingang nicht verfügbar: ${error.message}`);
  }
 }
 async connectLive(deviceId){return this.live(deviceId,this.state);}
 async devices(){if(!navigator.mediaDevices?.enumerateDevices)return [];return(await navigator.mediaDevices.enumerateDevices()).filter(device=>device.kind==='audioinput');}
 setVolume(value){this.monitor=Math.max(0,Math.min(1,Number.isFinite(+value)?+value:0));if(this.context?.state!=='closed')this.output?.gain.setTargetAtTime(this.monitor,this.context.currentTime,.015);}
 async record(state=this.state){
  if(this.recording)return true;if(this._recordPromise)return this._recordPromise;
  const intent=this._intent;
  const promise=(async()=>{
   await this._recordStopPromise;
   if(intent!==this._intent)return false;
   if(!this.playing&&!await this.play(state))return false;
   if(!this.playing||!this.processor)return false;
   this.recordChunks=[];this.recording=true;this.recordSampleRate=this.context.sampleRate;this.recordStarted=performance.now();
   this.processor.port.postMessage({type:'record',active:true});this.emit('record',true);return true;
  })();this._recordPromise=promise;
  try{return await promise;}finally{if(this._recordPromise===promise)this._recordPromise=null;}
 }
 stopRecording(){
  if(!this.recording)return this._recordStopPromise??Promise.resolve();
  this.recording=false;this._recordStopPromise=new Promise(resolve=>{this._recordStopResolve=resolve;});
  const completed=this._recordStopPromise;
  this.processor?.port.postMessage({type:'record',active:false});this.emit('record',false);
  if(!this.processor)this.finishRecording();return completed;
 }
 finishRecording(){
  if(this.recording){this.recording=false;this.emit('record',false);}
  const chunks=this.recordChunks;this.recordChunks=[];
  const count=chunks.reduce((total,chunk)=>total+chunk.length,0),sampleRate=this.recordSampleRate??this.context?.sampleRate??48000;
  if(count){
   const view=new DataView(new ArrayBuffer(44+count*2)),text=(offset,value)=>{for(let i=0;i<value.length;i++)view.setUint8(offset+i,value.charCodeAt(i));};
   text(0,'RIFF');view.setUint32(4,36+count*2,true);text(8,'WAVEfmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,2,true);
   view.setUint32(24,sampleRate,true);view.setUint32(28,sampleRate*4,true);view.setUint16(32,4,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,count*2,true);
   let offset=44;for(const chunk of chunks)for(const value of chunk){const sample=Number.isFinite(value)?Math.max(-1,Math.min(1,value)):0;view.setInt16(offset,Math.round(sample*(sample<0?32768:32767)),true);offset+=2;}
   this.emit('recorded',{blob:new Blob([view.buffer],{type:'audio/wav'}),duration:count/2/sampleRate});
  }
  const resolve=this._recordStopResolve;this._recordStopResolve=null;this._recordStopPromise=null;resolve?.();
 }
 close(){
  if(this._closePromise)return this._closePromise;
  const context=this.context;this.pause();
  const promise=Promise.resolve().then(async()=>{
   if(this._recordStopPromise)await Promise.race([this._recordStopPromise,new Promise(resolve=>setTimeout(resolve,500))]);
   this.finishRecording();if(context&&context.state!=='closed')await context.close();
   if(this.context===context){this.context=null;this.processor=null;this.analyser=null;this.output=null;this._initPromise=null;}
  }).finally(()=>{if(this._closePromise===promise)this._closePromise=null;});
  this._closePromise=promise;return promise;
 }
 get currentPosition(){return this.playing&&this.buffer&&this.sourceKind!=='live'?(this.context.currentTime-this.startTime)%this.buffer.duration:this.position;}
 generateDemo(){const sr=this.context.sampleRate,dur=8,n=sr*dur,b=this.context.createBuffer(2,n,sr);let seed=519;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296*2-1;};const notes=[36,36,43,39,36,46,43,34,36,36,43,48,39,43,34,31];const melody=[60,67,70,74,67,63,58,67];for(let i=0;i<n;i++){const t=i/sr,beat=t*2,bi=Math.floor(beat),q=beat-bi,step=Math.floor(beat*4),sub=beat*4-step;let kick=Math.sin(2*Math.PI*(43*t+8*(1-Math.exp(-q*25))))*Math.exp(-q*12)*.48;const snare=bi%4===2?(rnd()*.55+Math.sin(t*2*Math.PI*180)*.2)*Math.exp(-q*19):0;const hat=rnd()*Math.exp(-sub*24)*(.055+(step%4===2?.07:0));const f=440*2**((notes[bi%16]-69)/12);let bass=(Math.sin(2*Math.PI*f*t)+.2*Math.sin(2*Math.PI*f*2*t))*Math.exp(-q*5)*.19;const mi=Math.floor(beat*2),mp=beat*2-mi,mf=440*2**((melody[mi%8]-69)/12),pluck=(Math.sin(2*Math.PI*mf*t)+.18*Math.sin(2*Math.PI*mf*3*t))*Math.exp(-mp*6)*.1;const pan=Math.sin(mi*1.7)*.4;b.getChannelData(0)[i]=kick+snare+hat+bass+pluck*(1-pan);b.getChannelData(1)[i]=kick+snare+hat+bass+pluck*(1+pan);}return b;}
}


