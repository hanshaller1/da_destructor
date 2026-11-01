// All ranges are normalized. The catalog describes our own DSP, not the original plugin.
const p=(key,label,value=.5,format='percent',options)=>({key,label,default:value,min:0,max:1,format,...(options?{options}:{})});
const e=(id,category,description,params)=>({id,name:id,category,description,params});
export const CATEGORIES=['DISTORTION','FILTER','SPECTRAL','PITCH','RESONATOR','GRANULAR','MODULATION','DELAY','REVERB','DYNAMICS'];
export const EFFECTS=[
e('BITROT','DISTORTION','Bittiefe und Samplerate zerfallen in ein digitales Raster.',[p('bits','BITS',.62,'bits'),p('rate','RATE',.25),p('drive','DRIVE',.2),p('dither','DITHER',0),p('jitter','JITTER',0),p('smooth','SMOOTH',.15)]),
e('CIRCUIT BEND','DISTORTION','Speicherfehler, blockierte Leseköpfe und ausfallende Taktung.',[p('corrupt','CORRUPT',.25),p('shift','SHIFT',.2),p('stall','STALL',.3),p('rate','RATE',.4),p('bus','BUS',.5,'percent',['16 BIT','8 BIT','4 BIT']),p('clock','CLOCK',.2)]),
e('DISTORT','DISTORTION','Zwölf nichtlineare Kennlinien mit begrenztem Frequenzband.',[p('drive','DRIVE',.3),p('bias','BIAS',.5),p('model','MODEL',0,'percent',['CLIP','TANH','SINE','FOLD','RECTIFY','ASYMMETRIC','CUBIC','ATAN','WRAP','DIODE','FUZZ','SIGMOID']),p('lowcut','LOW CUT',0),p('highcut','HIGH CUT',1)]),
e('PLASMA','DISTORTION','Hysteretischer Waveshaper mit chaotisch flackernder Amplitude.',[p('drive','DRIVE',.4),p('arc','ARC',.4),p('freq','FREQ',.35,'hz'),p('hold','HOLD',.2),p('chaos','CHAOS',.3)]),
e('WAVEFOLDER','DISTORTION','Faltet die Wellenform mehrfach um variable Grenzen.',[p('drive','DRIVE',.35),p('folds','FOLDS',.3),p('shape','SHAPE',.5),p('bias','BIAS',.5),p('model','MODEL',0,'percent',['FOLD','259','SERGE','LOCK','WRAP'])]),
e('EXCITE','DISTORTION','Parallele Obertöne und ein separat angeregter Bassbereich.',[p('drive','DRIVE',.3),p('tone','TONE',.6,'hz'),p('attack','ATTACK',.15),p('release','RELEASE',.3),p('sub','SUB',.2)]),
e('HOWL','DISTORTION','Zwei gestimmte, begrenzte Feedbackschleifen.',[p('note','NOTE',.35,'hz'),p('regen','REGEN',.55),p('color','COLOR',.5),p('bite','BITE',.2),p('drift','DRIFT',.1),p('damp','DAMP',.3),p('couple','COUPLE',.15)]),
e('LOSSY','DISTORTION','Spektrale Codec-Näherung mit Quantisierung und Paketverlust.',[p('bitrate','BITRATE',.35),p('speed','SPEED',.4),p('packet','PACKET',.1),p('repeat','REPEAT',.25),p('artifact','ARTFCT',.3),p('jitter','JITTER',.15),p('tone','TONE',.6)]),
e('MIRROR','DISTORTION','Sinus-Folder mit gepitchten Feedbackspuren.',[p('fold','FOLD',.35),p('shape','SHAPE',.5),p('feedback','FDBK',.3),p('trail','TRAIL',.75,'semitone')]),
e('TAPE','DISTORTION','Sättigung, Hysterese, Bandschwankung und alternde Höhen.',[p('drive','TAPE',.3),p('dull','DULL',.2),p('wow','WOW',.15),p('flutter','FLUTTER',.1),p('noise','NOISE',0),p('age','AGE',.2),p('dropout','DROPOUT',0)]),
e('UNDERTOW','DISTORTION','Nulldurchgangszähler erzeugt tonfolgende Subharmonische.',[p('divide','DIVIDE',.2),p('misfire','MISFIRE',.05),p('tone','TONE',.4),p('level','LEVEL',.35),p('blend','BLEND',.3)]),
e('EQ','FILTER','Biquad-Equalizer mit fünf Filterformen.',[p('mode','MODE',.5,'percent',['HIGH PASS','LOW SHELF','BELL','HIGH SHELF','LOW PASS']),p('freq','FREQ',.5,'hz'),p('gain','GAIN',.65,'db'),p('q','Q',.25),p('drive','DRIVE',0)]),
e('PRISM','FILTER','Nichtlineares Multimode-Filter mit Resonanz und Audio-FM.',[p('cutoff','CUTOFF',.65,'hz'),p('res','RES',.25),p('drive','DRIVE',.15),p('mode','MODE',0,'percent',['LOW PASS','BAND PASS','HIGH PASS','NOTCH']),p('slope','SLOPE',.5),p('fm','FM',0),p('drift','DRIFT',.05)]),
e('TOOTH','FILTER','Drei versetzt gestimmte Kämme mit gedämpfter Rückkopplung.',[p('freq','FREQ',.4,'hz'),p('offset1','OFF 1',.4),p('offset2','OFF 2',.65),p('feedback','FB',.45),p('tone','TONE',.6),p('pluck','PLUCK',0),p('damp','DAMP',.3)]),
e('COMB','FILTER','Feedforward-Kamm mit bipolarer Rückkopplung.',[p('freq','FREQ',.45,'hz'),p('feedback','FB',.65),p('polarity','POLARITY',0,'percent',['+','−']),p('damp','DAMP',.3)]),
e('FORMANT','FILTER','Fünf parallele Vokalresonanzen zwischen A, E, I, O und U.',[p('vowel','VOWEL',.2),p('q','Q',.55),p('shift','SHIFT',.5),p('spread','SPREAD',.5),p('voice','VOICE',0,'percent',['MALE','FEMALE','CHILD','ROBOT','ALIEN']),p('seq','SEQ',0),p('glide','GLIDE',.3)]),
e('SIEVE','SPECTRAL','Ein mathematisches Sieb schaltet einzelne FFT-Bänder frei.',[p('pattern','PATTERN',0,'percent',['PRIME','FIB','POW 2','ODD','EVEN','KEY','CHORD']),p('ratio','RATIO',.4),p('smooth','SMOOTH',.3),p('rate','RATE',.4)]),
e('CHROMA','SPECTRAL','Frequenzabhängige Neigung, Fokus und spektraler Warp.',[p('tilt','TILT',.5),p('center','CENTER',.5,'hz'),p('width','WIDTH',.5),p('gain','GAIN',.65),p('warp','WARP',.5),p('gate','GATE',.05),p('scan','SCAN',.1)]),
e('CONTRAST','SPECTRAL','Betont starke, mittlere oder schwache spektrale Anteile.',[p('strong','STRONG',.6),p('medium','MEDIUM',.45),p('weak','WEAK',.25),p('low','LOW',.05),p('high','HIGH',.95),p('sustain','SUSTAIN',.3),p('smooth','SMOOTH',.4)]),
e('LIQUIFY','FILTER','Eine verteilte Allpass-Kaskade verwischt Transienten.',[p('amount','AMOUNT',.45),p('focus','FOCUS',.5,'hz'),p('reso','RESO',.35),p('spread','SPREAD',.5),p('drive','DRIVE',.1),p('trail','TRAIL',.2)]),
e('SEPARATE','SPECTRAL','FFT-basierte Näherung für tonale, rauschende und impulsive Anteile.',[p('tonal','TONAL',.7),p('noise','NOISE',.35),p('hits','HITS',.5),p('pitch','PITCH',.5,'semitone'),p('spread','SPREAD',.3),p('tight','TIGHT',.3)]),
e('SMEAR','SPECTRAL','Verwischt FFT-Bänder, streut Phasen und hält Spektren fest.',[p('smear','SMEAR',.45),p('tilt','TILT',.5),p('feedback','FB',.3),p('diff','DIFF',.3),p('direction','DIRECTION',.5,'percent',['DOWN','BOTH','UP']),p('hold','HOLD',0)]),
e('TRANSMIT','FILTER','Bandbegrenzter Funkkanal mit Rauschen und Empfangslücken.',[p('freq','FREQ',.5,'hz'),p('width','WIDTH',.3),p('drive','DRIVE',.2),p('noise','NOISE',.1),p('squelch','SQUELCH',.1),p('dropout','DROPOUT',.1),p('dial','DIAL',.5)]),
e('VESPER','FILTER','Modulierte Allpass-Notches mit drei gegeneinander laufenden Phasen.',[p('freq','FREQ',.45,'hz'),p('spread','SPREAD',.55),p('time','TIME',.3),p('sections','SECTIONS',.5),p('feedback','FDBK',.35),p('rate','RATE',.25),p('env','ENV',.2)]),
e('PITCH SHIFT','PITCH','Zwei überlappende Verzögerungsgrains verschieben die Tonhöhe.',[p('pitch','PITCH',.65,'semitone'),p('fine','FINE',.5),p('spread','SPREAD',.2),p('delay','DELAY',.1),p('feedback','FDBK',.1),p('spray','SPRAY',.05),p('mode','MODE',0,'percent',['PITCH','FREQUENCY','RING'])]),
e('FORMANT SHIFT','SPECTRAL','Verschiebt die geglättete Spektralhülle bei erhaltener Bin-Phase.',[p('shift','SHIFT',.65),p('detail','DETAIL',.5),p('smooth','SMOOTH',.4)]),
e('SCATTER','GRANULAR','Vier versetzte Grains verteilen die Audiohistorie im Stereofeld.',[p('pitch','PITCH',.5,'semitone'),p('size','SIZE',.4),p('density','DENSITY',.5),p('scatter','SCATTER',.4),p('reverse','REVERSE',.2),p('freeze','FREEZE',0),p('spread','SPREAD',.7)]),
e('MAGNET','SPECTRAL','Zieht FFT-Energie zu temperierten oder diatonischen Tonhöhen.',[p('attract','ATTRACT',.65),p('glide','GLIDE',.3),p('focus','FOCUS',.5),p('drift','DRIFT',.1),p('field','FIELD',0,'percent',['CHROMATIC','MAJOR','MINOR','PENTATONIC'])]),
e('STILLS','SPECTRAL','Hält spektrale Snapshots in einer phasenfortlaufenden Oszillatorbank.',[p('slice','SLICE',.4),p('blur','BLUR',.3),p('voices','VOICES',.5),p('wave','WAVE',0),p('tension','TENSION',.3),p('octave','OCTAVE',.5),p('feedback','FDBK',.2)]),
e('TRIAD','PITCH','Drei verzögerte Stimmen bilden mikroverstimmte Harmonien.',[p('voice1','V1',.5,'semitone'),p('voice2','V2',.65,'semitone'),p('voice3','V3',.8,'semitone'),p('stagger','STAGGER',.2),p('feedback','FDBK',.15),p('loose','LOOSE',.1),p('micro','MICRO',.1)]),
e('WARP','SPECTRAL','Ordnet Frequenzbänder um einen veränderbaren Drehpunkt neu an.',[p('pivot','PIVOT',.45),p('curve','CURVE',0,'percent',['POWER','LINEAR','MIRROR','FOLD']),p('stretch','STRETCH',.65),p('tilt','TILT',.5),p('glide','GLIDE',.3)]),
e('CRYSTAL','RESONATOR','Zwölf harmonische Resonanzen mit wandernder Skalenanregung.',[p('root','ROOT',.35,'hz'),p('focus','FOCUS',.6),p('bloom','BLOOM',.65),p('skew','SKEW',.1),p('wander','WANDER',.15),p('color','COLOR',.6),p('spread','SPREAD',.7)]),
e('FREQ SHIFT','PITCH','Quadratur-Allpassnetzwerk für unabhängige Frequenzverschiebung.',[p('shiftl','SHIFT L',.55),p('shiftr','SHIFT R',.45),p('time','TIME',.1),p('feedback','FDBK',.15),p('snap','SNAP',0)]),
e('MODAL','RESONATOR','Vierundzwanzig gedämpfte Moden von Holz bis Metall.',[p('tune','TUNE',.4,'hz'),p('decay','DECAY',.55),p('material','MATERIAL',.6),p('position','POSITION',.35),p('bright','BRIGHT',.6),p('stretch','STRETCH',.25),p('bow','BOW',0)]),
e('STRINGS','RESONATOR','Sechs gekoppelte, gedämpfte Saitenresonanzen.',[p('strings','STRINGS',.6),p('octave','OCTAVE',.5),p('damp','DAMP',.3),p('bright','BRIGHT',.6),p('couple','COUPLE',.2),p('bow','BOW',.1),p('position','POSITION',.4)]),
e('CHOPPER','GRANULAR','Taktbezogene Slices mit Shuffle, Ratchets und Reverse.',[p('size','SIZE',.5),p('division','DIVISION',.4),p('shuffle','SHUFFLE',.3),p('repeat','REPEAT',.2),p('pitch','PITCH',.5,'semitone'),p('reverse','REVERSE',.2),p('gate','GATE',.2)]),
e('LOOP','GRANULAR','Akkumulierender Mehrkopf-Looper mit Overdub.',[p('length','LENGTH',.4),p('speed','SPEED',.75),p('heads','HEADS',.3),p('overdub','OVERDUB',.4),p('modify','MODIFY',.2),p('scan','SCAN',.3)]),
e('SCANNER','GRANULAR','Zwei Grains durchfahren eine gehaltene Aufnahme.',[p('scan','SCAN',.5),p('size','SIZE',.4),p('shape','SHAPE',.5),p('transient','TRANSIENT',.2),p('duck','DUCK',.5),p('pitch','PITCH',.5,'semitone'),p('spray','SPRAY',.1)]),
e('STRUM','GRANULAR','Wiederholt rhythmisch geordnete Fragmente aus der Historie.',[p('slots','SLOTS',.4),p('rate','RATE',.4),p('pattern','PATTERN',0,'percent',['FWD','REV','SHUF','RANK','EUCL']),p('pitch','PITCH',.5,'semitone'),p('decay','DECAY',.3),p('sense','SENSE',.35),p('width','WIDTH',.6)]),
e('WENDY','GRANULAR','Gespeicherte Stereofragmente rutschen aus dem Zeitraster.',[p('span','SPAN',.5),p('cuts','CUTS',.35),p('slip','SLIP',.3),p('seek','SEEK',.4),p('wear','WEAR',.15),p('edge','EDGE',.3),p('width','WIDTH',.6)]),
e('CHORUS','MODULATION','Vier modulierte Delay-Stimmen verbreitern das Signal.',[p('rate','RATE',.3),p('depth','DEPTH',.5),p('time','TIME',.3),p('feedback','FDBK',.1),p('width','WIDTH',.7),p('mode','MODE',0,'percent',['CLASSIC','DIM D','JUNO'])]),
e('ENSEMBLE','MODULATION','Zwei unabhängige Modulationsraten bewegen sechs Delay-Taps.',[p('type','TYPE',.3,'percent',['JUNO','SOLINA','DIMENSION','LUSH']),p('rate1','RATE 1',.25),p('rate2','RATE 2',.6),p('depth','DEPTH',.5),p('feedback','FDBK',.15),p('width','WIDTH',.8)]),
e('FLANGER','MODULATION','Kurzes variables Delay mit bipolarer Rückkopplung.',[p('rate','RATE',.25),p('depth','DEPTH',.6),p('feedback','FDBK',.65),p('delay','DELAY',.25),p('tzf','TZF',0),p('barber','BARBER',0,'percent',['OFF','RISE','FALL'])]),
e('PHASER','MODULATION','Zwei bis zwölf modulierte Allpass-Stufen.',[p('rate','RATE',.3),p('depth','DEPTH',.6),p('feedback','FDBK',.3),p('center','CENTER',.5),p('stages','STAGES',.6),p('barber','BARBER',0,'percent',['OFF','RISE','FALL'])]),
e('FISSION','MODULATION','Audiomodulierte Delayzeit erzeugt FM-Seitenbänder.',[p('frequency','FREQUENCY',.35,'hz'),p('bite','BITE',.3),p('depth','DEPTH',.4),p('spread','SPREAD',.5),p('feedback','FEEDBACK',.2),p('skew','SKEW',.5),p('chaos','CHAOS',.1)]),
e('FLYBY','MODULATION','Doppler-Delay und Stereo-Orbit simulieren Bewegung.',[p('path','PATH',0,'percent',['ORBIT','PASS','FIG-8','BOUNCE','RANDOM','ROTOR']),p('speed','SPEED',.25),p('distance','DISTANCE',.4),p('depth','DEPTH',.5),p('air','AIR',.4),p('width','WIDTH',.8)]),
e('CLANG','MODULATION','Ringmodulation zwischen sinusförmigem und hartem Träger.',[p('frequency','FREQUENCY',.4,'hz'),p('shape','SHAPE',.15),p('spread','SPREAD',.1),p('drive','DRIVE',.1)]),
e('ORBIT','MODULATION','Taktbezogener Autopanner mit variabler Bewegungsform.',[p('rate','RATE',.35),p('depth','DEPTH',.7),p('shape','SHAPE',.15),p('phase','PHASE',0)]),
e('TREMOR','MODULATION','Tremolo mit Stereoversatz und variabler Pulsbreite.',[p('rate','RATE',.45),p('depth','DEPTH',.7),p('shape','SHAPE',.3),p('width','WIDTH',.5),p('stereo','STEREO',.5)]),
e('SPIRAL','DELAY','Geclocktes Tape-Echo mit Ping-Pong und alternden Wiederholungen.',[p('time','TIME',.4),p('feedback','FDBK',.4),p('pingpong','PING PONG',.6),p('wobble','WOBBLE',.15),p('age','AGE',.25),p('duck','DUCK',.15),p('halo','HALO',.2)]),
e('GRANULAR DELAY','DELAY','Gepitchte Delay-Grains mit zufälliger Position.',[p('time','TIME',.45),p('spray','SPRAY',.2),p('pitch','PITCH',.75,'semitone'),p('feedback','FDBK',.35),p('reverse','REVERSE',.1),p('tone','TONE',.6),p('swing','SWING',.1)]),
e('REEL','DELAY','Vier Bandköpfe mit regelmäßiger oder irrationaler Verteilung.',[p('time','TIME',.45),p('spacing','SPACING',0,'percent',['EVEN','TRIP','GOLD','SILV']),p('heads','HEADS',.65),p('halo','HALO',.2),p('skew','SKEW',.5),p('feedback','FDBK',.4),p('age','AGE',.3)]),
e('SPECTRAL DELAY','SPECTRAL','Jeder FFT-Bin besitzt eine eigene Delay-Länge.',[p('time','TIME',.4),p('tilt','TILT',.5),p('feedback','FB',.35),p('blur','BLUR',.15),p('shift','SHIFT',.5,'semitone'),p('spread','SPREAD',.6),p('damp','DAMP',.3)]),
e('CADENCE','DELAY','Rhythmische Echoakzente in einer euklidischen Tap-Folge.',[p('time','TIME',.4),p('steps','STEPS',.5),p('pulses','PULSES',.4),p('feedback','FDBK',.35),p('swing','SWING',.1),p('tone','TONE',.6)]),
e('DRIP','REVERB','Dispersiver Federhall mit modulierter Allpass-Kette.',[p('size','SIZE',.4),p('decay','DECAY',.55),p('damp','DAMP',.4),p('ripple','RIPPLE',.3),p('crash','CRASH',.1),p('tension','TENSION',.5),p('pickup','PICKUP',.5)]),
e('DATTORRO','REVERB','Diffuser Plattenhall auf einem orthogonalen Feedbacknetzwerk.',[p('size','SIZE',.5),p('decay','DECAY',.6),p('diff','DIFF',.6),p('predelay','PDLY',.1),p('tone','TONE',.6),p('mod','MOD',.2),p('freeze','FREEZE',0)]),
e('AETHER','REVERB','Schwebender Hall mit oktaviertem Feedback.',[p('size','SIZE',.65),p('decay','DECAY',.7),p('shimmer','SHIMMER',.35),p('tone','TONE',.65),p('motion','MOTION',.3)]),
e('GRANUVERB','REVERB','Ein Feedbackhall wird durch versetzte Pitch-Grains gestreut.',[p('size','SIZE',.55),p('grain','GRAIN',.4),p('scatter','SCATTER',.3),p('decay','DECAY',.6),p('pitch','PITCH',.6,'semitone'),p('damp','DAMP',.4)]),
e('SQUASH','DYNAMICS','Dreibandige Aufwärts- und Abwärtskompression.',[p('depth','DEPTH',.5),p('time','TIME',.3),p('input','IN',.5),p('output','OUT',.5),p('bands','BANDS',1,'percent',['1','2','3']),p('solo','SOLO',0,'percent',['ALL','LOW','MID','HIGH'])]),
e('GATE','DYNAMICS','Stereo-gekoppeltes Gate mit Attack, Hold und Release.',[p('threshold','THRESHOLD',.25),p('attack','ATTACK',.1),p('hold','HOLD',.15),p('release','RELEASE',.3),p('floor','FLOOR',0)]),
e('MANGLE','DYNAMICS','Zweibandige Sättigung oder aufwärts liftende Multiband-Kompression.',[p('mode','MODE',0,'percent',['CLASSIC','MELT']),p('brutality','BRUTALITY',.4),p('lift','LIFT',.4),p('pump','PUMP',.3),p('grit','GRIT',.25),p('split','SPLIT',.4)]),
e('TRANSIENT','DYNAMICS','Schnelle und langsame Hüllkurven trennen Attack und Sustain.',[p('attack','ATTACK',.7),p('sustain','SUSTAIN',.5),p('time','TIME',.3),p('release','RELEASE',.4),p('swell','SWELL',.1),p('length','LENGTH',.6),p('split','SPLIT',.5)])
];
const SNAP_TYPES=new Set(['PITCH SHIFT','TRIAD','SCATTER','SCANNER','CHOPPER','STRUM','GRANULAR DELAY','GRANUVERB','MIRROR','HOWL','TOOTH','COMB','CRYSTAL','MODAL','STRINGS','MAGNET','WARP','SPECTRAL DELAY','FREQ SHIFT','FISSION']);
for(const effect of EFFECTS)effect.snap=SNAP_TYPES.has(effect.id);
export const EFFECT_BY_ID=Object.fromEntries(EFFECTS.map(effect=>[effect.id,effect]));
export function makeEffect(type,id=`fx-${Date.now().toString(36)}`){const def=EFFECT_BY_ID[type];if(!def)throw new Error(`Unknown effect: ${type}`);return {id,type,on:true,mix:.5,gain:.5,snap:false,params:Object.fromEntries(def.params.map(p=>[p.key,p.default]))};}

// Exact readouts for direct physical controls. Composite macros stay in percent.
export function formatEffectValue(type,key,value,tonal={}){
 const x=Math.min(1,Math.max(0,Number(value)||0)),descriptor=EFFECT_BY_ID[type]?.params.find(p=>p.key===key);
 if(descriptor?.options)return descriptor.options[Math.round(x*(descriptor.options.length-1))];
 const signed=(n,digits=1)=>`${n>=0?'+':''}${n.toFixed(digits)}`;
 const frequency=n=>n>=1000?`${(n/1000).toFixed(n>=10000?1:2)} kHz`:`${n.toFixed(n<100?1:0)} Hz`;
 const ms=n=>`${(n*1000).toFixed(n<.1?1:0)} ms`;
 let f=null;
 if((type==='EQ'&&key==='freq')||(type==='PRISM'&&key==='cutoff')||(['TOOTH','COMB','TRANSMIT','VESPER'].includes(type)&&key==='freq')||(type==='LIQUIFY'&&key==='focus')||(type==='MODAL'&&key==='tune')||(type==='CRYSTAL'&&key==='root')||(['CLANG','FISSION','PLASMA'].includes(type)&&key==='frequency')||(type==='PLASMA'&&key==='freq'))f=30*600**x;
 if(type==='HOWL'&&key==='note')f=55*64**x;
 if(f!==null){if(tonal.snap&&EFFECT_BY_ID[type]?.snap){const root=Number(tonal.root)||0,notes=tonal.scale==='major'?[0,2,4,5,7,9,11]:tonal.scale==='dorian'?[0,2,3,5,7,9,10]:tonal.scale==='pentatonic'?[0,2,4,7,9]:tonal.scale==='chromatic'?[0,1,2,3,4,5,6,7,8,9,10,11]:[0,2,3,5,7,8,10],note=69+12*Math.log2(f/440);let best=Math.round(note),distance=100;for(let n=Math.floor(note)-12;n<=Math.ceil(note)+12;n++)if(notes.includes(((n-root)%12+12)%12)&&Math.abs(n-note)<distance){best=n;distance=Math.abs(n-note);}f=440*2**((best-69)/12);}return frequency(f);}
 if(type==='BITROT'&&key==='bits')return `${2+Math.round(x*14)} BIT`;
 if(type==='BITROT'&&key==='rate')return `${1+Math.floor(x*x*120)} S/H`;
 if(type==='EQ'&&key==='gain')return `${signed((x-.5)*36)} dB`;
 if(type==='FREQ SHIFT'&&['shiftl','shiftr'].includes(key)){
  let shift=(x-.5)*1000;
  if(tonal.snap&&Math.abs(shift)>.001){const root=Number(tonal.root)||0,notes=tonal.scale==='major'?[0,2,4,5,7,9,11]:tonal.scale==='dorian'?[0,2,3,5,7,9,10]:tonal.scale==='pentatonic'?[0,2,4,7,9]:tonal.scale==='chromatic'?[0,1,2,3,4,5,6,7,8,9,10,11]:[0,2,3,5,7,8,10],note=69+12*Math.log2(Math.abs(shift)/440);let best=Math.round(note),distance=100;for(let n=Math.floor(note)-12;n<=Math.ceil(note)+12;n++)if(notes.includes(((n-root)%12+12)%12)&&Math.abs(n-note)<distance){best=n;distance=Math.abs(n-note);}shift=Math.sign(shift)*440*2**((best-69)/12);}
  else if(tonal.params?.snap>.5)shift=Math.round(shift/55)*55;
  return `${signed(shift,1)} Hz`;
 }
 if(key==='rate'&&['CHORUS','FLANGER','PHASER','ORBIT','TREMOR'].includes(type))return `${(.03+x*x*12).toFixed(2)} Hz`;
 if(type==='ENSEMBLE'&&key==='rate1')return `${(.1+x*2).toFixed(2)} Hz`;
 if(type==='ENSEMBLE'&&key==='rate2')return `${(.3+x*6).toFixed(2)} Hz`;
 if(type==='FLYBY'&&key==='speed')return `${(.03+x*x*3).toFixed(2)} Hz`;
 if(['SPIRAL','REEL','CADENCE','GRANULAR DELAY'].includes(type)&&key==='time')return `${[8,4,2,1,.5,.25,.125][Math.round(x*6)]} BT`;
 if(['SCATTER','SCANNER'].includes(type)&&key==='size')return ms(.01+x*x*.5);
 if(type==='SCANNER'&&key==='scan')return `${(x*1.5).toFixed(2)} s`;
 if(type==='CHORUS'&&key==='time')return ms(.008+x*.025);
 if(type==='FLANGER'&&key==='delay')return ms(.0005+x*.006);
 if(type==='DATTORRO'&&key==='predelay')return ms(.2*x);
 if(type==='GATE'&&key==='threshold')return `${(-72+x*66).toFixed(1)} dB`;
 if(['GATE','EXCITE'].includes(type)&&key==='attack')return ms(.001+x*x*.1);
 if(['GATE','EXCITE'].includes(type)&&key==='release')return ms(.02+x*x*2);
 if(type==='GATE'&&key==='hold')return ms(x*.5);
 if(type==='TRANSIENT'&&key==='time')return ms(.001+x*.079);
 if(type==='TRANSIENT'&&key==='release')return ms(.03+x*1.97);
 if(type==='TRANSIENT'&&['attack','sustain'].includes(key))return signed((x-.5)*200,0);
 if(type==='UNDERTOW'&&key==='divide')return `÷${2+Math.round(x*6)}`;
 if(type==='STILLS'&&key==='voices')return `${1+Math.round(x*32)}`;
 if(type==='STRINGS'&&key==='strings')return `${1+Math.round(x*5)}`;
 if(type==='LOOP'&&key==='speed')return `${signed((x-.5)*4,2)}×`;
 if(type==='LOOP'&&key==='heads')return `${1+Math.round(x*3)}`;
 if(type==='REEL'&&key==='heads')return `${1+Math.round(x*3)}`;
 if(['CHOPPER','STRUM','WENDY'].includes(type)&&['division','slots','cuts'].includes(key))return `${2+Math.round(x*30)}`;
 if(type==='CADENCE'&&key==='steps')return `${2+Math.round(x*10)}`;
 if(type==='PITCH SHIFT'&&key==='fine')return `${signed((x-.5)*100,0)} ct`;
 if(type==='PITCH SHIFT'&&key==='pitch'&&tonal.params?.mode>.25)return `${signed((x-.5)*1000,0)} Hz`;
 if(descriptor?.format==='semitone'){
  let semitones=(x-.5)*24;
  if(type==='MIRROR'||type==='TRIAD'||type==='GRANUVERB')semitones=(x-.5)*48;
  if(type==='GRANULAR DELAY')semitones=(x-.75)*48;
  if(tonal.snap&&EFFECT_BY_ID[type]?.snap){const notes=tonal.scale==='major'?[0,2,4,5,7,9,11]:tonal.scale==='dorian'?[0,2,3,5,7,9,10]:tonal.scale==='pentatonic'?[0,2,4,7,9]:tonal.scale==='chromatic'?[0,1,2,3,4,5,6,7,8,9,10,11]:[0,2,3,5,7,8,10];let best=Math.round(semitones),distance=100;for(let n=Math.floor(semitones)-12;n<=Math.ceil(semitones)+12;n++)if(notes.includes((n%12+12)%12)&&Math.abs(n-semitones)<distance){best=n;distance=Math.abs(n-semitones);}semitones=best;}
  return `${signed(semitones)} st`;
 }
 return `${Math.round(x*100)} %`;
}
