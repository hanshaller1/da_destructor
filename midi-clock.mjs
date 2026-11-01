// MIDI tempo/transport follower. Access is requested only by an explicit enable().
const clampTempo=value=>Math.max(30,Math.min(300,value));
export class MidiClock extends EventTarget {
 constructor({navigator=globalThis.navigator,now=()=>performance.now()}={}){
  super();this.navigator=navigator;this.now=now;this.access=null;this.input=null;this.selectedId='';this.playing=false;this.bpm=120;this.pulses=0;
  this.intervals=new Float64Array(24);this.intervalCount=0;this.intervalWrite=0;this.intervalSum=0;this.lastPulse=NaN;
  this._enablePromise=null;this._generation=0;this._message=event=>this.receive(event.data,event.timeStamp??this.now());this._stateChange=()=>this._refreshInputs();
 }
 get supported(){return typeof this.navigator?.requestMIDIAccess==='function';}
 get enabled(){return !!this.access;}
 get inputs(){return Array.from(this.access?.inputs?.values()??[]).filter(input=>input.state!=='disconnected').map(input=>({id:input.id,name:input.name||'MIDI input',manufacturer:input.manufacturer||''}));}
 _emit(type,detail){this.dispatchEvent(new CustomEvent(type,{detail}));}
 _payload(kind,restart=false){return {bpm:this.bpm,playing:this.playing,restart,kind,pulses:this.pulses,beat:this.pulses/24,timestamp:this.eventTime??this.now()};}
 _transport(kind,restart=false){const detail=this._payload(kind,restart);this._emit('transport',detail);this._emit('clock',detail);}
 async enable(){
  if(this.access)return true;if(this._enablePromise)return this._enablePromise;
  if(!this.supported)throw new Error('Dieser Browser unterstützt Web MIDI nicht. Verwende einen Browser mit Web-MIDI-Unterstützung.');
  const generation=this._generation;
  const promise=(async()=>{
   await Promise.resolve();
   try{
    const access=await this.navigator.requestMIDIAccess({sysex:false});if(generation!==this._generation)return false;
    this.access=access;access.addEventListener?.('statechange',this._stateChange);
    if(!access.addEventListener)access.onstatechange=this._stateChange;
    this._refreshInputs();return true;
   }catch(error){
    if(generation!==this._generation)return false;
    throw new Error(error?.name==='NotAllowedError'||error?.name==='SecurityError'?'MIDI-Zugriff wurde nicht freigegeben. Erlaube MIDI im Browser.':`MIDI konnte nicht geöffnet werden: ${error?.message??error}`);
   }finally{if(this._enablePromise===promise)this._enablePromise=null;}
  })();this._enablePromise=promise;return promise;
 }
 selectInput(id){
  const selected=String(id??'');
  if(!selected){this.disconnect();return null;}
  if(!this.access)throw new Error('MIDI zuerst mit ENABLE MIDI freigeben.');
  const input=this.access.inputs.get(selected);
  if(!input||input.state==='disconnected')throw new Error('Dieser MIDI-Eingang ist nicht verbunden.');
  if(this.input===input)return this.inputs.find(item=>item.id===selected);
  const wasPlaying=this.playing;this._detach();this.selectedId=selected;this.input=input;
  if(input.addEventListener)input.addEventListener('midimessage',this._message);else input.onmidimessage=this._message;
  this.playing=false;this._resetTiming();if(wasPlaying)this._transport('input');this._emit('input',this.inputs.find(item=>item.id===selected));
  return this.inputs.find(item=>item.id===selected);
 }
 _detach(){
  if(this.input?.removeEventListener)this.input.removeEventListener('midimessage',this._message);
  else if(this.input?.onmidimessage===this._message)this.input.onmidimessage=null;
  this.input=null;
 }
 _refreshInputs(){
  const selected=this.selectedId,connected=this.access?.inputs.get(selected);
  if(this.input&&(!connected||connected.state==='disconnected')){
   this._detach();this.playing=false;this._resetTiming();this._transport('disconnect');
  }else if(!this.input&&selected&&connected&&connected.state!=='disconnected')this.selectInput(selected);
  this._emit('inputs',this.inputs);
 }
 _resetTiming(){this.intervals.fill(0);this.intervalCount=0;this.intervalWrite=0;this.intervalSum=0;this.lastPulse=NaN;}
 disconnect(){const hadInput=!!this.input||!!this.selectedId;this._detach();this.selectedId='';this.playing=false;this._resetTiming();if(hadInput)this._transport('disconnect');this._emit('input',null);}
 disable(){
  this._generation++;this.disconnect();
  this.access?.removeEventListener?.('statechange',this._stateChange);
  if(this.access?.onstatechange===this._stateChange)this.access.onstatechange=null;
  this.access=null;this._emit('inputs',[]);
 }
 receive(data,timestamp=this.now()){
  if(!data||!Number.isFinite(timestamp))return;
  this.eventTime=timestamp;
  for(const status of data){
   if(status===0xF2){this.sppPending=2;this.sppValue=0;this.sppShift=0;}
   else if(status<0x80&&this.sppPending){this.sppValue|=status<<this.sppShift;this.sppShift+=7;if(--this.sppPending===0){this.pulses=this.sppValue*6;this._emit('clock',this._payload('position'));}}
   else if(status===0xFA){this.playing=true;this.pulses=0;this._resetTiming();this._transport('start',true);}
   else if(status===0xFB){this.playing=true;this.lastPulse=NaN;this._transport('continue');}
   else if(status===0xFC){this.playing=false;this._transport('stop');}
   else if(status===0xF8){
    this.pulses++;
    if(Number.isFinite(this.lastPulse)){
     const interval=timestamp-this.lastPulse;
     // Discard discontinuities (sleep, reconnect, non-monotonic event timestamps).
     if(interval>0&&interval<250){
      if(this.intervalCount===24)this.intervalSum-=this.intervals[this.intervalWrite];else this.intervalCount++;
      this.intervals[this.intervalWrite]=interval;this.intervalSum+=interval;this.intervalWrite=(this.intervalWrite+1)%24;
      if(this.intervalCount>=3)this.bpm=Math.round(clampTempo(60000*this.intervalCount/(24*this.intervalSum))*100)/100;
     }else if(interval>=250||interval<0)this._resetTiming();
    }
    this.lastPulse=timestamp;
    // Up to20Hz at300BPM, rather than sending a full DSP state per MIDI byte.
    if(this.pulses%6===0)this._emit('clock',this._payload('pulse'));
   }
  }
 }
}
