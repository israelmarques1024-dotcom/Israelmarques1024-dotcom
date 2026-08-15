// ==UserScript==
// @name         Doritus StudyDB - GitHub Edition
// @namespace    doritus-studydb
// @version      4.1.0
// @description  Assistente de estudo com GitHub + localStorage, sem cliques ou envio automático.
// @match        https://saladofuturo.educacao.sp.gov.br/*
// @match        https://*.khanacademy.org/*
// @match        https://app.speak.com/*
// @match        https://www.speak.com/*
// @match        https://*.matific.com/*
// @match        https://*.alura.com.br/*
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @connect      raw.githubusercontent.com
// @run-at       document-start
// ==/UserScript==

(() => {
  'use strict';

  const CONFIG = {
    mode: 'study',
    cacheMs: 5 * 60 * 1000,
    debounceMs: 700,
    version: '4.0',
    localKey: 'studydb_local_v4',
    dbRaw: 'https://raw.githubusercontent.com/israelmarques1024-dotcom/Israelmarques1024-dotcom/main/studydb/answers.json',
    dbPage: 'https://github.com/israelmarques1024-dotcom/Israelmarques1024-dotcom/blob/main/studydb/answers.json',
    platforms: {
      CMSP: { domains: ['cmsp', 'saladofuturo'], name: 'CMSP' },
      KHAN: { domains: ['khanacademy'], name: 'Khan Academy' },
      SPEAK: { domains: ['speak'], name: 'Speak' },
      MATIFIC: { domains: ['matific'], name: 'Matific' },
      ALURA: { domains: ['alura'], name: 'Alura' }
    }
  };

  const log = (...a) => console.log('[StudyDB]', ...a);
  const warn = (...a) => console.warn('[StudyDB]', ...a);
  const err = (...a) => console.error('[StudyDB]', ...a);

  const U = {
    norm(v) {
      return String(v ?? '').normalize('NFKC').toLocaleLowerCase('pt-BR')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
    },
    async hash(text) {
      const bytes = new TextEncoder().encode(this.norm(text).slice(0, 500));
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
    },
    lev(a, b) {
      a = this.norm(a); b = this.norm(b);
      if (a === b) return 0;
      if (!a.length) return b.length;
      if (!b.length) return a.length;
      let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
      for (let i = 1; i <= a.length; i++) {
        const cur = [i];
        for (let j = 1; j <= b.length; j++) {
          const c = a[i - 1] === b[j - 1] ? 0 : 1;
          cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + c);
        }
        prev = cur;
      }
      return prev[b.length];
    },
    similarity(a, b) {
      a = this.norm(a); b = this.norm(b);
      if (!a || !b) return 0;
      if (a === b) return 1;
      if (a.includes(b) || b.includes(a)) return .9;
      return Math.max(0, 1 - this.lev(a, b) / Math.max(a.length, b.length));
    },
    debounce(fn, ms) {
      let t;
      return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
    },
    copy(text) {
      if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
      return Promise.resolve();
    },
    download(name, text) {
      const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    }
  };

  const V = {
    empty() {
      return { version: CONFIG.version, lastUpdate: new Date().toISOString(), answers: {}, metadata: { totalQuestions: 0, platforms: {}, subjects: {} } };
    },
    entry(x) {
      if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
      return {
        answer: typeof x.answer === 'string' ? x.answer.trim() : typeof x.text === 'string' ? x.text.trim() : '',
        explanation: typeof x.explanation === 'string' ? x.explanation.trim() : '',
        hint: typeof x.hint === 'string' ? x.hint.trim() : '',
        subject: typeof x.subject === 'string' ? x.subject.trim() : '',
        topic: typeof x.topic === 'string' ? x.topic.trim() : '',
        difficulty: ['easy', 'medium', 'hard'].includes(x.difficulty) ? x.difficulty : '',
        platform: typeof x.platform === 'string' ? x.platform.trim() : '',
        timestamp: Number.isFinite(x.timestamp) ? x.timestamp : Date.now(),
        source: typeof x.source === 'string' ? x.source : undefined,
        optionIndex: Number.isInteger(x.optionIndex) ? x.optionIndex : undefined
      };
    },
    rebuild(db) {
      const platforms = {}, subjects = {};
      for (const x of Object.values(db.answers || {})) {
        const p = x.platform || 'UNKNOWN', s = x.subject || 'UNKNOWN';
        platforms[p] = (platforms[p] || 0) + 1;
        subjects[s] = (subjects[s] || 0) + 1;
      }
      db.metadata = { totalQuestions: Object.keys(db.answers || {}).length, platforms, subjects };
      db.lastUpdate = new Date().toISOString();
      return db;
    },
    clean(raw) {
      const db = this.empty();
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return db;
      for (const [hash, value] of Object.entries(raw.answers || {})) {
        if (!/^[a-f0-9]{64}$/i.test(hash)) { warn('Hash inválido ignorado:', hash); continue; }
        const x = this.entry(value); if (x) db.answers[hash] = x;
      }
      return this.rebuild(db);
    }
  };

  const DB = {
    cloud: V.empty(), local: V.empty(), lastFetch: 0,
    init() {
      const raw = localStorage.getItem(CONFIG.localKey);
      if (!raw) return;
      try { this.local = V.clean(JSON.parse(raw)); } catch (e) { err('Local DB inválido:', e); }
    },
    save() { V.rebuild(this.local); localStorage.setItem(CONFIG.localKey, JSON.stringify(this.local)); },
    request(url) {
      return new Promise((resolve, reject) => GM_xmlhttpRequest({
        method: 'GET', url, headers: { Accept: 'application/json' },
        onload: r => {
          if (r.status < 200 || r.status >= 300) return reject(new Error('HTTP ' + r.status));
          try { resolve(JSON.parse(r.responseText)); } catch { reject(new Error('JSON remoto inválido')); }
        },
        onerror: () => reject(new Error('Falha de rede')),
        ontimeout: () => reject(new Error('Timeout'))
      }));
    },
    async fetch(force = false) {
      if (!force && Date.now() - this.lastFetch < CONFIG.cacheMs) return this.cloud;
      try {
        this.cloud = V.clean(await this.request(CONFIG.dbRaw + '?t=' + Date.now()));
        this.lastFetch = Date.now(); log('Cloud:', Object.keys(this.cloud.answers).length); UI.stats();
      } catch (e) { err('Cloud:', e); UI.status('Falha no banco remoto'); }
      return this.cloud;
    },
    async get(hash) {
      await this.fetch();
      if (this.local.answers[hash]) return { ...this.local.answers[hash], _origin: 'local' };
      if (this.cloud.answers[hash]) return { ...this.cloud.answers[hash], _origin: 'cloud' };
      return null;
    },
    set(hash, data) {
      const x = V.entry({ ...data, source: 'local', timestamp: Date.now() });
      if (!x) throw new Error('Entrada inválida');
      this.local.answers[hash] = x; this.save();
    },
    merged() {
      const db = V.empty(); db.answers = { ...this.cloud.answers, ...this.local.answers }; return V.rebuild(db);
    },
    json() { return JSON.stringify(this.merged(), null, 2); },
    stats() {
      const c = Object.keys(this.cloud.answers).length, l = Object.keys(this.local.answers).length;
      return { cloud: c, local: l, total: new Set([...Object.keys(this.cloud.answers), ...Object.keys(this.local.answers)]).size };
    }
  };

  const P = {
    current() {
      const hay = (location.href + ' ' + location.hostname).toLowerCase();
      for (const [key, p] of Object.entries(CONFIG.platforms)) if (p.domains.some(d => hay.includes(d))) return { key, ...p };
      return null;
    },
    extract() {
      const p = this.current(); if (!p) return null;
      const q = selectors => document.querySelector(selectors);
      const qa = selectors => [...document.querySelectorAll(selectors)];
      let el, opts = [], type = 'unknown';
      if (p.key === 'CMSP') { el = q('.question-text,.enunciado,[data-testid="question-text"],.questao'); opts = qa('.option,.alternativa,[data-testid="option"],.choice'); }
      if (p.key === 'KHAN') { el = q('[data-testid="exercise-title"],.exercise-text,.problem'); opts = qa('[data-testid="choice"]'); type = opts.length ? 'multiple_choice' : qa('input[type="text"],input[type="number"]').length ? 'input' : 'unknown'; }
      if (p.key === 'SPEAK') { el = q('.prompt,.question,[data-testid="prompt"]'); opts = qa('.choice,.option'); }
      if (p.key === 'MATIFIC') { el = q('.question-text,.instruction'); type = 'interactive'; }
      if (p.key === 'ALURA') { el = q('.question-text,.enunciado'); opts = qa('.option,.alternativa'); }
      if (!el?.innerText?.trim()) return null;
      if (type === 'unknown' && opts.length) type = 'multiple_choice';
      return { text: el.innerText.trim(), options: opts.map((e, i) => ({ text: e.innerText.trim(), index: i })), type, platform: p };
    }
  };

  const Engine = {
    current: null,
    async process() {
      const data = P.extract();
      if (!data) { this.current = null; UI.render(null); UI.status('Nenhuma questão detectada'); return false; }
      const hash = await U.hash(data.text), answer = await DB.get(hash);
      this.current = { ...data, hash, answer }; UI.render(this.current); UI.status(answer ? `Questão encontrada (${answer._origin})` : 'Questão nova');
      return !!answer;
    },
    async edit() {
      if (!this.current) await this.process(); const c = this.current;
      if (!c) return UI.notify('Nenhuma questão detectada.');
      const old = c.answer || {};
      const ask = (label, value = '') => prompt(label, value);
      const answer = ask('Resposta de referência:', old.answer || ''); if (answer === null) return;
      const hint = ask('Dica:', old.hint || ''); if (hint === null) return;
      const explanation = ask('Explicação:', old.explanation || ''); if (explanation === null) return;
      const subject = ask('Matéria:', old.subject || ''); if (subject === null) return;
      const topic = ask('Tópico:', old.topic || ''); if (topic === null) return;
      let difficulty = ask('Dificuldade: easy, medium ou hard', old.difficulty || 'medium'); if (difficulty === null) return;
      difficulty = ['easy', 'medium', 'hard'].includes(difficulty.trim().toLowerCase()) ? difficulty.trim().toLowerCase() : 'medium';
      let optionIndex;
      if (c.options?.length && answer.trim()) {
        let best = { score: 0, index: -1 };
        for (const o of c.options) { const score = U.similarity(o.text, answer); if (score > best.score) best = { score, index: o.index }; }
        if (best.score >= .85) optionIndex = best.index;
      }
      DB.set(c.hash, { answer: answer.trim(), hint: hint.trim(), explanation: explanation.trim(), subject: subject.trim(), topic: topic.trim(), difficulty, platform: c.platform.key, optionIndex });
      UI.notify('Salvo localmente.'); await this.process(); UI.stats();
    }
  };

  const UI = {
    panel: null,
    init() {
      if (this.panel || !document.body) return;
      const style = document.createElement('style');
      style.textContent = `.studydb{position:fixed;top:20px;right:20px;width:min(360px,calc(100vw - 40px));max-height:calc(100vh - 40px);overflow:auto;background:#151826;color:#f4f6fb;border:1px solid #33394d;border-radius:14px;padding:16px;z-index:2147483647;font:13px system-ui;box-shadow:0 18px 50px #0006}.studydb h2{margin:0;font-size:17px}.sdb-muted{color:#9aa3b8}.sdb-box{margin-top:10px;padding:10px;border-radius:9px;background:#0f1220;border:1px solid #262c40;white-space:pre-wrap;overflow-wrap:anywhere}.sdb-row{display:flex;gap:7px;flex-wrap:wrap;margin-top:9px}.sdb-btn,.sdb-select{border:1px solid #3a425c;border-radius:8px;background:#22283a;color:#fff;padding:8px 10px;font:inherit;cursor:pointer}.sdb-note{position:fixed;right:20px;bottom:20px;z-index:2147483647;background:#171b28;color:#fff;border:1px solid #3a425c;border-radius:10px;padding:12px 14px}`;
      document.head.appendChild(style);
      const panel = this.panel = document.createElement('aside'); panel.className = 'studydb';
      const title = document.createElement('h2'); title.textContent = 'StudyDB';
      const status = document.createElement('div'); status.id = 'sdb-status'; status.className = 'sdb-muted'; status.textContent = 'Inicializando…';
      const modeRow = document.createElement('div'); modeRow.className = 'sdb-row';
      const select = document.createElement('select'); select.id = 'sdb-mode'; select.className = 'sdb-select';
      [['study','Estudo'],['hint','Dica'],['manual','Manual']].forEach(([v,t]) => { const o=document.createElement('option');o.value=v;o.textContent=t;select.appendChild(o); }); select.value=CONFIG.mode; modeRow.append('Modo: ', select);
      const question = document.createElement('div'); question.id = 'sdb-question'; question.className = 'sdb-box sdb-muted'; question.textContent = 'Nenhuma questão detectada.';
      const result = document.createElement('div'); result.id = 'sdb-result'; result.className = 'sdb-box'; result.textContent = 'Nenhum conteúdo exibido.';
      const actions = document.createElement('div'); actions.className = 'sdb-row';
      const sync = document.createElement('div'); sync.className = 'sdb-row';
      const b = (text,id) => { const x=document.createElement('button');x.type='button';x.className='sdb-btn';x.id=id;x.textContent=text;return x; };
      actions.append(b('Ver dica','sdb-hint'), b('Ver explicação','sdb-exp'), b('Ver resposta','sdb-answer'), b('Adicionar / editar','sdb-edit'));
      sync.append(b('Atualizar GitHub','sdb-refresh'), b('Exportar JSON','sdb-export'), b('Copiar JSON','sdb-copy'), b('Abrir banco','sdb-open'));
      const stats = document.createElement('div'); stats.id = 'sdb-stats'; stats.className = 'sdb-box sdb-muted';
      panel.append(title,status,modeRow,question,result,actions,sync,stats); document.body.appendChild(panel);
      select.onchange = e => { CONFIG.mode = e.target.value; this.status('Modo: ' + CONFIG.mode); };
      document.getElementById('sdb-hint').onclick = () => this.field('hint','Dica');
      document.getElementById('sdb-exp').onclick = () => this.field('explanation','Explicação');
      document.getElementById('sdb-answer').onclick = () => this.field('answer','Resposta');
      document.getElementById('sdb-edit').onclick = () => Engine.edit();
      document.getElementById('sdb-refresh').onclick = async () => { DB.lastFetch=0; await DB.fetch(true); await Engine.process(); this.notify('Banco GitHub atualizado.'); };
      document.getElementById('sdb-export').onclick = () => { U.download('answers.json', DB.json()); this.notify('answers.json exportado.'); };
      document.getElementById('sdb-copy').onclick = async () => { await U.copy(DB.json()); this.notify('JSON copiado.'); };
      document.getElementById('sdb-open').onclick = () => window.open(CONFIG.dbPage, '_blank', 'noopener,noreferrer');
      this.stats();
    },
    render(c) {
      const q = document.getElementById('sdb-question'), r = document.getElementById('sdb-result'); if (!q || !r) return;
      r.textContent = 'Nenhum conteúdo exibido.';
      q.textContent = c ? `Plataforma: ${c.platform.name}\nBanco: ${c.answer?._origin || 'não encontrada'}\nHash: ${c.hash}\n\n${c.text}` : 'Nenhuma questão detectada.';
    },
    field(field,label) {
      const a = Engine.current?.answer, r = document.getElementById('sdb-result'); if (!r) return;
      r.textContent = !a ? 'Esta questão não está cadastrada no banco.' : a[field] ? `${label}:\n${a[field]}` : `${label} ainda não cadastrada.`;
    },
    stats() {
      const el = document.getElementById('sdb-stats'); if (!el) return; const s=DB.stats(),p=P.current();
      el.textContent=`Plataforma: ${p?.name || 'nenhuma'}\nCloud: ${s.cloud}\nLocal: ${s.local}\nTotal único: ${s.total}\nVersão: ${CONFIG.version}`;
    },
    status(t) { const el=document.getElementById('sdb-status'); if(el) el.textContent=t; },
    notify(t) { const n=document.createElement('div');n.className='sdb-note';n.textContent=t;document.body.appendChild(n);setTimeout(()=>n.remove(),2800); }
  };

  async function start() {
    DB.init(); UI.init(); await DB.fetch(); await Engine.process(); UI.stats();
    const run = U.debounce(async () => { await Engine.process(); UI.stats(); }, CONFIG.debounceMs);
    new MutationObserver(run).observe(document.body, { childList: true, subtree: true });
    GM_registerMenuCommand('StudyDB: Atualizar GitHub', async () => { DB.lastFetch=0; await DB.fetch(true); await Engine.process(); });
    GM_registerMenuCommand('StudyDB: Exportar JSON', () => U.download('answers.json', DB.json()));
    GM_registerMenuCommand('StudyDB: Abrir banco', () => window.open(CONFIG.dbPage, '_blank', 'noopener,noreferrer'));
  }

  const boot = () => start().catch(e => err('Falha fatal:', e));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})();
