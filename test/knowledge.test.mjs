import {test} from 'node:test';
import assert from 'node:assert/strict';
import {writeFile,mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createKnowledge} from '../src/knowledge.mjs';

test('local knowledge retrieves and separates VBCS and OIC references',async()=>{
  const knowledge=createKnowledge();const status=await knowledge.status();
  assert.equal(status.ready,true);assert.ok(status.documents>=11);assert.ok(status.passages>=50);
  const vb=await knowledge.search({query:'VBCS Call REST action chain must handle a failed REST response',product:'vbcs'});
  assert.equal(vb.product,'vbcs');assert.ok(vb.references.length>0);assert.ok(vb.references.every(r=>r.productKey==='vbcs'));assert.ok(vb.references.some(r=>/REST|Action/i.test(r.title+r.heading+r.excerpt)));
  const oic=await knowledge.search({query:'OIC failed integration instance fault location activity stream and payload',product:'oic'});
  assert.equal(oic.product,'oic');assert.ok(oic.references.length>0);assert.ok(oic.references.every(r=>r.productKey==='oic'));assert.ok(oic.references.some(r=>/activity stream/i.test(r.excerpt)));
  const explicit=await knowledge.search({query:'REST PATCH returned HTTP 400 Bad Request for a supplier update and the OIC integration returned 500 Internal Server Error',product:'oic'});assert.ok(explicit.references.length>0);assert.ok(explicit.references.every(r=>r.productKey==='oic'));assert.equal(explicit.references[0].title,'About Error Management');assert.ok(explicit.references.some(r=>/Determine the Source/.test(r.title)));
});

test('missing index and unsupported query fail safely without invented references',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'repromate-knowledge-'));try{
    const missing=createKnowledge({indexPath:join(dir,'missing.json')});assert.equal((await missing.status()).ready,false);assert.deepEqual((await missing.search({query:'VBCS problem'})).references,[]);
    const path=join(dir,'index.json');await writeFile(path,JSON.stringify({version:'test',builtAt:'now',documents:1,passages:[{id:'one',product:'Oracle Visual Builder',productKey:'vbcs',title:'Variables',heading:'Variables',url:'https://docs.oracle.com/example',text:'Page variables contain application state and can be bound to a component.'}]}));
    const local=createKnowledge({indexPath:path});assert.equal((await local.search({query:'printer toner cartridge failure',product:'auto'})).insufficientEvidence,true);
  }finally{await rm(dir,{recursive:true,force:true});}
});
