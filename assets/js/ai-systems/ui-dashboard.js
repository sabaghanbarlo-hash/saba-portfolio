/* AI Lead Follow-Up — dashboard interface. Uses AIS.leads and AIS.followup only. */
(function () {
  'use strict';
  var AIS = window.AIS, ui = AIS.ui, el = ui.el, U = AIS.util, L = AIS.leads, F = AIS.followup;

  var SYMBOL = { 'New': '●', 'Contacted': '◐', 'Follow-up': '↻', 'Booked': '✓', 'No Response': '○' };
  var SLUG = { 'New': 'new', 'Contacted': 'contacted', 'Follow-up': 'followup', 'Booked': 'booked', 'No Response': 'none' };
  var TL_LABEL = { captured: 'Captured', followup: 'Follow-up sent', booked: 'Booked', upcoming: 'Scheduled' };

  function pill(status) {
    return el('span', { class: 'ais-status s-' + SLUG[status] }, [el('span', { 'aria-hidden': 'true', text: SYMBOL[status] + ' ' }), status]);
  }
  function nextText(l) {
    if (l.status === 'Booked') return 'Not needed';
    return l.nextFollowUp ? U.relDay(l.nextFollowUp) : '—';
  }

  ui.demos.followup = {
    title: 'AI Lead Follow-Up',
    mount: function (root, ctx) {
      var st = { filter: 'all', selected: null, channel: 'email', draft: null, loading: false, sending: false, error: '', sent: '' };
      var token = 0;

      function visible() {
        return L.list().filter(function (l) { return st.filter === 'all' || l.status === st.filter; });
      }

      /* ---------- top: stats, filters, table ---------- */
      function stats() {
        var c = L.counts();
        var due = c['New'] + c['Follow-up'] + c['No Response'];
        function s(k, v) { return el('div', {}, [el('dt', { text: k }), el('dd', { text: String(v) })]); }
        return el('dl', { class: 'ais-stats' }, [s('Total leads', c.all), s('Need follow-up', due), s('Booked', c['Booked'])]);
      }
      function filters() {
        var c = L.counts();
        var wrap = el('div', { class: 'ais-filters', role: 'group', 'aria-label': 'Filter leads by status' });
        ['all'].concat(L.statuses).forEach(function (f) {
          wrap.appendChild(el('button', { type: 'button', class: 'ais-chip', 'aria-pressed': st.filter === f ? 'true' : 'false',
            text: (f === 'all' ? 'All' : f) + ' (' + c[f] + ')', onclick: function () { st.filter = f; renderTop(); } }));
        });
        return wrap;
      }
      function table() {
        var rows = visible();
        if (!rows.length) return el('p', { class: 'ais-empty', text: 'No leads with this status. Choose another filter.' });
        var tbody = el('tbody');
        rows.forEach(function (l) {
          var rec = F.recommend(l);
          tbody.appendChild(el('tr', { class: st.selected === l.id ? 'is-selected' : '', 'data-id': l.id }, [
            el('td', { 'data-label': 'Lead' }, [el('strong', { text: l.name }), el('span', { class: 'ais-sub', text: 'via ' + l.source })]),
            el('td', { 'data-label': 'Service', text: l.service }),
            el('td', { 'data-label': 'Received', text: U.formatShort(l.received) }),
            el('td', { 'data-label': 'Status' }, [pill(l.status)]),
            el('td', { 'data-label': 'Last contact', text: l.lastContact ? U.relDay(l.lastContact) : 'None yet' }),
            el('td', { 'data-label': 'Next follow-up', text: nextText(l) }),
            el('td', { 'data-label': 'Action' }, [el('button', { type: 'button', class: 'btn ais-btn-sm', text: rec.action, 'aria-label': rec.action + ': ' + l.name,
              'aria-pressed': st.selected === l.id ? 'true' : 'false', onclick: function () { select(l.id); } })])
          ]));
        });
        return el('div', { class: 'ais-tablewrap' }, [el('table', { class: 'ais-table' }, [
          el('caption', { class: 'ais-sr', text: 'Leads captured by the assistant and booking system' }),
          el('thead', {}, [el('tr', {}, ['Lead', 'Service', 'Received', 'Status', 'Last contact', 'Next follow-up', 'Action'].map(function (h) { return el('th', { scope: 'col', text: h }); }))]),
          tbody])]);
      }
      function renderTop() {
        var top = root.querySelector('.ais-dash-top'); if (!top) return;
        top.textContent = '';
        [stats(), filters(), table()].forEach(function (n) { top.appendChild(n); });
      }

      /* ---------- detail ---------- */
      function timelineFor(l) {
        var items = (l.timeline || []).slice().sort(function (a, b) { return new Date(a.at) - new Date(b.at); });
        if (l.nextFollowUp && l.status !== 'Booked') items.push({ type: 'upcoming', at: l.nextFollowUp, text: 'Next follow-up due ' + U.relDay(l.nextFollowUp).toLowerCase() });
        return el('ol', { class: 'ais-timeline' }, items.map(function (t) {
          return el('li', { class: 't-' + t.type }, [
            el('span', { class: 'ais-tl-label', text: TL_LABEL[t.type] || 'Note' }),
            el('span', { class: 'ais-tl-text', text: t.text }),
            el('span', { class: 'ais-tl-when', text: t.type === 'upcoming' ? U.formatShort(t.at) : U.formatStamp(t.at) })
          ]);
        }));
      }
      function convoFor(l) {
        if (!l.conversation || !l.conversation.length) return el('p', { class: 'ais-empty', text: 'No conversation yet. This lead came in through the booking form.' });
        var who = { customer: l.name.split(' ')[0], assistant: 'AI Assistant', business: 'LUMIÈRE Studio' };
        return el('ul', { class: 'ais-convo' }, l.conversation.map(function (m) {
          return el('li', { class: 'from-' + m.from }, [
            el('span', { class: 'ais-convo-who', text: who[m.from] + (m.channel && m.channel !== 'chat' ? ' · ' + m.channel : '') }),
            el('span', { class: 'ais-convo-text', text: m.text })
          ]);
        }));
      }

      function composer(l) {
        var box = el('div', { class: 'ais-composer-box' });
        if (l.status === 'Booked') {
          box.appendChild(el('p', { class: 'ais-empty', text: 'This lead is booked' + (l.appointment ? ' for ' + U.formatLong(l.appointment.date) + ' at ' + U.formatTime(l.appointment.time) : '') + '. No follow-up is needed.' }));
          return box;
        }
        var pills = el('fieldset', { class: 'ais-fieldset ais-channels' }, [el('legend', { class: 'ais-label', text: 'Channel' })]);
        var row = el('div', { class: 'budget-pills' });
        F.channels.forEach(function (c) {
          var ok = F.canUse(l, c.id), id = 'aisCh_' + c.id;
          row.appendChild(el('input', { type: 'radio', name: 'aisChannel', id: id, value: c.id, checked: st.channel === c.id && ok, disabled: !ok, onchange: function () {
            st.channel = c.id; st.draft = null; st.sent = ''; st.error = ''; renderDetail(true);
          } }));
          row.appendChild(el('label', { for: id, text: c.label + (ok ? '' : ' (no ' + (c.id === 'email' ? 'email' : 'phone') + ')') }));
        });
        pills.appendChild(row);
        box.appendChild(pills);
        box.appendChild(el('button', { type: 'button', class: 'btn primary ais-gen', id: 'aisGen', text: st.loading ? 'Generating…' : st.draft ? 'Regenerate' : 'Generate Follow-Up',
          disabled: st.loading || st.sending || !F.canUse(l, st.channel), onclick: generate }));

        if (st.loading) {
          var sk = el('div', { class: 'ais-skeleton ais-skeleton-text', 'aria-label': 'Generating message' }); sk.setAttribute('aria-busy', 'true');
          for (var i = 0; i < 4; i++) sk.appendChild(el('span'));
          box.appendChild(sk);
        } else if (st.draft) {
          var d = st.draft, ch = F.channels.filter(function (c) { return c.id === st.channel; })[0].label;
          if (d.subject != null) {
            box.appendChild(el('div', { class: 'field' }, [el('label', { for: 'aisSubject', text: 'Subject' }),
              el('input', { id: 'aisSubject', type: 'text', value: d.subject, oninput: function () { st.draft.subject = this.value; } })]));
          }
          var ta = el('textarea', { id: 'aisBody', rows: '7', 'aria-describedby': 'aisBodyErr', oninput: function () { st.draft.body = this.value; st.error = ''; count.textContent = counter(); errEl.textContent = ''; } });
          ta.value = d.body;
          var count = el('span', { class: 'ais-count', text: '' });
          function counter() { return st.channel === 'sms' ? st.draft.body.length + ' characters' : ''; }
          count.textContent = counter();
          var errEl = el('span', { class: 'err', id: 'aisBodyErr', role: 'alert', text: st.error });
          box.appendChild(el('div', { class: 'field' }, [el('label', { for: 'aisBody', text: ch + ' message to ' + l.name.split(' ')[0] }), ta, el('div', { class: 'ais-fieldmeta' }, [errEl, count])]));
          box.appendChild(el('div', { class: 'ais-nav' }, [
            el('span', { class: 'ais-fineprint', text: 'Demo: this will not actually send.' }),
            el('button', { type: 'button', class: 'btn primary', id: 'aisSend', disabled: st.sending, text: st.sending ? 'Sending…' : 'Send via ' + ch + ' (demo)', onclick: sendDraft })
          ]));
        } else if (st.sent) {
          box.appendChild(el('p', { class: 'ais-success', role: 'status', text: st.sent }));
        } else {
          box.appendChild(el('p', { class: 'ais-empty', text: 'Choose a channel and generate a message for review.' }));
        }
        return box;
      }

      function detail(l) {
        var rec = F.recommend(l);
        return el('div', { class: 'ais-detail-inner' }, [
          el('div', { class: 'ais-detail-head' }, [
            el('button', { type: 'button', class: 'ais-back', text: '← All leads', onclick: function () { st.selected = null; renderTop(); renderDetail(); root.scrollTop = 0; } }),
            el('h3', { id: 'aisDetailTitle', tabindex: '-1', text: l.name }), pill(l.status)
          ]),
          el('div', { class: 'ais-reco', role: 'note' }, [el('p', { class: 'ais-label', text: 'Recommended next action' }), el('p', { class: 'ais-reco-head', text: rec.headline }), el('p', { class: 'ais-reco-why', text: rec.reason })]),
          el('div', { class: 'ais-detail-grid' }, [
            el('section', { 'aria-labelledby': 'aisInfoH' }, [
              el('h4', { id: 'aisInfoH', text: 'Lead information' }),
              el('dl', { class: 'ais-review' }, [['Interested in', l.service], ['Email', l.email || '—'], ['Phone', l.phone || '—'], ['Source', l.source], ['Received', U.formatStamp(l.received)]].map(function (r) {
                return el('div', {}, [el('dt', { text: r[0] }), el('dd', { text: r[1] })]);
              })),
              el('h4', { id: 'aisConvoH', text: 'Conversation history' }), convoFor(l)
            ]),
            el('section', { 'aria-labelledby': 'aisTlH' }, [
              el('h4', { id: 'aisTlH', text: 'Follow-up timeline' }), timelineFor(l),
              el('h4', { text: 'Follow-up message' }), composer(l)
            ])
          ])
        ]);
      }
      function renderDetail(keepFocus) {
        var box = root.querySelector('.ais-dash-detail'); if (!box) return;
        box.textContent = '';
        var l = st.selected ? L.get(st.selected) : null;
        box.classList.toggle('has-lead', !!l);
        if (!l) { box.appendChild(el('p', { class: 'ais-empty ais-empty-lg', text: 'Select a lead to see the conversation, follow-up timeline and recommended next action.' })); return; }
        box.appendChild(detail(l));
      }

      /* ---------- actions ---------- */
      function select(id) {
        st.selected = id; st.draft = null; st.loading = false; st.sending = false; st.error = ''; st.sent = ''; token++;
        var l = L.get(id);
        st.channel = F.canUse(l, 'email') ? 'email' : 'sms';
        renderTop(); renderDetail();
        var h = root.querySelector('#aisDetailTitle');
        if (h) { h.scrollIntoView({ block: 'start', behavior: 'smooth' }); h.focus({ preventScroll: true }); }
      }
      function generate() {
        var l = L.get(st.selected); if (!l) return;
        st.loading = true; st.draft = null; st.sent = ''; st.error = '';
        var mine = ++token; renderDetail();
        setTimeout(function () {                          /* simulated generation delay */
          if (mine !== token) return;
          st.loading = false; st.draft = F.generate(l, st.channel); renderDetail();
          var ta = root.querySelector('#aisBody'); if (ta) ta.focus({ preventScroll: true });
        }, 650);
      }
      function sendDraft() {
        var l = L.get(st.selected); if (!l || !st.draft) return;
        if (!String(st.draft.body).trim()) { st.error = 'Write a message before sending.'; renderDetail(); var t = root.querySelector('#aisBody'); if (t) t.focus(); return; }
        st.sending = true; var mine = ++token; renderDetail();
        setTimeout(function () {
          if (mine !== token) return;
          L.logFollowUp(l.id, { channel: st.channel, body: st.draft.body });
          st.sending = false; st.draft = null; st.sent = 'Demo message sent';
          ctx.toast('Demo message sent');
          renderTop(); renderDetail();
          var s = root.querySelector('.ais-success'); if (s) { s.setAttribute('tabindex', '-1'); s.focus({ preventScroll: true }); }
        }, 600);
      }

      /* ---------- mount ---------- */
      function build() {
        root.textContent = '';
        root.appendChild(el('div', { class: 'ais-dash' }, [
          el('div', { class: 'ais-dash-top' }),
          el('section', { class: 'ais-dash-detail', 'aria-live': 'polite', 'aria-label': 'Lead details' })
        ]));
        renderTop(); renderDetail();
      }
      build();

      return {
        reset: function () { L.reset(); st = { filter: 'all', selected: null, channel: 'email', draft: null, loading: false, sending: false, error: '', sent: '' }; token++; build(); ctx.toast('Demo leads restored'); },
        focus: function () { var b = root.querySelector('.ais-chip'); if (b) b.focus(); }
      };
    }
  };
})();
