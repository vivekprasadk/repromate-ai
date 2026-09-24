export const PRIMARY_MODEL = 'qwen3-vl:4b-instruct-q4_K_M';
export const NOTICE = 'Investigation guidance only. Steps are proposed and unexecuted; causes are hypotheses, not confirmed findings. Review suggested checks before using them in an authorized, isolated test environment; never apply destructive checks to live data.';
export const LABELS = {description:'Reported text — not independently verified',logs:'Supplied logs — not independently verified',visual:'AI-observed visual evidence — unverified'};
const str = {type:'string',minLength:1,maxLength:3000};
const obj = properties => ({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const arr = items => ({type:'array',items,maxItems:8});
export const REPORT_SCHEMA = obj({summary:str,
  observations:arr(obj({text:str,source:{type:'string',enum:['description','logs','visual']},quote:{type:'string',maxLength:3000},imageRef:{type:'string',maxLength:100}})),
  steps:arr(str),questions:arr(str),hypotheses:arr(obj({title:str,reason:str,check:str})),tests:arr(obj({name:str,steps:str,expected:str}))});
export function checkSchema(value, schema=REPORT_SCHEMA, path='report') {
  if(schema.type==='object') {
    if(!value || typeof value!=='object' || Array.isArray(value)) throw Error(`Invalid ${path}: object required`);
    if(Object.keys(value).some(k=>!Object.hasOwn(schema.properties,k))) throw Error(`Invalid ${path}: unknown field`);
    for(const k of schema.required) if(!Object.hasOwn(value,k)) throw Error(`Invalid ${path}.${k}: required`);
    for(const [k,s] of Object.entries(schema.properties)) checkSchema(value[k],s,`${path}.${k}`);
  } else if(schema.type==='array') {
    if(!Array.isArray(value)||value.length>schema.maxItems) throw Error(`Invalid ${path}: array limit`);
    value.forEach((v,i)=>checkSchema(v,schema.items,`${path}[${i}]`));
  } else if(typeof value!=='string' || value.length<(schema.minLength||0) || value.length>schema.maxLength || (schema.enum&&!schema.enum.includes(value))) throw Error(`Invalid ${path}: string constraint`);
}
export function validateReport(raw,input) {
  checkSchema(raw);
  const summarySentences=raw.summary.split(/(?<=[.!?;])\s+/);
  if(summarySentences.some(sentence=>/\b(?:due to|caused by|because of|root cause (?:is|was)|results? from)\b/i.test(sentence)&&! /\b(?:may|might|could|possibly|potentially|suggests?)\b/i.test(sentence))) throw Error('Invalid report: summary claim presents a possible cause as established');
  if(raw.observations.some(o=>o.source==='visual'&&/\b(?:proves?|confirms?|definitively|conclusively)\b/i.test(o.text))) throw Error('Invalid report: visual interpretation cannot establish confirmed facts');
  const prose=[raw.summary,...raw.observations.map(o=>o.text),...raw.steps,...raw.questions,...raw.hypotheses.flatMap(h=>Object.values(h)),...raw.tests.flatMap(t=>Object.values(t))];
  if(prose.some(s=>/\b(?:I|we)\s+(?:(?:have|successfully)\s+)*(?:executed|reproduced|confirmed|tested)\b|\b(?:confirmed (?:root )?cause|(?:issue|bug|case) (?:was|is|has been) (?:successfully )?(?:reproduced|executed|confirmed))\b/i.test(s))) throw Error('Invalid report: unsupported execution or certainty claim');
  if(raw.hypotheses.some(h=>!(/\b(may|might|could|if|possible|potential)\b/i.test(h.title)))) throw Error('Invalid report: hypotheses must use conditional language');
  let discardedCitations=0;const observations=[];
  for(const o of raw.observations){
    if(o.source==='visual'){
      if(!input.image||o.imageRef!=='screenshot-1'){discardedCitations++;continue;}
      observations.push({...o,quote:'',label:LABELS.visual,verified:false});
    }else{
      if(!o.quote.trim()||!input[o.source]?.includes(o.quote)){discardedCitations++;continue;}
      // The exact text citation remains valid even if the model adds a stray image citation.
      if(o.imageRef)discardedCitations++;
      observations.push({...o,imageRef:'',label:LABELS[o.source],verified:false});
    }
  }
  if(!observations.length) throw Error('No valid evidence citations. Revise the input or retry; no AI report was accepted.');
  return {...raw,observations,discardedCitations};
}
export function finishReport(report,{mode,model=null,durationMs=0,input,digest=null,knowledge={references:[],insufficientEvidence:true,durationMs:0,product:input.product||'auto'}}) {
  const visualEvidenceUsed=report.observations.some(o=>o.source==='visual');
  return {...report,notice:mode==='demo'?'Deterministic demonstration — not AI analysis. Screenshots are previewed, never analyzed. '+NOTICE:'Experimental local AI. '+NOTICE+(input.image&&!visualEvidenceUsed?' No visual finding was accepted; this report does not establish what the screenshot shows.':''),
    summaryLabel:mode==='ai'?'AI synthesis — unverified':'Deterministic demonstration summary',
    reproductionStatus:'Proposed — unexecuted',
    technicalReferences:knowledge.references||[],
    evidenceSources:{description:'User-supplied report',logs:'User-supplied logs',image:input.image?{id:input.image.id,name:input.image.name,mimeType:input.image.mimeType}:null},
    metadata:{mode,model,modelDigest:digest,processingDurationMs:Math.round(durationMs),discardedCitationCount:report.discardedCitations,imageSubmitted:Boolean(input.image),visualEvidenceUsed,knowledgeProduct:knowledge.product||input.product||'auto',knowledgeRetrievalMs:knowledge.durationMs||0,knowledgeReferenceCount:knowledge.references?.length||0,knowledgeInsufficientEvidence:Boolean(knowledge.insufficientEvidence)}};
}
export function demoReport(input,knowledge) {
  const start=performance.now();
  const known=input.logs.includes('PATCH /api/accounts/1042 409')&&input.description.includes('disappears after refresh');
  const obs=(text,source,quote)=>({text,source,quote,imageRef:''});
  const report=validateReport({summary:known?'The report describes a success notification despite a supplied HTTP 409 save response and a value that disappears after refresh.':'A deterministic investigation checklist based on the supplied report; no tailored AI analysis was performed.',
    observations:[obs('The user reports this behavior.','description',input.description.slice(0,3000)),...(known?[obs('The supplied log records HTTP 409 for the save request.','logs','PATCH /api/accounts/1042 409')]:[]),...(known&&input.logs.includes('UI notification: "Account saved successfully"')?[obs('The supplied log also records a success notification, conflicting with the failed request.','logs','UI notification: "Account saved successfully"')]:[])],
    steps:['Open the affected screen in the reported environment.','Repeat the reported action with the same inputs.','Capture the UI notification and network response.','Refresh and compare displayed state with the intended change.'],
    questions:['Which application version, user role, and record version were involved?','How often does this occur, and does it affect other records?'],
    hypotheses:known?[{title:'The UI may display success on a failed response',reason:'The supplied evidence suggests a mismatch between the HTTP response and the UI notification.',check:'Inspect the Save action chain success and error branches.'},{title:'A record version conflict could prevent persistence',reason:'HTTP 409 may indicate conflicting state; inspect the response before drawing a conclusion.',check:'Compare the submitted record version with the backend version.'}]:[],
    tests:[{name:'Successful save',steps:'In a test environment, save with a successful backend response and refresh.',expected:'The updated value persists.'},{name:'Failed save',steps:'In a test environment, simulate HTTP 409 during Save.',expected:'An error appears and no success notification is displayed.'}]
  },input);
  return finishReport(report,{mode:'demo',input,durationMs:performance.now()-start,knowledge});
}
export function reportMarkdown(r) {
  const literal=value=>String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/[\\\x60*_\[\]#|]/g,'\\$&');
  const lines=['# ReproMate investigation',literal(r.notice),'## Summary — '+literal(r.summaryLabel||'Unverified synthesis'),literal(r.summary),'## Evidence'];
  for(const o of r.observations) lines.push(`### ${literal(o.label)}`,literal(o.text),o.source==='visual'?`Image: ${literal(o.imageRef)} (${literal(r.evidenceSources.image?.name)})`:`Source: ${o.source}\n\n${o.quote.split('\n').map(l=>'> '+literal(l)).join('\n')}`);
  lines.push('## Technical references — retrieved guidance, not case evidence');
  if(!r.technicalReferences?.length)lines.push('No sufficiently relevant local reference was found.');
  for(const ref of r.technicalReferences||[])lines.push(`### [${literal(ref.title)}](${ref.url})`,`${literal(ref.product)} · ${literal(ref.heading)}`,literal(ref.excerpt));
  lines.push(`## Reproduction steps — ${literal(r.reproductionStatus)}`,...r.steps.map((s,i)=>`${i+1}. ${literal(s)}`),'## Missing information',...r.questions.map(s=>'- '+literal(s)),'## Conditional hypotheses — unverified');
  if(!r.hypotheses.length)lines.push('Insufficient evidence for a specific cause.');
  for(const h of r.hypotheses) lines.push(`### ${literal(h.title)}`,literal(h.reason),`Verification check: ${literal(h.check)}`);
  lines.push('## Suggested test cases');
  for(const t of r.tests) lines.push(`### ${literal(t.name)}`,`Steps: ${literal(t.steps)}`,`Expected: ${literal(t.expected)}`);
  lines.push('## Metadata','```json',JSON.stringify(r.metadata,null,2),'```','## Evidence sources','```json',JSON.stringify(r.evidenceSources,null,2),'```');
  return lines.join('\n\n')+'\n';
}
