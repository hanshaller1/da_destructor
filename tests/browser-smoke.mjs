import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {homedir} from 'node:os';
import {existsSync} from 'node:fs';

// Use the already bundled browser library and installed Chrome; no browser download.
const require=createRequire(import.meta.url);
let playwright;
for(const candidate of [process.env.PLAYWRIGHT_MODULE,'playwright',path.join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')].filter(Boolean)){
 try{playwright=require(candidate);break;}catch{}
}
if(!playwright)throw new Error('Playwright nicht gefunden. PLAYWRIGHT_MODULE setzen oder Playwright bereitstellen.');
const {chromium}=playwright;
const output=path.resolve('test-results/browser');await mkdir(output,{recursive:true});
const executablePath=[process.env.CHROME_PATH,'C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p=>p&&existsSync(p));
const browser=await chromium.launch({...(executablePath?{executablePath}:{}),headless:true,args:['--autoplay-policy=no-user-gesture-required','--mute-audio']});
const context=await browser.newContext({viewport:{width:1545,height:909},acceptDownloads:true});
const page=await context.newPage();page.setDefaultTimeout(7000);
const failures=[],results=[],pageErrors=[],consoleErrors=[];
page.on('pageerror',error=>pageErrors.push(String(error)));
page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
const tab=id=>page.locator(`.tabs [data-page="${id}"]`).click();
const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('dd-session-v1')||'null'));
const settle=()=>page.waitForTimeout(550);
async function check(name,run){try{const evidence=await run();results.push({name,status:'passed',evidence});console.log(`PASS ${name} ${JSON.stringify(evidence??'')}`);}catch(error){const failure={name,status:'failed',message:error.message};failures.push(failure);results.push(failure);console.log(`FAIL ${name}: ${error.message}`);await page.screenshot({path:path.join(output,`failure-${failures.length}.png`),fullPage:true}).catch(()=>{});await page.keyboard.press('Escape').catch(()=>{});}}
async function overflow(){return page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth,body:document.body.scrollWidth,overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth}));}

try{
 await check('load and six primary tabs',async()=>{
  const response=await page.goto(process.env.BASE_URL||'http://127.0.0.1:4173/',{waitUntil:'networkidle'});assert.equal(response.status(),200);
  await page.locator('h1').waitFor();assert.equal(await page.locator('h1').textContent(),'DA DESTRUCTOR');assert.equal(await page.locator('.tabs button').count(),6);
  for(const id of ['time','fx','animate','perform','source','config']){await tab(id);assert.equal(await page.locator(`.tabs [data-page="${id}"]`).getAttribute('aria-current'),'page');}
  await tab('time');await page.screenshot({path:path.join(output,'desktop-time.png'),fullPage:true});return {tabs:6};
 });
 await check('actual AudioWorklet starts and produces nonzero stereo meters',async()=>{
  await page.locator('[data-action="audio"]').click();
  await page.waitForFunction(()=>document.querySelector('[data-action="audio"]')?.textContent.includes('AUDIO RUNNING'));
  await page.waitForFunction(()=>{const text=document.querySelector('#peak-readout')?.textContent;return text&&text.includes('dB')&&!text.includes('∞');});
  const peak=await page.locator('#peak-readout').textContent();const left=await page.locator('#meter-l').evaluate(n=>n.style.height);const right=await page.locator('#meter-r').evaluate(n=>n.style.height);
  assert.ok(parseFloat(left)>0&&parseFloat(right)>0);return {peak,left,right};
 });
 await check('time knob keyboard edits, engine enable, freeze and bend toggles',async()=>{
  await tab('time');const speed=page.locator('d-knob[data-path="time.vari.speed"]');await speed.focus();await speed.press('ArrowDown');assert.equal(await speed.getAttribute('aria-valuenow'),'99');
  assert.equal(await page.locator('[data-toggle="time.vari.on"]').getAttribute('aria-pressed'),'true');
  await page.locator('[data-toggle="time.stretch.freeze"]').click();assert.equal(await page.locator('[data-toggle="time.stretch.freeze"]').getAttribute('aria-pressed'),'true');
  await page.locator('[data-toggle="time.stutter.bend"]').click();assert.equal(await page.locator('[data-engine="stutter"] h2').textContent(),'BENDIT');await page.locator('[data-toggle="time.stutter.bend"]').click();
  await settle();const state=await saved();assert.equal(state.time.vari.speed,.99);assert.equal(state.time.stretch.freeze,true);
  // Return to a clean musical source before testing recording.
  for(const engine of ['stretch','vari','stutter']){const on=page.locator(`[data-toggle="time.${engine}.on"]`);if(await on.getAttribute('aria-pressed')==='true')await on.click();}
  return {variSpeed:state.time.vari.speed,freeze:state.time.stretch.freeze};
 });
 await check('stutter sequencer four-pattern chain and independent step edits',async()=>{
  await page.locator('[data-select="seq.stutter.patterns"]').selectOption('4');assert.equal(await page.locator('[data-local="seq-pattern"]').count(),4);
  await page.locator('[data-local="seq-pattern"][data-local-value="3"]').click();const step=page.locator('[data-step="63"]');await step.click();assert.ok((await step.getAttribute('class')).includes('disabled'));
  await step.focus();await step.press('ArrowUp');assert.ok(!(await step.getAttribute('class')).includes('disabled'));
  await settle();const state=await saved();assert.equal(state.seq.stutter.steps.length,64);assert.equal(state.seq.stutter.patterns,4);assert.equal(state.seq.stutter.steps[63].on,true);return {patterns:4,lastStep:state.seq.stutter.steps[63]};
 });
 await check('62-effect catalog supports add, duplicate protection, reorder and remove',async()=>{
  await tab('fx');assert.equal(await page.locator('.effect-option').count(),62);
  await page.locator('.effect-option[data-add-fx="TAPE"]').click();await page.locator('.effect-option[data-add-fx="EQ"]').click();assert.equal(await page.locator('.fx-unit').count(),2);
  await page.locator('.effect-option[data-add-fx="TAPE"]').click();assert.equal(await page.locator('.fx-unit').count(),2);
  const before=await page.locator('.fx-unit h3').allTextContents();assert.deepEqual(before,['TAPE','EQ']);
  await page.locator('.fx-unit').nth(1).locator('[data-fx-up]').click();assert.deepEqual(await page.locator('.fx-unit h3').allTextContents(),['EQ','TAPE']);
  await page.screenshot({path:path.join(output,'desktop-fx.png'),fullPage:true});
  await page.locator('.fx-unit').first().locator('[data-remove-fx]').click();assert.deepEqual(await page.locator('.fx-unit h3').allTextContents(),['TAPE']);return {catalog:62,orderAfterReorder:['EQ','TAPE'],remaining:'TAPE'};
 });
 await check('ANIMATE target routing persists and graph pointer edits add a point',async()=>{
  await tab('animate');await page.locator('[data-add-target="mods.0"]').click();await page.locator('#mapping-target').selectOption('main.pan');await page.locator('#mapping-curve').selectOption('s');await page.locator('#mapping-save').click();
  assert.equal(await page.locator('[data-edit-target="mods.0"]').count(),1);
  const graph=page.locator('[data-graph="0"]'),box=await graph.boundingBox();await graph.click({position:{x:box.width*.18,y:box.height*.62}});await settle();
  const state=await saved();assert.equal(state.mods[0].targets[0].path,'main.pan');assert.equal(state.mods[0].targets[0].curve,'s');assert.equal(state.graphs[0].points.length,6);
  await page.screenshot({path:path.join(output,'desktop-animate.png'),fullPage:true});return {route:state.mods[0].targets[0],graphPoints:state.graphs[0].points.length};
 });
 await check('PERFORM XY supports pointer and keyboard gestures plus macro target assignment',async()=>{
  await tab('perform');const xy=page.locator('#xy-pad'),box=await xy.boundingBox();await xy.click({position:{x:box.width*.78,y:box.height*.26}});assert.ok((await page.locator('#xy-x').textContent()).includes('0.78'));await xy.press('ArrowRight');assert.ok((await page.locator('#xy-x').textContent()).includes('0.79'));
  await page.locator('[data-add-target="macros.0"]').click();await page.locator('#mapping-target').selectOption('main.high');await page.locator('#mapping-save').click();assert.equal(await page.locator('[data-edit-target="macros.0"]').count(),1);
  await page.screenshot({path:path.join(output,'desktop-perform.png'),fullPage:true});await settle();const state=await saved();return {x:state.xy.x,y:state.xy.y,macroTarget:state.macros[0].targets[0].path};
 });
 await check('all four themes and tonal root selectors work',async()=>{
  await tab('config');const themes=['olive','graphite','oxide','paper'];for(const theme of themes){await page.locator(`[data-theme-name="${theme}"]`).click();assert.equal(await page.locator('html').getAttribute('data-theme'),theme);}
  await page.locator('[data-select="tonal.root"]').selectOption('9');await page.locator('[data-select="tonal.scale"]').selectOption('"dorian"');await settle();const state=await saved();assert.equal(state.tonal.root,9);assert.equal(state.tonal.scale,'dorian');
  await page.screenshot({path:path.join(output,'desktop-paper.png'),fullPage:true});await page.locator('[data-theme-name="olive"]').click();return {themes,tonal:state.tonal};
 });
 await check('recorded WAV download contains valid stereo PCM and nonzero output',async()=>{
  await page.locator('[data-action="record"]').first().click();await page.waitForTimeout(1250);const event=page.waitForEvent('download');await page.locator('[data-action="record"]').first().click();const download=await event;const file=path.join(output,'smoke-recording.wav');await download.saveAs(file);const data=await readFile(file);
  assert.equal(data.toString('ascii',0,4),'RIFF');assert.equal(data.toString('ascii',8,12),'WAVE');assert.equal(data.toString('ascii',12,16),'fmt ');assert.equal(data.readUInt16LE(20),1);assert.equal(data.readUInt16LE(22),2);assert.equal(data.readUInt16LE(34),16);
  const bytes=data.readUInt32LE(40);assert.ok(bytes>44100*2*2*.5);assert.equal(data.length,bytes+44);let peak=0;for(let i=44;i<data.length;i+=2)peak=Math.max(peak,Math.abs(data.readInt16LE(i)));assert.ok(peak>50);return {bytes:data.length,channels:2,sampleRate:data.readUInt32LE(24),seconds:bytes/(data.readUInt32LE(24)*4),peak};
 });
 await check('desktop and mobile geometry have no document-level horizontal overflow',async()=>{
  await tab('time');let desktop=await overflow();assert.ok(desktop.overflow<=1,JSON.stringify(desktop));
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);const pages={};for(const id of ['time','fx','animate','perform','source','config']){await tab(id);pages[id]=await overflow();assert.ok(pages[id].overflow<=1,`${id}: ${JSON.stringify(pages[id])}`);}
  await tab('time');await page.screenshot({path:path.join(output,'mobile-time.png'),fullPage:true});await page.setViewportSize({width:1545,height:909});return {desktop,mobile:pages};
 });
 await check('browser execution has no unhandled errors',async()=>{assert.deepEqual(pageErrors,[]);assert.deepEqual(consoleErrors,[]);return {pageErrors,consoleErrors};});
}finally{
 await writeFile(path.join(output,'summary.json'),JSON.stringify({results,pageErrors,consoleErrors},null,2));await browser.close();
}
console.log(JSON.stringify({passed:results.filter(r=>r.status==='passed').length,failed:failures.length,output},null,2));
if(failures.length)process.exitCode=1;
