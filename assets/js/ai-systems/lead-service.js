/* AI Lead Follow-Up — lead data store (no DOM).
   Persists to localStorage. Replace load()/save() with a CRM or API later. */
(function () {
  'use strict';
  var AIS = window.AIS, U = AIS.util;
  var KEY = 'leads';
  var STATUSES = ['New', 'Contacted', 'Follow-up', 'Booked', 'No Response'];

  function ago(days, hour, min) {
    var d = U.addDays(new Date(), -days); d.setHours(hour == null ? 10 : hour, min || 0, 0, 0);
    return d.toISOString();
  }
  function ahead(days, hour) {
    var d = U.addDays(new Date(), days); d.setHours(hour == null ? 10 : hour, 0, 0, 0);
    return d.toISOString();
  }
  function msg(from, text, at, channel) { return { from: from, text: text, at: at, channel: channel || 'chat' }; }
  function ev(type, text, at) { return { type: type, text: text, at: at }; }

  function seed() {
    var appt = U.isoDate(U.addDays(new Date(), 3));
    return [
      { id: 'seed_sarah', seed: true, name: 'Sarah Johnson', email: 'sarah.johnson@example.com', phone: '+44 7700 900101',
        service: 'Laser Hair Removal', status: 'New', source: 'AI Customer Assistant', received: ago(1, 16, 20), lastContact: null, nextFollowUp: ahead(0, 17),
        conversation: [
          msg('customer', 'Hi, do you offer laser hair removal?', ago(1, 16, 18)),
          msg('assistant', 'Yes. Sessions are 45 minutes and start with a consultation. Shall I take your details?', ago(1, 16, 18)),
          msg('customer', 'Maybe. Can I book for next week?', ago(1, 16, 19)),
          msg('assistant', 'Absolutely. What name should I use?', ago(1, 16, 19))
        ],
        timeline: [ev('captured', 'Inquiry captured by AI Customer Assistant', ago(1, 16, 20))] },
      { id: 'seed_emma', seed: true, name: 'Emma Williams', email: 'emma.williams@example.com', phone: '+44 7700 900102',
        service: 'Facial Treatment', status: 'Follow-up', source: 'AI Customer Assistant', received: ago(4, 11, 5), lastContact: ago(2, 9, 30), nextFollowUp: ahead(1, 10),
        conversation: [
          msg('customer', 'What facials do you offer?', ago(4, 11, 2)),
          msg('assistant', 'Our facials last 60 minutes and begin with a skin assessment.', ago(4, 11, 2)),
          msg('business', 'Hi Emma! Thanks for your interest in a facial. Would you like help finding a time?', ago(2, 9, 30), 'email')
        ],
        timeline: [ev('captured', 'Inquiry captured by AI Customer Assistant', ago(4, 11, 5)), ev('followup', 'Demo email follow-up sent', ago(2, 9, 30))] },
      { id: 'seed_michael', seed: true, name: 'Michael Brown', email: 'michael.brown@example.com', phone: '+44 7700 900103',
        service: 'Consultation', status: 'Booked', source: 'AI Booking System', received: ago(6, 14, 10), lastContact: ago(5, 9, 0), nextFollowUp: null,
        appointment: { date: appt, time: '11:00' },
        conversation: [
          msg('customer', 'Do you offer consultations?', ago(6, 14, 8)),
          msg('assistant', 'Yes. Consultations are 30 minutes. Would you like to request one?', ago(6, 14, 8)),
          msg('business', 'Hi Michael, your consultation request is confirmed. See you soon.', ago(5, 9, 0), 'email')
        ],
        timeline: [ev('captured', 'Inquiry captured by AI Customer Assistant', ago(6, 14, 10)), ev('booked', 'Consultation requested through AI Booking System', ago(5, 9, 0))] },
      { id: 'seed_jessica', seed: true, name: 'Jessica Davis', email: 'jessica.davis@example.com', phone: '+44 7700 900104',
        service: 'Skin Treatment', status: 'No Response', source: 'AI Customer Assistant', received: ago(12, 12, 40), lastContact: ago(5, 10, 0), nextFollowUp: ahead(2, 10),
        conversation: [
          msg('customer', 'How much are skin treatments?', ago(12, 12, 38)),
          msg('assistant', 'Pricing is shared after your consultation. Would you like to request one?', ago(12, 12, 38)),
          msg('business', 'Hi Jessica! Checking in on your skin treatment inquiry.', ago(8, 10, 0), 'sms'),
          msg('business', 'Following up again. We have appointments available this week.', ago(5, 10, 0), 'sms')
        ],
        timeline: [ev('captured', 'Inquiry captured by AI Customer Assistant', ago(12, 12, 40)), ev('followup', 'Demo SMS follow-up sent', ago(8, 10, 0)), ev('followup', 'Demo SMS follow-up sent', ago(5, 10, 0))] },
      { id: 'seed_olivia', seed: true, name: 'Olivia Martin', email: 'olivia.martin@example.com', phone: '',
        service: 'Facial Treatment', status: 'Contacted', source: 'AI Customer Assistant', received: ago(2, 15, 25), lastContact: ago(1, 9, 45), nextFollowUp: ahead(1, 10),
        conversation: [
          msg('customer', 'Do you do facials for sensitive skin?', ago(2, 15, 22)),
          msg('assistant', 'Yes, treatments are tailored after a skin assessment.', ago(2, 15, 22)),
          msg('business', 'Hi Olivia! Happy to talk through options for your skin. Would you like a time?', ago(1, 9, 45), 'email')
        ],
        timeline: [ev('captured', 'Inquiry captured by AI Customer Assistant', ago(2, 15, 25)), ev('followup', 'Demo email follow-up sent', ago(1, 9, 45))] },
      { id: 'seed_daniel', seed: true, name: 'Daniel Wilson', email: 'daniel.wilson@example.com', phone: '+44 7700 900106',
        service: 'Consultation', status: 'New', source: 'AI Customer Assistant', received: ago(0, 8, 50), lastContact: null, nextFollowUp: ahead(1, 9),
        conversation: [
          msg('customer', 'What are your opening hours?', ago(0, 8, 47)),
          msg('assistant', 'Monday to Friday 9 AM–7 PM, Saturday 10 AM–5 PM. Would you like to request a time?', ago(0, 8, 47)),
          msg('customer', 'Yes, please.', ago(0, 8, 49))
        ],
        timeline: [ev('captured', 'Inquiry captured by AI Customer Assistant', ago(0, 8, 50))] }
    ];
  }

  function load() {
    var s = AIS.storage.get(KEY, null);
    var now = new Date();
    if (!s || !Array.isArray(s.items)) {
      s = { seededAt: now.toISOString(), items: seed() };
      AIS.storage.set(KEY, s);
    } else if (U.dayDiff(new Date(s.seededAt), now) >= 7) {
      /* Sample dates drift; refresh the sample leads but keep anything created in the demos. */
      s = { seededAt: now.toISOString(), items: seed().concat(s.items.filter(function (l) { return !l.seed; })) };
      AIS.storage.set(KEY, s);
    }
    return s;
  }
  function save(s) { AIS.storage.set(KEY, s); }
  function find(s, id) { for (var i = 0; i < s.items.length; i++) if (s.items[i].id === id) return s.items[i]; return null; }
  function byEmail(s, email) {
    var e = String(email || '').trim().toLowerCase();
    if (!e) return null;
    for (var i = 0; i < s.items.length; i++) if ((s.items[i].email || '').toLowerCase() === e) return s.items[i];
    return null;
  }

  AIS.leads = {
    statuses: STATUSES,
    list: function () {
      return load().items.slice().sort(function (a, b) { return new Date(b.received) - new Date(a.received); });
    },
    get: function (id) { return find(load(), id); },
    counts: function () {
      var c = { all: 0 }; STATUSES.forEach(function (s) { c[s] = 0; });
      load().items.forEach(function (l) { c.all++; c[l.status]++; });
      return c;
    },
    reset: function () { AIS.storage.remove(KEY); load(); },

    /* Called by the AI Customer Assistant when a visitor finishes lead capture. */
    addFromChat: function (data) {
      var s = load(), nowIso = new Date().toISOString();
      var convo = (data.transcript || []).slice(-8).map(function (m) { return msg(m.from, m.text, m.at || nowIso); });
      var lead = byEmail(s, data.email);
      if (lead) {
        lead.service = data.service; lead.phone = lead.phone || data.phone || '';
        lead.conversation = lead.conversation.concat(convo);
        lead.timeline.push(ev('captured', 'Repeat inquiry captured by AI Customer Assistant', nowIso));
      } else {
        lead = { id: U.uid('lead'), seed: false, name: data.name, email: data.email, phone: data.phone || '', service: data.service,
          status: 'New', source: 'AI Customer Assistant', received: nowIso, lastContact: null,
          nextFollowUp: AIS.followup.nextDate({ status: 'New' }), conversation: convo,
          timeline: [ev('captured', 'Inquiry captured by AI Customer Assistant', nowIso)] };
        s.items.push(lead);
      }
      save(s); return lead;
    },

    /* Called by the AI Booking System after a confirmed request. */
    recordBooking: function (b) {
      var s = load(), nowIso = new Date().toISOString();
      var text = b.serviceName + ' requested for ' + U.formatLong(b.date) + ' at ' + U.formatTime(b.time) + ' through AI Booking System';
      var lead = byEmail(s, b.email);
      if (!lead) {
        lead = { id: U.uid('lead'), seed: false, name: b.name, email: b.email, phone: b.phone, service: b.serviceName,
          status: 'Booked', source: 'AI Booking System', received: nowIso, lastContact: null, nextFollowUp: null,
          conversation: [], timeline: [ev('captured', 'Lead created by AI Booking System', nowIso)] };
        s.items.push(lead);
      }
      lead.service = b.serviceName; lead.status = 'Booked'; lead.nextFollowUp = null;
      lead.appointment = { date: b.date, time: b.time };
      lead.timeline.push(ev('booked', text, nowIso));
      save(s); return lead;
    },

    /* Called by the dashboard when the demo "Send" button is used. */
    logFollowUp: function (id, opts) {
      var s = load(), lead = find(s, id);
      if (!lead) return null;
      var now = new Date(), nowIso = now.toISOString();
      var label = AIS.followup.channels.filter(function (c) { return c.id === opts.channel; })[0].label;
      lead.conversation.push(msg('business', opts.body, nowIso, opts.channel));
      lead.timeline.push(ev('followup', 'Demo ' + label + ' follow-up sent', nowIso));
      lead.lastContact = nowIso;
      lead.status = lead.status === 'New' ? 'Contacted' : 'Follow-up';
      lead.nextFollowUp = AIS.followup.nextDate(lead, now);
      save(s); return lead;
    }
  };
})();
