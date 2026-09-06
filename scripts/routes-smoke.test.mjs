import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
test('existing web routes and packaged map endpoints serve without server errors',async()=>{
  const child=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1'],{stdio:['ignore','pipe','pipe']});
  child.stdout.on('data',data=>process.stdout.write(data));child.stderr.on('data',data=>process.stderr.write(data));
  try{
    let ready=false;
    for(let n=0;n<60;n++){try{const r=await fetch('http://127.0.0.1:8080/');assert.equal(r.status,200,'Initial page response');ready=true;break;}catch(error){if(error instanceof assert.AssertionError)throw error;}await delay(250);}
    assert.ok(ready,'Dev server startup');
    for(const path of ['/','/family','/family/dad','/family/mom','/sos','/sos-now','/sos-status','/shelters','/community','/guide','/more','/safe-route/govt-school','/maps/aluva.osm','/maps/aluva-context.geojson','/sw.js']){
      const response=await fetch('http://127.0.0.1:8080'+path);assert.equal(response.status,200,path);console.log(path,response.status);
    }
  }finally{child.kill();await once(child,'exit');}
});
