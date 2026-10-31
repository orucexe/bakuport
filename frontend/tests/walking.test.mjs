import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source=await readFile(new URL('../src/services/walking.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {refineWalking}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const point=(lat,lng)=>({lat,lng,name:'Location'});
const origin=point(40.4,49.8),board=point(40.401,49.8),alight=point(40.42,49.8),destination=point(40.421,49.8);
const sample={key:'1:1',walk_to_m:111,walk_from_m:111,ride_minutes:10,planned_minutes:14,
 legs:[{type:'walk',from:origin,to:board,minutes:1.5,distance_m:111,shape:[origin,board],estimated:true},
 {type:'bus',from:board,to:alight,minutes:10,distance_m:2100,shape:[board,alight]},
 {type:'walk',from:alight,to:destination,minutes:1.5,distance_m:111,shape:[alight,destination],estimated:true}]};
function provider(distance=300){globalThis.google={maps:{importLibrary:async()=>({Route:{computeRoutes:async request=>({routes:[{distanceMeters:distance,durationMillis:240000,path:[request.origin,request.destination],warnings:['Check pedestrian crossings']}]})}})}};}

test('real provider walking distance/time replaces estimates and retains warnings',async()=>{
 provider();const [result]=await refineWalking([sample],800,new AbortController().signal);
 assert.equal(result.walking_status,'provider');assert.equal(result.walk_to_m,300);assert.equal(result.walk_from_minutes,4);
 assert.equal(result.planned_minutes,18);assert.equal(result.legs[0].estimated,false);assert.deepEqual(result.walking_warnings,['Check pedestrian crossings']);
 assert.equal(sample.walk_to_m,111,'Input must remain unchanged');
});
test('provider walking path above passenger limit excludes candidate',async()=>{
 provider(1200);assert.deepEqual(await refineWalking([sample],800,new AbortController().signal),[]);
});
test('denied provider retains labeled estimates without inventing street geometry',async()=>{
 globalThis.google={maps:{importLibrary:async()=>{throw Error('REQUEST_DENIED')}}};
 const [result]=await refineWalking([sample],800,new AbortController().signal);
 assert.equal(result.walking_status,'estimate');assert.equal(result.walk_to_m,111);assert.equal(result.legs[0].estimated,true);
});
test('aborted search cannot apply provider results',async()=>{
 provider();const controller=new AbortController();controller.abort();const [result]=await refineWalking([sample],800,controller.signal);
 assert.equal(result.walking_status,'estimate');assert.equal(result.planned_minutes,14);
});
