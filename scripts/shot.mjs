// node shot.mjs <path> <name> [jsToRunBeforeShot]  -> Phoenix/screenshots/web/replica/<name>.png (1440x900 @2x)
import {spawn} from 'child_process';import fs from 'fs';
const [path,name,pre]=process.argv.slice(2);
const port=9400+Math.floor(Math.random()*300);
const chrome=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--hide-scrollbars','--force-color-profile=srgb',`--remote-debugging-port=${port}`,'--no-first-run',`--user-data-dir=/tmp/phx-rs-${port}`,'about:blank'],{stdio:'ignore'});
let tabs;for(let i=0;i<40;i++){try{tabs=await (await fetch(`http://127.0.0.1:${port}/json`)).json();break}catch{await new Promise(r=>setTimeout(r,250))}}
const ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
let id=0;const pend=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id)}};
const send=(method,params={})=>new Promise(r=>{const i=++id;pend.set(i,r);ws.send(JSON.stringify({id:i,method,params}))});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:2,mobile:false});await send('Page.enable');
await send('Page.navigate',{url:'http://localhost:5175'+path});await wait(3500);
if(pre){await send('Runtime.evaluate',{expression:pre,awaitPromise:true});await wait(800)}
const s=await send('Page.captureScreenshot',{format:'png'});
fs.writeFileSync(`/Users/dezloper/Desktop/Redesign/Phoenix/screenshots/web/replica/${name}.png`,Buffer.from(s.result.data,'base64'));
chrome.kill();process.exit(0);
