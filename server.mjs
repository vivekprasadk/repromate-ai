import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve,extname,sep} from 'node:path';
import {validateInput,MAX_BODY} from './src/input.mjs';
import {demoReport} from './src/report.mjs';
import {createOllama,DEFAULT_TIMEOUT_MS} from './src/ollama.mjs';
import {createKnowledge} from './src/knowledge.mjs';
const publicDir=fileURLToPath(new URL('./public/',import.meta.url));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.json':'application/json'};
export function createServer({ollama=createOllama(),knowledge=createKnowledge(),staticOnly=false}={}) {
  let active=false;
  return http.createServer(async(req,res)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' data: blob:; connect-src 'self'; style-src 'self'; script-src 'self'; frame-ancestors 'none'; base-uri 'none'");
    const json=(status,value)=>{if(!res.destroyed&&!res.writableEnded){res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(value));}};
    try {
      const host=req.headers.host||'';
      if(!/^(127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/.test(host)) return json(403,{error:'Loopback host required'});
      if(req.headers.origin&&req.headers.origin!==`http://${host}`) return json(403,{error:'Cross-origin requests are not allowed'});
      const path=new URL(req.url,`http://${host}`).pathname;
      if(!staticOnly&&req.method==='GET'&&path==='/api/status') {const s=await ollama.readiness();delete s.license;return json(200,{app:'repromate',apiVersion:3,analysisTimeoutSeconds:Math.round((ollama.timeoutMs??DEFAULT_TIMEOUT_MS)/1000),knowledge:await knowledge.status(),...s});}
      if(!staticOnly&&req.method==='POST'&&path==='/api/knowledge/search'){
        if(!req.headers['content-type']?.startsWith('application/json'))return json(415,{error:'Content-Type must be application/json'});
        const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>100000)return json(413,{error:'Search request is too large'});chunks.push(chunk);}
        let value;try{value=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return json(400,{error:'Invalid JSON'});}
        if(!value||typeof value.query!=='string'||value.query.trim().length<3||value.query.length>100000||!['auto','vbcs','oic'].includes(value.product??'auto'))return json(400,{error:'Provide query text and product auto, vbcs or oic'});
        return json(200,await knowledge.search({query:value.query,product:value.product??'auto'}));
      }
      if(!staticOnly&&req.method==='POST'&&path==='/api/analyze') {
        if(!req.headers['content-type']?.startsWith('application/json')) return json(415,{error:'Content-Type must be application/json'});
        if(Number(req.headers['content-length'])>MAX_BODY){req.resume();return json(413,{error:'Combined request limit is 8 MB'});}
        const body=await new Promise((resolve,reject)=>{let size=0;let chunks=[];let exceeded=false;
          req.on('data',chunk=>{size+=chunk.length;if(exceeded)return;if(size>MAX_BODY){exceeded=true;chunks=[];json(413,{error:'Combined request limit is 8 MB'});resolve(null);}else chunks.push(chunk);});
          req.on('end',()=>resolve(exceeded?null:Buffer.concat(chunks)));req.on('error',reject);});
        if(body===null)return;
        let input;try{input=validateInput(JSON.parse(body.toString('utf8')));}catch(e){return json(400,{error:e.message});}
        const retrieval=await knowledge.search({query:`${input.description}\n${input.environment}\n${input.logs}`,product:input.product,limit:3});
        if(input.mode==='demo')return json(200,demoReport(input,retrieval));
        if(active)return json(409,{error:'Another local analysis is still finishing. Please retry shortly.'});
        active=true;const controller=new AbortController();res.on('close',()=>{if(!res.writableEnded)controller.abort();});
        try{return json(200,await ollama.analyze(input,{signal:controller.signal,knowledge:retrieval}));}finally{active=false;}
      }
      if(req.method!=='GET')return json(405,{error:'Method not allowed'});
      const relative=decodeURIComponent(path==='/'?'/index.html':path);
      const target=resolve(publicDir,'.'+relative);
      if(!target.startsWith(publicDir.endsWith(sep)?publicDir:publicDir+sep)||!mime[extname(target)])return json(404,{error:'Not found'});
      try{const data=await readFile(target);res.writeHead(200,{'Content-Type':mime[extname(target)]});res.end(data);}catch{return json(404,{error:'Not found'});}
    }catch(e){json(e.status||500,{error:e.status?e.message:'Request failed. No report was accepted.',...(e.diagnostics?{diagnostics:e.diagnostics}:{})});}
  });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const port=Number(process.env.PORT||4317);const server=createServer({staticOnly:process.env.STATIC_ONLY==='1'});
  server.on('error',e=>{console.error(`Cannot start ReproMate: ${e.message}`);process.exitCode=1;});
  server.listen(port,'127.0.0.1',()=>console.log(`ReproMate: http://127.0.0.1:${port} — cases stay in memory; startup never downloads models.`));
}
