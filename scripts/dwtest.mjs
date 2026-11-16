// Mock-only functional test of the Deposit and Withdraw dialogs (localhost).
import {spawn} from 'child_process';
const port=9050+Math.floor(Math.random()*300);
const chrome=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new',`--remote-debugging-port=${port}`,'--no-first-run',`--user-data-dir=/tmp/phx-dw-${port}`,'about:blank'],{stdio:'ignore'});
let tabs;for(let i=0;i<40;i++){try{tabs=await (await fetch(`http://127.0.0.1:${port}/json`)).json();break}catch{await new Promise(r=>setTimeout(r,250))}}
const ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
let id=0;const pend=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id)}};
const send=(method,params={})=>new Promise(r=>{const i=++id;pend.set(i,r);ws.send(JSON.stringify({id:i,method,params}))});
const js=async e=>{const r=await send('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true});return r.result.result?.value??r.result.exceptionDetails?.exception?.description};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});await send('Page.enable');
const bal=()=>js("(document.querySelector('.btn.bal')||{}).textContent");
const clickBtn=t=>js(`(()=>{const b=[...document.querySelectorAll('.modal button, [role=dialog] button')].find(b=>b.textContent.trim()===${JSON.stringify(t)});if(!b)return 'MISS '+${JSON.stringify(t)};if(b.disabled)return 'DISABLED '+${JSON.stringify(t)};b.click();return 'ok'})()`);
await send('Page.navigate',{url:'http://localhost:5175/SOL?in&dialog=deposit'});await wait(5000);
console.log('start balance',await bal());
console.log('submit disabled with empty amount:',await clickBtn('Submit Deposit'));
await js("(()=>{const i=document.querySelector('.modal input');i.focus()})()");await send('Input.insertText',{text:'5'});await wait(300);
console.log('after typing 5, submit:',await clickBtn('Submit Deposit'));await wait(3800);
console.log('dialog gone:',await js("!document.querySelector('.modal')"),'balance after deposit',await bal());
await js("window.__go=1");await send('Page.navigate',{url:'http://localhost:5175/SOL?in&dialog=withdraw'});await wait(5000);
console.log('start balance',await bal(),'| continue disabled at 0:',await clickBtn('Continue to Review'));
console.log('50%:',await clickBtn('50%'));await wait(300);
console.log('continue:',await clickBtn('Continue to Review'));await wait(500);
console.log('review text:',await js("(document.querySelector('.modal')||{innerText:''}).innerText.replace(/\\n+/g,' | ').slice(0,160)"));
console.log('confirm:',await clickBtn('Confirm Withdraw'));await wait(3800);
console.log('dialog gone:',await js("!document.querySelector('.modal')"),'balance after withdraw',await bal());
chrome.kill();process.exit(0);
