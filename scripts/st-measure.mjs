import {spawn} from 'child_process';
const port=9700+Math.floor(Math.random()*200);
const chrome=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new',`--remote-debugging-port=${port}`,'--no-first-run',`--user-data-dir=/tmp/phx-m-${port}`,'about:blank'],{stdio:'ignore'});
let tabs;for(let i=0;i<40;i++){try{tabs=await (await fetch(`http://127.0.0.1:${port}/json`)).json();break}catch{await new Promise(r=>setTimeout(r,250))}}
const ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
let id=0;const pend=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id)}};
const send=(method,params={})=>new Promise(r=>{const i=++id;pend.set(i,r);ws.send(JSON.stringify({id:i,method,params}))});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
await send('Page.navigate',{url:'http://localhost:5175/SOL?in&dialog=settings'});await wait(3500);
const ev=async e=>(await send('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true})).result.result.value;
console.log(await ev(`(()=>{const r=e=>{const b=e.getBoundingClientRect();return [+b.x.toFixed(1),+b.y.toFixed(1),+b.width.toFixed(1),+b.height.toFixed(1)]};const d=document.querySelector('.sx-modal');const o=r(d);const rel=e=>{const b=r(e);return [b[0]-o[0],b[1]-o[1],b[2],b[3]]};
return JSON.stringify({dialog:r(d),cs:getComputedStyle(d).borderRadius,tabs:[...document.querySelectorAll('.sx-tab')].map(rel),sels:[...document.querySelectorAll('.sx-selbtn')].map(rel),rows:[...document.querySelectorAll('.sx-row')].map(rel).map(x=>x[1]),toggle:rel(document.querySelector('.sx-tg')),h2:rel(d.querySelector('h2'))})})()`));
await ev(`document.querySelectorAll('.sx-selbtn')[4].click()`);await wait(400);
console.log(await ev(`JSON.stringify([...document.querySelectorAll('.sx-menu, .sx-opt')].slice(0,3).map(e=>{const b=e.getBoundingClientRect();return [b.x,b.y,b.width,b.height]}))+document.querySelector('.sx-selbtn[aria-expanded=true]').getBoundingClientRect().right`));
chrome.kill();process.exit(0);
