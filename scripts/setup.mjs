import {mkdir,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createOllama} from '../src/ollama.mjs';
import {PRIMARY_MODEL} from '../src/report.mjs';
import {createKnowledge} from '../src/knowledge.mjs';
const model=process.env.OLLAMA_MODEL||PRIMARY_MODEL;
if(process.argv.includes('--pull')){
  if(![PRIMARY_MODEL,'gemma3:4b'].includes(model))throw Error('Setup downloads only the approved primary/fallback models');
  console.log(`Explicit setup download: ${model}. Model weights stay in Ollama, outside this repository.`);
  const code=await new Promise((resolve,reject)=>{const p=spawn('ollama',['pull',model],{stdio:'inherit',shell:false});p.on('error',reject);p.on('exit',resolve);});
  if(code!==0)throw Error('Model download failed. Check Ollama and network access.');
}
const state=await createOllama({model}).readiness();
const knowledge=await createKnowledge().status();
if(!knowledge.ready){console.error(knowledge.error);process.exitCode=1;}else console.log(`Local knowledge ready: ${knowledge.documents} Oracle documents, ${knowledge.passages} passages, index ${knowledge.version}.`);
if(!state.ready){console.error(state.error);process.exitCode=1;}else{
  if(model===PRIMARY_MODEL&&!/Apache License|Apache-2\.0/i.test(state.license||''))throw Error('Expected Apache-2.0 license metadata was not found; setup stopped.');
  const metadata={...state,recordedAt:new Date().toISOString(),licenseIdentifier:model===PRIMARY_MODEL?'Apache-2.0':'Gemma terms',licenseSource:model===PRIMARY_MODEL?'https://huggingface.co/Qwen/Qwen3-VL-4B-Instruct/tree/main':'https://ai.google.dev/gemma/terms',modelSource:`https://ollama.com/library/${model}`,weightsCommitted:false};
  await mkdir(new URL('../.runtime/',import.meta.url),{recursive:true});
  await writeFile(new URL('../.runtime/model-provenance.json',import.meta.url),JSON.stringify(metadata,null,2));
  await writeFile(new URL(`../.runtime/model-provenance-${model.replace(/[^a-z0-9-]/gi,'_')}.json`,import.meta.url),JSON.stringify(metadata,null,2));
  console.log(JSON.stringify({...metadata,license:'Full installed license recorded in .runtime/model-provenance.json'},null,2));
}
