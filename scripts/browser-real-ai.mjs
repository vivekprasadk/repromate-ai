// Explicit synthetic smoke test. Unlike browser-tests.mjs, this uses installed Ollama.
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {createServer} from '../server.mjs';
import {reportMarkdown} from '../src/report.mjs';
const {chromium}=createRequire(import.meta.url)('playwright');
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output=new URL(`../output/playwright/real-ai/${runId}/`,import.meta.url);
await mkdir(output,{recursive:true});
const server=createServer();server.listen(0,'127.0.0.1');await once(server,'listening');
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
const external=[];
await context.route('**/*',route=>{if(new URL(route.request().url()).hostname!=='127.0.0.1'){external.push(route.request().url());return route.abort();}return route.continue();});
const page=await context.newPage();
try {
  await page.goto(base);
  await page.waitForFunction(()=>!document.querySelector('#mode').options[1].disabled,{},{timeout:20000});
  await page.locator('#sample').click();
  await page.waitForFunction(()=>document.querySelector('#preview').naturalWidth>0&&!document.querySelector('#analyze').disabled);
  await page.locator('#mode').selectOption('ai');
  const start=performance.now();
  const responsePromise=page.waitForResponse(r=>r.url()===base+'/api/analyze',{timeout:200000});
  await page.locator('#analyze').click();
  const response=await responsePromise;
  assert.equal(response.status(),200,await response.text());
  await page.locator('#export:not([disabled])').waitFor({timeout:10000});
  const submissionToRenderedMs=Math.round(performance.now()-start);
  const downloads={};
  for(const [id,extension] of [['export','md'],['export-json','json']]){
    const pending=page.waitForEvent('download');await page.locator('#'+id).click();
    downloads[extension]=await readFile(await (await pending).path(),'utf8');
  }
  const report=JSON.parse(downloads.json);
  assert.equal(report.metadata.mode,'ai');assert.equal(report.metadata.visualEvidenceUsed,true);
  assert.equal(downloads.md,reportMarkdown(report));
  assert.match(await page.locator('#report').innerText(),/AI-observed visual evidence — unverified/i);
  assert.ok(await page.locator('.evidence-image').count()>0);
  assert.deepEqual(external,[]);
  await writeFile(new URL('investigation.json',output),downloads.json);
  await writeFile(new URL('investigation.md',output),downloads.md);
  await page.screenshot({path:fileURLToPath(new URL('report.png',output)),fullPage:true});
  const result={passed:true,measuredAt:new Date().toISOString(),submissionToRenderedMs,metadata:report.metadata,externalRequests:external,conditions:'Genuine installed local Ollama; synthetic sample; external browser requests blocked; one UI smoke test, not a latency percentile benchmark.'};
  await writeFile(new URL('result.json',output),JSON.stringify(result,null,2));
  console.log(JSON.stringify({...result,outputDirectory:fileURLToPath(output)},null,2));
} catch(error) {
  await writeFile(new URL('result.json',output),JSON.stringify({passed:false,measuredAt:new Date().toISOString(),error:error.message,conditions:'Genuine local-model synthetic UI smoke test; no demo fallback.'},null,2));
  await page.screenshot({path:fileURLToPath(new URL('failure.png',output)),fullPage:true}).catch(()=>{});
  console.error('Failed smoke-test artifacts: '+fileURLToPath(output));throw error;
} finally {await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
