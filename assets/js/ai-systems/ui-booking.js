/* AI Booking System — booking flow interface. Uses AIS.booking and AIS.leads only. */
(function () {
  'use strict';
  var AIS = window.AIS, ui = AIS.ui, el = ui.el, U = AIS.util, B = AIS.booking;

  var STEPS = ['Service', 'Date & time', 'Your details', 'Confirm'];

  ui.demos.booking = {
    title: 'AI Booking System',
    mount: function (root, ctx) {
      var st, slotToken = 0;

      function fresh() {
        st = { step: 1, serviceId: '', date: '', time: '', name: '', email: '', phone: '', errors: {}, submitting: false, slots: null, loading: false, result: null, formError: '' };
      }
      fresh();

      function svc() { return B.service(st.serviceId); }
      function heading(text) { return el('h3', { class: 'ais-step-title', tabindex: '-1', text: text }); }

      /* ---------- chrome ---------- */
      function stepper() {
        return el('ol', { class: 'ais-stepper', 'aria-label': 'Booking progress' }, STEPS.map(function (label, i) {
          var n = i + 1, cls = n === st.step ? 'is-current' : n < st.step ? 'is-done' : '';
          return el('li', { class: cls, 'aria-current': n === st.step ? 'step' : false }, [
            el('span', { class: 'ais-step-num', 'aria-hidden': 'true', text: n < st.step ? '✓' : String(n) }), el('span', { text: label })
          ]);
        }));
      }
      function summary() {
        var s = svc();
        function row(k, v) { return el('div', {}, [el('dt', { text: k }), el('dd', { text: v || 'Not chosen yet', class: v ? '' : 'is-empty' })]); }
        return el('aside', { class: 'ais-summary', 'aria-label': 'Booking summary' }, [
          el('p', { class: 'ais-summary-title', text: 'Your request' }),
          el('dl', {}, [
            row('Service', s ? s.name + ' · ' + s.minutes + ' min' : ''),
            row('Date', st.date ? U.formatLong(st.date) : ''),
            row('Time', st.time ? U.formatTime(st.time) : ''),
            row('Name', st.name.trim())
          ]),
          el('p', { class: 'ais-fineprint', text: 'Demo only. No calendar, payment or messaging service is connected.' })
        ]);
      }
      function nav(nextLabel, onNext, canNext) {
        return el('div', { class: 'ais-nav' }, [
          st.step > 1 ? el('button', { type: 'button', class: 'btn', text: 'Back', onclick: function () { go(st.step - 1); } }) : el('span'),
          el('button', { type: 'button', class: 'btn primary', id: 'aisNext', text: nextLabel, disabled: !canNext, onclick: onNext })
        ]);
      }
      function setNext(enabled) { var b = root.querySelector('#aisNext'); if (b) b.disabled = !enabled; }

      /* ---------- steps ---------- */
      function stepService() {
        var group = el('fieldset', { class: 'ais-fieldset' }, [el('legend', { class: 'ais-sr', text: 'Choose a service' })]);
        var grid = el('div', { class: 'ais-choices' });
        AIS.services.forEach(function (s) {
          var id = 'aisSvc_' + s.id;
          var input = el('input', { type: 'radio', name: 'aisService', id: id, value: s.id, checked: st.serviceId === s.id, onchange: function () {
            st.serviceId = s.id; st.time = ''; st.slots = null; refreshSummary(); setNext(true);
          } });
          grid.appendChild(el('div', { class: 'ais-choice' }, [input, el('label', { for: id }, [
            el('span', { class: 'ais-choice-name', text: s.name }),
            el('span', { class: 'ais-choice-meta', text: s.minutes + ' min' }),
            el('span', { class: 'ais-choice-blurb', text: s.blurb })
          ])]));
        });
        group.appendChild(grid);
        return [heading('Choose a service'), group, nav('Continue', function () { go(2); }, !!st.serviceId)];
      }

      function stepDate() {
        var dateInput = el('input', { type: 'date', id: 'aisDate', min: B.minDate(), max: B.maxDate(), value: st.date, onchange: function () { pickDate(this.value); } });
        var chips = el('div', { class: 'ais-datechips', role: 'group', 'aria-label': 'Next available days' });
        B.nextAvailableDates(st.serviceId, 5).forEach(function (iso) {
          var d = U.parseDate(iso);
          chips.appendChild(el('button', { type: 'button', class: 'ais-chip', 'aria-pressed': st.date === iso ? 'true' : 'false', 'data-date': iso,
            text: d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }), onclick: function () { dateInput.value = iso; pickDate(iso); } }));
        });
        var slotsBox = el('div', { class: 'ais-slots', id: 'aisSlots' });
        var out = [
          heading('Pick a date and time'),
          el('div', { class: 'field' }, [el('label', { for: 'aisDate', text: 'Date' }), dateInput]),
          el('p', { class: 'ais-label', text: 'Next available' }), chips, slotsBox,
          nav('Continue', function () { go(3); }, !!(st.date && st.time))
        ];
        setTimeout(function () { renderSlots(); }, 0);
        return out;
      }

      function pickDate(iso) {
        st.date = iso; st.time = ''; st.slots = null;
        root.querySelectorAll('.ais-chip').forEach(function (c) { c.setAttribute('aria-pressed', c.getAttribute('data-date') === iso ? 'true' : 'false'); });
        refreshSummary(); setNext(false);
        var err = B.validateDate(iso);
        if (err) { st.slots = { error: err, slots: [] }; renderSlots(); return; }
        st.loading = true; renderSlots();
        var token = ++slotToken;
        setTimeout(function () {                       /* simulated availability lookup */
          if (token !== slotToken) return;
          st.loading = false; st.slots = B.slotsFor(iso, st.serviceId); renderSlots();
        }, 380);
      }

      function renderSlots() {
        var box = root.querySelector('#aisSlots'); if (!box) return;
        box.textContent = ''; box.removeAttribute('aria-busy');
        if (st.loading) {
          box.setAttribute('aria-busy', 'true');
          var sk = el('div', { class: 'ais-skeleton', 'aria-label': 'Checking availability' });
          for (var i = 0; i < 8; i++) sk.appendChild(el('span'));
          box.appendChild(sk); return;
        }
        if (!st.date) { box.appendChild(el('p', { class: 'ais-empty', text: 'Choose a date to see available times.' })); return; }
        var res = st.slots || B.slotsFor(st.date, st.serviceId); st.slots = res;
        if (res.error) { box.appendChild(el('p', { class: 'ais-error', role: 'alert', text: res.error })); return; }
        if (res.closed) { box.appendChild(el('p', { class: 'ais-empty', text: 'The studio is closed on Sundays. Please choose another date.' })); return; }
        if (!res.slots.some(function (s) { return s.available; })) { box.appendChild(el('p', { class: 'ais-empty', text: 'No times left on this day. Please try another date.' })); return; }
        var grid = el('div', { class: 'ais-slotgrid', role: 'group', 'aria-label': 'Available times on ' + U.formatLong(st.date) });
        res.slots.forEach(function (s) {
          grid.appendChild(el('button', { type: 'button', class: 'ais-slot' + (s.available ? '' : ' is-off'), disabled: !s.available,
            'aria-pressed': st.time === s.time ? 'true' : 'false', 'data-time': s.time,
            'aria-label': s.label + (s.available ? '' : ', unavailable'),
            onclick: function () {
              st.time = s.time;
              grid.querySelectorAll('.ais-slot').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-time') === s.time ? 'true' : 'false'); });
              refreshSummary(); setNext(true);
            } }, [s.label, s.available ? null : el('span', { class: 'ais-slot-off', text: 'Unavailable' })]));
        });
        box.appendChild(grid);
      }

      function field(id, label, type, key, autocomplete, hint) {
        var input = el('input', { id: id, type: type, value: st[key], autocomplete: autocomplete, required: true,
          'aria-describedby': id + 'Err', 'aria-invalid': st.errors[key] ? 'true' : false, class: st.errors[key] ? 'invalid' : false,
          oninput: function () { st[key] = this.value; if (key === 'name') refreshSummary(); } });
        return el('div', { class: 'field' }, [el('label', { for: id, text: label }), input, el('span', { class: 'err', id: id + 'Err', text: st.errors[key] || hint || '' })]);
      }
      function stepDetails() {
        return [heading('Your details'),
          el('form', { class: 'inquiry ais-form', novalidate: true, onsubmit: function (e) { e.preventDefault(); validateDetails(); } }, [
            field('aisName', 'Name', 'text', 'name', 'name'),
            el('div', { class: 'form-row' }, [field('aisEmail', 'Email', 'email', 'email', 'email'), field('aisPhone', 'Phone', 'tel', 'phone', 'tel')]),
            el('div', { class: 'ais-nav' }, [
              el('button', { type: 'button', class: 'btn', text: 'Back', onclick: function () { go(2); } }),
              el('button', { type: 'submit', class: 'btn primary', text: 'Review request' })
            ])
          ])];
      }
      function validateDetails() {
        st.errors = {};
        var n = AIS.validate.name(st.name), e = AIS.validate.email(st.email), p = AIS.validate.phone(st.phone, false);
        if (n) st.errors.name = n; if (e) st.errors.email = e; if (p) st.errors.phone = p;
        if (Object.keys(st.errors).length) { render(false); var bad = root.querySelector('[aria-invalid="true"]'); if (bad) bad.focus(); return; }
        go(4);
      }

      function stepReview() {
        var s = svc();
        var list = el('dl', { class: 'ais-review' });
        [['Service', s.name + ' · ' + s.minutes + ' min'], ['Date', U.formatLong(st.date)], ['Time', U.formatTime(st.time)],
          ['Name', st.name.trim()], ['Email', st.email.trim()], ['Phone', st.phone.trim()]].forEach(function (r) {
          list.appendChild(el('div', {}, [el('dt', { text: r[0] }), el('dd', { text: r[1] })]));
        });
        return [heading('Review your request'), list,
          st.formError ? el('p', { class: 'ais-error', role: 'alert', text: st.formError }) : null,
          el('div', { class: 'ais-nav' }, [
            el('button', { type: 'button', class: 'btn', text: 'Back', disabled: st.submitting, onclick: function () { go(3); } }),
            el('button', { type: 'button', class: 'btn primary', id: 'aisConfirm', disabled: st.submitting, text: st.submitting ? 'Confirming…' : 'Confirm appointment request', onclick: confirm })
          ])];
      }
      function confirm() {
        st.submitting = true; st.formError = ''; render(false);
        setTimeout(function () {
          var res = B.create({ serviceId: st.serviceId, date: st.date, time: st.time, name: st.name, email: st.email, phone: st.phone });
          st.submitting = false;
          if (!res.ok) {
            st.formError = res.errors.time || res.errors.date || 'Please check your details and try again.';
            if (res.errors.time || res.errors.date) { st.time = ''; st.slots = null; go(2); ctx.toast(st.formError); return; }
            go(3); return;
          }
          AIS.leads.recordBooking(res.booking);
          st.result = res.booking; st.step = 5; render(true);
        }, 700);
      }

      function stepDone() {
        var b = st.result;
        return [
          el('div', { class: 'ais-confirmed' }, [
            el('span', { class: 'ais-check', 'aria-hidden': 'true', text: '✓' }),
            el('h3', { class: 'ais-step-title', tabindex: '-1', text: 'Appointment Request Confirmed' }),
            el('dl', { class: 'ais-review' }, [['Service', b.serviceName], ['Date', U.formatLong(b.date)], ['Time', U.formatTime(b.time)], ['Customer name', b.name]].map(function (r) {
              return el('div', {}, [el('dt', { text: r[0] }), el('dd', { text: r[1] })]);
            })),
            el('p', { class: 'ais-confirm-note', text: 'We\'ll send a confirmation to your contact information.' }),
            el('p', { class: 'ais-fineprint', text: 'Demo only: nothing was sent, and no real calendar was changed. The request is saved in this browser and added to the follow-up dashboard as a Booked lead.' }),
            el('div', { class: 'ais-note-actions' }, [
              el('button', { type: 'button', class: 'btn ais-btn-sm', text: 'View in Follow-Up dashboard', onclick: function () { ctx.open('followup'); } }),
              el('button', { type: 'button', class: 'btn ais-btn-sm', text: 'Request another', onclick: function () { fresh(); render(true); } })
            ])
          ])
        ];
      }

      /* ---------- render ---------- */
      function refreshSummary() {
        var old = root.querySelector('.ais-summary'); if (!old) return;
        old.parentNode.replaceChild(summary(), old);
      }
      function go(n) { st.step = n; st.formError = n === 4 ? st.formError : ''; render(true); }
      function render(focusHeading) {
        root.textContent = '';
        var body = st.step === 1 ? stepService() : st.step === 2 ? stepDate() : st.step === 3 ? stepDetails() : st.step === 4 ? stepReview() : stepDone();
        var main = el('div', { class: 'ais-book-main' }, [st.step <= 4 ? stepper() : null].concat(body));
        root.appendChild(el('div', { class: 'ais-book' + (st.step === 5 ? ' is-done' : '') }, [main, st.step <= 4 ? summary() : null]));
        if (focusHeading) { var h = root.querySelector('.ais-step-title'); if (h) h.focus({ preventScroll: false }); root.scrollTop = 0; if (root.parentNode) root.scrollTop = 0; }
      }

      render(false);
      return {
        reset: function () { B.clear(); slotToken++; fresh(); render(true); ctx.toast('Demo bookings cleared'); },
        focus: function () { var h = root.querySelector('.ais-step-title'); if (h) h.focus(); }
      };
    }
  };
})();
