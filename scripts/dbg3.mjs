import {spawn} from 'child_process';
const port=9600+Math.floor(Math.random()*300);
const chrome=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new',`--remote-debugging-port=${port}`,'--no-first-run',`--user-data-dir=/tmp/phx-dbg-${port}`,'about:blank'],{stdio:'ignore'});
let tabs;for(let i=0;i<40;i++){try{tabs=await (await fetch(`http://127.0.0.1:${port}/json`)).json();break}catch{await new Promise(r=>setTimeout(r,250))}}
const ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
let id=0;const pend=new Map();const logs=[];ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id)}else if(m.method==='Runtime.consoleAPICalled'||m.method==='Runtime.exceptionThrown')logs.push(JSON.stringify(m.params).slice(0,900))};
const send=(method,params={})=>new Promise(r=>{const i=++id;pend.set(i,r);ws.send(JSON.stringify({id:i,method,params}))});
const js=async e=>{const r=await send('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true});return r.result.result?.value??JSON.stringify(r.result.exceptionDetails)};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
await send('Runtime.enable');await send('Page.enable');await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
await send('Page.navigate',{url:'http://localhost:5175/SOL'});await wait(5000);
console.log(await js("(()=>{const b=[...document.querySelectorAll('button')].filter(x=>x.textContent.trim()==='Start Trading');b[0].click();return b.length+' '+b[0].className})()"));await wait(1000);console.log(await js("document.querySelectorAll('.modal').length+' '+document.querySelectorAll('.ov').length"));
for(const l of logs){ if(/error|Error|warn/i.test(l)) console.log(l.slice(0,700)) }
console.log('total logs',logs.length);
chrome.kill();process.exit(0);
