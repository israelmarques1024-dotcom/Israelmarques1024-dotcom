// ==UserScript==
// @name         Doritus Ultra Study
// @namespace    doritus-ultra
// @version      2.1.0
// @description  Detecta questões da página, consulta um banco local de estudo e destaca sugestões sem enviar respostas automaticamente.
// @author       israelmarques1024-dotcom
// @match        *://*/*
// @grant        GM_registerMenuCommand
// @grant        GM_setValue
// @grant        GM_getValue
// @updateURL    https://raw.githubusercontent.com/israelmarques1024-dotcom/Israelmarques1024-dotcom/main/studydb/doritus-ultra-study.user.js
// @downloadURL  https://raw.githubusercontent.com/israelmarques1024-dotcom/Israelmarques1024-dotcom/main/studydb/doritus-ultra-study.user.js
// @run-at       document-idle
// ==/UserScript==

(() => {
'use strict';

const APP = 'Doritus Ultra Study';
const VERSION = '2.1.0';
const DB_KEY = 'doritus_ultra_local_bank_v21';
const SETTINGS_KEY = 'doritus_ultra_settings_v21';
const HISTORY_KEY = 'doritus_ultra_history_v21';
const HIGHLIGHT_CLASS = 'dus-suggested-option';

const DEFAULT_SETTINGS = {
  fuzzyThreshold: 0.92,
  maxQuestions: 80,
  autoScan: true,
  showFloatingButton: true
};

const SELECTORS = {
  questionContainers: [
    '[data-testid*="question"]',
    '[data-test-id*="question"]',
    '[class*="question" i]',
    '[id*="question" i]',
    '[role="group"]',
    'fieldset',
    'form'
  ],
  options: [
    'label:has(input[type="radio"])',
    'label:has(input[type="checkbox"])',
    '[role="radio"]',
    '[role="option"]',
    'button',
    '[class*="option" i]',
    '[class*="choice" i]',
    '[data-testid*="choice"]',
    '[data-test-id*="choice"]'
  ]
};

const PLATFORM_HINTS = [
  [/khanacademy/i, 'Khan Academy'],
  [/saladofuturo|educacao\.sp\.gov\.br|cmsp/i, 'Sala do Futuro/CMSP'],
  [/matific/i, 'Matific'],
  [/alura/i, 'Alura'],
  [/speak/i, 'Speak'],
];

const state = {
  scan: [],
  currentIndex: 0,
  observer: null,
  scanTimer: null
};

function settings() {
  return {...DEFAULT_SETTINGS, ...(GM_getValue(SETTINGS_KEY, {}) || {})};
}
function saveSettings(s) { GM_setValue(SETTINGS_KEY, s); }

function loadDB() {
  const db = GM_getValue(DB_KEY, {});
  return db && typeof db === 'object' ? db : {};
}
function saveDB(db) { GM_setValue(DB_KEY, db); }

function normalize(text) {
  return String(text || '')
    .normalize('NFKC')
    .toLocaleLowerCase('pt-BR')
    .replace(/\s+/g, ' ')
    .replace(/[“”"'`´]/g, '')
    .replace(/\s*([,.;:!?()[\]{}])\s*/g, '$1')
    .trim()
    .slice(0, 2500);
}

async function sha256(text) {
  const data = new TextEncoder().encode(normalize(text));
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function tokenize(text) {
  return new Set(normalize(text).split(/[^\p{L}\p{N}]+/u).filter(x => x.length > 1));
}
function jaccard(a, b) {
  const A = tokenize(a), B = tokenize(b);
  if (!A.size || !B.size) return 0;
  let common = 0;
  for (const x of A) if (B.has(x)) common++;
  return common / (A.size + B.size - common);
}

function cleanText(el) {
  if (!el) return '';
  return String(el.innerText || el.textContent || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function visible(el) {
  if (!el || !(el instanceof Element)) return false;
  const r = el.getBoundingClientRect();
  const st = getComputedStyle(el);
  return r.width > 0 && r.height > 0 && st.display !== 'none' && st.visibility !== 'hidden';
}

function platformName() {
  const src = location.hostname + ' ' + location.href;
  for (const [re, name] of PLATFORM_HINTS) if (re.test(src)) return name;
  return location.hostname;
}

function optionElementFromLabel(label) {
  const input = label.querySelector('input[type="radio"],input[type="checkbox"]');
  return input || label;
}

function optionCandidates(container) {
  const seen = new Set();
  const result = [];
  for (const sel of SELECTORS.options) {
    let nodes = [];
    try { nodes = [...container.querySelectorAll(sel)]; } catch {}
    for (const el of nodes) {
      if (!visible(el)) continue;
      const text = cleanText(el);
      if (!text || text.length > 600) continue;
      const key = normalize(text);
      if (!key || seen.has(key)) continue;
      if (/^(continuar|próximo|proximo|enviar|submit|verificar|tentar novamente|voltar|avançar|avancar)$/i.test(text)) continue;
      const target = el.matches('label') ? optionElementFromLabel(el) : el;
      seen.add(key);
      result.push({text, element: target, visualElement: el});
    }
  }
  return result.slice(0, 20);
}

function questionText(container, options) {
  const raw = cleanText(container);
  if (!raw) return '';
  let q = raw;
  for (const o of options) if (o.text.length > 1) q = q.replace(o.text, ' ');
  q = q.replace(/\s+/g, ' ').trim();
  if (q.length < 8) q = raw;
  return q.slice(0, 2000);
}

function smallestQuestionContainers() {
  const candidates = [];
  const seen = new Set();
  for (const sel of SELECTORS.questionContainers) {
    let nodes = [];
    try { nodes = [...document.querySelectorAll(sel)]; } catch {}
    for (const el of nodes) {
      if (!visible(el) || seen.has(el)) continue;
      const opts = optionCandidates(el);
      if (opts.length < 2 || opts.length > 20) continue;
      const txt = cleanText(el);
      if (txt.length < 10 || txt.length > 6000) continue;
      seen.add(el);
      candidates.push({el, opts});
    }
  }
  return candidates.filter((x, i) => !candidates.some((y, j) => i !== j && x.el.contains(y.el) && y.opts.length >= 2 && cleanText(y.el).length < cleanText(x.el).length * 0.9));
}

function getAllQuestions() {
  const max = settings().maxQuestions;
  const containers = smallestQuestionContainers();
  const out = [];
  const signatures = new Set();
  for (const {el, opts} of containers) {
    const q = questionText(el, opts);
    const sig = normalize(q) + '|' + opts.map(x => normalize(x.text)).join('|');
    if (!q || signatures.has(sig)) continue;
    signatures.add(sig);
    out.push({container: el, question: q, options: opts, platform: platformName(), status: 'pending', match: null, suggestion: null, confidence: 0, reason: ''});
    if (out.length >= max) break;
  }
  return out;
}

function findOptionIndexByAnswer(options, answer) {
  const target = normalize(answer);
  if (!target) return -1;
  let exact = options.findIndex(o => normalize(o.text) === target);
  if (exact >= 0) return exact;
  if (target.length >= 2) {
    const idx = options.findIndex(o => { const t = normalize(o.text); return t.includes(target) || target.includes(t); });
    if (idx >= 0) return idx;
  }
  return -1;
}

function parseNumber(s) {
  const v = String(s).replace(/\./g, '').replace(',', '.').replace(/[^\d.+\-]/g, '');
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function solveSimple(question, options) {
  const q = normalize(question);
  let m = q.match(/(?:calcule|resultado|valor de)?\s*(-?\d+(?:[.,]\d+)?)\s*([+\-×x*/÷])\s*\(?\s*(-?\d+(?:[.,]\d+)?)\s*\)?/i);
  if (m) {
    const a = parseNumber(m[1]), b = parseNumber(m[3]);
    if (a !== null && b !== null) {
      const op = m[2]; let ans;
      if (op === '+') ans = a + b; else if (op === '-') ans = a - b; else if (op === '×' || op.toLowerCase() === 'x' || op === '*') ans = a * b; else if ((op === '/' || op === '÷') && b !== 0) ans = a / b;
      if (Number.isFinite(ans)) {
        for (const v of [String(ans), String(ans).replace('.', ',')]) {
          const idx = findOptionIndexByAnswer(options, v);
          if (idx >= 0) return {index: idx, answer: options[idx].text, confidence: 0.97, reason: `Operação calculada: ${a} ${op} ${b} = ${ans}`};
        }
      }
    }
  }
  m = q.match(/(?:quanto (?:é|e)|calcule)?\s*(\d+(?:[.,]\d+)?)\s*%\s*(?:de|do|da)\s*(\d+(?:[.,]\d+)?)/i);
  if (m) {
    const p = parseNumber(m[1]), base = parseNumber(m[2]);
    if (p !== null && base !== null) {
      const ans = p * base / 100;
      const idx = findOptionIndexByAnswer(options, String(ans));
      if (idx >= 0) return {index: idx, answer: options[idx].text, confidence: 0.97, reason: `${p}% de ${base} = ${ans}`};
    }
  }
  m = q.match(/(-?\d*)\s*x\s*([+\-])\s*(\d+(?:[.,]\d+)?)\s*=\s*(-?\d+(?:[.,]\d+)?)/i);
  if (m) {
    let a = m[1] === '' || m[1] === '+' ? 1 : m[1] === '-' ? -1 : Number(m[1]);
    const b = parseNumber(m[3]), c = parseNumber(m[4]);
    const x = m[2] === '-' ? (c + b) / a : (c - b) / a;
    const idx = findOptionIndexByAnswer(options, String(x));
    if (idx >= 0) return {index: idx, answer: options[idx].text, confidence: 0.95, reason: `Equação resolvida: x = ${x}`};
  }
  const concepts = [
    [/bact[eé]rias?.*procarion|procariontes?.*bact[eé]r/i, 'procarion'],
    [/estrutura.*entrada.*sa[ií]da.*subst[aâ]ncias.*c[eé]lula|membrana plasm[aá]tica/i, 'membrana plasm'],
    [/unidade.*for[cç]a.*si|for[cç]a.*newton/i, 'newton'],
    [/simple past.*\bgo\b|passado.*\bgo\b/i, 'went'],
    [/simple past.*\bsee\b|passado.*\bsee\b/i, 'saw'],
    [/verb to be.*\bhe\b/i, 'is'],
    [/verb to be.*\bi\b/i, 'am']
  ];
  for (const [re, answerPart] of concepts) {
    if (re.test(q)) {
      const idx = options.findIndex(o => normalize(o.text).includes(normalize(answerPart)));
      if (idx >= 0) return {index: idx, answer: options[idx].text, confidence: 0.85, reason: 'Regra conceitual local de estudo'};
    }
  }
  return null;
}

async function lookup(entry) {
  const db = loadDB();
  const hash = await sha256(entry.question); entry.hash = hash;
  const exact = db[hash];
  if (exact) {
    const idx = Number.isInteger(exact.optionIndex) ? exact.optionIndex : findOptionIndexByAnswer(entry.options, exact.answer);
    if (idx >= 0 && idx < entry.options.length) return {index: idx, answer: entry.options[idx].text, confidence: 1, reason: 'Correspondência exata no banco local', source: 'local-exact'};
  }
  const threshold = settings().fuzzyThreshold; let best = null;
  for (const [key, rec] of Object.entries(db)) {
    if (!rec.question) continue;
    const score = jaccard(entry.question, rec.question);
    if (score >= threshold && (!best || score > best.score)) best = {key, rec, score};
  }
  if (best) {
    const idx = Number.isInteger(best.rec.optionIndex) ? best.rec.optionIndex : findOptionIndexByAnswer(entry.options, best.rec.answer);
    if (idx >= 0 && idx < entry.options.length) return {index: idx, answer: entry.options[idx].text, confidence: best.score, reason: `Correspondência aproximada local (${Math.round(best.score*100)}%)`, source: 'local-fuzzy'};
  }
  const simple = solveSimple(entry.question, entry.options);
  if (simple) return {...simple, source: 'local-solver'};
  return null;
}

function clearHighlights() { document.querySelectorAll('.' + HIGHLIGHT_CLASS).forEach(el => el.classList.remove(HIGHLIGHT_CLASS)); }
function highlight(entry) {
  if (!entry?.suggestion || !Number.isInteger(entry.suggestion.index)) return;
  const o = entry.options[entry.suggestion.index]; if (!o?.visualElement) return;
  o.visualElement.classList.add(HIGHLIGHT_CLASS);
  o.visualElement.scrollIntoView({behavior: 'smooth', block: 'center'});
}

async function analyzeAll() {
  clearHighlights(); state.scan = getAllQuestions();
  for (const entry of state.scan) {
    const result = await lookup(entry);
    if (result) { entry.status = 'found'; entry.suggestion = result; entry.confidence = result.confidence; entry.reason = result.reason; }
    else { entry.status = 'missing'; entry.reason = 'Sem resposta no banco local e sem solução local confiável.'; }
  }
  state.currentIndex = 0; render();
}

async function saveCurrent(index) {
  const entry = state.scan[state.currentIndex];
  if (!entry || !Number.isInteger(index) || index < 0 || index >= entry.options.length) return;
  const hash = entry.hash || await sha256(entry.question); const db = loadDB(); const now = Date.now(); const previous = db[hash];
  db[hash] = {question: entry.question, answer: entry.options[index].text, optionIndex: index, options: entry.options.map(o => o.text), platform: entry.platform, createdAt: previous?.createdAt || now, updatedAt: now, revision: (previous?.revision || 0) + 1, source: 'manual-confirmation'};
  saveDB(db);
  entry.suggestion = {index, answer: entry.options[index].text, confidence: 1, reason: previous ? 'Correção salva no banco local' : 'Resposta confirmada e salva no banco local', source: 'manual-confirmation'};
  entry.status = 'found'; render(); highlight(entry);
}

function exportDB() {
  const blob = new Blob([JSON.stringify({version: '2.1.0', exportedAt: new Date().toISOString(), records: loadDB()}, null, 2)], {type: 'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `doritus-study-bank-${new Date().toISOString().slice(0,10)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function importDB(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result); const incoming = data.records || data;
      if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) throw new Error('Formato inválido.');
      const db = loadDB(); let count = 0;
      for (const [hash, rec] of Object.entries(incoming)) {
        if (!/^[a-f0-9]{64}$/i.test(hash) || !rec?.question || rec.answer == null) continue;
        db[hash] = rec; count++;
      }
      saveDB(db); alert(`${count} registros importados.`); analyzeAll();
    } catch (e) { alert(`Falha ao importar: ${e.message}`); }
  };
  reader.readAsText(file);
}

function addHistory(item) { const h = GM_getValue(HISTORY_KEY, []); h.unshift(item); GM_setValue(HISTORY_KEY, h.slice(0, 100)); }

function installStyle() {
  if (document.getElementById('dus-v21-style')) return;
  const st = document.createElement('style'); st.id = 'dus-v21-style';
  st.textContent = `.${HIGHLIGHT_CLASS}{outline:3px solid #ffd54a !important;outline-offset:3px !important;box-shadow:0 0 0 6px rgba(255,213,74,.20) !important;border-radius:8px !important}#dus-v21-toggle{position:fixed;right:18px;bottom:18px;z-index:2147483646;background:#111;color:#fff;border:1px solid #444;border-radius:999px;padding:11px 15px;font:600 13px system-ui;box-shadow:0 8px 28px #0008;cursor:pointer}#dus-v21{position:fixed;right:18px;bottom:68px;z-index:2147483647;width:min(460px,calc(100vw - 24px));max-height:78vh;overflow:auto;background:#101010;color:#eee;border:1px solid #444;border-radius:15px;box-shadow:0 18px 55px #0009;padding:14px;font:13px/1.45 system-ui}#dus-v21 *{box-sizing:border-box}#dus-v21 h2{margin:0 0 4px;font-size:17px}#dus-v21 button,#dus-v21 select,#dus-v21 input{background:#1d1d1d;color:#eee;border:1px solid #444;border-radius:8px;padding:8px;font:inherit}#dus-v21 button{cursor:pointer;font-weight:600}#dus-v21 button:hover{background:#282828}#dus-v21 .row{display:flex;gap:7px;align-items:center}#dus-v21 .row>*{flex:1}#dus-v21 .card{margin-top:10px;background:#181818;border:1px solid #333;border-radius:10px;padding:10px}#dus-v21 .small{font-size:11px;color:#aaa}#dus-v21 .opt{display:flex;gap:7px;align-items:flex-start;margin-top:6px}#dus-v21 .opt button{flex:0 0 auto}#dus-v21 .ok{color:#8ee29a}.miss{color:#ff9a9a}.warn{color:#ffd66d}#dus-v21 .hidden{display:none!important}`;
  document.documentElement.appendChild(st);
}

function buildUI() {
  if (document.getElementById('dus-v21')) return; installStyle();
  const toggle = document.createElement('button'); toggle.id = 'dus-v21-toggle'; toggle.textContent = 'Doritus'; document.body.appendChild(toggle);
  const panel = document.createElement('section'); panel.id = 'dus-v21'; panel.className = 'hidden';
  panel.innerHTML = `<h2>${APP} <span class="small">v${VERSION}</span></h2><div class="small">Detecta questões da página, consulta seu banco local e destaca sugestões. Não envia atividades automaticamente.</div><div class="row" style="margin-top:9px"><button id="dus-scan">Ler página</button><button id="dus-highlight">Destacar sugestão</button></div><div id="dus-summary" class="card small">Nenhuma leitura executada.</div><div id="dus-question" class="card"></div><div class="row" style="margin-top:8px"><button id="dus-prev">◀ Anterior</button><button id="dus-next">Próxima ▶</button></div><div class="row" style="margin-top:8px"><button id="dus-export">Exportar banco</button><button id="dus-import">Importar banco</button><input id="dus-file" type="file" accept="application/json,.json" class="hidden"></div>`;
  document.body.appendChild(panel);
  toggle.onclick = () => panel.classList.toggle('hidden'); document.getElementById('dus-scan').onclick = analyzeAll; document.getElementById('dus-highlight').onclick = () => highlight(state.scan[state.currentIndex]);
  document.getElementById('dus-prev').onclick = () => { if (!state.scan.length) return; state.currentIndex = (state.currentIndex - 1 + state.scan.length) % state.scan.length; render(); };
  document.getElementById('dus-next').onclick = () => { if (!state.scan.length) return; state.currentIndex = (state.currentIndex + 1) % state.scan.length; render(); };
  document.getElementById('dus-export').onclick = exportDB; document.getElementById('dus-import').onclick = () => document.getElementById('dus-file').click();
  document.getElementById('dus-file').onchange = e => { if (e.target.files?.[0]) importDB(e.target.files[0]); e.target.value = ''; };
}

function render() {
  const summary = document.getElementById('dus-summary'), box = document.getElementById('dus-question'); if (!summary || !box) return;
  const found = state.scan.filter(x => x.status === 'found').length, missing = state.scan.filter(x => x.status === 'missing').length;
  summary.innerHTML = `Questões detectadas: <b>${state.scan.length}</b> • <span class="ok">com sugestão: ${found}</span> • <span class="miss">sem resposta: ${missing}</span> • banco local: ${Object.keys(loadDB()).length}`;
  if (!state.scan.length) { box.innerHTML = '<div class="small">Nenhuma questão com alternativas foi detectada. Use “Ler página”.</div>'; return; }
  const e = state.scan[state.currentIndex], suggestion = e.suggestion;
  const statusText = suggestion ? `<span class="ok">Sugestão encontrada</span> • confiança ${Math.round((suggestion.confidence || 0)*100)}%` : `<span class="miss">Sem resposta no banco</span>`;
  box.innerHTML = `<div class="small">${state.currentIndex+1}/${state.scan.length} • ${escapeHTML(e.platform)} • ${statusText}</div><div style="margin-top:7px;font-weight:650">${escapeHTML(e.question)}</div><div class="small" style="margin-top:5px">${escapeHTML(e.reason || '')}</div><div id="dus-options"></div>`;
  const opts = box.querySelector('#dus-options');
  e.options.forEach((o, idx) => { const row = document.createElement('div'); row.className = 'opt'; const mark = suggestion?.index === idx ? '★ ' : ''; row.innerHTML = `<button data-save="${idx}" title="Confirmar esta alternativa no banco local">Salvar</button><div>${mark}${escapeHTML(o.text)}</div>`; opts.appendChild(row); });
  opts.querySelectorAll('[data-save]').forEach(btn => { btn.onclick = () => saveCurrent(Number(btn.dataset.save)); });
  addHistory({at: Date.now(), page: location.href, question: e.question, status: e.status});
}

function escapeHTML(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[c]); }
function scheduleScan() { clearTimeout(state.scanTimer); state.scanTimer = setTimeout(() => { if (settings().autoScan) analyzeAll(); }, 900); }
function installObserver() { if (state.observer) return; state.observer = new MutationObserver(muts => { if (muts.some(m => m.addedNodes?.length || m.removedNodes?.length)) scheduleScan(); }); state.observer.observe(document.documentElement, {subtree:true, childList:true}); }

GM_registerMenuCommand('Doritus: ler página', analyzeAll);
GM_registerMenuCommand('Doritus: exportar banco local', exportDB);
GM_registerMenuCommand('Doritus: limpar destaques', clearHighlights);

function init() { buildUI(); installObserver(); if (settings().autoScan) setTimeout(analyzeAll, 1200); }
if (document.body) init(); else addEventListener('DOMContentLoaded', init, {once:true});

})();
