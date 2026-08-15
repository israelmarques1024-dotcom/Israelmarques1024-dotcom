// ==UserScript==
// @name         Doritus Ultra Study
// @namespace    doritus-ultra
// @version      2.2.0
// @description  Lê questões da página, consulta banco local e destaca sugestões automaticamente.
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
const BASE='https://raw.githubusercontent.com/israelmarques1024-dotcom/Israelmarques1024-dotcom/main/studydb/ultra-v22/';
const PARTS=5;
const EXPECTED='fbcc5311f9416d3dfce55154597f2c5c19d5f292f5cf47645f74e6fcf2da0c3e';
const CACHE='doritus_ultra_bundle_v22';
const get=url=>new Promise((resolve,reject)=>GM_xmlhttpRequest({method:'GET',url,onload:r=>r.status>=200&&r.status<300?resolve(r.responseText):reject(new Error('HTTP '+r.status)),onerror:()=>reject(new Error('Falha de rede'))}));
const sha=async text=>{const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return [...new Uint8Array(d)].map(x=>x.toString(16).padStart(2,'0')).join('')};
let source='';
try{
  const chunks=await Promise.all(Array.from({length:PARTS},(_,i)=>get(BASE+`part-${String(i).padStart(2,'0')}.txt`)));
  source=chunks.join('');
  const got=await sha(source);
  if(got!==EXPECTED)throw new Error(`Integridade inválida: ${got}`);
  GM_setValue(CACHE,source);
}catch(err){
  source=GM_getValue(CACHE,'');
  if(!source){console.error('[Doritus Ultra] Não foi possível carregar o v2.2:',err);return;}
}
try{eval(source)}catch(err){console.error('[Doritus Ultra] Falha ao iniciar:',err)}
})();
