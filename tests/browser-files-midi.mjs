import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {homedir} from 'node:os';
import path from 'node:path';

const require=createRequire(import.meta.url);
let playwright;
for(const candidate of [process.env.PLAYWRIGHT_MODULE,'playwright',path.join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')].filter(Boolean)){
 try{playwright=require(candidate);break;}catch{}
}
if(!playwright)throw new Error('Playwright nicht gefunden. PLAYWRIGHT_MODULE setzen oder Playwright bereitstellen.');
const output=path.resolve('test-results/browser');await mkdir(output,{recursive:true});
let audioFile=path.join(output,'smoke-recording.wav');
if(!existsSync(audioFile)){
 audioFile=path.join(output,'integration-input.wav');
 const rate=22050,frames=22050,wav=Buffer.alloc(44+frames*4);wav.write('RIFF',0);wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(2,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*4,28);wav.writeUInt16LE(4,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(frames*4,40);
 for(let frame=0;frame<frames;frame++){wav.writeInt16LE(Math.round(Math.sin(frame*2*Math.PI*220/rate)*9000),44+frame*4);wav.writeInt16LE(Math.round(Math.sin(frame*2*Math.PI*330/rate)*7000),46+frame*4);}
 await writeFile(audioFile,wav);
}
const executablePath=[process.env.CHROME_PATH,'C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(file=>file&&existsSync(file));
const browser=await playwright.chromium.launch({...(executablePath?{executablePath}:{}),headless:true,args:['--autoplay-policy=no-user-gesture-required','--mute-audio']});
const context=await browser.newContext({viewport:{width:1545,height:909},acceptDownloads:true});
await context.addInitScript(()=>{
 class SimulatedInput extends EventTarget{constructor(){super();this.id='simulated-midi-clock';this.name='Simulated 100 BPM clock';this.manufacturer='Browser integration test';this.state='connected';}}
 const input=new SimulatedInput(),access=new EventTarget();access.inputs=new Map([[input.id,input]]);window.__midiRequests=[];
 Object.defineProperty(navigator,'requestMIDIAccess',{configurable:true,value:async options=>{window.__midiRequests.push(options);return access;}});
 window.__simulateMidi=(bytes,time)=>{const event=new Event('midimessage');Object.defineProperties(event,{data:{value:new Uint8Array(bytes)},timeStamp:{value:time}});input.dispatchEvent(event);};
});
const page=await context.newPage();page.setDefaultTimeout(6000);
const results=[],failures=[],pageErrors=[],consoleErrors=[];
page.on('pageerror',error=>pageErrors.push(String(error)));page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
const tab=id=>page.locator(`.tabs [data-page="${id}"]`).click();
const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('dd-session-v1')||'null'));
const running=()=>page.waitForFunction(()=>document.querySelector('[data-action="audio"]')?.textContent.includes('AUDIO RUNNING'));
const paused=()=>page.waitForFunction(()=>document.querySelector('[data-action="audio"]')?.textContent.includes('START AUDIO'));
async function check(name,run){
 try{const evidence=await run();results.push({name,status:'passed',evidence});console.log(`PASS ${name} ${JSON.stringify(evidence)}`);}
 catch(error){const failure={name,status:'failed',message:error.message};results.push(failure);failures.push(failure);console.log(`FAIL ${name}: ${error.message}`);await page.screenshot({path:path.join(output,`integration-failure-${failures.length}.png`),fullPage:true}).catch(()=>{});await page.keyboard.press('Escape').catch(()=>{});}
}
try{
 const response=await page.goto(process.env.BASE_URL||'http://127.0.0.1:4173/',{waitUntil:'networkidle'});assert.equal(response.status(),200);
 await check('real WAV file input decodes and playback pauses/resumes at retained position',async()=>{
  await tab('source');await page.locator('#audio-file').setInputFiles(audioFile);
  await page.waitForFunction(name=>document.querySelector('#source-name')?.textContent===name,path.basename(audioFile));
  const description=await page.locator('#source-description').textContent();assert.ok(description.includes('STEREO'));
  await page.locator('[data-action="audio"]').click();await running();
  await page.waitForFunction(()=>{const value=document.querySelector('#peak-readout')?.textContent;return value&&value.includes('dB')&&!value.includes('∞');});
  await page.waitForTimeout(130);await page.locator('.pause-button').click();await paused();
  const stopped=await page.locator('#time-display').textContent();await page.waitForTimeout(180);assert.equal(await page.locator('#time-display').textContent(),stopped);
  await page.locator('.pause-button').click();await running();await page.waitForTimeout(130);
  const resumed=await page.locator('#time-display').textContent();assert.notEqual(resumed,stopped);await page.locator('.pause-button').click();await paused();
  return {file:path.basename(audioFile),description,pausedAt:stopped,resumedAt:resumed};
 });
 const presetFile=path.join(output,'integration-preset.json');
 await check('save-new and export preserve tonal grid, ordered FX and SNAP',async()=>{
  await tab('fx');await page.locator('.effect-option[data-add-fx="TAPE"]').click();await page.locator('.effect-option[data-add-fx="PITCH SHIFT"]').click();
  const snap=page.locator('.fx-unit').filter({has:page.locator('h3',{hasText:'PITCH SHIFT'})}).locator('[data-toggle$=".snap"]');
  await snap.click();assert.equal(await snap.getAttribute('aria-pressed'),'true');
  await tab('config');await page.locator('[data-select="tonal.root"]').selectOption('9');await page.locator('[data-select="tonal.scale"]').selectOption('"dorian"');await page.locator('[data-select="tonal.chord"]').selectOption('"major"');
  await page.locator('[data-action="save-preset"]').first().click();await page.locator('#preset-name').fill('Browser integration 100');await page.locator('#save-user-preset').click();
  const user=await page.evaluate(()=>JSON.parse(localStorage.getItem('dd-presets-v1')));assert.equal(user.length,1);assert.equal(user[0].name,'Browser integration 100');
  const downloadEvent=page.waitForEvent('download');await page.locator('[data-action="export-preset"]').first().click();const download=await downloadEvent;await download.saveAs(presetFile);
  const exported=JSON.parse(await readFile(presetFile,'utf8'));assert.deepEqual(exported.tonal,{root:9,scale:'dorian',chord:'major'});assert.deepEqual(exported.fx.map(effect=>effect.type),['TAPE','PITCH SHIFT']);assert.equal(exported.fx[1].snap,true);assert.equal(exported.playing,false);assert.equal(exported.bypass,false);
  return {name:exported.presetName,tonal:exported.tonal,fx:exported.fx.map(effect=>effect.type),snap:exported.fx[1].snap};
 });
 await check('actual preset file import restores saved tonal grid and FX after INIT reset',async()=>{
  await tab('config');
  await page.locator('[data-action="init"]').click();assert.deepEqual((await saved()).fx,[]);
  await page.locator('#preset-file').setInputFiles(presetFile);
  await page.waitForFunction(()=>document.querySelector('#preset-select')?.selectedOptions[0]?.textContent==='Browser integration 100');
  const imported=await saved();assert.deepEqual(imported.tonal,{root:9,scale:'dorian',chord:'major'});assert.deepEqual(imported.fx.map(effect=>effect.type),['TAPE','PITCH SHIFT']);assert.equal(imported.fx[1].snap,true);
  assert.equal(await page.locator('[data-select="tonal.root"]').inputValue(),'9');assert.equal(await page.locator('[data-select="tonal.scale"]').inputValue(),'"dorian"');
  await tab('fx');assert.deepEqual(await page.locator('.fx-unit h3').allTextContents(),['TAPE','PITCH SHIFT']);await tab('config');
  return {preset:imported.presetName,fx:imported.fx.map(effect=>effect.type),tonal:imported.tonal};
 });
 await check('simulated MIDI CONFIG permission, explicit input,100 BPM clock and START/STOP/CONTINUE',async()=>{
  await tab('config');
  assert.deepEqual(await page.evaluate(()=>window.__midiRequests),[]);
  await page.locator('[data-action="enable-midi"]').click();await page.locator('#midi-input option[value="simulated-midi-clock"]').waitFor({state:'attached'});
  assert.deepEqual(await page.evaluate(()=>window.__midiRequests),[{sysex:false}]);
  await page.locator('#midi-input').selectOption('simulated-midi-clock');await page.locator('[data-action="clock-midi"]').click();assert.equal(await page.locator('#bpm').isDisabled(),true);
  await page.evaluate(()=>{window.__simulateMidi([0xFA],0);for(let pulse=0;pulse<24;pulse++)window.__simulateMidi([0xF8],pulse*25);});
  await running();await page.waitForFunction(()=>Math.abs(Number(document.querySelector('#bpm')?.value)-100)<.05);
  const status=await page.locator('#midi-status').textContent();assert.ok(status.includes('RUNNING / 100.0 BPM'));
  await page.evaluate(()=>window.__simulateMidi([0xFC],650));await paused();assert.ok((await page.locator('#midi-status').textContent()).includes('STOPPED'));
  await page.evaluate(()=>window.__simulateMidi([0xFB],700));await running();await page.evaluate(()=>window.__simulateMidi([0xFC],750));await paused();
  await page.screenshot({path:path.join(output,'desktop-midi-simulated.png'),fullPage:true});
  return {simulated:true,realHardwareTested:false,sysex:false,input:'simulated-midi-clock',bpm:Number(await page.locator('#bpm').inputValue()),start:true,stop:true,continue:true,status};
 });
 await check('file, preset and simulated MIDI browser paths have no unhandled errors',async()=>{assert.deepEqual(pageErrors,[]);assert.deepEqual(consoleErrors,[]);return {pageErrors,consoleErrors};});
}finally{
 await writeFile(path.join(output,'files-midi-summary.json'),JSON.stringify({results,pageErrors,consoleErrors,midiHardware:'simulated; no physical MIDI device exercised'},null,2));await browser.close();
}
console.log(JSON.stringify({passed:results.filter(result=>result.status==='passed').length,failed:failures.length,output},null,2));if(failures.length)process.exitCode=1;
