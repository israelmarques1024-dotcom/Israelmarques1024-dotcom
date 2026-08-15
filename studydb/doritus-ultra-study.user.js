// ==UserScript==
// @name         Capitritus
// @namespace    capitritus
// @version      3.0.0
// @description  Assistente de estudo para detectar questões da página, consultar banco local e destacar sugestões.
// @author       israelmarques1024-dotcom
// @match        *://*/*
// @grant        GM_registerMenuCommand
// @grant        GM_setValue
// @grant        GM_getValue
// @updateURL    https://raw.githubusercontent.com/israelmarques1024-dotcom/Israelmarques1024-dotcom/main/studydb/capitritus.user.js
// @downloadURL  https://raw.githubusercontent.com/israelmarques1024-dotcom/Israelmarques1024-dotcom/main/studydb/capitritus.user.js
// @run-at       document-idle
// ==/UserScript==

(() => {
'use strict';

const APP='Capitritus', VERSION='3.0.0';
const DB_KEY='doritus_ultra_local_bank_v21'; // compatibilidade com banco anterior
const MARK='capitritus-mark', BADGE='capitritus-badge';
const state={items:[],timer:null,observer:null};

const norm=s=>String(s||'').normalize('NFKC').toLocaleLowerCase('pt-BR').replace(/\u00a0/g,' ').replace(/[“”"'`´]/g,'').replace(/\s+/g,' ').trim();
const txt=el=>String(el?.innerText||el?.textContent||'').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim();
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const visible=el=>{if(!el||!(el instanceof Element))return false;const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'};
const qsa=(root,sel)=>{try{return [...root.querySelectorAll(sel)]}catch{return[]}};
const uniq=(arr,key=x=>x)=>{const s=new Set();return arr.filter(x=>{const k=key(x);if(s.has(k))return false;s.add(k);return true})};

async function sha(text){const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(norm(text)));return [...new Uint8Array(d)].map(x=>x.toString(16).padStart(2,'0')).join('')}
function db(){const x=GM_getValue(DB_KEY,{});return x&&typeof x==='object'&&!Array.isArray(x)?x:{}}
function saveDb(x){GM_setValue(DB_KEY,x)}

function platform(){const h=location.hostname;if(/saladofuturo|educacao\.sp\.gov\.br|cmsp/i.test(h))return'Sala do Futuro/CMSP';if(/khanacademy/i.test(h))return'Khan Academy';if(/matific/i.test(h))return'Matific';return h}

function labelFor(input){
  if(input.id){try{const l=document.querySelector(`label[for="${CSS.escape(input.id)}"]`);if(l)return l}catch{}}
  return input.closest('label,[role="radio"],[role="option"],[class*="option" i],[class*="choice" i]')||input.parentElement||input;
}
function usableInput(el){if(visible(el))return true;const l=labelFor(el);return l&&visible(l)}
function optionText(el){const l=el.matches?.('input')?labelFor(el):el;return txt(l)||el.getAttribute?.('aria-label')||el.value||''}

function cardRoot(el){
  let p=el;
  while(p&&p!==document.body){const t=txt(p);if(/Quest[aã]o\s*\d+\s*de\s*\d+/i.test(t)&&t.length<18000)return p;p=p.parentElement}
  return el.closest?.('[class*="question" i],[id*="question" i],fieldset,form,[role="group"]')||el.parentElement?.parentElement||el.parentElement;
}
function stemFrom(root,options=[]){
  let t=txt(root).replace(/Quest[aã]o\s*\d+\s*de\s*\d+/ig,' ').replace(/\b\d+\s*PONTOS?\b/ig,' ').replace(/\bCerto\s*Errado\b/ig,' ');
  for(const o of options){const p=t.indexOf(o.text);if(p>=0)t=t.slice(0,p)+t.slice(p+o.text.length)}
  return t.replace(/\s+/g,' ').trim().slice(0,5000);
}

function radioGroups(){
  const map=new Map();
  for(const el of qsa(document,'input[type="radio"],input[type="checkbox"]').filter(usableInput)){
    let key=el.name;
    if(!key){const r=cardRoot(el);key='anon-'+(r?.dataset?.capid||(r&&(r.dataset.capid=Math.random().toString(36).slice(2))))}
    if(!key)continue;
    if(!map.has(key))map.set(key,[]);map.get(key).push(el);
  }
  const groups=[...map.values()].filter(g=>g.length>=2&&g.length<=30);
  for(const rg of qsa(document,'[role="radiogroup"]')){const g=qsa(rg,'[role="radio"]').filter(visible);if(g.length>=2)groups.push(g)}
  return groups;
}

function detectRadios(){
  const out=[],seen=new Set();
  for(const g of radioGroups()){
    const options=g.map(el=>({element:el,visual:labelFor(el),text:optionText(el)})).filter(o=>o.text);
    if(options.length<2)continue;
    let root=cardRoot(g[0]);
    const labs=options.map(o=>norm(o.text));
    const isTF=options.length===2&&labs.some(x=>/certo|verdadeiro/.test(x))&&labs.some(x=>/errado|falso/.test(x));
    if(isTF){
      let p=g[0].parentElement,best=root;
      for(let i=0;i<6&&p;i++,p=p.parentElement){
        const rs=qsa(p,'input[type="radio"],[role="radio"]').filter(usableInput);
        if(rs.length===2&&txt(p).length<2500)best=p;
        if(rs.length>2)break;
      }
      root=best;
    }
    const question=stemFrom(root,options);if(question.length<8)continue;
    const sig=norm(question)+'|'+options.map(o=>norm(o.text)).join('|');if(seen.has(sig))continue;seen.add(sig);
    out.push({type:isTF?'truefalse':'choice',question,options,root,platform:platform(),suggestion:null});
  }
  return out;
}

function detectSelects(){
  const out=[],byRoot=new Map();
  const controls=[...qsa(document,'select').filter(visible),...qsa(document,'[role="combobox"],[aria-haspopup="listbox"]').filter(visible)];
  for(const c of controls){const r=cardRoot(c);if(!r)continue;if(!byRoot.has(r))byRoot.set(r,[]);byRoot.get(r).push(c)}
  for(const [root,controls] of byRoot){
    const question=stemFrom(root,[]);
    controls.forEach((c,i)=>{
      let options=[];
      if(c.matches('select'))options=[...c.options].map(o=>({text:txt(o),value:o.value,element:o,visual:c})).filter(o=>o.text&&!/selecione|escolha|--/i.test(o.text));
      else{
        const ids=[c.getAttribute('aria-controls'),c.getAttribute('aria-owns')].filter(Boolean);
        const scopes=[...ids.map(id=>document.getElementById(id)).filter(Boolean),root];
        const els=[];for(const s of scopes)els.push(...qsa(s,'[role="option"],[data-value],[data-label]'));
        options=uniq(els.map(el=>({text:txt(el)||el.getAttribute('aria-label')||'',value:el.getAttribute('data-value')||txt(el),element:el,visual:c})).filter(o=>o.text),o=>norm(o.text));
      }
      out.push({type:'fill',question,options,root,control:c,blankIndex:i,blankCount:controls.length,platform:platform(),suggestion:null});
    });
  }
  return out;
}

function detectOpen(){
  const out=[],seen=new Set();
  const controls=[...qsa(document,'textarea').filter(visible),...qsa(document,'[contenteditable="true"]').filter(visible)];
  for(const c of controls){const root=cardRoot(c),question=stemFrom(root,[]);if(question.length<15||seen.has(norm(question)))continue;seen.add(norm(question));out.push({type:'open',question,root,platform:platform(),hints:[]})}
  for(const el of qsa(document,'div,section,article').filter(visible)){
    const t=txt(el);if(!/Quest[aã]o\s*\d+\s*de\s*\d+/i.test(t)||!/Responder|Assistente de corre[cç][aã]o|N[°º]\s*m[ií]nimo de caracteres/i.test(t))continue;
    if(qsa(el,'input[type="radio"],select,textarea,[role="radio"],[role="combobox"]').length)continue;
    const q=stemFrom(el,[]).replace(/Responder|Assistente de corre[cç][aã]o|N[°º]\s*m[ií]nimo de caracteres:?\s*\d*/ig,' ').trim();if(q.length<20||seen.has(norm(q)))continue;seen.add(norm(q));out.push({type:'open',question:q,root:el,platform:platform(),hints:[]});
  }
  return out;
}

function tfIndex(item,value){const a=item.options.map(o=>norm(o.text));return value?a.findIndex(x=>/certo|verdadeiro/.test(x)):a.findIndex(x=>/errado|falso/.test(x))}
function concept(item){
  const q=norm(item.question), opts=item.options||[];
  if(item.type==='truefalse'){
    const yes=()=>({index:tfIndex(item,true),confidence:.94,why:'regra conceitual'}), no=()=>({index:tfIndex(item,false),confidence:.94,why:'regra conceitual'});
    if(/mata atl[aâ]ntica/.test(q)&&/alta umidade|chuvas frequentes|florestas densas/.test(q))return yes();
    if(/cerrado/.test(q)&&/troncos tortuosos|cascas grossas|fogo/.test(q))return yes();
    if(/desmatamento.*margens.*mant[eé]m.*protegidos|barra o aquecimento/.test(q))return no();
    if(/floresta invertida|ra[ií]zes profundas/.test(q))return yes();
  }
  const scores=opts.map(o=>{const t=norm(o.text);let s=0;
    if(/hotspot/.test(q)){if(/elevada riqueza|esp[eé]cies exclusivas|end[eê]m/.test(t))s+=5;if(/degrada[cç][aã]o|a[cç][oõ]es humanas/.test(t))s+=4;if(/baixa quantidade|clima des[eé]rtico|cobertura vegetal intacta|elimina os riscos/.test(t))s-=5}
    if(/fragmenta[cç][aã]o/.test(q)){if(/isolamento|reduz.*circula[cç][aã]o|dispers[aã]o de sementes/.test(t))s+=5;if(/aumenta a umidade|bloqueia a extin[cç][aã]o|compensa a perda/.test(t))s-=4}
    if(/aqu[aá]tic|algas|fotoss[ií]ntese/.test(q)){if(/profundidade/.test(t)&&/luz/.test(t))s+=5;if(/algas/.test(t)&&/fotoss[ií]ntese/.test(t))s+=3;if(/mesmo valor em rios e oceanos|dispensa.*preserva[cç][aã]o|unico componente imune/.test(t))s-=4}
    if(/metro.*cent[ií]metro/.test(q)&&/1\s*metro.*100\s*cent/.test(t))s+=6;
    return s});
  const best=scores.map((s,i)=>({s,i})).sort((a,b)=>b.s-a.s)[0];if(best&&best.s>1)return{index:best.i,confidence:Math.min(.97,.72+best.s*.04),why:'conceito'};
  return null;
}
function fillInference(item){const q=norm(item.question);if(/intensidade luminosa|assoreamento|fotoss[ií]ntese das algas/.test(q)){const a=['abiótico','bióticos','aquático'][item.blankIndex];if(a)return{answer:a,confidence:.9,why:'conceito da lacuna'}}return null}

async function lookup(item){
  const D=db(),h=await sha(item.question+(item.type==='fill'?`|${item.blankIndex}`:''));item.hash=h;
  const rec=D[h];
  if(rec&&item.options?.length){let i=Number.isInteger(rec.optionIndex)?rec.optionIndex:item.options.findIndex(o=>norm(o.text)===norm(rec.answer));if(i>=0)return{index:i,confidence:1,why:'banco local'}}
  if(item.type==='fill'&&!item.options.length)return fillInference(item);
  return concept(item);
}

function clearMarks(){qsa(document,'.'+MARK).forEach(x=>x.classList.remove(MARK));qsa(document,'.'+BADGE).forEach(x=>x.remove())}
function mark(item){const s=item.suggestion;if(!s)return;if(item.type==='fill'){item.control?.classList.add(MARK);return}const o=item.options?.[s.index],v=o?.visual;if(!v)return;v.classList.add(MARK);if(!v.querySelector('.'+BADGE)){const b=document.createElement('span');b.className=BADGE;b.textContent=`Capitritus ${Math.round(s.confidence*100)}%`;v.appendChild(b)}}

async function analyze(){state.items=[...detectRadios(),...detectSelects(),...detectOpen()];for(const item of state.items){if(item.type==='open'){item.hints=[];continue}item.suggestion=await lookup(item)}clearMarks();state.items.forEach(mark);render()}
async function save(item,index){const D=db(),h=item.hash||await sha(item.question),old=D[h];D[h]={question:item.question,answer:item.options[index].text,optionIndex:index,options:item.options.map(o=>o.text),platform:item.platform,createdAt:old?.createdAt||Date.now(),updatedAt:Date.now(),revision:(old?.revision||0)+1};saveDb(D);item.suggestion={index,confidence:1,why:'confirmada'};clearMarks();state.items.forEach(mark);render()}

function style(){if(document.getElementById('cap-style'))return;const s=document.createElement('style');s.id='cap-style';s.textContent=`.${MARK}{outline:3px solid #ffd54a!important;outline-offset:3px!important;box-shadow:0 0 0 5px #ffd54a33!important;border-radius:8px!important}.${BADGE}{display:inline-block!important;margin-left:6px!important;padding:2px 6px!important;border-radius:999px!important;background:#ffd54a!important;color:#111!important;font:700 10px system-ui!important}#cap-toggle{position:fixed;right:18px;bottom:18px;z-index:2147483646;background:#111;color:#fff;border:1px solid #555;border-radius:999px;padding:11px 16px;font:700 13px system-ui;cursor:pointer}#cap-panel[hidden]{display:none!important}#cap-panel{position:fixed;right:18px;bottom:68px;z-index:2147483647;width:min(500px,calc(100vw - 24px));max-height:76vh;overflow:auto;background:#111;color:#eee;border:1px solid #444;border-radius:14px;padding:13px;box-shadow:0 18px 55px #0009;font:13px/1.45 system-ui}#cap-panel button{background:#222;color:#eee;border:1px solid #444;border-radius:7px;padding:7px;cursor:pointer}.cap-card{margin-top:8px;padding:9px;background:#181818;border:1px solid #333;border-radius:9px}.cap-small{font-size:11px;color:#aaa}.cap-ans{color:#ffd96a;font-weight:700;margin-top:5px}.cap-row{display:flex;gap:6px;margin-top:7px}`;document.documentElement.appendChild(s)}
function build(){if(document.getElementById('cap-toggle'))return;style();const t=document.createElement('button');t.id='cap-toggle';t.textContent='Capitritus';document.body.appendChild(t);const p=document.createElement('section');p.id='cap-panel';p.hidden=true;p.innerHTML=`<b>Capitritus <span class="cap-small">v${VERSION}</span></b><div class="cap-row"><button id="cap-read">Ler página</button><button id="cap-clear">Limpar destaques</button></div><div id="cap-summary" class="cap-card">Inicializando…</div><div id="cap-results"></div>`;document.body.appendChild(p);t.onclick=()=>p.hidden=!p.hidden;document.getElementById('cap-read').onclick=analyze;document.getElementById('cap-clear').onclick=clearMarks}
function render(){const s=document.getElementById('cap-summary'),r=document.getElementById('cap-results');if(!s||!r)return;const found=state.items.filter(x=>x.suggestion).length;s.textContent=`Detectadas: ${state.items.length} • sugestões: ${found} • banco local: ${Object.keys(db()).length}`;r.innerHTML='';state.items.forEach((it,n)=>{const c=document.createElement('div');c.className='cap-card';let ans='';if(it.type==='open')ans='<div class="cap-small">Questão aberta detectada; use os conceitos da atividade para elaborar sua resposta.</div>';else if(it.suggestion){const a=it.suggestion.index>=0?it.options[it.suggestion.index]?.text:it.suggestion.answer;ans=`<div class="cap-ans">Sugestão: ${esc(a||'')}</div><div class="cap-small">${esc(it.suggestion.why||'')} • ${Math.round((it.suggestion.confidence||0)*100)}%</div>`}else ans='<div class="cap-small">Sem sugestão confiável.</div>';c.innerHTML=`<div class="cap-small">Item ${n+1} • ${esc(it.type)} • ${esc(it.platform)}</div><div style="font-weight:650;margin-top:4px">${esc(it.question)}</div>${ans}<div class="cap-options"></div>`;if(it.options?.length&&it.type!=='fill'){const box=c.querySelector('.cap-options');it.options.forEach((o,i)=>{const row=document.createElement('div');row.className='cap-row';row.innerHTML=`<button data-i="${i}">Salvar</button><span>${it.suggestion?.index===i?'★ ':''}${esc(o.text)}</span>`;box.appendChild(row)});box.querySelectorAll('button[data-i]').forEach(b=>b.onclick=()=>save(it,Number(b.dataset.i)))}r.appendChild(c)})}

function init(){build();setTimeout(analyze,800);state.observer=new MutationObserver(ms=>{if(ms.some(m=>!m.target?.closest?.('#cap-panel'))) {clearTimeout(state.timer);state.timer=setTimeout(analyze,1000)}});state.observer.observe(document.documentElement,{subtree:true,childList:true})}
GM_registerMenuCommand('Capitritus: ler página',analyze);
if(document.body)init();else addEventListener('DOMContentLoaded',init,{once:true});
})();
