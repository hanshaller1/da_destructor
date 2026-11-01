import test from 'node:test';
import assert from 'node:assert/strict';
import {GestureRecorder} from '../automation.mjs';
test('motion recorder retains initial values, coalesces fast moves and sorts independent controls',()=>{
 const r=new GestureRecorder();r.start(10,{'macros.0.value':.2,'xy.x':.5});r.capture('macros.0.value',.4,10.5);r.capture('macros.0.value',.6,10.505);r.capture('xy.x',.9,10.8);
 const take=r.stop(11);assert.equal(take.duration,1);assert.deepEqual(take.events,[{time:0,path:'macros.0.value',value:.2},{time:0,path:'xy.x',value:.5},{time:.505,path:'macros.0.value',value:.6},{time:.8,path:'xy.x',value:.9}]);
 take.events[0].value=0;assert.equal(r.events[0].value,.2);
});
test('recording stays bounded and ignores nonnumeric or inactive gestures',()=>{const r=new GestureRecorder({maxDuration:2,maxEvents:10});assert.equal(r.capture('x',1,0),false);r.start(0);assert.equal(r.capture('x',NaN,1),false);r.capture('x',2,3);assert.equal(r.active,false);const take=r.stop(5);assert.equal(take.duration,2);assert.ok(take.events.every(e=>e.value>=0&&e.value<=1));});
