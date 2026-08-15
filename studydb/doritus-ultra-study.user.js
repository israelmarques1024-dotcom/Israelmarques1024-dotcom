// ==UserScript==
// @name         Doritus Ultra Study
// @namespace    doritus-ultra
// @version      2.0.0
// @description  Assistente de estudo com banco virtual de 100 milhões de registros.
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
const BASE='https://raw.githubusercontent.com/israelmarques1024-dotcom/Israelmarques1024-dotcom/main/studydb/ultra/';
const PARTS=5;
const EXPECTED='79c5ea733fb601009d38a8d1434abe8179419fba8ebb6e17b596c14db6be1ddd';
const CACHE='doritus_ultra_study_bundle_v2';
const get=url=>new Promise((resolve,reject)=>GM_xmlhttpRequest({
 method:'GET',url,
 onload:r=>r.status>=200&&r.status<300?resolve(r.responseText):reject(new Error('HTTP '+r.status)),
 onerror:()=>reject(new Error('Falha de rede'))
}));
const digest=async text=>{
 const data=new TextEncoder().encode(text);
 const hash=await crypto.subtle.digest('SHA-256',data);
 return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('');
};
let source='';
try{
 const chunks=await Promise.all(Array.from({length:PARTS},(_,i)=>get(BASE+`part-${String(i).padStart(2,'0')}.txt`)));
 source=chunks.join('');
 const got=await digest(source);
 if(got!==EXPECTED)throw new Error('SHA-256 inválido');
 GM_setValue(CACHE,source);
}catch(err){
 source=GM_getValue(CACHE,'');
 if(!source){console.error('[Doritus Ultra] Não foi possível carregar o bundle:',err);return;}
}
try{eval(source)}catch(err){console.error('[Doritus Ultra] Erro ao iniciar:',err);}
})();
