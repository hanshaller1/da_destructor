import test from 'node:test';import assert from 'node:assert/strict';import {ModulationEffect} from '../fx-modulation.mjs';
const sr=12000;
test('flanger has explicit stable dry delay and through-zero reads both sides of its reference',()=>{
 const f=new ModulationEffect('FLANGER',sr);assert.equal(f.latency,240);const p={tzf:1,delay:.5,depth:1,rate:.8,feedback:.5};let ahead=0,behind=0,energy=0;
 const read=f.wet.read.bind(f.wet);f.wet.read=(ch,d)=>{if(d<f.latency)ahead++;if(d>f.latency)behind++;return read(ch,d);};
 for(let n=0;n<sr;n++){const y=f.process(Math.sin(n*.2)*.2,Math.sin(n*.19)*.2,p,n,120);energy+=y[0]**2;assert.ok(Number.isFinite(y[0]));}
 assert.ok(ahead>100&&behind>100);assert.ok(energy>1);
});
test('barber rise and fall produce different continuous bounded signals in both processors',()=>{
 for(const type of ['FLANGER','PHASER']){const up=new ModulationEffect(type,sr),down=new ModulationEffect(type,sr);let diff=0,previous=0,maxJump=0;
  for(let n=0;n<sr*2;n++){const x=Math.sin(n*.22)*.1+Math.sin(n*.07)*.05,a=up.process(x,x,{barber:.5,rate:.6,depth:.7},n,120),b=down.process(x,x,{barber:1,rate:.6,depth:.7},n,120);diff+=Math.abs(a[0]-b[0]);maxJump=Math.max(maxJump,Math.abs(a[0]-previous));previous=a[0];assert.ok(Number.isFinite(a[0])&&Math.abs(a[0])<4);}
  assert.ok(diff>1,type);assert.ok(maxJump<.5,type);up.reset();assert.equal(up.phase,0);
 }
});
