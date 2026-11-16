// Click-through of the MOCK app (localhost only): sign in -> market order -> position -> close -> limit order -> cancel -> ghost mode.
import {spawn} from 'child_process';import fs from 'fs';
const OUT='/Users/dezloper/Desktop/Redesign/Phoenix/screenshots/web/replica/e2e';fs.mkdirSync(OUT,{recursive:true});
const port=9100+Math.floor(Math.random()*300);
const chrome=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--hide-scrollbars','--force-color-profile=srgb',`--remote-debugging-port=${port}`,'--no-first-run',`--user-data-dir=/tmp/phx-e2e-${port}`,'about:blank'],{stdio:'ignore'});
let tabs;for(let i=0;i<40;i++){try{tabs=await (await fetch(`http://127.0.0.1:${port}/json`)).json();break}catch{await new Promise(r=>setTimeout(r,250))}}
const ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
let id=0;const pend=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id)}};
const send=(method,params={})=>new Promise(r=>{const i=++id;pend.set(i,r);ws.send(JSON.stringify({id:i,method,params}))});
const js=async e=>{const r=await send('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true});return r.result.result?.value??r.result.exceptionDetails?.exception?.description};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const errs=[];await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});await send('Page.enable');
const shot=async n=>{const s=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(`${OUT}/${n}.png`,Buffer.from(s.result.data,'base64'))};
const HELP=`window.clk=(t,o={})=>{const L=t.toLowerCase();const vis=e=>e.getClientRects().length>0;const root=o.in?document.querySelector(o.in)||document:document;const all=[...root.querySelectorAll('button,a,[role=tab],[role=button],label')].filter(vis);let q=all.filter(e=>(e.textContent||'').trim().toLowerCase()===L||(e.getAttribute('aria-label')||'').toLowerCase()===L);if(!q.length)q=all.filter(e=>(e.textContent||'').trim().toLowerCase().includes(L));q.sort((a,b)=>(a.textContent||'').length-(b.textContent||'').length);const e=q[o.nth||0];if(e){e.click();return 'ok:'+(e.textContent||'').trim().slice(0,24)}return 'MISS:'+t};
window.txt=()=>document.body.innerText;window.has=t=>document.body.innerText.includes(t)`;
const go=async p=>{await send('Page.navigate',{url:'http://localhost:5175'+p});await wait(3500);await js("localStorage.clear()");await send('Page.navigate',{url:'http://localhost:5175'+p});await wait(3500);await js(HELP)};
const typeInto=async(sel,v)=>{await js(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});e.focus();e.select&&e.select()})()`);await send('Input.insertText',{text:v})};
const log=(...a)=>console.log(...a);
await go('/SOL');
log('1 start trading', await js("(()=>{document.querySelector('nav .btn.navcta').click();return 'ok'})()"));await wait(700);await shot('01-login');
log('  login dialog text has Google:', await js("has('Sign in with Google')"));
log('2 sign in google', await js("clk('Sign in with Google')"));await wait(600);await shot('02-connecting');await wait(3000);
log('  signed in (Deposit visible):', await js("has('Deposit')"), 'balance', await js("(document.body.innerText.match(/\\$2\\.39/)||[''])[0]"));
log('  inputs:', await js("JSON.stringify([...document.querySelectorAll('input')].map(i=>({t:i.type,p:i.placeholder,m:i.inputMode,v:i.value,c:i.className})).slice(0,10))"));
await shot('03-signedin');
// order size: first text/decimal input in the order form
await typeInto("input[inputmode='decimal'], input[type='text'], input[type='number']",'0.05');await wait(500);await shot('04-size-entered');
log('3 place order button text:', await js("[...document.querySelectorAll('button')].map(b=>b.textContent.trim()).filter(t=>/Place Order|Order Size|Start Trading|Ghost/.test(t)).join(' | ')"));
log('  click place order', await js("clk('Place Order')"));await wait(800);await shot('05-confirm');
log('  confirm dialog text:', await js("(document.querySelector('.modal')||{innerText:'(no modal)'}).innerText.replace(/\\n+/g,' | ').slice(0,300)"));
log('  click confirm', await js("clk('Place Order',{in:'.modal'})"));await wait(400);await shot('06-placing');
log('  toast while placing:', await js("(document.querySelector('.toast')||{innerText:'(none)'}).innerText"));await wait(2800);await shot('07-position');
log('  Positions tab label:', await js("(document.body.innerText.match(/Positions \\(\\d\\)/)||[''])[0]"), '| row text:', await js("(document.querySelector('.t-pos table tbody tr')||{innerText:'(no row)'}).innerText.replace(/\\s+/g,' ')"));
log('  toast after:', await js("(document.querySelector('.toast')||{innerText:'(none)'}).innerText"));
log('4 open close dialog (pos panel buttons):', await js("[...document.querySelectorAll('.t-pos button')].map(b=>(b.getAttribute('aria-label')||b.textContent).trim()).filter(Boolean).slice(0,14).join(' | ')"));
log('  click Close All', await js("clk('Close All',{in:'.t-pos'})"));await wait(700);await shot('08-closeall-dialog');
log('  dialog:', await js("(document.querySelector('.modal')||{innerText:'(no modal)'}).innerText.replace(/\\n+/g,' | ').slice(0,240)"));
log('  confirm close all', await js("clk('Close All',{in:'.modal'})"));await wait(3200);await shot('09-closed');
log('  after close tab label:', await js("(document.body.innerText.match(/Positions \\(\\d\\)/)||[''])[0]"), 'Trade History tab:', await js("clk('Trade History',{in:'.t-pos'})"));await wait(500);await shot('10-trade-history');
log('  history rows:', await js("[...document.querySelectorAll('.t-pos table tbody tr')].slice(0,3).map(r=>r.innerText.replace(/\\s+/g,' ')).join(' || ')"));
// limit order far below market -> rests
log('5 limit tab', await js("clk('Limit',{in:'.t-order, aside, body'})"));await wait(400);
log('  inputs now:', await js("JSON.stringify([...document.querySelectorAll('input')].map(i=>i.placeholder||i.type).slice(0,8))"));
// ghost mode
await go('/leaderboard?in');
log('6 leaderboard ghost icons:', await js("document.querySelectorAll('.lb-ghost, button[aria-label*=host]').length"));
await send('Page.navigate',{url:'http://localhost:5175/SOL?in&ghost=3ctH%E2%80%A6tuFr'});await wait(4500);await js(HELP);await shot('11-ghost-trade');
log('  ghost banner:', await js("has('Ghost Mode')"), '| order btn:', await js("[...document.querySelectorAll('button')].map(b=>b.textContent.trim()).filter(t=>/Ghost Mode|Place Order|Order Size/.test(t)).join(' | ')"), '| position:', await js("(document.querySelector('.t-pos table tbody tr')||{innerText:'(none)'}).innerText.replace(/\\s+/g,' ')"));
chrome.kill();process.exit(0);
