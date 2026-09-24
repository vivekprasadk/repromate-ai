import {demoReport,reportMarkdown} from './contract.mjs';
import {sample} from './sample.mjs';
const $=id=>document.getElementById(id);
const hosted=!['127.0.0.1','localhost','[::1]'].includes(location.hostname)||new URLSearchParams(location.search).has('demo');
let image=null,report=null,reportImage=null,controller=null,generation=0,imageGeneration=0,busy=false,attachmentLoading=false,analysisTimeoutSeconds=300;
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
function invalidate(){report=null;reportImage=null;$('report').replaceChildren();$('empty').hidden=false;$('export').disabled=true;$('export-json').disabled=true;}
function showImage(value){image=value;$('preview-wrap').hidden=!value;if(value)$('preview').src=value.dataUrl;else $('preview').removeAttribute('src');}
function clearImage(){imageGeneration++;setAttachmentLoading(false);showImage(null);$('screenshot').value='';invalidate();}
function dataURL(blob){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(Error('Could not read image'));r.readAsDataURL(blob);});}
function setAttachmentLoading(value){attachmentLoading=value;$('analyze').disabled=busy||value;if(!busy)$('analyze').textContent=value?'Loading screenshot…':'Generate investigation →';}
async function attach(file,expectedId){
  const id=expectedId??++imageGeneration;if(expectedId!==undefined&&id!==imageGeneration)return;
  invalidate();showImage(null);setAttachmentLoading(true);$('error').textContent='';
  try{
    if(!file)return;
    if(file.size>4*1024*1024||!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('Choose one PNG, JPEG or WebP image of at most 4 MB.');
    const url=await dataURL(file);const decoded=new Image();decoded.src=url;await decoded.decode();
    if(id===imageGeneration)showImage({id:'screenshot-1',name:file.name||'synthetic-account-save.png',mimeType:file.type,dataUrl:url});
  }catch(e){if(id===imageGeneration){$('screenshot').value='';throw e;}}
  finally{if(id===imageGeneration)setAttachmentLoading(false);}
}
$('remove').onclick=clearImage;
$('screenshot').onchange=()=>attach($('screenshot').files[0]).catch(e=>$('error').textContent=e.message);
const drop=$('drop-zone');drop.ondragover=e=>{e.preventDefault();if(!busy)drop.classList.add('dragging');};drop.ondragleave=()=>drop.classList.remove('dragging');
drop.ondrop=e=>{e.preventDefault();drop.classList.remove('dragging');if(busy)return;if(e.dataTransfer.files.length!==1){$('error').textContent='Drop exactly one screenshot.';return;}attach(e.dataTransfer.files[0]).catch(e=>$('error').textContent=e.message);};
$('sample').onclick=async()=>{
  const id=++imageGeneration;invalidate();showImage(null);$('screenshot').value='';setAttachmentLoading(true);$('error').textContent='';
  for(const k of Object.keys(sample))$(k).value=sample[k];
  try{const r=await fetch('./sample.png');if(!r.ok)throw Error('Bundled screenshot unavailable');await attach(await r.blob(),id);}
  catch(e){if(id===imageGeneration)$('error').textContent=e.message;}
  finally{if(id===imageGeneration)setAttachmentLoading(false);}
};
for(const id of ['description','environment','logs','product','mode'])$(id).addEventListener('input',invalidate);
function timeoutLabel(){return analysisTimeoutSeconds%60===0?`${analysisTimeoutSeconds/60} minutes`:`${analysisTimeoutSeconds} seconds`;}
function engineNote(){$('engine-note').textContent=$('mode').value==='demo'?'Deterministic demonstration: no AI or image analysis; inputs stay in this browser.':`Experimental local AI: evidence is sent only to this local app and local Ollama. No history or cloud API. Allow up to ${timeoutLabel()} on CPU.`;}
$('mode').onchange=engineNote;
async function readiness(){if(hosted){$('readiness').textContent='Hosted demonstration · browser-only · no uploads';return;}
  $('readiness').textContent='Checking local Ollama…';
  try{const res=await fetch('./api/status');if(!res.ok)throw Error('Local service unavailable');const s=await res.json();if(s.apiVersion!==3)throw Error('Older local service detected; restart ReproMate');if(Number.isFinite(s.analysisTimeoutSeconds))analysisTimeoutSeconds=s.analysisTimeoutSeconds;$('mode').options[1].disabled=!s.ready;$('mode').options[1].textContent=`Local AI · ${s.model||'unavailable'}`;const k=s.knowledge?.ready?` · knowledge ${s.knowledge.documents} docs/${s.knowledge.passages} passages`:' · knowledge index unavailable';$('readiness').textContent=(s.ready?`Model available · ${s.model} · vision capable · Ollama ${s.version}`:s.error)+k;if(!s.ready&&$('mode').value==='ai')$('mode').value='demo';engineNote();}
  catch(e){$('readiness').textContent=e.message+'. Demo remains available.';$('mode').options[1].disabled=true;}
}
$('refresh-status').onclick=readiness;readiness();engineNote();
function section(title){const s=el('section',undefined,'report-section');s.append(el('h3',title));$('report').append(s);return s;}
function modelLabel(model){if(!model)return 'Browser-only';if(model.startsWith('qwen3-vl:4b'))return 'Qwen3-VL 4B';if(model==='gemma3:4b')return 'Gemma 3 4B';return model;}
function compactRunDetails(r){
  if(r.metadata.mode==='demo')return 'Deterministic demo · Browser-only · Screenshot not analyzed';
  const seconds=Math.max(0,r.metadata.processingDurationMs/1000).toFixed(1);
  const image=r.metadata.visualEvidenceUsed?'Screenshot analyzed':r.metadata.imageSubmitted?'Screenshot supplied · no visual finding accepted':'No screenshot';
  const discarded=r.metadata.discardedCitationCount===1?'1 invalid citation removed':`${r.metadata.discardedCitationCount} invalid citations removed`;
  return `Local AI · ${modelLabel(r.metadata.model)} · ${seconds}s · ${image} · ${discarded}`;
}
function appendReferences(references){
  const s=section('Technical references — retrieved guidance, not case evidence');if(!references?.length)s.append(el('p','No sufficiently relevant local VBCS/OIC reference was found.'));
  for(const ref of references||[]){const c=el('div',undefined,'card');const a=el('a',ref.title);a.href=ref.url;a.target='_blank';a.rel='noreferrer';c.append(el('span',ref.product,'tag'),a,el('p',ref.heading),el('p',ref.excerpt));s.append(c);}
}
function renderEarlyReferences(retrieval){$('empty').hidden=true;$('report').replaceChildren(el('div','Local technical references are ready. The AI investigation is still being prepared.','notice'));appendReferences(retrieval.references);}
function render(r){$('empty').hidden=true;$('report').replaceChildren(el('div',r.notice,'notice'),el('span',r.summaryLabel||'Unverified summary','tag'),el('p',r.summary,'summary'));
  let s=section('Evidence & observations');for(const o of r.observations){const c=el('div',undefined,'card');c.append(el('span',o.label,`tag tag-${o.source}`),el('p',o.text));if(o.source==='visual'){const im=el('img');im.src=reportImage.dataUrl;im.alt=`${o.imageRef}: ${reportImage.name} — unverified visual evidence`;im.className='evidence-image';c.append(im);}else c.append(el('blockquote',o.quote));s.append(c);}
  appendReferences(r.technicalReferences);
  for(const [title,key]of [[`Reproduction steps — ${r.reproductionStatus}`,'steps'],['Missing information','questions']]){s=section(title);const list=el('ol');for(const text of r[key])list.append(el('li',text));s.append(list);}
  s=section('Conditional hypotheses — unverified');if(!r.hypotheses.length)s.append(el('p','Insufficient evidence for a specific cause.'));
  for(const h of r.hypotheses){const c=el('div',undefined,'card');c.append(el('strong',h.title),el('p',h.reason),el('p','Verification check: '+h.check));s.append(c);}
  s=section('Suggested test cases');for(const t of r.tests){const c=el('div',undefined,'card');c.append(el('strong',t.name),el('p','Steps: '+t.steps),el('p','Expected: '+t.expected));s.append(c);}
  $('report').append(el('p',compactRunDetails(r),'run-details'));
}
function setBusy(value){busy=value;for(const id of ['sample','description','environment','logs','product','screenshot','remove','mode','analyze','refresh-status'])$(id).disabled=value;$('analyze').disabled=value||attachmentLoading;$('cancel').hidden=!value;$('analyze').textContent=value?'Analyzing locally…':attachmentLoading?'Loading screenshot…':'Generate investigation →';if(!value)readiness();}
$('cancel').onclick=()=>{generation++;controller?.abort();setBusy(false);$('elapsed').textContent='Cancelled. No result retained.';invalidate();};
$('form').onsubmit=async e=>{e.preventDefault();if(busy||attachmentLoading)return;const id=++generation;invalidate();$('error').textContent='';const input={description:$('description').value,environment:$('environment').value,logs:$('logs').value,product:$('product').value,mode:$('mode').value,image};reportImage=image;setBusy(true);controller=new AbortController();const start=performance.now();let earlyReferencesShown=false;const tick=setInterval(()=>{if(id===generation)$('elapsed').textContent=`Elapsed: ${((performance.now()-start)/1000).toFixed(1)} s · you can cancel safely`;},100);
  try{let result;if(input.mode==='demo')result=demoReport(input);else{
      try{const search=await fetch('./api/knowledge/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:`${input.description}\n${input.environment}\n${input.logs}`,product:input.product}),signal:controller.signal});if(search.ok){const retrieval=await search.json();if(id!==generation)return;renderEarlyReferences(retrieval);earlyReferencesShown=true;}}
      catch(searchError){if(controller.signal.aborted)throw searchError;}
      const response=await fetch('./api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input),signal:controller.signal});const data=await response.json();if(!response.ok){const failure=Error(data.error||'Analysis failed');failure.diagnostics=data.diagnostics;throw failure;}result=data;
    }if(id!==generation)return;report=result;render(report);$('elapsed').textContent=`Completed in ${((performance.now()-start)/1000).toFixed(1)} s. Server processing: ${report.metadata.processingDurationMs} ms.`;$('export').disabled=false;$('export-json').disabled=false;
  }catch(error){if(id===generation){if(!earlyReferencesShown)invalidate();$('error').textContent=error.message;const d=error.diagnostics;$('elapsed').textContent=d?`No report accepted. Stopped during ${String(d.phase).replaceAll('-',' ')} after ${(d.elapsedMs/1000).toFixed(1)} s.`:'No report accepted.';}}finally{clearInterval(tick);if(id===generation)setBusy(false);}
};
function download(type){if(!report)return;const content=type==='json'?JSON.stringify(report,null,2):reportMarkdown(report);const url=URL.createObjectURL(new Blob([content],{type:type==='json'?'application/json':'text/markdown'}));const a=el('a');a.href=url;a.download=`repromate-investigation.${type}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('export').onclick=()=>download('md');$('export-json').onclick=()=>download('json');
