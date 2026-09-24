import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const {chromium}=createRequire(import.meta.url)('playwright');
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||undefined});
try{const page=await browser.newPage({viewport:{width:1000,height:840},deviceScaleFactor:1});await page.goto(new URL('../public/sample-screen.html',import.meta.url).href);await page.screenshot({path:fileURLToPath(new URL('../public/sample.png',import.meta.url)),fullPage:true});}finally{await browser.close();}
