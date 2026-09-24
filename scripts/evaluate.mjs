import {readFile,mkdir,writeFile,access} from 'node:fs/promises';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {createOllama,SYSTEM_PROMPT,generationSchema} from '../src/ollama.mjs';
import {cases,caseInput} from '../test/cases.mjs';
import {validateInput} from '../src/input.mjs';
const label=process.env.EVALUATION_LABEL||'';if(label&&!/^[a-z0-9-]{1,40}$/.test(label))throw Error('Use a short alphanumeric evaluation label');
let rawModelOutput=null;const client=createOllama({onResponse:content=>{rawModelOutput=content}});const readiness=await client.readiness();if(!readiness.ready)throw Error(readiness.error);
const image={id:'screenshot-1',name:'synthetic-account-save.png',mimeType:'image/png',dataUrl:'data:image/png;base64,'+(await readFile(new URL('../public/sample.png',import.meta.url))).toString('base64')};
const anchor=caseInput(cases.find(c=>c.id==='vision-anchor'),image);
const out=new URL(`../evaluation/${client.model.replace(/[^a-z0-9-]/gi,'_')}${label?'-'+label:''}/`,import.meta.url);await mkdir(out,{recursive:true});
try{await access(new URL('results.json',out));throw Error('Results already exist. Set EVALUATION_LABEL to a new run name to preserve them.');}catch(e){if(e.code!=='ENOENT')throw e;}
await writeFile(new URL('protocol.json',out),JSON.stringify({revision:client.protocolRevision,systemPrompt:SYSTEM_PROMPT,imageSchema:generationSchema(anchor),textSchema:generationSchema({...anchor,image:null}),options:{temperature:0,num_predict:1200,num_ctx:8192,num_gpu:0},screenshotSHA256:createHash('sha256').update(await readFile(new URL('../public/sample.png',import.meta.url))).digest('hex')},null,2));
const results=[];
const report={model:client.model,protocolRevision:client.protocolRevision,evaluationLabel:label||'baseline',digest:readiness.digest,ollamaVersion:readiness.version,licenseIdentifier:client.model.startsWith('qwen3')?'Apache-2.0':'Gemma terms',hardware:{cpu:os.cpus()[0].model,logicalCPUs:os.cpus().length,memoryGB:Math.round(os.totalmem()/1024**3),platform:os.platform()},conditions:'CPU-only num_gpu=0, temperature=0, sequential requests, no application response cache. Ten repeated identical warm anchor requests; Ollama may reuse prompt state. Local API client timing includes readiness and validation, excludes browser rendering. Synthetic cases only; outputs retained solely as explicit evaluation artifacts.',startedAt:new Date().toISOString(),results};
async function run(id,input,kind,expect){rawModelOutput=null;const start=performance.now();try{const output=await client.analyze(validateInput(input));const elapsedMs=Math.round(performance.now()-start);const anchorConflict=/409/.test(JSON.stringify(output))&&/success/i.test(JSON.stringify(output));results.push({id,kind,expect,accepted:true,elapsedMs,anchorConflict,output,rawModelOutput,semanticReview:'PENDING'});console.log(`${id}: ACCEPTED ${elapsedMs} ms`);}catch(e){results.push({id,kind,expect,accepted:false,elapsedMs:Math.round(performance.now()-start),error:e.message,rejectedModelOutput:e.rejectedModelOutput||rawModelOutput||null});console.log(`${id}: REJECTED ${e.message}`);}await writeFile(new URL('results.json',out),JSON.stringify(report,null,2));}
// Explicitly unload to make cold-load measurement distinct from warmed repetitions.
const unload=await fetch('http://127.0.0.1:11434/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:client.model,keep_alive:0}),signal:AbortSignal.timeout(30000)});if(!unload.ok)throw Error('Could not unload model for cold benchmark');await unload.json();
await run('cold-anchor',anchor,'cold');
for(let i=1;i<=10;i++)await run(`warm-anchor-${i}`,anchor,'warm');
for(const c of cases)await run(c.id,caseInput(c,image),'reviewed-case',c.expect);
const warm=results.filter(r=>r.kind==='warm');const durations=warm.map(r=>r.elapsedMs).sort((a,b)=>a-b);const q=p=>durations[Math.ceil(p*durations.length)-1];
report.summary={warmRuns:warm.length,acceptedWarm:warm.filter(r=>r.accepted).length,p50Ms:q(.5),p95Ms:q(.95),maxMs:durations.at(-1),latencyGate:q(.95)<90000,invalidWarm:warm.filter(r=>!r.accepted).length,acceptedCases:results.filter(r=>r.kind==='reviewed-case'&&r.accepted).length,caseCount:cases.length,coldMs:results[0].elapsedMs,semanticReview:'PENDING',demoReady:false};report.finishedAt=new Date().toISOString();await writeFile(new URL('results.json',out),JSON.stringify(report,null,2));console.log(JSON.stringify(report.summary,null,2));
