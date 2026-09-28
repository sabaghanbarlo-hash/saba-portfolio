/* AI Customer Assistant — chat interface. Talks to AIS.createChatbot() and AIS.leads only. */
(function () {
  'use strict';
  var AIS = window.AIS, ui = AIS.ui, el = ui.el;

  ui.demos.assistant = {
    title: 'AI Customer Assistant',
    mount: function (root, ctx) {
      var engine, conv, busy, run = 0;

      var log = el('div', { class: 'ais-chat-log', role: 'log', 'aria-live': 'polite', 'aria-label': 'Conversation with the LUMIÈRE Studio assistant' });
      var quick = el('div', { class: 'chat-suggestions ais-quick', role: 'group', 'aria-label': 'Suggested questions' });
      var input = el('input', { id: 'aisChatInput', class: 'ais-chat-input', type: 'text', placeholder: 'Ask a question…', autocomplete: 'off', maxlength: '200' });
      var send = el('button', { type: 'submit', class: 'btn primary ais-send', text: 'Send', disabled: true });
      var form = el('form', { class: 'ais-composer', novalidate: true }, [
        el('label', { for: 'aisChatInput', class: 'ais-sr', id: 'aisChatLabel', text: 'Your message' }), input, send
      ]);
      var header = el('div', { class: 'chat-header' }, [
        el('div', { class: 'chat-avatar', 'aria-hidden': 'true', text: 'L' }),
        el('div', {}, [
          el('p', { class: 'chat-name' }, ['LUMIÈRE Studio ', el('span', { class: 'chat-dot', 'aria-hidden': 'true' })]),
          el('p', { class: 'chat-sub', text: 'AI Customer Assistant · Portfolio Demo' })
        ])
      ]);
      var note = el('p', { class: 'ais-fineprint', text: 'Demo knowledge base with predefined responses. Details you enter stay in this browser and are not sent anywhere.' });
      var wrap = el('div', { class: 'ais-chat' }, [header, log, quick, form, note]);
      root.appendChild(wrap);

      function refreshSend() { send.disabled = busy || !input.value.trim(); }
      function setBusy(v) { busy = v; input.disabled = v; wrap.setAttribute('aria-busy', v ? 'true' : 'false'); refreshSend(); }
      function scroll() { log.scrollTop = log.scrollHeight; }

      function add(kind, text) {
        var m = el('div', { class: 'chat-msg ' + (kind === 'user' ? 'chat-user' : 'chat-ai'), text: text });
        log.appendChild(m); scroll(); return m;
      }
      function typing() {
        var t = el('div', { class: 'chat-msg chat-ai ais-typing', 'aria-hidden': 'true' }, [el('span'), el('span'), el('span')]);
        log.appendChild(t); scroll(); return t;
      }
      function say(list, done) {
        setBusy(true);
        var i = 0, mine = run;
        (function next() {
          if (mine !== run) return;
          if (i >= list.length) { setBusy(false); if (done) done(); return; }
          var t = typing(), text = list[i++];
          conv.push({ from: 'assistant', text: text, at: new Date().toISOString() });
          setTimeout(function () { if (mine !== run) return; t.remove(); add('ai', text); next(); }, Math.min(350 + text.length * 8, 1100));
        })();
      }
      function applyInput(cfg) {
        input.type = cfg.type; input.placeholder = cfg.placeholder;
        input.setAttribute('autocomplete', cfg.autocomplete);
        document.getElementById('aisChatLabel').textContent = cfg.label;
      }
      function renderQuick(list) {
        quick.textContent = '';
        quick.hidden = !list.length;
        list.forEach(function (label) {
          quick.appendChild(el('button', { type: 'button', text: label, onclick: function () { submit(label); } }));
        });
      }

      function finish(lead) {
        AIS.leads.addFromChat({ name: lead.name, email: lead.email, phone: lead.phone, service: lead.service, transcript: conv });
        var card = el('div', { class: 'ais-note', role: 'group', 'aria-label': 'Inquiry saved' }, [
          el('p', { class: 'ais-note-title', text: 'Inquiry saved to this browser (demo)' }),
          el('p', { text: lead.name + ' · ' + lead.service + '. It now appears as a New lead in the follow-up dashboard.' }),
          el('div', { class: 'ais-note-actions' }, [
            el('button', { type: 'button', class: 'btn ais-btn-sm', text: 'Try the Booking System', onclick: function () { ctx.open('booking'); } }),
            el('button', { type: 'button', class: 'btn ais-btn-sm', text: 'View in Follow-Up dashboard', onclick: function () { ctx.open('followup'); } })
          ])
        ]);
        log.appendChild(card); scroll();
      }

      function submit(text) {
        text = String(text || '').trim();
        if (busy || !text) return;
        var user = { from: 'customer', text: text, at: new Date().toISOString() };
        add('user', text); input.value = ''; refreshSend();
        conv.push(user);
        var r = engine.reply(text);
        quick.textContent = ''; quick.hidden = true;
        say(r.replies, function () {
          applyInput(r.input); renderQuick(r.quick);
          if (r.lead) finish(r.lead);
          input.focus();
        });
      }

      function start() {
        run++; engine = AIS.createChatbot(); conv = []; busy = false; setBusy(false);
        log.textContent = ''; input.value = '';
        var g = engine.greeting();
        applyInput(g.input); renderQuick([]);
        say(g.replies, function () { renderQuick(g.quick); });
      }

      input.addEventListener('input', refreshSend);
      form.addEventListener('submit', function (e) { e.preventDefault(); submit(input.value); });
      start();

      return { reset: start, focus: function () { input.focus(); } };
    }
  };
})();
