import puppeteer from "puppeteer-core";
const BASE = "http://localhost:3000";
const jar = new Map();
const header = () => [...jar].map(([k,v])=>`${k}=${v}`).join("; ");
async function call(m,p,b){const r=await fetch(BASE+p,{method:m,headers:{...(b?{"Content-Type":"application/json"}:{}),cookie:header()},body:b?JSON.stringify(b):undefined});
 (r.headers.getSetCookie?.()??[]).forEach(l=>{const [pair]=l.split(";");const i=pair.indexOf("=");if(i>0)jar.set(pair.slice(0,i),pair.slice(i+1));});
 return {status:r.status, json: await r.json().catch(()=>null)};}

await call("POST","/api/auth/login",{email:"admin",password:"Tulsi@2026"});
const moms = await call("GET","/api/mom?pageSize=10");
const mom = moms.json.data.find(m=>m.status!=="DRAFT") ?? moms.json.data[0];
await call("POST",`/api/mom/${mom.id}/submit`).catch(()=>{});
const send = await call("POST",`/api/documents/MOM/${mom.id}/send`,{channels:["EMAIL"],attachPdf:true,allowCorrection:true});
const url = send.json?.data?.linkUrl;
if(!url){console.error("send failed", JSON.stringify(send.json)); process.exit(1);}
console.log("client link:", url);

// PDF photo embedding check
const pdfRes = await fetch(`${BASE}/api/documents/MOM/${mom.id}/pdf`,{headers:{cookie:header()}});
const pdf = Buffer.from(await pdfRes.arrayBuffer());
console.log("pdf bytes:", pdf.length, "type:", pdfRes.headers.get("content-type"));

const browser = await puppeteer.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
const page = await browser.newPage();
const errs=[]; page.on("pageerror",e=>errs.push(String(e))); page.on("console",m=>{if(m.type()==="error")errs.push(m.text())});
await page.setViewport({width:390,height:844});
const res = await page.goto(url,{waitUntil:"networkidle2"});
await new Promise(r=>setTimeout(r,1500));
const text = await page.evaluate(()=>document.body.innerText);
const imgs = await page.evaluate(()=>[...document.images].map(i=>({src:i.currentSrc.slice(0,40), ok:i.naturalWidth>0})));
const overflow = await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+2);
console.log("status:", res.status(), "| overflow:", overflow, "| images:", JSON.stringify(imgs));
console.log("has confirm button:", /Confirm/i.test(text));
console.log("no admin nav leaked:", !/Dashboard|Audit Logs|System Settings/i.test(text));
console.log("errors:", errs.length? errs.slice(0,3): "none");
await page.screenshot({path:"/tmp/te-shots/client-report.png", fullPage:false});
// expired/invalid link page
await page.goto(BASE+"/report/deadbeefdead.invalidtoken",{waitUntil:"networkidle2"});
const t2 = await page.evaluate(()=>document.body.innerText);
console.log("invalid link handled gracefully:", !/Application error/i.test(t2), "|", t2.split("\n").filter(Boolean)[1]?.slice(0,80));
await browser.close();
