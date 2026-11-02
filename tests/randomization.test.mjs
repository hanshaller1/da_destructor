import test from 'node:test';
import assert from 'node:assert/strict';
import {createState} from '../state.mjs';
import {randomParameterValue as pick} from '../randomization.mjs';
test('random discrete switches and enum directions obey strength and zero locks',()=>{
 const state=createState();
 assert.equal(pick(state,'time.stretch.reverse',false,1,()=>0),true);
 assert.equal(pick(state,'time.stretch.reverse',true,0,()=>0),true);
 assert.equal(pick(state,'time.stretch.reverse',false,.3,()=>.5),false);
 assert.equal(pick(state,'time.stutter.pattern','EVEN',1,()=>0),'DOTTED');
 assert.equal(pick(state,'time.stutter.pattern','EVEN',-1,()=>0),'RAMP DOWN');
 assert.equal(pick(state,'time.stutter.pattern','EVEN',0,()=>0),'EVEN');
});
test('random continuous settings retain signed v1 interpolation',()=>{
 const state=createState();
 assert.equal(pick(state,'main.mix',.5,.5,()=>1),.75);
 assert.equal(pick(state,'main.mix',.5,-.5,()=>1),.25);
 assert.equal(pick(state,'main.mix',.5,0,()=>1),.5);
});
