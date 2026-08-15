// ==UserScript==
// @name         Doritus Ultra - Edição Gist
// @namespace    doritus-ultra
// @version      1.0.0
// @description  Sistema completo de respostas usando GitHub Gist como banco de dados
// @author       Você
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @connect      gist.githubusercontent.com
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // ═══════════════════════════════════════════════════════════
    // CONFIGURAÇÃO - ALTERE AQUI COM SEUS DADOS
    // ═══════════════════════════════════════════════════════════
    const CONFIG = {
        GIST_ID: '979fe4a45fef28fbdc1f1de9debceb17',
        GITHUB_USER: 'israelmarques1024-dotcom',

        // Modo de operação: 'auto' | 'ghost' | 'manual'
        MODE: 'auto',

        // Tempos em ms (modo discreto)
        MIN_READ_TIME: 2000,
        MAX_READ_TIME: 8000,
        CLICK_DELAY_MIN: 300,
        CLICK_DELAY_MAX: 1500,
        TYPING_SPEED: 50, // ms por caractere

        // Cache
        CACHE_DURATION: 5 * 60 * 1000, // 5 minutos

        // Plataformas suportadas
        PLATFORMS: {
            CMSP: { domains: ['cmsp', 'saladofuturo'], name: 'CMSP' },
            KHAN: { domains: ['khanacademy'], name: 'Khan Academy' },
            SPEAK: { domains: ['speak'], name: 'Speak' },
            MATIFIC: { domains: ['matific'], name: 'Matific' },
            ALURA: { domains: ['alura'], name: 'Alura' }
        }
    };

    // URLs do Gist
    const GIST_URLS = {
        READ: `https://gist.githubusercontent.com/${CONFIG.GITHUB_USER}/${CONFIG.GIST_ID}/raw/answers.json`,
        PAGE: `https://gist.github.com/${CONFIG.GITHUB_USER}/${CONFIG.GIST_ID}`
    };

    // ═══════════════════════════════════════════════════════════
    // BANCO DE DADOS HÍBRIDO (GIST + LOCAL)
    // ═══════════════════════════════════════════════════════════
    const HybridDB = {
        cloudData: { answers: {}, metadata: {} },
        localData: { answers: {}, metadata: { learned: 0 } },
        lastFetch: 0,

        // Inicializar
        init() {
            const saved = localStorage.getItem('doritus_local_db');
            if (saved) {
                try {
                    this.localData = JSON.parse(saved);
                } catch(e) {
                    console.error('[Doritus] Erro ao carregar banco local:', e);
                }
            }
        },

        // Salvar localmente
        saveLocal() {
            localStorage.setItem('doritus_local_db', JSON.stringify(this.localData));
        },

        // Buscar no Gist (nuvem)
        async fetchCloud() {
            if (Date.now() - this.lastFetch < CONFIG.CACHE_DURATION && this.cloudData.answers) {
                return this.cloudData;
            }

            try {
                const response = await fetch(GIST_URLS.READ + '?t=' + Date.now());
                if (!response.ok) throw new Error('HTTP ' + response.status);

                const data = await response.json();
                this.cloudData = data;
                this.lastFetch = Date.now();

                console.log('[Doritus] Gist carregado:', Object.keys(data.answers || {}).length, 'respostas');
                return data;
            } catch (error) {
                console.error('[Doritus] Erro ao carregar Gist:', error);
                return { answers: {}, metadata: {} };
            }
        },

        // Buscar resposta (mescla nuvem + local)
        async get(hash) {
            await this.fetchCloud();

            // Local tem prioridade (respostas novas)
            if (this.localData.answers[hash]) {
                return this.localData.answers[hash];
            }

            // Depois, nuvem
            if (this.cloudData.answers[hash]) {
                return this.cloudData.answers[hash];
            }

            return null;
        },

        // Salvar nova resposta (sempre local)
        set(hash, data) {
            this.localData.answers[hash] = {
                ...data,
                timestamp: Date.now(),
                source: 'local'
            };
            this.localData.metadata.learned = (this.localData.metadata.learned || 0) + 1;
            this.saveLocal();
        },

        // Estatísticas combinadas
        getStats() {
            const cloudCount = Object.keys(this.cloudData.answers || {}).length;
            const localCount = Object.keys(this.localData.answers || {}).length;
            return {
                cloud: cloudCount,
                local: localCount,
                total: cloudCount + localCount,
                learned: this.localData.metadata.learned || 0
            };
        },

        // Gerar JSON completo para exportar ao Gist
        generateExportJSON() {
            const merged = {
                ...this.cloudData,
                answers: {
                    ...this.cloudData.answers,
                    ...this.localData.answers
                },
                metadata: {
                    ...this.cloudData.metadata,
                    lastExport: new Date().toISOString(),
                    localCount: Object.keys(this.localData.answers).length
                }
            };
            return JSON.stringify(merged, null, 2);
        },

        // Limpar cache local (após exportar)
        clearLocal() {
            this.localData = { answers: {}, metadata: { learned: 0 } };
            this.saveLocal();
        }
    };

    // ═══════════════════════════════════════════════════════════
    // UTILITÁRIOS
    // ═══════════════════════════════════════════════════════════
    const Utils = {
        // Hash SHA-256
        async sha256(text) {
            const normalized = text.toLowerCase()
                .replace(/[^\w\s]/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
                .substring(0, 200);

            const encoder = new TextEncoder();
            const data = encoder.encode(normalized);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        },

        // Aguardar
        sleep(ms) {
            return new Promise(r => setTimeout(r, ms));
        },

        random(min, max) {
            return Math.floor(Math.random() * (max - min + 1)) + min;
        },

        // Simular digitação humana
        async typeLikeHuman(element, text) {
            element.focus();
            element.value = '';
            for (const char of text) {
                element.value += char;
                await this.sleep(CONFIG.TYPING_SPEED + this.random(-20, 20));
            }
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
        }
    };

    // ═══════════════════════════════════════════════════════════
    // DETECTOR DE PLATAFORMAS
    // ═══════════════════════════════════════════════════════════
    const PlatformDetector = {
        getCurrent() {
            const url = window.location.href.toLowerCase();
            const hostname = window.location.hostname.toLowerCase();

            for (const [key, platform] of Object.entries(CONFIG.PLATFORMS)) {
                if (platform.domains.some(d => url.includes(d) || hostname.includes(d))) {
                    return { key, ...platform };
                }
            }
            return null;
        },

        extractQuestionData() {
            const platform = this.getCurrent();
            if (!platform) return null;

            const extractors = {
                CMSP: () => {
                    const questionEl = document.querySelector('.question-text, .enunciado, [data-testid="question-text"], .questao');
                    const options = document.querySelectorAll('.option, .alternativa, [data-testid="option"], .choice');

                    if (!questionEl || options.length === 0) return null;

                    return {
                        text: questionEl.innerText.trim(),
                        options: Array.from(options).map((opt, i) => ({
                            text: opt.innerText.trim(),
                            element: opt,
                            index: i
                        })),
                        type: 'multiple_choice'
                    };
                },

                KHAN: () => {
                    const questionEl = document.querySelector('[data-testid="exercise-title"], .exercise-text, .problem');
                    const inputs = document.querySelectorAll('input[type="text"], input[type="number"]');
                    const choices = document.querySelectorAll('[data-testid="choice"]');

                    if (!questionEl) return null;

                    if (choices.length > 0) {
                        return {
                            text: questionEl.innerText.trim(),
                            options: Array.from(choices).map((c, i) => ({
                                text: c.innerText.trim(),
                                element: c,
                                index: i
                            })),
                            type: 'multiple_choice'
                        };
                    } else if (inputs.length > 0) {
                        return {
                            text: questionEl.innerText.trim(),
                            inputs: Array.from(inputs).map((inp, i) => ({
                                element: inp,
                                index: i
                            })),
                            type: 'input'
                        };
                    }
                    return null;
                },

                SPEAK: () => {
                    const prompt = document.querySelector('.prompt, .question, [data-testid="prompt"]');
                    const choices = document.querySelectorAll('.choice, .option');

                    if (!prompt) return null;

                    return {
                        text: prompt.innerText.trim(),
                        options: Array.from(choices).map((c, i) => ({
                            text: c.innerText.trim(),
                            element: c,
                            index: i
                        })),
                        type: 'multiple_choice'
                    };
                },

                MATIFIC: () => {
                    const question = document.querySelector('.question-text, .instruction');
                    const interactives = document.querySelectorAll('.interactive, .draggable');

                    if (!question) return null;
                    return {
                        text: question.innerText.trim(),
                        elements: Array.from(interactives),
                        type: 'interactive'
                    };
                },

                ALURA: () => {
                    const question = document.querySelector('.question-text, .enunciado');
                    const options = document.querySelectorAll('.option, .alternativa');

                    if (!question || options.length === 0) return null;
                    return {
                        text: question.innerText.trim(),
                        options: Array.from(options).map((o, i) => ({
                            text: o.innerText.trim(),
                            element: o,
                            index: i
                        })),
                        type: 'multiple_choice'
                    };
                }
            };

            const extractor = extractors[platform.key];
            return extractor ? extractor() : null;
        }
    };

    // ═══════════════════════════════════════════════════════════
    // MOTOR DE RESPOSTAS
    // ═══════════════════════════════════════════════════════════
    const AnswerEngine = {
        async process() {
            const data = PlatformDetector.extractQuestionData();
            if (!data) return false;

            const hash = await Utils.sha256(data.text);
            const answer = await HybridDB.get(hash);

            if (!answer) {
                console.log('[Doritus] Pergunta nova:', data.text.substring(0, 50) + '...');
                UI.showStatus('❓ Pergunta nova - não está no banco');
                return false;
            }

            console.log('[Doritus] Resposta encontrada:', answer);

            if (CONFIG.MODE === 'ghost') {
                this.highlightAnswer(data, answer);
                UI.showStatus('👻 Modo Ghost: resposta destacada');
                return true;
            }

            if (CONFIG.MODE === 'auto') {
                await this.executeAnswer(data, answer);
                return true;
            }

            return false;
        },

        highlightAnswer(data, answer) {
            if (data.type === 'multiple_choice' && data.options) {
                const target = data.options.find(o =>
                    o.index === answer.optionIndex ||
                    o.text.includes(answer.text) ||
                    answer.text.includes(o.text)
                );
                if (target) {
                    target.element.style.border = '3px solid #00ff00';
                    target.element.style.background = '#00ff0020';
                    target.element.style.boxShadow = '0 0 10px #00ff00';
                }
            }
        },

        async executeAnswer(data, answer) {
            // Atraso de "leitura"
            await Utils.sleep(Utils.random(CONFIG.MIN_READ_TIME, CONFIG.MAX_READ_TIME));

            if (data.type === 'multiple_choice' && data.options) {
                const target = data.options.find(o =>
                    o.index === answer.optionIndex ||
                    this.similarity(o.text, answer.text) > 0.7
                );

                if (target) {
                    await this.humanClick(target.element);
                    UI.showNotification('✅ Resposta aplicada!');
                }
            } else if (data.type === 'input' && data.inputs && answer.text) {
                const input = data.inputs[answer.inputIndex || 0];
                if (input) {
                    await Utils.typeLikeHuman(input.element, answer.text);
                    UI.showNotification('✅ Texto digitado!');
                }
            }
        },

        async humanClick(element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await Utils.sleep(Utils.random(CONFIG.CLICK_DELAY_MIN, CONFIG.CLICK_DELAY_MAX));

            // Eventos realistas
            element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
            await Utils.sleep(Utils.random(50, 150));
            element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            await Utils.sleep(Utils.random(30, 80));
            element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
            element.click();
        },

        similarity(a, b) {
            if (!a || !b) return 0;
            a = a.toLowerCase().trim();
            b = b.toLowerCase().trim();
            if (a === b) return 1;
            if (a.includes(b) || b.includes(a)) return 0.8;
            // Distância de Levenshtein simplificada
            const longer = a.length > b.length ? a : b;
            const shorter = a.length > b.length ? b : a;
            if (longer.length === 0) return 1;
            const distance = longer.split('').filter((c, i) => c !== shorter[i]).length;
            return (longer.length - distance) / longer.length;
        },

        async learn(data, correctAnswer) {
            const hash = await Utils.sha256(data.text);

            const answerData = {
                text: correctAnswer,
                optionIndex: data.options?.findIndex(o => o.text === correctAnswer),
                inputIndex: 0,
                platform: PlatformDetector.getCurrent()?.key,
                timestamp: Date.now()
            };

            HybridDB.set(hash, answerData);
            UI.showNotification('📚 Aprendido! Salvo localmente.');
        }
    };

    // ═══════════════════════════════════════════════════════════
    // INTERFACE DO USUÁRIO
    // ═══════════════════════════════════════════════════════════
    const UI = {
        panel: null,

        init() {
            this.createPanel();
            this.applyStyles();
        },

        applyStyles() {
            const css = `
                @keyframes doritus-slide-in {
                    from { transform: translateX(400px); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes doritus-pulse {
                    0%, 100% { box-shadow: 0 0 5px #00ff00; }
                    50% { box-shadow: 0 0 20px #00ff00, 0 0 40px #00ff00; }
                }
                .doritus-panel {
                    animation: doritus-slide-in 0.5s ease;
                }
                .doritus-btn {
                    transition: all 0.2s;
                }
                .doritus-btn:hover {
                    transform: scale(1.05);
                }
                .doritus-notification {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 15px 25px;
                    border-radius: 10px;
                    font-family: 'Segoe UI', sans-serif;
                    font-size: 14px;
                    z-index: 999999;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.3);
                    animation: slideIn 0.3s ease;
                }
            `;

            const style = document.createElement('style');
            style.textContent = css;
            document.head.appendChild(style);
        },

        createPanel() {
            this.panel = document.createElement('div');
            this.panel.className = 'doritus-panel';
            this.panel.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                width: 320px;
                background: linear-gradient(145deg, #1a1a2e 0%, #16213e 100%);
                border-radius: 15px;
                padding: 20px;
                color: #fff;
                font-family: 'Segoe UI', system-ui, sans-serif;
                z-index: 999999;
                box-shadow: 0 20px 60px rgba(0,0,0,0.5);
                border: 1px solid #00ff0040;
            `;

            this.panel.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <h3 style="margin: 0; color: #00ff00; font-size: 18px;">🧠 Doritus Ultra</h3>
                    <span id="doritus-status" style="font-size: 11px; color: #888;">Pronto</span>
                </div>

                <div style="margin-bottom: 15px;">
                    <label style="font-size: 12px; color: #aaa;">Modo:</label>
                    <select id="doritus-mode" style="width: 100%; padding: 8px; background: #0f0f23; color: #fff; border: 1px solid #333; border-radius: 5px; margin-top: 5px;">
                        <option value="auto">🤖 Automático</option>
                        <option value="ghost">👻 Fantasma (só mostra)</option>
                        <option value="manual">✋ Manual</option>
                    </select>
                </div>

                <div style="display: grid; gap: 8px; margin-bottom: 15px;">
                    <button id="doritus-answer" class="doritus-btn" style="padding: 10px; background: linear-gradient(135deg, #00b894 0%, #00cec9 100%); border: none; color: white; border-radius: 8px; cursor: pointer; font-weight: bold;">
                        ⚡ Responder agora
                    </button>
                    <button id="doritus-learn" class="doritus-btn" style="padding: 10px; background: linear-gradient(135deg, #0984e3 0%, #6c5ce7 100%); border: none; color: white; border-radius: 8px; cursor: pointer;">
                        📚 Ensinar resposta
                    </button>
                    <button id="doritus-export" class="doritus-btn" style="padding: 10px; background: linear-gradient(135deg, #fdcb6e 0%, #e17055 100%); border: none; color: white; border-radius: 8px; cursor: pointer;">
                        ☁️ Exportar para o Gist
                    </button>
                </div>

                <div id="doritus-stats" style="background: #0f0f23; padding: 10px; border-radius: 8px; font-size: 12px; color: #aaa;">
                    Carregando estatísticas...
                </div>

                <div style="margin-top: 10px; font-size: 10px; color: #666; text-align: center;">
                    Gist: ${CONFIG.GIST_ID.substring(0, 8)}...
                </div>

                <button id="doritus-minimize" style="position: absolute; top: 10px; right: 10px; background: none; border: none; color: #666; cursor: pointer; font-size: 16px;">−</button>
            `;

            document.body.appendChild(this.panel);
            this.attachEvents();
            this.updateStats();
        },

        attachEvents() {
            // Modo
            document.getElementById('doritus-mode').value = CONFIG.MODE;
            document.getElementById('doritus-mode').onchange = (e) => {
                CONFIG.MODE = e.target.value;
                this.showStatus(`Modo: ${e.target.value}`);
            };

            // Responder
            document.getElementById('doritus-answer').onclick = async () => {
                const success = await AnswerEngine.process();
                if (!success) {
                    this.showNotification('❓ Nenhuma resposta encontrada no banco');
                }
            };

            // Ensinar
            document.getElementById('doritus-learn').onclick = () => {
                this.showTeachDialog();
            };

            // Exportar
            document.getElementById('doritus-export').onclick = () => {
                this.showExportDialog();
            };

            // Minimizar
            let minimized = false;
            document.getElementById('doritus-minimize').onclick = () => {
                minimized = !minimized;
                const content = this.panel.querySelectorAll('div:not(:first-child), button:not(#doritus-minimize)');
                content.forEach(el => el.style.display = minimized ? 'none' : '');
                this.panel.style.width = minimized ? '150px' : '320px';
            };

            // Arrastar
            let isDragging = false, startX, startY, initialX, initialY;
            const header = this.panel.querySelector('div:first-child');

            header.onmousedown = (e) => {
                if (e.target.tagName === 'SELECT') return;
                isDragging = true;
                startX = e.clientX;
                startY = e.clientY;
                initialX = this.panel.offsetLeft;
                initialY = this.panel.offsetTop;
            };

            document.onmousemove = (e) => {
                if (!isDragging) return;
                this.panel.style.right = 'auto';
                this.panel.style.left = (initialX + e.clientX - startX) + 'px';
                this.panel.style.top = (initialY + e.clientY - startY) + 'px';
            };

            document.onmouseup = () => isDragging = false;
        },

        showTeachDialog() {
            const data = PlatformDetector.extractQuestionData();
            if (!data) {
                this.showNotification('❌ Não detectei pergunta nesta página');
                return;
            }

            const answer = prompt(`📚 Ensinar nova resposta\n\nPergunta detectada:\n"${data.text.substring(0, 100)}..."\n\nDigite a resposta correta:`);

            if (answer && answer.trim()) {
                AnswerEngine.learn(data, answer.trim());
                this.updateStats();
            }
        },

        showExportDialog() {
            const json = HybridDB.generateExportJSON();
            const stats = HybridDB.getStats();

            const modal = document.createElement('div');
            modal.style.cssText = `
                position: fixed;
                top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.8);
                z-index: 9999999;
                display: flex;
                align-items: center;
                justify-content: center;
            `;

            modal.innerHTML = `
                <div style="background: #1a1a2e; padding: 30px; border-radius: 15px; max-width: 600px; width: 90%; color: white;">
                    <h3 style="margin-top: 0; color: #00ff00;">☁️ Exportar para o Gist</h3>
                    <p style="color: #aaa; font-size: 14px;">
                        Você tem <b>${stats.local}</b> respostas locais para enviar ao Gist.
                    </p>
                    <textarea id="export-json" style="width: 100%; height: 200px; background: #0f0f23; color: #00ff00; border: 1px solid #333; border-radius: 8px; padding: 10px; font-family: monospace; font-size: 12px; resize: none;">${json}</textarea>
                    <div style="margin-top: 15px; display: flex; gap: 10px;">
                        <button id="copy-json" style="flex: 1; padding: 12px; background: #00b894; border: none; color: white; border-radius: 8px; cursor: pointer;">📋 Copiar JSON</button>
                        <button id="open-gist" style="flex: 1; padding: 12px; background: #0984e3; border: none; color: white; border-radius: 8px; cursor: pointer;">🔗 Abrir Gist</button>
                        <button id="close-modal" style="flex: 1; padding: 12px; background: #636e72; border: none; color: white; border-radius: 8px; cursor: pointer;">Fechar</button>
                    </div>
                    <div style="margin-top: 15px; padding: 10px; background: #2d3436; border-radius: 8px; font-size: 12px; color: #ddd;">
                        <b>Como atualizar:</b><br>
                        1. Clique em "Copiar JSON"<br>
                        2. Clique em "Abrir Gist"<br>
                        3. Cole o JSON no arquivo answers.json<br>
                        4. Salve o Gist
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            document.getElementById('copy-json').onclick = () => {
                const textarea = document.getElementById('export-json');
                textarea.select();
                document.execCommand('copy');
                this.showNotification('✅ JSON copiado!');
            };

            document.getElementById('open-gist').onclick = () => {
                window.open(GIST_URLS.PAGE, '_blank');
            };

            document.getElementById('close-modal').onclick = () => {
                modal.remove();
            };
        },

        updateStats() {
            const stats = HybridDB.getStats();
            const el = document.getElementById('doritus-stats');
            if (el) {
                el.innerHTML = `
                    ☁️ Nuvem: <b style="color: #74b9ff;">${stats.cloud}</b> |
                    💻 Local: <b style="color: #00b894;">${stats.local}</b> |
                    📚 Aprendidas: <b style="color:#fdcb6e">${stats.learned}</b>
                `;
            }
        },

        showStatus(text) {
            const el = document.getElementById('doritus-status');
            if (el) {
                el.textContent = text;
                setTimeout(() => el.textContent = 'Pronto', 3000);
            }
        },

        showNotification(text) {
            const notif = document.createElement('div');
            notif.className = 'doritus-notification';
            notif.textContent = text;
            document.body.appendChild(notif);
            setTimeout(() => {
                notif.style.opacity = '0';
                setTimeout(() => notif.remove(), 300);
            }, 3000);
        }
    };

    // ═══════════════════════════════════════════════════════════
    // INICIALIZAÇÃO
    // ═══════════════════════════════════════════════════════════
    async function init() {
        HybridDB.init();
        await HybridDB.fetchCloud(); // Pré-carregar

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => UI.init());
        } else {
            UI.init();
        }

        // Observar mudanças na página (SPA)
        const observer = new MutationObserver(() => {
            if (CONFIG.MODE === 'auto') {
                setTimeout(() => AnswerEngine.process(), 1500);
            }
        });

        setTimeout(() => {
            observer.observe(document.body, { childList: true, subtree: true });
        }, 2000);

        // Tentar responder após carregar
        setTimeout(() => AnswerEngine.process(), 3000);
    }

    // Iniciar
    init();

})();
