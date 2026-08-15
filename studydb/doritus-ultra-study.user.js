// ==UserScript==
// @name         Doritus Ultra Study
// @namespace    doritus-ultra
// @version      2.5.1
// @description  Assistente conceitual de estudo: hotfix para controles ocultos da Sala do Futuro.
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
const BASE='https://raw.githubusercontent.com/israelmarques1024-dotcom/Israelmarques1024-dotcom/main/studydb/ultra-v25/';
const PARTS=4;
const EXPECTED='7f85b2bc644097c6721357112d9af3f2af6bdba8bf23e9336e1a602cd468eb86';
const CACHE='doritus_ultra_bundle_v25';

// Hotfix: várias SPAs escondem o radio/checkbox nativo e deixam apenas a opção visual.
// A v2.5 validava dimensões/visibilidade do input, então acabava vendo zero questões.
// Mantemos os controles fora da tela e praticamente transparentes para que o detector os enxergue
// sem interferir no clique normal do componente visual da página.
const exposeHiddenNativeControls=()=>{
  for(const el of document.querySelectorAll('input[type="radio"],input[type="checkbox"]')){
    const cs=getComputedStyle(el),r=el.getBoundingClientRect();
    const hidden=r.width===0||r.height===0||cs.display==='none'||cs.visibility==='hidden'||cs.opacity==='0';
    if(!hidden||el.dataset.dusExposed==='1')continue;
    el.dataset.dusExposed='1';
    el.style.setProperty('display','block','important');
    el.style.setProperty('visibility','visible','important');
    el.style.setProperty('opacity','0.001','important');
    el.style.setProperty('position','fixed','important');
    el.style.setProperty('left','-9999px','important');
    el.style.setProperty('top','-9999px','important');
    el.style.setProperty('width','1px','important');
    el.style.setProperty('height','1px','important');
    el.style.setProperty('pointer-events','none','important');
  }
};
exposeHiddenNativeControls();
new MutationObserver(exposeHiddenNativeControls).observe(document.documentElement,{subtree:true,childList:true});

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
  if(typeof DecompressionStream==='undefined')throw new Error('DecompressionStream não suportado pelo navegador');
  const bin=atob(b64);
  const bytes=Uint8Array.from(bin,c=>c.charCodeAt(0));
  const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
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
  if(!source){console.error('[Doritus Ultra] Não foi possível carregar v2.5.1:',err);return;}
}
// Exibe a versão do hotfix também dentro da interface carregada pelo bundle.
source=source.replace("const VERSION='2.5.0';","const VERSION='2.5.1';");
try{eval(source)}catch(err){console.error('[Doritus Ultra] Falha ao iniciar:',err)}
})();
