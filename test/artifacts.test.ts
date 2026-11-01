import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { readJsonArtifact } from '../gate/artifacts.mjs';

test('completed malformed, HTML, empty and scalar artifact bodies fail without a retry', {timeout:15000}, async () => {
  let calls=0;
  const bodies=['{"ok":true}', '[1,2]', '{broken', '<html>fallback</html>', '', 'null', 'true', '7'];
  const server=createServer((req,res)=>{calls++;res.end(bodies[Number(req.url?.slice(1))]);});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address=server.address();assert.ok(address&&typeof address!=='string');
  try{
    for(let i=0;i<bodies.length;i++){
      const url=`http://127.0.0.1:${address.port}/${i}`,response=await fetch(url);
      const result=await readJsonArtifact({url:()=>url,status:()=>response.status,request:()=>({allHeaders:async()=>({})}),text:()=>response.text()});
      assert.equal(result.ok,i<2,bodies[i]);assert.equal(result.transportRetry,false);
    }
    assert.equal(calls,bodies.length);
  }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});

test('conditional artifact responses fetch the full URL once, retain credentials and remove range/cache conditions', {timeout:15000}, async()=>{
 const observed:Array<{url:string|undefined;authorization:string|undefined;etag:string|string[]|undefined;range:string|undefined}>=[];
 const server=createServer((req,res)=>{
  observed.push({url:req.url,authorization:req.headers.authorization,etag:req.headers['if-none-match'],range:req.headers.range});
  if(observed.length===1){res.statusCode=304;res.end();}else{res.end('{"complete":true}');}
 });
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const address=server.address();assert.ok(address&&typeof address!=='string');
 try{
  const url=`http://127.0.0.1:${address.port}/artifact.json?v=correct`;
  const headers={authorization:'Bearer controlled-test-fixture','if-none-match':'"test-etag"',range:'bytes=0-10'};
  const response=await fetch(url,{headers});
  const result=await readJsonArtifact({url:()=>url,status:()=>response.status,request:()=>({allHeaders:async()=>headers}),text:()=>response.text()});
  assert.equal(result.ok,true);assert.equal(result.transportRetry,true);assert.equal(observed.length,2);
  assert.equal(observed[1].url,'/artifact.json?v=correct');assert.equal(observed[1].authorization,headers.authorization);
  assert.equal(observed[1].etag,undefined);assert.equal(observed[1].range,undefined);
 }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
