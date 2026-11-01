// Browser gesture recorder; playback is sample-clocked inside the AudioWorklet.
const clamp=v=>Math.max(0,Math.min(1,Number.isFinite(+v)?+v:0));
export class GestureRecorder {
 constructor({maxEvents=50000,maxDuration=600}={}){this.maxEvents=maxEvents;this.maxDuration=maxDuration;this.active=false;this.events=[];this.initial=new Map();this.lastValues=new Map();this.seen=new Set();this.duration=0;}
 start(time,initialValues={}){this.active=true;this.started=Number(time)||0;this.events=[];this.duration=0;this.seen.clear();this.initial=new Map(Object.entries(initialValues));this.lastValues=new Map(Object.entries(initialValues));}
 capture(path,value,time,eventKind){
  const boolean=typeof value==='boolean';
  if(!this.active||typeof path!=='string'||!boolean&&!Number.isFinite(value))return false;
  const t=Math.max(0,Math.min(this.maxDuration,(Number(time)||0)-this.started));
  if(this.lastValues.has(path)&&+this.lastValues.get(path)===+value)return false;this.lastValues.set(path,value);
  const kind=boolean?{kind:'boolean'}:['enum','integer'].includes(eventKind)?{kind:eventKind}:{};
  if(!this.seen.has(path)){this.seen.add(path);this.events.push({time:0,path,value:clamp(this.initial.get(path)??value),...kind});}
  const last=this.events.at(-1),event={time:Math.round(t*1e6)/1e6,path,value:clamp(value),...kind};
  if(last?.path===path&&last.time>0&&event.time-last.time<.012)this.events[this.events.length-1]=event;
  else if(this.events.length<this.maxEvents)this.events.push(event);
  this.duration=Math.max(this.duration,t);
  if(t>=this.maxDuration||this.events.length>=this.maxEvents)this.active=false;
  return true;
 }
 stop(time){if(this.active)this.duration=Math.max(this.duration,Math.min(this.maxDuration,(Number(time)||0)-this.started));this.active=false;this.events.sort((a,b)=>a.time-b.time);return {duration:Math.max(.01,this.duration),loop:true,events:this.events.map(e=>({...e}))};}
}
