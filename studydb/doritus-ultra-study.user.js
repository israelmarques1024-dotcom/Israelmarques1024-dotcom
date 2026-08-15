// ==UserScript==
// @name         Doritus Ultra Study
// @namespace    doritus-ultra
// @version      2.8.2
// @description  Assistente conceitual de estudo com detector, banco local, solvers e mapa curricular v7.
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
const BASE='https://raw.githubusercontent.com/israelmarques1024-dotcom/Israelmarques1024-dotcom/main/studydb/ultra-v27/';
const PARTS=5;
const BASE_SHA='9d14f58f238994ae6a83934f0662b5591eca3349fbb7c9cb08349ed6c3e6d9be';
const PATCHED_SHA='2d41b9af625bcc95f85f4e6b999f549affe920a2b9f48c60464c2247795c95c3';
const CACHE='doritus_ultra_bundle_v282';

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
  if(typeof DecompressionStream==='undefined')throw new Error('DecompressionStream não suportado');
  const bin=atob(b64);
  const bytes=Uint8Array.from(bin,c=>c.charCodeAt(0));
  const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return await new Response(stream).text();
};
function replaceOnce(source,from,to,label){
  const i=source.indexOf(from);
  if(i<0)throw new Error('Patch não encontrado: '+label);
  return source.slice(0,i)+to+source.slice(i+from.length);
}

let source='';
try{
  const chunks=await Promise.all(Array.from({length:PARTS},(_,i)=>get(BASE+`part-${String(i).padStart(2,'0')}.txt`)));
  source=await unpack(chunks.join(''));
  if(await sha(source)!==BASE_SHA)throw new Error('Bundle base v2.7 inválido');

  source=replaceOnce(source,"// @version      2.7.0","// @version      2.8.2",'meta-version');
  source=replaceOnce(source,"const VERSION='2.7.0';","const VERSION='2.8.2';",'version');
  source=replaceOnce(source,'function esc(s){',"\nKNOWLEDGE.push(\n  {id:'sci-riparian',subject:'Ciências',topic:'Mata ciliar e assoreamento',keywords:['mata ciliar','desmatamento ciliar','assoreamento','sedimentos','erosão','transparência da água','fotossíntese das algas'],facts:['A remoção da mata ciliar favorece erosão, assoreamento e aumento de sedimentos, reduzindo a transparência da água e a entrada de luz.'],answerHints:['assoreamento','sedimentos','reduz transparência','entrada de luz','fotossíntese das algas'],trueCues:['reduz transparência','reduz a penetração de luz','assoreamento','sedimentos'],falseCues:['protegidos','barra o aquecimento','mantém os fatores protegidos']},\n  {id:'sci-aquatic',subject:'Ciências',topic:'Ecossistema aquático',keywords:['ecossistema aquático','algas','peixes','fotossíntese','intensidade luminosa','ambiente aquático'],facts:['Luz é fator abiótico. Algas e peixes são fatores bióticos em ecossistemas aquáticos. A profundidade influencia a penetração da luz e a região onde algas realizam fotossíntese.'],answerHints:['abiótico','bióticos','aquático','fotossíntese','penetração da luz','profundidade'],trueCues:['fator abiótico','fatores bióticos','ambiente aquático','penetração de luz'],falseCues:['único componente imune','mesmo valor em rios e oceanos','dispensa preservação']},\n  {id:'sci-biomas-hotspots',subject:'Ciências',topic:'Biomas, hotspots e degradação',keywords:['hotspot','hotspots','espécies exclusivas','riqueza de espécies','degradação','ações humanas','mata atlântica','cerrado'],facts:['Hotspots de biodiversidade combinam alta riqueza de espécies, muitas vezes endêmicas, com forte ameaça ou degradação causada por ações humanas.'],answerHints:['elevada riqueza','espécies exclusivas','degradação','ações humanas'],trueCues:['espécies exclusivas','grave degradação','ações humanas'],falseCues:['baixa quantidade de fauna e flora','clima desértico','cobertura vegetal intacta','elimina os riscos de extinção']},\n  {id:'sci-fragment-flow',subject:'Ciências',topic:'Fragmentação e fluxo ecológico',keywords:['fragmentação florestal','fragmentação','isolamento','dispersão de sementes','circulação de animais','fluxo gênico','efeito de borda'],facts:['A fragmentação florestal isola populações, reduz circulação de animais, dificulta dispersão de sementes e compromete o fluxo gênico.'],answerHints:['isolamento','dispersão de sementes','circulação de animais','fluxo gênico'],trueCues:['reduz circulação','impede a dispersão','isola fragmentos'],falseCues:['aumenta a umidade interna','bloqueia a extinção','compensa a perda']}\n);\n\nfunction scienceAntiCuePenalty(entry,ot,c){\n  const q=normalize(entry.question+' '+entry.context);\n  let p=0;\n  if(/hotspot|hotspots/.test(q)){\n    if(/baixa quantidade|baixa biodiversidade|clima des[ée]rtico|cobertura vegetal intacta|elimina os riscos/.test(ot))p+=1.8;\n  }\n  if(/fragmenta[cç][aã]o|fragmentos|dispers[aã]o de sementes|circula[cç][aã]o de animais/.test(q)){\n    if(/bloqueia a extin[cç][aã]o|aumenta a umidade interna|compensa a perda/.test(ot))p+=1.6;\n  }\n  if(/mata ciliar|assoreamento|transpar[eê]ncia da [áa]gua|fotossint[eé]tica das algas/.test(q)){\n    if(/mant[eé]m os fatores protegidos|barra o aquecimento|protege os peixes/.test(ot))p+=1.6;\n  }\n  if(entry.type==='fill-blank'){\n    if(/ab[ií]ot/.test(q) && /bi[oó]tic/.test(ot))p+=.5;\n    if(/bi[oó]tic/.test(q) && /ab[ií]ot/.test(ot))p+=.4;\n  }\n  return p;\n}\n\nfunction esc(s){",'knowledge-addon');
  source=replaceOnce(source,"function optionConcept(entry,ranked){\n  if(!entry.options.length)return null;\n  let bestOverall=null;\n\n  for(const {c,score:conceptScore} of ranked){\n    const scores=entry.options.map(o=>{\n      const ot=normalize(o.text);\n      let s=0;\n      s+=phraseScore(ot,c.answerHints||[])*1.4;\n      for(const f of c.facts||[])s+=jaccard(ot,f)*1.1;\n      s+=phraseScore(ot,c.trueCues||[])*.8;\n      s-=phraseScore(ot,c.falseCues||[])*1.05;\n      return s;\n    });\n\n    const order=scores.map((s,i)=>({s,i})).sort((a,b)=>b.s-a.s);\n    if(!order.length||order[0].s<=0)continue;\n    const margin=order[0].s-(order[1]?.s||0);\n    const normalizedEvidence=Math.min(1,order[0].s/3);\n    const confidence=.53+conceptScore*.24+normalizedEvidence*.16+Math.min(.07,margin*.05);\n    const candidate={\n      index:order[0].i,\n      answer:entry.options[order[0].i].text,\n      confidence:Math.min(.95,confidence),\n      reason:`Conceito: ${c.topic}`,\n      source:'concept',\n      evidence:order[0].s,\n      margin\n    };\n    if(candidate.confidence>=cfg().suggestionThreshold &&\n      (!bestOverall||candidate.confidence>bestOverall.confidence||\n       (candidate.confidence===bestOverall.confidence&&candidate.margin>bestOverall.margin))){\n      bestOverall=candidate;\n    }\n  }\n  return bestOverall;\n}","function optionConcept(entry,ranked){\n  if(!entry.options.length)return null;\n  let bestOverall=null;\n  const qNorm=normalize(entry.question+' '+entry.context);\n\n  for(const {c,score:conceptScore} of ranked){\n    const scores=entry.options.map(o=>{\n      const ot=normalize(o.text);\n      let s=0;\n      s+=phraseScore(ot,c.answerHints||[])*1.55;\n      s+=phraseScore(ot,c.keywords||[])*1.1;\n      for(const f of c.facts||[])s+=jaccard(ot,f)*1.15;\n      s+=phraseScore(ot,c.trueCues||[])*1.0;\n      s-=phraseScore(ot,c.falseCues||[])*1.25;\n      s-=scienceAntiCuePenalty(entry,ot,c);\n      if(entry.type==='fill-blank'){\n        const exactKw=(c.keywords||[]).some(k=>normalize(k)===ot);\n        if(exactKw)s+=1.25;\n        if((c.answerHints||[]).some(k=>normalize(k)===ot))s+=1.1;\n        if(qNorm.includes('fator')&&/ab[ií]ot/.test(ot)&&/(luz|temperatura|água|solo|transpar[eê]ncia)/.test(qNorm))s+=.9;\n        if(qNorm.includes('algas')&&qNorm.includes('peixes')&&/bi[oó]tic/.test(ot))s+=1.0;\n        if(qNorm.includes('ecossistema')&&/aqu[aá]tic/.test(ot))s+=.9;\n      }\n      return s;\n    });\n\n    const order=scores.map((s,i)=>({s,i})).sort((a,b)=>b.s-a.s);\n    if(!order.length||order[0].s<=0)continue;\n    const margin=order[0].s-(order[1]?.s||0);\n    const normalizedEvidence=Math.min(1,order[0].s/3.2);\n    let confidence=.52+conceptScore*.23+normalizedEvidence*.18+Math.min(.08,margin*.055);\n    if(entry.type==='fill-blank')confidence+=.06;\n    const candidate={\n      index:order[0].i,\n      answer:entry.options[order[0].i].text,\n      confidence:Math.min(.96,confidence),\n      reason:`Conceito: ${c.topic}`,\n      source:'concept',\n      evidence:order[0].s,\n      margin\n    };\n    const threshold=entry.type==='fill-blank'?Math.max(.6,cfg().suggestionThreshold-.08):cfg().suggestionThreshold;\n    if(candidate.confidence>=threshold &&\n      (!bestOverall||candidate.confidence>bestOverall.confidence||\n       (candidate.confidence===bestOverall.confidence&&candidate.margin>bestOverall.margin))){\n      bestOverall=candidate;\n    }\n  }\n  return bestOverall;\n}",'optionConcept');

  const patched=await sha(source);
  if(patched!==PATCHED_SHA)throw new Error('Patch v2.8.2 não bate com SHA esperado: '+patched);
  GM_setValue(CACHE,source);
}catch(err){
  console.error('[Doritus Ultra] Falha ao preparar v2.8.2:',err);
  source=GM_getValue(CACHE,'');
  if(!source)return;
}
try{eval(source)}catch(err){console.error('[Doritus Ultra] Falha ao iniciar:',err)}
})();
