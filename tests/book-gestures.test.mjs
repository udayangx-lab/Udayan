import {test} from 'node:test';
import assert from 'node:assert/strict';
import {touchSwipe, createWheelSwipe} from '../lib/book-gestures.ts';
const fingers = [{id:1,x:200,y:100},{id:2,x:240,y:160}];
const translated = (dx,dy=0) => fingers.map(point=>({...point,x:point.x+dx,y:point.y+dy}));
test('two fingers moving together turn the page in either direction',()=>{
 assert.equal(touchSwipe(fingers,translated(-65,4)), 'next');
 assert.equal(touchSwipe(fingers,translated(65,-3)), 'previous');
 assert.equal(touchSwipe(fingers,translated(-20)), 'horizontal');
 assert.equal(touchSwipe(fingers,translated(-4)), null);
 assert.equal(touchSwipe(fingers,[...translated(-65)].reverse()), 'next');
});
test('pinch, opposite finger movement, and vertical scrolling do not change pages',()=>{
 assert.equal(touchSwipe(fingers,[{id:1,x:120,y:100},{id:2,x:320,y:160}]), 'cancel');
 assert.equal(touchSwipe(fingers,translated(5,70)), 'cancel');
 assert.equal(touchSwipe(fingers,[{id:3,x:100,y:100},{id:4,x:140,y:160}]), 'cancel');
 assert.equal(touchSwipe(fingers,[{id:1,x:100,y:100}]), 'cancel');
 assert.equal(touchSwipe([fingers[0]],[{id:1,x:135,y:100}]), 'next');
});
test('trackpad inertia never advances multiple pages within one gesture',()=>{
 const wheel=createWheelSwipe();
 const directions=[];
 for(let time=0;time<1700;time+=40){const result=wheel({dx:time<200?20:2,dy:0,time});if(result.direction)directions.push(result.direction);assert.equal(result.consume,true);}
 assert.deepEqual(directions,['next']);
 assert.equal(wheel({dx:-80,dy:0,time:2200}).direction,'previous');
});
test('trackpad zoom and vertical scrolling remain browser gestures',()=>{
 const wheel=createWheelSwipe();
 assert.deepEqual(wheel({dx:100,dy:0,time:0,pinch:true}),{consume:false,direction:null});
 assert.deepEqual(wheel({dx:10,dy:90,time:40}),{consume:false,direction:null});
 assert.equal(wheel({dx:35,dy:0,time:500}).direction,null);
 assert.equal(wheel({dx:35,dy:0,time:540}).direction,'next');
});
