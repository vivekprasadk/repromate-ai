import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {validateReport,LABELS} from '../src/report.mjs';
import {decodeModelReport} from '../src/ollama.mjs';
import {cases,caseInput} from '../test/cases.mjs';

const label=process.env.EVALUATION_LABEL||'';if(label&&!/^[a-z0-9-]{1,40}$/.test(label))throw Error('Invalid evaluation label');
const audits=[];
for(const model of ['qwen3-vl:4b-instruct-q4_K_M','gemma3:4b']){
  const directory=new URL('../evaluation/'+model.replace(/[^a-z0-9-]/gi,'_')+(label?'-'+label:'')+'/',import.meta.url);
  let result;
  try{result=JSON.parse(await readFile(new URL('results.json',directory),'utf8'));}catch{continue;}
  const groups=new Map(),entries=[];
  for(const run of result.results){
    const entry={id:run.id,kind:run.kind,elapsedMs:run.elapsedMs,originallyAccepted:run.accepted,
      finalPolicyAccepted:false,originalError:run.error,error:run.error};
    let raw;
    try{
      if(run.rawModelOutput){raw=JSON.parse(run.rawModelOutput);entry.auditInput='complete original model JSON';}
      else if(run.accepted){
        raw=Object.fromEntries(['summary','steps','questions','hypotheses','tests'].map(k=>[k,run.output[k]]));
        raw.observations=run.output.observations.map(({text,source,quote,imageRef})=>({text,source,quote,imageRef}));
        entry.auditInput='retained report; earlier discarded observations unavailable';
        for(const o of run.output.observations)if(o.label!==LABELS[o.source]||o.verified!==false)throw Error('Incorrect evidence label');
      }else if(run.rejectedModelOutput){
        raw=JSON.parse(run.rejectedModelOutput);
        entry.auditInput='original rejected model JSON; post-hoc revalidation';
      }else{entries.push(entry);continue;}
      const c=run.kind==='reviewed-case'?cases.find(c=>c.id===run.id):cases.find(c=>c.id==='vision-anchor');
      const input=caseInput(c,{id:'screenshot-1'});
      const checked=Object.hasOwn(raw,'visualObservations')?decodeModelReport(raw,input):validateReport(raw,input);
      entry.finalPolicyAccepted=true;
      delete entry.error;
      entry.visualObservations=checked.observations.filter(o=>o.source==='visual').length;
      entry.discardedCitations=(run.rawModelOutput?0:(run.output?.discardedCitations||0))+checked.discardedCitations;
      entry.finalPolicyObservations=checked.observations;
    }catch(e){entry.error=e.message;}
    if(raw){
      const hash=createHash('sha256').update(JSON.stringify(raw)).digest('hex').slice(0,12);
      entry.outputGroup=hash;
      const group=groups.get(hash)||{ids:[],raw};
      group.ids.push(run.id);groups.set(hash,group);
    }
    entries.push(entry);
  }
  const warm=entries.filter(e=>e.kind==='warm');
  const sorted=warm.map(e=>e.elapsedMs).sort((a,b)=>a-b);
  const p=q=>sorted[Math.ceil(q*sorted.length)-1];
  const audit={model,protocolRevision:result.protocolRevision||'baseline',digest:result.digest,hardware:result.hardware,conditions:result.conditions,
    complete:!!result.finishedAt,entries,
    warm:{count:warm.length,p50Ms:p(.5),p95Ms:p(.95),maxMs:sorted.at(-1),
      finalPolicyAccepted:warm.filter(r=>r.finalPolicyAccepted).length,latencyPass:warm.length>=10&&p(.95)<90000},
    uniqueOutputs:Object.fromEntries(groups),
    semanticReview:'See evaluation/REPORT.md and the protocol-specific semantic review. Post-hoc policy validation is not a fresh inference run or a semantic quality guarantee.'};
  await writeFile(new URL('audit.json',directory),JSON.stringify(audit,null,2));
  audits.push(audit);
  console.log(JSON.stringify({model,complete:audit.complete,warm:audit.warm,
    reviewedCases:entries.filter(e=>e.kind==='reviewed-case').map(({finalPolicyObservations,...entry})=>entry)},null,2));
}
await writeFile(new URL('../evaluation/metrics'+(label?'-'+label:'')+'.json',import.meta.url),JSON.stringify(audits.map(({uniqueOutputs,...audit})=>audit),null,2));
