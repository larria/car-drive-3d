import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const out = process.env.AUDIO_EVIDENCE_DIR || fileURLToPath(new URL('../artifacts/audio-runtime/',import.meta.url));
await mkdir(out, {recursive:true});
const browser = await chromium.launch({channel:'chrome',headless:true});
const page = await browser.newPage({viewport:{width:1440,height:1000}});
const observations=[];
page.on('pageerror',error=>observations.push({error:String(error)}));
await page.addInitScript(()=>{
  const Native=window.AudioContext;
  window.AudioContext=class extends Native{
    constructor(...args){super(...args);window.__audioContext=this;window.__audioAnalyser=this.createAnalyser();window.__audioAnalyser.fftSize=2048;const original=AudioNode.prototype.connect;if(!window.__audioPatched){window.__audioPatched=true;AudioNode.prototype.connect=function(destination,...rest){const result=original.call(this,destination,...rest);if(destination===window.__audioContext.destination&&this!==window.__audioAnalyser)original.call(this,window.__audioAnalyser);return result;};}}
  };
});
const sample=async label=>{await page.waitForTimeout(350);const observation=await page.evaluate(label=>{const a=window.__audioAnalyser;let peak=0;if(a){const data=new Float32Array(a.fftSize);a.getFloatTimeDomainData(data);peak=Math.max(...data.map(Math.abs));}return{label,state:window.larria.session.state,diagnostics:window.larria.audio.diagnostics,peak:window.__audioContext?.state==='running'?peak:0,analyserLastFramePeak:peak,status:document.querySelector('#audio-status').textContent};},label);observations.push(observation);console.log(JSON.stringify(observation));return observation;};
try{
await page.goto(process.env.E2E_URL||'http://127.0.0.1:5187/car-drive-3d/');await page.waitForFunction(()=>window.larria?.ready);
await page.locator('.project-settings').click();await page.locator('#audio-preview').click();await sample('first-real-click-menu-preview');
await page.locator('#setting-audio').uncheck();await sample('muted');await page.locator('#audio-preview').click();await sample('muted-preview-refused');
await page.locator('#setting-audio').check();await page.locator('#audio-preview').click();await sample('reenabled-preview');
await page.locator('#settings-dialog .close-dialog').click();await page.locator('[data-exam="select:practice"]').click();await sample('briefing');await page.locator('[data-exam="start"]').click();await sample('practice');
await page.keyboard.down('w');await page.waitForTimeout(1500);await page.keyboard.up('w');await sample('vehicle-load');await page.keyboard.press('Escape');await sample('paused');
await page.locator('#exam-overlay [data-exam="settings"]').click();await page.locator('#audio-preview').click();await sample('paused-settings-preview');await page.screenshot({path:`${out}/audio-settings.png`});
await page.locator('#settings-dialog .close-dialog').click();await page.locator('[data-exam="resume"]').click();await sample('resumed');
await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await sample('blur');await page.locator('[data-exam="resume"]').click();await sample('gesture-return');
await page.reload();await page.waitForFunction(()=>window.larria?.ready);await sample('reload-no-autoplay');
await page.locator('[data-exam="select"]').click();await page.locator('[data-exam="start"]').click();await page.waitForTimeout(1500);await sample('exam-no-music-idle');await page.keyboard.down('w');await page.waitForTimeout(14000);await page.keyboard.up('w');await sample('exam-real-input-outcome');await page.screenshot({path:`${out}/exam-outcome.png`});
await page.locator('#exam-overlay [data-exam="exit"]').click();await page.locator('.project-settings').click();await page.locator('#audio-masterVolume').focus();await page.keyboard.press('Home');await page.locator('#audio-preview').click();await sample('zero-volume-preview-refused');await page.locator('#setting-audio').uncheck();await page.reload();await page.waitForFunction(()=>window.larria?.ready);await page.locator('.project-settings').click();observations.push({label:'mute-persisted-reload',checked:await page.locator('#setting-audio').isChecked()});
}finally{await writeFile(`${out}/observations.json`,JSON.stringify(observations,null,2));await browser.close();}
