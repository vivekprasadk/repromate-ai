import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const DEFAULT_INDEX=fileURLToPath(new URL('../knowledge/index.json',import.meta.url));
const STOP=new Set('a an and are as at be been but by can could did do does for from had has have how if in into is it its may might not of on or our should so than that the their then there these they this to was were what when where which who will with would you your'.split(' '));
function words(value){return String(value||'').toLowerCase().match(/[a-z][a-z0-9_-]{1,}|\b\d{3}\b/g)?.filter(w=>!STOP.has(w))||[];}
function inferProduct(query){
  const q=query.toLowerCase();
  if(/\b(?:oic|oracle integration|integration instance|connectivity agent)\b/.test(q))return 'oic';
  if(/\b(?:vbcs|visual builder|action chain|service data provider)\b/.test(q))return 'vbcs';
  return 'auto';
}
function scorePassage(p,queryTokens,queryText,product){
  const hay=`${p.title} ${p.heading} ${p.text}`.toLowerCase();
  const title=`${p.title} ${p.heading}`.toLowerCase();
  const docTokens=new Set(words(hay));
  let score=0,matched=0;
  for(const token of new Set(queryTokens))if(docTokens.has(token)){matched++;score+=/^\d{3}$/.test(token)||/[a-z]+-?\d{3,}/.test(token)?7:1;}
  for(const phrase of queryText.match(/\b(?:[a-z]+[-_])?\d{3,}\b|\b(?:http|rest|oauth|wsdl|json|timeout|conflict|mapping|adapter|variable|binding|action chain)\b/gi)||[])if(hay.includes(phrase.toLowerCase()))score+=2;
  if(product!=='auto'&&p.productKey===product)score+=3;
  if(product!=='auto'&&p.productKey!==product)score-=4;
  if(p.productKey==='oic'&&/\b(?:error|failed|failure|bad request|internal server|\d{3})\b/i.test(queryText)){
    if(p.url.endsWith('/error-management.html'))score+=30;
    if(p.url.includes('/determine-source-integrations-error.html'))score+=25;
    if(/troubleshoot integration runtime/.test(p.title.toLowerCase()))score+=5;
    if(p.url.includes('/troubleshoot-integration-design-time.html')&&!/\bdesign(?:-time)?|configure|mapper|mapping\b/i.test(queryText))score-=15;
    if(p.url.includes('/troubleshoot-integration-activations.html')&&!/\bactivat(?:e|ion|ing)|deploy(?:ment)?\b/i.test(queryText))score-=15;
    if(/object storage/.test(title)&&!/object storage|bucket/i.test(queryText))score-=8;
  }
  const coverage=queryTokens.length?matched/new Set(queryTokens).size:0;
  return score+coverage*4;
}
function safeReference(p,score){return {id:p.id,product:p.product,productKey:p.productKey,title:p.title,heading:p.heading,url:p.url,excerpt:p.text.slice(0,1200),version:p.version||'Not specified',score:Number(score.toFixed(3))};}

export function createKnowledge({indexPath=process.env.REPROMATE_KNOWLEDGE_INDEX||DEFAULT_INDEX}={}){
  let loaded=null,error=null;
  async function load(){
    if(loaded||error)return;
    try{
      const parsed=JSON.parse(await readFile(indexPath,'utf8'));
      if(!Array.isArray(parsed.passages)||!parsed.passages.length)throw Error('index contains no passages');
      loaded=parsed;
    }catch(e){error=`Knowledge index unavailable: ${e.message}. Run node scripts/knowledge-refresh.mjs while online.`;}
  }
  async function status(){await load();return loaded?{ready:true,version:loaded.version,builtAt:loaded.builtAt,documents:loaded.documents,passages:loaded.passages.length,products:[...new Set(loaded.passages.map(p=>p.productKey))]}:{ready:false,error,documents:0,passages:0,products:[]};}
  async function search({query,product='auto',limit=3}={}){
    await load();const started=performance.now();
    const clean=String(query||'').trim();if(!clean||!loaded)return {query:clean,product,references:[],durationMs:Math.round((performance.now()-started)*1000)/1000,insufficientEvidence:true};
    const selected=product==='auto'?inferProduct(clean):product;
    const expanded=words(clean);
    const candidates=selected==='auto'?loaded.passages:loaded.passages.filter(p=>p.productKey===selected);
    const ranked=candidates.map(p=>({p,score:scorePassage(p,expanded,clean,selected)})).filter(x=>x.score>6).sort((a,b)=>b.score-a.score||a.p.id.localeCompare(b.p.id));
    const seen=new Set(),references=[];
    for(const item of ranked){if(seen.has(item.p.url))continue;seen.add(item.p.url);references.push(safeReference(item.p,item.score));if(references.length>=Math.min(5,Math.max(1,limit)))break;}
    return {query:clean,product:selected,references,durationMs:Math.round((performance.now()-started)*1000)/1000,insufficientEvidence:references.length===0};
  }
  return {status,search,indexPath};
}
