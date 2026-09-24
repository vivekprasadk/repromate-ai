import {readFile,writeFile,mkdir,rename,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const corpus=JSON.parse(await readFile(new URL('../knowledge/corpus.json',import.meta.url),'utf8'));
const decode=s=>s.replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n)));
const clean=s=>decode(s.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<nav[\s\S]*?<\/nav>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim());
function extract(html,meta){
  const title=clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||meta.product);
  const blocks=[];let heading=title;
  const re=/<(h[1-4]|p|li|pre|table)\b[^>]*>([\s\S]*?)<\/\1>/gi;let match;
  while((match=re.exec(html))){const text=clean(match[2]);if(!text)continue;if(/^h[1-4]$/i.test(match[1])){heading=text;continue;}if(text.length>=35)blocks.push({heading,text});}
  const passages=[];let current=null;
  for(const block of blocks){if(!current||current.heading!==block.heading||`${current.text} ${block.text}`.split(/\s+/).length>240){current={heading:block.heading,text:block.text};passages.push(current);}else current.text+=`\n\n${block.text}`;}
  return passages.map((p,i)=>({...p,id:createHash('sha256').update(`${meta.url}\n${p.heading}\n${p.text}`).digest('hex').slice(0,24),title,product:meta.product,productKey:meta.productKey,url:meta.url,version:'Current Oracle online documentation',ordinal:i+1}));
}
const passages=[];const failures=[];
for(const item of corpus){
  process.stdout.write(`Fetching ${item.productKey}: ${item.url}\n`);
  try{const response=await fetch(item.url,{redirect:'error',headers:{'User-Agent':'ReproMate-local-indexer/1.0'}});if(!response.ok)throw Error(`HTTP ${response.status}`);const html=await response.text();const downloadedAt=new Date().toISOString();const contentHash=createHash('sha256').update(html).digest('hex');const extracted=extract(html,item).map(p=>({...p,downloadedAt,contentHash}));if(!extracted.length)throw Error('no readable passages');passages.push(...extracted);}
  catch(e){failures.push(`${item.url}: ${e.message}`);}
}
if(failures.length)throw Error(`Knowledge refresh failed; active index unchanged.\n${failures.join('\n')}`);
const index={version:createHash('sha256').update(JSON.stringify(passages)).digest('hex').slice(0,16),builtAt:new Date().toISOString(),documents:corpus.length,passages};
await mkdir(`${root}knowledge`,{recursive:true});const active=`${root}knowledge/index.json`;const temp=`${active}.tmp`;const backup=`${active}.previous`;await writeFile(temp,JSON.stringify(index,null,2),'utf8');
await rm(backup,{force:true});let moved=false;
try{try{await rename(active,backup);moved=true;}catch(e){if(e.code!=='ENOENT')throw e;}await rename(temp,active);await rm(backup,{force:true});}
catch(e){await rm(temp,{force:true});if(moved)await rename(backup,active);throw e;}
console.log(`Activated knowledge index ${index.version}: ${index.documents} documents, ${passages.length} passages.`);
