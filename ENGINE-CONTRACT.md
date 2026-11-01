# DA DESTRUCTOR engine contract

Independent original Web Audio interpretation of supplied functional research. All JS uses ESM (.mjs), no runtime dependencies.

State sent to worklet `{type:'state', state}`. Complete state:
```
{bpm:120, playing:true, bypass:false,
 time:{order:'stretch-vari-stutter',stretch:{on:false,speed:1,tempo:.5,grain:.4,pitch:.5,spread:.2,scatter:0,mix:1,reverse:false,freeze:false,linked:false},vari:{on:false,speed:1,tempo:.5,mode:0,wow:0,saturation:0,compress:0,mix:1,stop:false,scratch:.5,model:0},stutter:{on:false,bend:false,sync:true,rate:.45,capture:.5,pitch:.5,ramp:.5,gate:.15,decay:0,pan:0,probability:1,retrigger:0,smooth:.3,mix:1,reverse:false,freeze:false,warp:0,break:0,reps:.2,width:0,duck:.5}},
 fx:[],fxMode:'serial',
 main:{gain:.5,low:.5,mid:.5,high:.5,pan:.5,mix:1,compress:0},
 mods:[{type:'lfo',shape:'sine',rate:.4,depth:1,smooth:.1,targets:[]}],
 graphs:[{points:[[0,0],[.5,1],[1,0]],rate:.4,targets:[]}],
 macros:[{value:0,targets:[]}],xy:{x:.5,y:.5,targetsX:[],targetsY:[]},
 seq:{stutter:{on:false,rate:.5,patterns:1,steps:Array(64).fill({on:true,value:.5})},stretch:{on:false,rate:.5,patterns:1,steps:...}}
}
```
All numeric control values normalized 0..1; enumerated selects can be strings except time mode/model above. Target `{path:'time.stretch.speed',min:0,max:1,start:0,end:1,skew:0}`. FX paths `fx.<instance id>.<param key>`; use FX object id lookup. Mod paths `mods.0.rate`. Main gain .5 =0dB (range -24..+24). EQ .5=0dB +/-15. time pitch .5=0st +/-12. FX item `{id:'fx-1',type:'TAPE',on:true,mix:.5,gain:.5,params:{...}}`.

## Module contracts

`time-core.mjs`: `export class TimeRack { constructor(sampleRate); reset(); process(left,right,time,frame,bpm); }` returns reusable [L,R], accepts normalized state. No DOM. Per-sample call, do not allocate arrays in hot path.

`effects.mjs`: `export const EFFECTS = [{id:'TAPE',name:'TAPE',category:'DISTORTION',description:'German...',params:[{key:'drive',label:'TAPE',default:.3,min:0,max:1,unit:'%',...}]}]` all params normalized, optional `format` string ('percent','hz','db','semitone','seconds','bits') and `options:[...]`. `export const CATEGORIES`. No dependencies. Exactly the 62 original function names as effect types, UI product name original.

`fx-core.mjs`: `export class EffectRack {constructor(sampleRate);configure(fx,mode);reset();process(left,right,frame,bpm);}` returns reusable [L,R], per sample. configure only on state updates; fx items by reference, updates to their `.params` and `.mix` immediately affect sound. `.gain` normalized .5=0 dB +/-12. Apply smooth on/bypass fades. Include own STFT framework for real spectral processing if feasible; disclose approximations in docs.

`modulation.mjs`: modulation/sequencer helpers owned by worklet agent. Worklet loads modules relative with import.

`audio-worklet.mjs`: processor name `destructor-processor`, input stereo output stereo. On state message sanitize and configure. Commands `{type:'reset'}` resets all state and tails, `{type:'transport',playing:boolean}` optional. Sends meter `{type:'meter', peakL,peakR,rms,beat,step,mods:[...],graphs:[...]}` approx 25Hz. Worklet has no sample source: browser feeds AudioBufferSource or MediaStreamAudioSource. Internal clock increments only when playing. Message `{type:'error',message}` on recoverable setup error. Smooth main/master/bypass and guard finite output. Hard output limiting <=1. Prefer transparent clean path when all processing off.

Tests belong `tests/`, generated output `test-results/` gitignored. Root UI and host are owned by primary agent. Agents coordinate module changes directly and report actual limitations.
