(() => {
  'use strict';

  /* ------------------------------------------------------------------ */
  /*  Configuración de modelos y actitudes                              */
  /* ------------------------------------------------------------------ */

  const MODELS = {
    sbi: {
      id: 'sbi',
      name: 'SBI',
      long: 'Situación · Comportamiento · Impacto',
      desc: 'Feedback concreto y observable. Ideal para reconocer o corregir algo puntual de forma clara y directa.',
      fields: [
        { key: 'situacion', label: 'Situación', hint: '¿Cuándo y dónde ocurrió? Ej.: “En la reunión semanal del martes pasado…”' },
        { key: 'comportamiento', label: 'Comportamiento', hint: '¿Qué hizo o dijo exactamente? Solo hechos observables, sin juicios ni etiquetas.' },
        { key: 'impacto', label: 'Impacto', hint: '¿Qué efecto tuvo en ti, en el equipo, en el cliente o en los resultados?' },
      ],
    },
    carpa: {
      id: 'carpa',
      name: 'CARPA',
      long: 'Circunstancia/Contexto · Acción · Resultado · Preguntas · Acuerdos',
      desc: 'Suma indagación y acuerdos al feedback. Ideal para construir soluciones en conjunto con la otra persona.',
      fields: [
        { key: 'circunstancia', label: 'Circunstancia / Contexto', hint: 'El marco en que ocurrió lo que quieres conversar y por qué se reúnen hoy.' },
        { key: 'accion', label: 'Acción', hint: '¿Qué hizo la persona? Descríbelo de forma concreta y factual.' },
        { key: 'resultado', label: 'Resultado', hint: '¿Qué consecuencias tuvo esa acción?' },
        { key: 'preguntas', label: 'Preguntas', hint: '¿Qué preguntas harás para conocer su perspectiva y entender qué pasó?' },
        { key: 'acuerdos', label: 'Acuerdos', hint: '¿Qué acuerdos o próximos pasos esperas construir juntos?' },
      ],
    },
    cnv: {
      id: 'cnv',
      name: 'Comunicación No Violenta',
      long: 'Observaciones · Interpretaciones/Sentimientos · Necesidades · Pedido',
      desc: 'Para conversaciones sensibles o tensas, cuidando la relación y expresando lo que te pasa sin culpar.',
      fields: [
        { key: 'observaciones', label: 'Observaciones', hint: 'Hechos concretos, como los vería una cámara, sin evaluar ni juzgar.' },
        { key: 'sentimientos', label: 'Interpretaciones / Sentimientos', hint: '¿Qué sientes tú ante lo observado? Distingue tus sentimientos de las interpretaciones que haces del otro.' },
        { key: 'necesidades', label: 'Necesidades', hint: '¿Qué necesidad tuya (o del equipo) no está siendo atendida?' },
        { key: 'pedido', label: 'Pedido', hint: '¿Qué pides concretamente? Debe ser claro, realizable, en positivo y abierto a conversarse.' },
      ],
    },
  };

  const ATTITUDES = {
    positiva: { label: 'Positiva / receptiva', icon: '🙂', desc: 'Llega abierta y colabora con facilidad.' },
    neutra: { label: 'Neutra / normal', icon: '😐', desc: 'Escucha, pregunta y se abre de a poco.' },
    resistente: { label: 'Resistente / difícil', icon: '😠', desc: 'Se pone a la defensiva; cede si te lo ganas.' },
  };

  const GREETINGS = {
    positiva: '¡Hola! Ya estoy aquí, ¿cómo estás?',
    neutra: 'Hola, ya me conecté. ¿Cómo estás?',
    resistente: 'Hola… me avisaron que querías hablar conmigo. Tengo poco rato, ¿de qué se trata?',
  };

  const STORAGE_KEY = 'feedback-coach-v1';

  /* ------------------------------------------------------------------ */
  /*  Estado                                                            */
  /* ------------------------------------------------------------------ */

  const freshState = () => ({
    screen: 'model',
    modelId: null,
    recipient: '',
    context: '',
    attitude: 'neutra',
    caso: {},
    messages: [], // { role: 'user' | 'assistant', content }
    feedback: null,
  });

  let state = freshState();
  let busy = false; // esperando respuesta de la contraparte
  let lastError = null; // error de la última respuesta (permite reintentar)
  let runId = 0; // invalida respuestas de conversaciones reiniciadas

  function save() {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) { /* ignorar */ }
  }

  function load() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved && typeof saved === 'object') state = Object.assign(freshState(), saved);
      if (state.modelId && !MODELS[state.modelId]) state = freshState();
    } catch (_) { state = freshState(); }
  }

  /* ------------------------------------------------------------------ */
  /*  Utilidades DOM                                                    */
  /* ------------------------------------------------------------------ */

  const $ = (sel, root = document) => root.querySelector(sel);

  function h(tag, props = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (v === false || v == null) continue;
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v === true ? '' : v);
    }
    for (const c of children.flat()) if (c != null) node.append(c);
    return node;
  }

  const SCREENS = ['model', 'setup', 'chat', 'feedback'];
  function show(screen) {
    state.screen = screen;
    SCREENS.forEach((s) => $('#screen-' + s).classList.toggle('hidden', s !== screen));
    window.scrollTo({ top: 0 });
    save();
  }

  const shortName = () => (state.recipient.split(/[,(\-–—:]/)[0].trim().slice(0, 30)) || 'Contraparte';
  const model = () => MODELS[state.modelId];

  /* ------------------------------------------------------------------ */
  /*  Pantalla 1: elegir modelo                                         */
  /* ------------------------------------------------------------------ */

  function renderModelCards() {
    const box = $('#model-cards');
    box.replaceChildren();
    Object.values(MODELS).forEach((m, i) => {
      box.append(
        h('button', { type: 'button', class: 'card', onclick: () => chooseModel(m.id) },
          h('span', { class: 'num', text: `Opción ${i + 1}` }),
          h('h3', { text: m.name }),
          h('p', { class: 'long', text: m.long }),
          h('p', { text: m.desc })
        )
      );
    });
  }

  function chooseModel(id) {
    if (state.modelId !== id) state.caso = {}; // cada modelo tiene sus propios campos
    state.modelId = id;
    renderSetup();
    show('setup');
  }

  /* ------------------------------------------------------------------ */
  /*  Pantalla 2: armar el caso                                         */
  /* ------------------------------------------------------------------ */

  function renderSetup() {
    const m = model();
    $('#setup-model-tag').textContent = m.name;
    $('#setup-model-long').textContent = m.long;
    $('#recipient').value = state.recipient;
    $('#context').value = state.context;

    const att = $('#attitude-options');
    att.replaceChildren();
    Object.entries(ATTITUDES).forEach(([key, a]) => {
      att.append(
        h('label', { class: 'attitude' },
          h('input', { type: 'radio', name: 'attitude', value: key, checked: state.attitude === key }),
          h('div', { class: 'box' }, h('strong', { text: `${a.icon} ${a.label}` }), h('span', { text: a.desc }))
        )
      );
    });

    const cf = $('#case-fields');
    cf.replaceChildren();
    m.fields.forEach((f) => {
      cf.append(
        h('div', { class: 'case-field' },
          h('label', { for: 'f-' + f.key, text: f.label }),
          h('p', { class: 'hint', text: f.hint }),
          h('textarea', { id: 'f-' + f.key, 'data-key': f.key, rows: 3, maxlength: 1500 })
        )
      );
      $('#f-' + f.key).value = state.caso[f.key] || '';
    });

    $('#setup-error').classList.add('hidden');
  }

  function readSetupForm() {
    state.recipient = $('#recipient').value.trim();
    state.context = $('#context').value.trim();
    const checked = document.querySelector('input[name="attitude"]:checked');
    state.attitude = checked ? checked.value : 'neutra';
    state.caso = {};
    model().fields.forEach((f) => { state.caso[f.key] = $('#f-' + f.key).value.trim(); });
  }

  function onSetupSubmit(e) {
    e.preventDefault();
    readSetupForm();
    const missing = [];
    if (!state.recipient) missing.push('Para quién es el feedback');
    if (!state.context) missing.push('Contexto');
    model().fields.forEach((f) => { if (!state.caso[f.key]) missing.push(f.label); });
    const err = $('#setup-error');
    if (missing.length) {
      err.textContent = 'Completa los campos pendientes: ' + missing.join(', ') + '.';
      err.classList.remove('hidden');
      save();
      return;
    }
    err.classList.add('hidden');
    startConversation();
    show('chat');
    $('#chat-input').focus();
  }

  /* ------------------------------------------------------------------ */
  /*  Pantalla 3: chat                                                  */
  /* ------------------------------------------------------------------ */

  function startConversation() {
    runId++;
    busy = false;
    lastError = null;
    state.feedback = null;
    state.messages = [{ role: 'assistant', content: GREETINGS[state.attitude] || GREETINGS.neutra }];
    renderChat();
    save();
  }

  function renderChat() {
    const m = model();
    const a = ATTITUDES[state.attitude];

    const chips = $('#chat-chips');
    chips.replaceChildren(
      h('span', { class: 'chip model', text: m.name }),
      h('span', { class: 'chip' }, 'Para: ', h('b', { text: shortName() })),
      h('span', { class: 'chip' }, 'Actitud: ', h('b', { text: `${a.icon} ${a.label}` }))
    );

    const summary = $('#case-summary');
    summary.replaceChildren(
      h('div', { class: 'case-item' }, h('b', { text: 'Contexto' }), h('span', { text: state.context })),
      ...m.fields.map((f) => h('div', { class: 'case-item' }, h('b', { text: f.label }), h('span', { text: state.caso[f.key] || '' })))
    );

    renderMessages();
    updateComposer();
  }

  function renderMessages() {
    const box = $('#messages');
    box.replaceChildren(h('div', { class: 'note', text: `${shortName()} se ha conectado a la reunión` }));

    state.messages.forEach((msg) => {
      const mine = msg.role === 'user';
      box.append(
        h('div', { class: 'msg ' + (mine ? 'me' : 'them') },
          h('div', { class: 'who', text: mine ? 'Tú (líder)' : shortName() }),
          h('div', { class: 'bubble', text: msg.content })
        )
      );
    });

    if (busy) {
      box.append(
        h('div', { class: 'msg them typing', 'aria-label': 'Escribiendo…' },
          h('div', { class: 'bubble' }, h('span', { class: 'dot' }), h('span', { class: 'dot' }), h('span', { class: 'dot' }))
        )
      );
    }
    if (lastError) {
      box.append(
        h('div', { class: 'note err', role: 'alert' },
          h('span', { text: lastError }),
          h('button', { type: 'button', onclick: requestReply, text: 'Reintentar' })
        )
      );
    }
    box.scrollTop = box.scrollHeight;
  }

  function updateComposer() {
    $('#chat-input').disabled = busy;
    $('#btn-send').disabled = busy;
  }

  function autosize() {
    const ta = $('#chat-input');
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 140) + 'px';
  }

  function setupPayload() {
    return { modelId: state.modelId, attitude: state.attitude, recipient: state.recipient, context: state.context, caso: state.caso };
  }

  async function api(payload) {
    let res;
    try {
      res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    } catch (_) {
      throw new Error('No hay conexión con el servidor. Revisa tu internet e intenta de nuevo.');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Ocurrió un error inesperado.');
    return data;
  }

  async function onSend(e) {
    e.preventDefault();
    if (busy) return;
    const input = $('#chat-input');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    autosize();
    state.messages.push({ role: 'user', content: text });
    save();
    await requestReply();
  }

  async function requestReply() {
    if (busy) return;
    const myRun = runId;
    busy = true;
    lastError = null;
    renderMessages();
    updateComposer();
    try {
      const data = await api({ mode: 'chat', setup: setupPayload(), messages: state.messages });
      if (myRun !== runId) return; // la conversación fue reiniciada mientras esperábamos
      state.messages.push({ role: 'assistant', content: data.reply });
      save();
    } catch (err) {
      if (myRun !== runId) return;
      lastError = err.message;
    } finally {
      if (myRun === runId) {
        busy = false;
        renderMessages();
        updateComposer();
        if (!$('#screen-chat').classList.contains('hidden')) $('#chat-input').focus();
      }
    }
  }

  function hasLeaderMessages() {
    return state.messages.some((m) => m.role === 'user');
  }

  function restartConversation() {
    if (hasLeaderMessages() && !confirm('¿Reiniciar la conversación? Se perderá lo conversado, pero se mantiene tu caso y los parámetros elegidos.')) return;
    startConversation();
    show('chat');
    $('#chat-input').focus();
  }

  function restartActivity() {
    if ((hasLeaderMessages() || state.recipient) && !confirm('¿Reiniciar toda la actividad? Volverás a elegir el modelo y a definir tu caso desde el inicio.')) return;
    runId++;
    busy = false;
    lastError = null;
    state = freshState();
    renderModelCards();
    show('model');
  }

  /* ------------------------------------------------------------------ */
  /*  Pantalla 4: feedback                                              */
  /* ------------------------------------------------------------------ */

  const level = (pct) => (pct >= 60 ? 'good' : pct >= 40 ? 'mid' : 'bad');

  function pctBlock(name, pct, text, extraClass = '') {
    const lv = level(pct);
    return h('div', { class: 'fb-item ' + extraClass },
      h('div', { class: 'fb-row' }, h('h3', { text: name }), h('span', { class: 'pct ' + lv, text: pct + '%' })),
      h('div', { class: 'bar', role: 'img', 'aria-label': `${name}: ${pct}%` }, h('i', { class: lv, style: `width:${pct}%` })),
      text ? h('p', { text }) : null
    );
  }

  async function requestFeedback() {
    if (!hasLeaderMessages()) {
      alert('Primero conversa un poco: aún no hay intervenciones tuyas para evaluar.');
      return;
    }
    const myRun = runId;
    $('#fb-sub').textContent = `${model().name} · Para: ${shortName()} · Actitud ${ATTITUDES[state.attitude].label.toLowerCase()}`;
    $('#fb-body').replaceChildren(
      h('div', { class: 'fb-loading' }, h('div', { class: 'spinner' }), h('p', { text: 'Analizando tu conversación…' }))
    );
    show('feedback');
    try {
      const data = await api({ mode: 'feedback', setup: setupPayload(), messages: state.messages });
      if (myRun !== runId) return;
      state.feedback = data.feedback;
      save();
      renderFeedback();
    } catch (err) {
      if (myRun !== runId) return;
      $('#fb-body').replaceChildren(
        h('p', { class: 'error', role: 'alert', text: err.message }),
        h('button', { type: 'button', class: 'btn', onclick: requestFeedback, text: 'Reintentar' })
      );
    }
  }

  function renderFeedback() {
    const fb = state.feedback;
    if (!fb) return;
    const body = $('#fb-body');
    body.replaceChildren(
      ...fb.items.map((it) => pctBlock(it.nombre, it.porcentaje, it.justificacion)),
      h('div', { class: 'overall' }, pctBlock('Promedio general', fb.promedio, '', 'plain')),
      h('div', { class: 'tips' },
        h('h3', { text: 'Dos tips para tu próxima vez' }),
        h('ol', {}, ...fb.tips.map((t) => h('li', { text: t })))
      )
    );
  }

  function backToChat() {
    show('chat');
    renderMessages();
    $('#chat-input').focus();
  }

  /* ------------------------------------------------------------------ */
  /*  Inicio                                                            */
  /* ------------------------------------------------------------------ */

  function bind() {
    $('#setup-back').addEventListener('click', () => { readSetupForm(); show('model'); });
    $('#setup-form').addEventListener('submit', onSetupSubmit);
    $('#setup-form').addEventListener('change', () => { readSetupForm(); save(); });

    $('#composer').addEventListener('submit', onSend);
    $('#chat-input').addEventListener('input', autosize);
    $('#chat-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        $('#composer').requestSubmit();
      }
    });

    $('#btn-restart-chat').addEventListener('click', restartConversation);
    $('#btn-restart-activity').addEventListener('click', restartActivity);
    $('#btn-feedback').addEventListener('click', requestFeedback);

    $('#fb-back').addEventListener('click', backToChat);
    $('#fb-restart-chat').addEventListener('click', restartConversation);
    $('#fb-restart-activity').addEventListener('click', restartActivity);
  }

  function init() {
    load();
    renderModelCards();
    bind();

    // Restaurar la pantalla donde se quedó la persona (p. ej., tras recargar)
    if (state.modelId && state.screen !== 'model') {
      renderSetup();
      if (state.screen === 'chat' || state.screen === 'feedback') {
        if (!state.messages.length) { show('setup'); return; }
        renderChat();
        if (state.screen === 'feedback' && state.feedback) {
          $('#fb-sub').textContent = `${model().name} · Para: ${shortName()} · Actitud ${ATTITUDES[state.attitude].label.toLowerCase()}`;
          renderFeedback();
          show('feedback');
          return;
        }
        show('chat');
        // si quedó pendiente la respuesta de la contraparte, se solicita de nuevo
        if (state.messages[state.messages.length - 1].role === 'user') requestReply();
        return;
      }
      show('setup');
      return;
    }
    show('model');
  }

  init();
})();
