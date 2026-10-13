import {chromium} from '@playwright/test';
import {writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const out=fileURLToPath(new URL('../artifacts/audio-runtime/',import.meta.url));await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext();const page=await context.newPage();
try{
await page.goto(process.env.E2E_URL||'http://127.0.0.1:5188/car-drive-3d/');await page.waitForFunction(()=>window.larria?.ready);await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();await page.waitForFunction(()=>window.larria?.ready);await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
await context.setOffline(true);await page.reload();await page.waitForFunction(()=>window.larria?.ready);await page.locator('.project-settings').click();await page.locator('#audio-preview').click();await page.waitForTimeout(900);
const result=await page.evaluate(async()=>{const keys=await caches.keys();const urls=[];for(const key of keys){const cache=await caches.open(key);for(const request of await cache.keys())if(request.url.includes('/audio/'))urls.push(request.url);}const audio=new AudioContext();const decoded=[];for(const url of urls.filter(url=>new URL(url).pathname.endsWith('.mp3'))){const parsed=new URL(url);parsed.search='';const response=await fetch(parsed.href);const buffer=await audio.decodeAudioData(await response.arrayBuffer());let boundaryDelta=0,maxAdjacentDelta=0,peak=0;for(let c=0;c<buffer.numberOfChannels;c++){const data=buffer.getChannelData(c);boundaryDelta=Math.max(boundaryDelta,Math.abs(data[0]-data[data.length-1]));for(let i=0;i<data.length;i++){peak=Math.max(peak,Math.abs(data[i]));if(i)maxAdjacentDelta=Math.max(maxAdjacentDelta,Math.abs(data[i]-data[i-1]));}}decoded.push({name:url.split('/').pop(),duration:buffer.duration,channels:buffer.numberOfChannels,peak,boundaryDelta,maxAdjacentDelta});}await audio.close();return{offline:navigator.onLine===false,controlled:!!navigator.serviceWorker.controller,decoded,diagnostics:window.larria.audio.diagnostics,status:document.querySelector('#audio-status').textContent};});
await page.screenshot({path:`${out}/offline.png`});await writeFile(`${out}/offline.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result));
if(result.decoded.length!==12||!result.diagnostics.unlocked)throw new Error('Offline audio unavailable');
const music=result.decoded.find(asset=>asset.name.startsWith('menu-music.mp3'));
if(!music||music.duration!==48||music.channels!==2||music.boundaryDelta>music.maxAdjacentDelta*1.05||result.decoded.some(asset=>asset.peak>=0.95))throw new Error('MP3 decoded signal or loop boundary invalid');
}finally{await browser.close();}
