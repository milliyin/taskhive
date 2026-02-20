#!/usr/bin/env node
import { createHmac } from "crypto";
import { existsSync, readFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = existsSync(join(__dirname, "package.json")) ? __dirname : resolve(__dirname, "..");
const BASE = "https://taskhive-six.vercel.app";
const A1 = "th_agent_509d2ce7ca2547516ebd375e916893da556e29f0ffd77eabf8c9dd61849d4584";
const A2 = "th_agent_235189ce305387c7b93fac53fdc9ec593bbf8fe3c8d366900c7c85877c90bdfb";
const P1 = process.env.P1 || "sb-wkqrkknmimhzcozlaozo-auth-token=base64-eyJhY2Nlc3NfdG9rZW4iOiJleUpoYkdjaU9pSkZVekkxTmlJc0ltdHBaQ0k2SWpJMU5qVmtaVGxrTFRWa01qY3ROR0V4TWkxaFlURmpMV0UwWlRJM1pEWXlNbVEwTXlJc0luUjVjQ0k2SWtwWFZDSjkuZXlKcGMzTWlPaUpvZEhSd2N6b3ZMM2RyY1hKcmEyNXRhVzFvZW1OdmVteGhiM3B2TG5OMWNHRmlZWE5sTG1OdkwyRjFkR2d2ZGpFaUxDSnpkV0lpT2lKbU5Ea3pOelpoTnkwd1kyTTNMVFE1Wm1JdFlUZzVOeTFtT0RobVltUmhOVGhpTkdJaUxDSmhkV1FpT2lKaGRYUm9aVzUwYVdOaGRHVmtJaXdpWlhod0lqb3hOemN4TmpFd01URXlMQ0pwWVhRaU9qRTNOekUyTURZMU1USXNJbVZ0WVdsc0lqb2lhV3hzYVhscGJtUmxjMmxuYm5OQVoyMWhhV3d1WTI5dElpd2ljR2h2Ym1VaU9pSWlMQ0poY0hCZmJXVjBZV1JoZEdFaU9uc2ljSEp2ZG1sa1pYSWlPaUpsYldGcGJDSXNJbkJ5YjNacFpHVnljeUk2V3lKbGJXRnBiQ0pkZlN3aWRYTmxjbDl0WlhSaFpHRjBZU0k2ZXlKbGJXRnBiQ0k2SW1sc2JHbDVhVzVrWlhOcFoyNXpRR2R0WVdsc0xtTnZiU0lzSW1WdFlXbHNYM1psY21sbWFXVmtJanAwY25WbExDSnVZVzFsSWpvaWFXeHNhWGxwYmlJc0luQm9iMjVsWDNabGNtbG1hV1ZrSWpwbVlXeHpaU3dpYzNWaUlqb2laalE1TXpjMllUY3RNR05qTnkwME9XWmlMV0U0T1RjdFpqZzRabUprWVRVNFlqUmlJbjBzSW5KdmJHVWlPaUpoZFhSb1pXNTBhV05oZEdWa0lpd2lZV0ZzSWpvaVlXRnNNU0lzSW1GdGNpSTZXM3NpYldWMGFHOWtJam9pY0dGemMzZHZjbVFpTENKMGFXMWxjM1JoYlhBaU9qRTNOekUyTURZMU1USjlYU3dpYzJWemMybHZibDlwWkNJNkltWTNPR1l5TmpBNUxXUTBNV010TkRVMVlTMDVZamRoTFRJd05XSTJPVFF6WVdZeU5TSXNJbWx6WDJGdWIyNTViVzkxY3lJNlptRnNjMlY5Lm5qc3FFa3ZQNUZ4SjZRLTE0Z0JXdk5mTDAyVWlrYktxblVBeEkwNS03Z0JuOGt4cG1yeXZvRkM2RXQwd0xwRHdCaUFiV0o0SkJZUTVFSWtPZF9OSVlRIiwidG9rZW5fdHlwZSI6ImJlYXJlciIsImV4cGlyZXNfaW4iOjM2MDAsImV4cGlyZXNfYXQiOjE3NzE2MTAxMTIsInJlZnJlc2hfdG9rZW4iOiJnYWQyeXppcDRwMnUiLCJ1c2VyIjp7ImlkIjoiZjQ5Mzc2YTctMGNjNy00OWZiLWE4OTctZjg4ZmJkYTU4YjRiIiwiYXVkIjoiYXV0aGVudGljYXRlZCIsInJvbGUiOiJhdXRoZW50aWNhdGVkIiwiZW1haWwiOiJpbGxpeWluZGVzaWduc0BnbWFpbC5jb20iLCJlbWFpbF9jb25maXJtZWRfYXQiOiIyMDI2LTAyLTE3VDEzOjM5OjIwLjI0MTUzNloiLCJwaG9uZSI6IiIsImNvbmZpcm1hdGlvbl9zZW50X2F0IjoiMjAyNi0wMi0xN1QxMzozODozNy4yMDAyNDVaIiwiY29uZmlybWVkX2F0IjoiMjAyNi0wMi0xN1QxMzozOToyMC4yNDE1MzZaIiwibGFzdF9zaWduX2luX2F0IjoiMjAyNi0wMi0yMFQxNjo1NToxMi43ODMwNTgyMDFaIiwiYXBwX21ldGFkYXRhIjp7InByb3ZpZGVyIjoiZW1haWwiLCJwcm92aWRlcnMiOlsiZW1haWwiXX0sInVzZXJfbWV0YWRhdGEiOnsiZW1haWwiOiJpbGxpeWluZGVzaWduc0BnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwibmFtZSI6ImlsbGl5aW4iLCJwaG9uZV92ZXJpZmllZCI6ZmFsc2UsInN1YiI6ImY0OTM3NmE3LTBjYzctNDlmYi1hODk3LWY4OGZiZGE1OGI0YiJ9LCJpZGVudGl0aWVzIjpbeyJpZGVudGl0eV9pZCI6IjNjODNiODg1LTEyMzYtNGJhYi05YmRkLTg4NGNlODBiY2I1YyIsImlkIjoiZjQ5Mzc2YTctMGNjNy00OWZiLWE4OTctZjg4ZmJkYTU4YjRiIiwidXNlcl9pZCI6ImY0OTM3NmE3LTBjYzctNDlmYi1hODk3LWY4OGZiZGE1OGI0YiIsImlkZW50aXR5X2RhdGEiOnsiZW1haWwiOiJpbGxpeWluZGVzaWduc0BnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwibmFtZSI6ImlsbGl5aW4iLCJwaG9uZV92ZXJpZmllZCI6ZmFsc2UsInN1YiI6ImY0OTM3NmE3LTBjYzctNDlmYi1hODk3LWY4OGZiZGE1OGI0YiJ9LCJwcm92aWRlciI6ImVtYWlsIiwibGFzdF9zaWduX2luX2F0IjoiMjAyNi0wMi0xN1QxMzozODozNy4xODI3MDhaIiwiY3JlYXRlZF9hdCI6IjIwMjYtMDItMTdUMTM6Mzg6MzcuMTgzMjA2WiIsInVwZGF0ZWRfYXQiOiIyMDI2LTAyLTE3VDEzOjM4OjM3LjE4MzIwNloiLCJlbWFpbCI6ImlsbGl5aW5kZXNpZ25zQGdtYWlsLmNvbSJ9XSwiY3JlYXRlZF9hdCI6IjIwMjYtMDItMTdUMTM6Mzg6MzcuMTU0NjI1WiIsInVwZGF0ZWRfYXQiOiIyMDI2LTAyLTIwVDE2OjU1OjEyLjgwMjQzN1oiLCJpc19hbm9ueW1vdXMiOmZhbHNlfSwid2Vha19wYXNzd29yZCI6bnVsbH0";
const P2 = process.env.P2 || "sb-wkqrkknmimhzcozlaozo-auth-token=base64-eyJhY2Nlc3NfdG9rZW4iOiJleUpoYkdjaU9pSkZVekkxTmlJc0ltdHBaQ0k2SWpJMU5qVmtaVGxrTFRWa01qY3ROR0V4TWkxaFlURmpMV0UwWlRJM1pEWXlNbVEwTXlJc0luUjVjQ0k2SWtwWFZDSjkuZXlKcGMzTWlPaUpvZEhSd2N6b3ZMM2RyY1hKcmEyNXRhVzFvZW1OdmVteGhiM3B2TG5OMWNHRmlZWE5sTG1OdkwyRjFkR2d2ZGpFaUxDSnpkV0lpT2lJNFlqazBNRGc1WVMwek5ETXdMVFJtTXpRdFlUTXhZeTAzWkdRNFpXSm1OVFJpWWpFaUxDSmhkV1FpT2lKaGRYUm9aVzUwYVdOaGRHVmtJaXdpWlhod0lqb3hOemN4TmpFd01UVXlMQ0pwWVhRaU9qRTNOekUyTURZMU5USXNJbVZ0WVdsc0lqb2liR1Z6WVdwaE1UYzBOa0JoYkdsaWRHOHVZMjl0SWl3aWNHaHZibVVpT2lJaUxDSmhjSEJmYldWMFlXUmhkR0VpT25zaWNISnZkbWxrWlhJaU9pSmxiV0ZwYkNJc0luQnliM1pwWkdWeWN5STZXeUpsYldGcGJDSmRmU3dpZFhObGNsOXRaWFJoWkdGMFlTSTZleUpsYldGcGJDSTZJbXhsYzJGcVlURTNORFpBWVd4cFluUnZMbU52YlNJc0ltVnRZV2xzWDNabGNtbG1hV1ZrSWpwMGNuVmxMQ0p1WVcxbElqb2liR1Z6WVdwaE1UYzBOa0JoYkdsaWRHOHVZMjl0SWl3aWNHaHZibVZmZG1WeWFXWnBaV1FpT21aaGJITmxMQ0p6ZFdJaU9pSTRZamswTURnNVlTMHpORE13TFRSbU16UXRZVE14WXkwM1pHUTRaV0ptTlRSaVlqRWlmU3dpY205c1pTSTZJbUYxZEdobGJuUnBZMkYwWldRaUxDSmhZV3dpT2lKaFlXd3hJaXdpWVcxeUlqcGJleUp0WlhSb2IyUWlPaUp3WVhOemQyOXlaQ0lzSW5ScGJXVnpkR0Z0Y0NJNk1UYzNNVFl3TmpVMU1uMWRMQ0p6WlhOemFXOXVYMmxrSWpvaVl6VTBaREZoTnpNdE5UZGxaUzAwTW1WbUxUa3hNbVV0TVRKalpXUTVNRFJoWm1Wa0lpd2lhWE5mWVc1dmJubHRiM1Z6SWpwbVlXeHpaWDAuTE9FRFFiWXRJLUVIWEMyX2c0RUcwTC1wLTc4bml5d2VBWDQ2UnlmVS12eFJlTmVMYWlMVE9OSGdkeVNwQnk4dFh1Y2lDZWhpVFZkRG9nU05SVjhxOGciLCJ0b2tlbl90eXBlIjoiYmVhcmVyIiwiZXhwaXJlc19pbiI6MzYwMCwiZXhwaXJlc19hdCI6MTc3MTYxMDE1MiwicmVmcmVzaF90b2tlbiI6IjdwczJodHVzY3dwcyIsInVzZXIiOnsiaWQiOiI4Yjk0MDg5YS0zNDMwLTRmMzQtYTMxYy03ZGQ4ZWJmNTRiYjEiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJlbWFpbCI6Imxlc2FqYTE3NDZAYWxpYnRvLmNvbSIsImVtYWlsX2NvbmZpcm1lZF9hdCI6IjIwMjYtMDItMTlUMTk6MzQ6MzEuNjI2MjQzWiIsInBob25lIjoiIiwiY29uZmlybWF0aW9uX3NlbnRfYXQiOiIyMDI2LTAyLTE5VDE5OjM0OjEyLjIwNjkyWiIsImNvbmZpcm1lZF9hdCI6IjIwMjYtMDItMTlUMTk6MzQ6MzEuNjI2MjQzWiIsImxhc3Rfc2lnbl9pbl9hdCI6IjIwMjYtMDItMjBUMTY6NTU6NTIuMzI0MzU3MDQ1WiIsImFwcF9tZXRhZGF0YSI6eyJwcm92aWRlciI6ImVtYWlsIiwicHJvdmlkZXJzIjpbImVtYWlsIl19LCJ1c2VyX21ldGFkYXRhIjp7ImVtYWlsIjoibGVzYWphMTc0NkBhbGlidG8uY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsIm5hbWUiOiJsZXNhamExNzQ2QGFsaWJ0by5jb20iLCJwaG9uZV92ZXJpZmllZCI6ZmFsc2UsInN1YiI6IjhiOTQwODlhLTM0MzAtNGYzNC1hMzFjLTdkZDhlYmY1NGJiMSJ9LCJpZGVudGl0aWVzIjpbeyJpZGVudGl0eV9pZCI6IjMyYWI2Yzg1LWM2MmMtNDA0Zi04ZTUxLTI4YjU5NzdjMjA3OCIsImlkIjoiOGI5NDA4OWEtMzQzMC00ZjM0LWEzMWMtN2RkOGViZjU0YmIxIiwidXNlcl9pZCI6IjhiOTQwODlhLTM0MzAtNGYzNC1hMzFjLTdkZDhlYmY1NGJiMSIsImlkZW50aXR5X2RhdGEiOnsiZW1haWwiOiJsZXNhamExNzQ2QGFsaWJ0by5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwibmFtZSI6Imxlc2FqYTE3NDZAYWxpYnRvLmNvbSIsInBob25lX3ZlcmlmaWVkIjpmYWxzZSwic3ViIjoiOGI5NDA4OWEtMzQzMC00ZjM0LWEzMWMtN2RkOGViZjU0YmIxIn0sInByb3ZpZGVyIjoiZW1haWwiLCJsYXN0X3NpZ25faW5fYXQiOiIyMDI2LTAyLTE5VDE5OjM0OjEyLjE3MjQ1NVoiLCJjcmVhdGVkX2F0IjoiMjAyNi0wMi0xOVQxOTozNDoxMi4xNzI1MTJaIiwidXBkYXRlZF9hdCI6IjIwMjYtMDItMTlUMTk6MzQ6MTIuMTcyNTEyWiIsImVtYWlsIjoibGVzYWphMTc0NkBhbGlidG8uY29tIn1dLCJjcmVhdGVkX2F0IjoiMjAyNi0wMi0xOVQxOTozNDoxMi4xNDU1OTFaIiwidXBkYXRlZF9hdCI6IjIwMjYtMDItMjBUMTY6NTU6NTIuMzI2Mzk5WiIsImlzX2Fub255bW91cyI6ZmFsc2V9LCJ3ZWFrX3Bhc3N3b3JkIjpudWxsfQ";
const WH = "https://webhook.site/65b68f48-3f5f-4ace-9dee-5400829600be";
let ok=0,fail=0;
const log=(e,m)=>console.log(`  ${e}  ${m}`);
const sec=(t)=>console.log(`\n${"─".repeat(64)}\n  ${t}\n${"─".repeat(64)}`);
const chk=(c,l)=>{if(c){log("✅",l);ok++}else{log("❌",l);fail++}return c};
async function api(m,p,b=null,k=A1){const o={method:m,headers:{Authorization:`Bearer ${k}`,"Content-Type":"application/json"}};if(b)o.body=JSON.stringify(b);const r=await fetch(`${BASE}${p}`,o);let d;try{d=await r.json()}catch{d={ok:false}};return{status:r.status,headers:Object.fromEntries(r.headers),...d}}
async function web(m,p,b=null,c=P1){const o={method:m,headers:{Cookie:c,"Content-Type":"application/json"}};if(b)o.body=JSON.stringify(b);const r=await fetch(`${BASE}${p}`,o);let d;try{d=await r.json()}catch{d={ok:false}};return{status:r.status,...d}}
async function main(){
console.log(`\n╔══════════════════════════════════════════════════════════════╗\n║   TaskHive Full Platform Test — Tier 1 + 2 + 3             ║\n╚══════════════════════════════════════════════════════════════╝\n  ${BASE}  |  Root: ${ROOT}\n`);
const ck=await web("POST","/api/tasks",{title:"cookie test",description:"Testing if cookie is valid for auth check.",budgetCredits:50,categoryId:"1"});
if(ck.status===401||ck.error==="Unauthorized"){console.log("  ⛔ COOKIE EXPIRED — log in & set P1/P2 env vars\n");process.exit(1)}
sec("T1.1 — Deployment");
chk((await fetch(BASE)).status===200,`Web UI → 200`);chk((await api("GET","/api/v1/tasks?limit=1")).status===200,`API → 200`);
sec("T1.2 — Authentication");
chk((await api("GET","/api/v1/agents/me",null,A1)).ok,`Agent 1`);chk((await api("GET","/api/v1/agents/me",null,A2)).ok,`Agent 2`);
chk((await api("GET","/api/v1/agents/me",null,"th_agent_"+"0".repeat(64))).status===401,`Bad key → 401`);
chk((await fetch(`${BASE}/api/v1/agents/me`)).status===401,`No auth → 401`);chk(A1.startsWith("th_agent_")&&A1.length===73,`Key format`);
sec("T1.3 — Envelope");
const env=await api("GET","/api/v1/tasks?limit=1");chk(env.hasOwnProperty("ok"),"ok");chk(env.hasOwnProperty("data"),"data");chk(env.hasOwnProperty("meta"),"meta");
chk(!!env.meta?.timestamp,"timestamp");chk(!!env.meta?.request_id,"request_id");if(env.data?.[0])chk(Number.isInteger(env.data[0].id),`Int ID: ${env.data[0].id}`);
sec("T1.4 — Task Creation");
const t=await web("POST","/api/tasks",{title:"E2E Lifecycle "+Date.now(),description:"Full lifecycle test: create claim accept deliver accept credits review.",budgetCredits:200,categoryId:"1",maxRevisions:2,deadline:new Date(Date.now()+7*86400000).toISOString()},P2);
chk(t.status===201,`Create → ${t.status}`);const TID=t.data?.id;chk(typeof TID==="number",`ID: ${TID}`);
chk((await web("POST","/api/tasks",{title:"x",description:"y",budgetCredits:1})).status===400,`Validation`);
if(!TID){console.log("\n  ⛔ No task\n");process.exit(1)}
sec("T1.5 — Claims");
const c1=await api("POST",`/api/v1/tasks/${TID}/claims`,{proposed_credits:180,message:"A1"},A1);chk(c1.ok,`A1 claim`);chk(c1.data?.status==="pending","Pending");const C1=c1.data?.id;
const c2=await api("POST",`/api/v1/tasks/${TID}/claims`,{proposed_credits:160,message:"A2"},A2);if(c2.ok){chk(true,"A2 claim")}else{log("ℹ️","A2 skip (self-claim on P2 task)")}
chk((await api("POST",`/api/v1/tasks/${TID}/claims`,{proposed_credits:170},A1)).status===409,`Dup → 409`);
sec("T1.6 — Accept Claim");
chk((await web("PATCH",`/api/tasks/${TID}/claims/${C1}`,{action:"accept"},P2)).status===200,`Accept`);
chk((await api("GET",`/api/v1/tasks/${TID}`)).data?.status==="claimed","→ claimed");
const rej=(await api("GET","/api/v1/agents/me/claims",null,A2)).data?.find(c=>c.task_id===TID);if(rej)chk(rej.status==="rejected","A2 rejected");
chk((await api("POST",`/api/v1/tasks/${TID}/claims`,{proposed_credits:100},A2)).status===409,"Late → 409");
sec("T1.7 — Deliverable");
const balB=(await api("GET","/api/v1/agents/me/credits",null,A1)).data?.credit_balance||0;
const dl=await api("POST",`/api/v1/tasks/${TID}/deliverables`,{content:"# Done\n```py\ndef f():return 42\n```"},A1);
chk(dl.ok,"Deliver");chk(dl.data?.status==="submitted","submitted");const DID=dl.data?.id;
chk([403,409].includes((await api("POST",`/api/v1/tasks/${TID}/deliverables`,{content:"x"},A2)).status),"Wrong agent");
chk((await api("GET",`/api/v1/tasks/${TID}`)).data?.status==="delivered","→ delivered");
sec("T1.8 — Accept + Credits");
chk((await web("PATCH",`/api/tasks/${TID}/deliverables/${DID}`,{action:"accept"},P2)).status===200,"Accept del");
chk((await api("GET",`/api/v1/tasks/${TID}`)).data?.status==="completed","→ completed");
const ca=await api("GET","/api/v1/agents/me/credits",null,A1);const balA=ca.data?.credit_balance||0;
chk(balA>balB,`Credits: ${balB} → ${balA}`);
const pay=(ca.data?.recent_transactions||[]).find(t=>t.type==="payment"&&t.task_id===TID);
if(pay){chk(pay.amount===180,`Pay: ${pay.amount}`);chk(typeof pay.balance_after==="number","balance_after")}
sec("T1.9 — Enums");chk(["open","claimed","in_progress","delivered","completed","disputed","cancelled"].includes((await api("GET",`/api/v1/tasks/${TID}`)).data?.status),"Valid");
sec("T2.1 — Pagination");
const pg=await api("GET","/api/v1/tasks?limit=2");chk(pg.ok,"Page1");chk(pg.meta?.hasOwnProperty("has_more"),"has_more");chk(pg.meta?.hasOwnProperty("cursor"),"cursor");
if(pg.meta?.cursor){const p2=await api("GET",`/api/v1/tasks?limit=2&cursor=${pg.meta.cursor}`);chk(p2.ok,"Page2");chk(!p2.data?.some(t=>pg.data.some(x=>x.id===t.id)),"No dups")}
chk((await api("GET","/api/v1/tasks?cursor=BAD")).status===400,"Bad cursor");
sec("T2.2 — Rate Limit");
const rl=await fetch(`${BASE}/api/v1/agents/me`,{headers:{Authorization:`Bearer ${A1}`}});
chk(rl.headers.get("x-ratelimit-limit")==="100","Limit");chk(rl.headers.has("x-ratelimit-remaining"),"Remaining");chk(rl.headers.has("x-ratelimit-reset"),"Reset");
sec("T2.3 — Errors");
const e4=await api("GET","/api/v1/tasks/999999");chk(!!e4.error?.code,"code");chk(e4.error?.message?.includes("999999"),"context");chk(e4.error?.suggestion?.includes("/api/v1"),"suggestion");
sec("T2.4 — Profile");
chk((await api("GET","/api/v1/agents/me")).ok,"me");chk((await api("PATCH","/api/v1/agents/me",{description:"t"})).ok,"patch");
chk((await api("GET","/api/v1/agents/me/claims")).ok,"claims");chk((await api("GET","/api/v1/agents/me/tasks")).ok,"tasks");
chk(typeof(await api("GET","/api/v1/agents/me/credits")).data?.credit_balance==="number","credits");
sec("T2.5 — Bulk");
const b1=await web("POST","/api/tasks",{title:"BulkA",description:"Automated bulk test task alpha number.",budgetCredits:50,categoryId:"1"},P2);
const b2=await web("POST","/api/tasks",{title:"BulkB",description:"Automated bulk test task bravo number.",budgetCredits:75,categoryId:"1"},P2);
if(b1.data?.id&&b2.data?.id){const bk=await api("POST","/api/v1/tasks/bulk/claims",{claims:[{task_id:b1.data.id,proposed_credits:40},{task_id:b2.data.id,proposed_credits:60},{task_id:999999,proposed_credits:10}]});
chk(bk.ok,"Bulk");chk((bk.data?.results?.filter(r=>r.ok)?.length||0)>=2,"2+ ok");chk((bk.data?.results?.filter(r=>!r.ok)?.length||0)>=1,"1+ fail")}
sec("T2.6 — Idempotency");
const it=await web("POST","/api/tasks",{title:"Idemp",description:"Idempotency key test for claims route endpoint.",budgetCredits:80,categoryId:"1"});
if(it.data?.id){const ik=`i-${Date.now()}`;const h={Authorization:`Bearer ${A2}`,"Content-Type":"application/json","Idempotency-Key":ik};
const r1=await fetch(`${BASE}/api/v1/tasks/${it.data.id}/claims`,{method:"POST",headers:h,body:JSON.stringify({proposed_credits:70})});chk(r1.status===201,"1st");
const r2=await fetch(`${BASE}/api/v1/tasks/${it.data.id}/claims`,{method:"POST",headers:h,body:JSON.stringify({proposed_credits:70})});chk(r2.headers.get("idempotency-replayed")==="true","Replayed")}
sec("T3.1 — Webhooks");
const wh=await api("POST","/api/v1/webhooks",{url:WH,events:["task.new_match","claim.accepted","deliverable.accepted"]});
chk(wh.status===201,"Register");chk(wh.data?.secret?.startsWith("whsec_"),"Secret");
chk((await api("GET","/api/v1/webhooks")).data?.length>=1,"List");
if(wh.data?.secret)chk(createHmac("sha256",wh.data.secret).update("t").digest("hex").length===64,"HMAC");
chk((await api("POST","/api/v1/webhooks",{url:"http://x.com",events:["claim.accepted"]})).status===422,"HTTP rej");
chk((await api("POST","/api/v1/webhooks",{url:"https://x.com",events:["fake"]})).status===422,"Bad evt");
if(wh.data?.id)chk((await api("DELETE",`/api/v1/webhooks/${wh.data.id}`)).ok,"Delete");
sec("T3.2 — Search");
const sr=await api("GET","/api/v1/tasks/search?q=lifecycle");chk(sr.ok,"Search");chk(sr.meta?.query==="lifecycle","Meta");
if(sr.data?.[0])chk(typeof sr.data[0].relevance==="number","Relevance");
chk((await api("GET","/api/v1/tasks/search?q=bulk+test&status=open")).ok,"Multi");
chk((await api("GET","/api/v1/tasks/search?q=")).status===400,"Empty");
sec("T3.3 — Visibility");
const a1id=(await api("GET","/api/v1/agents/me")).data?.id;const pub=await api("GET",`/api/v1/agents/${a1id}`);
chk(pub.ok,"Public");chk(typeof pub.data?.reputation_score==="number","reputation");chk(typeof pub.data?.tasks_completed==="number","completed");chk(pub.data?.hasOwnProperty("avg_rating"),"avg_rating");
sec("T3.4 — Rollback");
const rb=await web("POST","/api/tasks",{title:"Rollback",description:"Testing cancel and withdraw rollback flow paths.",budgetCredits:60,categoryId:"1"});
if(rb.data?.id){const rbc=await api("POST",`/api/v1/tasks/${rb.data.id}/claims`,{proposed_credits:50},A2);
if(rbc.ok){chk((await api("POST",`/api/v1/tasks/${rb.data.id}/claims/${rbc.data.id}/withdraw`,null,A2)).ok,"Withdraw");
chk((await api("GET",`/api/v1/tasks/${rb.data.id}`)).data?.status==="open","→ open")}
chk((await web("POST",`/api/tasks/${rb.data.id}/cancel`)).status===200,"Cancel");
chk((await api("GET",`/api/v1/tasks/${rb.data.id}`)).data?.status==="cancelled","→ cancelled")}
sec("T3.5 — Reviews");
const rv=await web("POST",`/api/tasks/${TID}/review`,{agentId:a1id,rating:5,qualityScore:5,speedScore:4,comment:"E2E."},P2);
chk(rv.status===201||rv.status===200,`Review → ${rv.status}`);
chk((await api("GET","/api/v1/agents/me")).data?.avg_rating!==null,"avg_rating");
sec("T3.6 — SSE");
try{const s=await fetch(`${BASE}/api/v1/events`,{headers:{Authorization:`Bearer ${A1}`},signal:AbortSignal.timeout(3000)});chk(s.headers.get("content-type")?.includes("text/event-stream"),"Global")}catch(e){chk(e.name==="TimeoutError","Global (timeout)")}
try{const s=await fetch(`${BASE}/api/v1/tasks/${TID}/events`,{headers:{Authorization:`Bearer ${A1}`},signal:AbortSignal.timeout(3000)});chk(s.headers.get("content-type")?.includes("text/event-stream"),"Task")}catch(e){chk(e.name==="TimeoutError","Task (timeout)")}
sec("T3.7 — Bot & Skills");
chk(existsSync(join(ROOT,"demo-bot.js")),"demo-bot.js");
let bs=false;try{bs=!!JSON.parse(readFileSync(join(ROOT,"package.json"),"utf8")).scripts?.["demo-bot"]}catch{};chk(bs,"npm run demo-bot");
let sc=0;for(const s of["browse-tasks","claim-task","submit-deliverable","agent-profile"]){if(existsSync(join(ROOT,"skills",s,"SKILL.md")))sc++}chk(sc>=3,`Skills: ${sc}/4`);
console.log(`\n${"═".repeat(64)}\n  RESULTS: ${ok} passed | ${fail} failed | ${ok+fail} total\n  Score: ${Math.round(ok/(ok+fail)*100)}%\n${"═".repeat(64)}\n`);
console.log(fail===0?"  🎉 ALL TESTS PASSED\n":`  ⚠️  ${fail} failed\n`);process.exit(fail>0?1:0)}
main().catch(e=>{console.error("CRASH:",e);process.exit(1)});