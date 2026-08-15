// ==UserScript==
// @name         Doritus Ultra Study
// @namespace    doritus-ultra
// @version      2.4.0
// @description  Assistente conceitual de estudo para leitura e destaque de sugestões.
// @author       israelmarques1024-dotcom
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      raw.githubusercontent.com
// @updateURL    https://raw.githubusercontent.com/israelmarques1024-dotcom/Israelmarques1024-dotcom/main/studydb/doritus-ultra-study.user.js
// @downloadURL  https://raw.githubusercontent.com/israelmarques1024-dotcom/Israelmarques1024-dotcom/main/studydb/doritus-ultra-study.user.js
// @run-at       document-idle
// ==/UserScript==

(async()=>{
'use strict';
const BASE='https://raw.githubusercontent.com/israelmarques1024-dotcom/Israelmarques1024-dotcom/main/studydb/ultra-v24/';
const PARTS=5;
const EXPECTED='a94dfab9516da0e3c12f415129cb3129d136dbd3714aa67738aea84c482db6a6';
const CACHE='doritus_ultra_bundle_v24';
const get=url=>new Promise((resolve,reject)=>GM_xmlhttpRequest({
  method:'GET',url,
  onload:r=>r.status>=200&&r.status<300?resolve(r.responseText):reject(new Error('HTTP '+r.status)),
  onerror:()=>reject(new Error('Falha de rede'))
}));
const sha=async text=>{
  const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map(x=>x.toString(16).padStart(2,'0')).join('');
};
const unpack=async b64=>{
  const bin=atob(b64);
  const bytes=Uint8Array.from(bin,c=>c.charCodeAt(0));
  const ds=new DecompressionStream('gzip');
  const stream=new Blob([bytes]).stream().pipeThrough(ds);
  return await new Response(stream).text();
};
let source='';
try{
  const chunks=await Promise.all(Array.from({length:PARTS},(_,i)=>get(BASE+`part-${String(i).padStart(2,'0')}.txt`)));
  source=await unpack(chunks.join(''));
  const got=await sha(source);
  if(got!==EXPECTED)throw new Error(`Integridade inválida: ${got}`);
  GM_setValue(CACHE,source);
}catch(err){
  source=GM_getValue(CACHE,'');
  if(!source){console.error('[Doritus Ultra] Não foi possível carregar v2.4:',err);return;}
}
try{eval(source)}catch(err){console.error('[Doritus Ultra] Falha ao iniciar:',err)}
})();
