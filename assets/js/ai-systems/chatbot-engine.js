/* AI Customer Assistant — conversation logic only (no DOM).
   A predefined knowledge base with keyword intents. Swap reply() for a real
   AI/back-end call later; the UI only depends on the object it returns:
   { replies: string[], input: {...}, quick: string[], lead: object|null } */
(function () {
  'use strict';
  var AIS = window.AIS;
  var biz = AIS.config.business;

  var QUICK = ['Services', 'Opening hours', 'Book an appointment', 'Location'];
  var INPUT_CHAT = { type: 'text', placeholder: 'Ask a question…', autocomplete: 'off', label: 'Your message' };
  var INPUT_NAME = { type: 'text', placeholder: 'Your name', autocomplete: 'name', label: 'Your name' };
  var INPUT_EMAIL = { type: 'email', placeholder: 'you@example.com', autocomplete: 'email', label: 'Your email' };
  var INPUT_PHONE = { type: 'tel', placeholder: 'Phone (or type skip)', autocomplete: 'tel', label: 'Your phone number, optional' };

  var RX = {
    cancel: /\b(cancel|stop|never ?mind|forget it|start over)\b/i,
    price: /\b(cost|costs|price|prices|pricing|how much|fee|fees|charge)\b/i,
    hours: /\b(hours|opening|open|opens|closed?|closing|what time)\b/i,
    location: /\b(where|located|location|address|find you|directions|parking|near)\b/i,
    book: /\b(book|booking|appointment|appointments|reserve|schedule|availability|available|slot|next week|tomorrow|this week|sign me up|inquire|enquire|enquiry|inquiry|contact me|call me|get in touch)\b/i,
    consult: /\bconsult/i,
    yes: /^\s*(yes|yeah|yep|sure|ok|okay|please|yes please|sounds good|go ahead|let'?s do it|book me in)\b/i,
    greeting: /^\s*(hi|hello|hey|good (morning|afternoon|evening))\b/i,
    thanks: /\b(thanks|thank you|cheers)\b/i,
    human: /\b(human|real person|staff|receptionist|speak to|talk to|someone)\b/i,
    services: /\b(services?|treatments?|what do you (offer|do)|offer|menu|beauty)\b/i
  };

  function detectService(text) {
    if (/laser|hair removal/i.test(text)) return 'Laser Hair Removal';
    if (/facial/i.test(text)) return 'Facial Treatment';
    if (/skin (treatment|care)|\bskin\b/i.test(text) && !/consult/i.test(text)) return 'Skin Treatment';
    if (/consult/i.test(text)) return 'Consultation';
    return null;
  }

  function cleanName(text) {
    var t = String(text).trim().replace(/^(hi,?\s*)?(i'?m|i am|my name is|it'?s|this is|call me)\s+/i, '').replace(/[.!]+$/, '').trim();
    return t.replace(/(^|\s)([a-zà-ÿ])/g, function (m, a, b) { return a + b.toUpperCase(); });
  }

  AIS.createChatbot = function () {
    var state = { mode: 'chat', offer: null, service: null, lead: {}, captured: false };

    function out(replies, input, quick, extra) {
      var r = { replies: replies, input: input || INPUT_CHAT, quick: quick || QUICK, lead: null };
      if (extra) for (var k in extra) r[k] = extra[k];
      return r;
    }

    function startLead(intro) {
      state.mode = 'ask_name';
      var first = intro ? [intro] : [];
      return out(first.concat(['Absolutely. I can help you with that. What name should I use?']), INPUT_NAME, []);
    }

    function handleFlow(text) {
      if (RX.cancel.test(text)) {
        state.mode = 'chat'; state.lead = {};
        return out(['No problem, I have not saved anything. Is there anything else I can help with?']);
      }
      if (state.mode === 'ask_name') {
        var name = cleanName(text);
        var err = AIS.validate.name(name);
        if (err) return out(['Sorry, I did not catch a name. ' + err], INPUT_NAME, []);
        state.lead.name = name; state.mode = 'ask_email';
        return out(['Nice to meet you, ' + AIS.util.firstName(name) + '. What is the best email address to reach you?'], INPUT_EMAIL, []);
      }
      if (state.mode === 'ask_email') {
        var e = AIS.validate.email(text);
        if (e) return out(['That does not look right. ' + e], INPUT_EMAIL, []);
        state.lead.email = text.trim(); state.mode = 'ask_phone';
        return out(['Thank you. And a phone number? This is optional, so type "skip" to leave it out.'], INPUT_PHONE, ['Skip']);
      }
      /* ask_phone */
      var skip = /^\s*(skip|no|none|no thanks|n\/a)\s*$/i.test(text);
      if (!skip) {
        var pe = AIS.validate.phone(text, true);
        if (pe) return out(['That number does not look right. ' + pe + ' Or type "skip".'], INPUT_PHONE, ['Skip']);
        state.lead.phone = text.trim();
      }
      state.lead.service = state.service || 'Consultation';
      state.mode = 'chat'; state.captured = true;
      var lead = state.lead; state.lead = {};
      return out([
        'Thanks! Your inquiry has been received.',
        'I have noted your interest in ' + lead.service.toLowerCase() + '. In a live setup, ' + biz.name + ' would confirm the next step by email or phone. In this demo nothing is sent anywhere.'
      ], INPUT_CHAT, ['Opening hours', 'Location', 'Services'], { lead: lead });
    }

    return {
      greeting: function () {
        return out(['Hi! I am the ' + biz.name + ' assistant. I can answer questions about treatments, opening hours and appointments.']);
      },
      state: state,
      reply: function (raw) {
        var text = String(raw || '').trim();
        var svc = detectService(text);
        if (svc) state.service = svc;

        if (state.mode !== 'chat') return handleFlow(text);

        if (state.offer === 'book' && RX.yes.test(text)) { state.offer = null; return startLead(); }
        state.offer = null;

        if (RX.price.test(text)) {
          state.offer = 'book';
          return out([
            'In this demo, the initial 30-minute consultation is complimentary. Treatment pricing is shared after your consultation, once we know what suits you.',
            'Would you like to request a consultation?'
          ], INPUT_CHAT, ['Yes, please', 'Opening hours', 'Services']);
        }
        if (RX.hours.test(text)) {
          state.offer = 'book';
          return out([biz.hoursText + ' Would you like to request a time?'], INPUT_CHAT, ['Yes, please', 'Location', 'Services']);
        }
        if (RX.location.test(text) && !RX.book.test(text)) return out(['You will find us at ' + biz.address + '. Tell me if you would like to arrange a visit.'], INPUT_CHAT, ['Book an appointment', 'Opening hours', 'Services']);
        if (RX.book.test(text)) {
          if (state.captured) {
            return out(['I already have your details. In the AI Booking System demo you can pick an exact date and time.'], INPUT_CHAT, ['Opening hours', 'Services', 'Location']);
          }
          var intro = null;
          if (/next week/i.test(text)) intro = 'Next week works. I will note that preference.';
          else if (/^\s*how\b/i.test(text)) intro = 'You can request an appointment right here in the chat.';
          return startLead(intro);
        }
        if (RX.consult.test(text)) {
          state.offer = 'book';
          return out([
            'Yes. Consultations are 30 minutes and cover your skin, your goals and the treatments that could suit you.',
            'Would you like to request one?'
          ], INPUT_CHAT, ['Yes, please', 'How much is it?', 'Opening hours']);
        }
        if (/laser|hair removal/i.test(text)) { state.offer = 'book'; return out(['Laser hair removal sessions are 45 minutes and start with a consultation. Shall I take your details so the team can arrange it?'], INPUT_CHAT, ['Yes, please', 'Opening hours', 'Services']); }
        if (/facial/i.test(text)) { state.offer = 'book'; return out(['Our facial treatments last 60 minutes and begin with a skin assessment. Would you like to request an appointment?'], INPUT_CHAT, ['Yes, please', 'Opening hours', 'Services']); }
        if (RX.services.test(text)) {
          return out(['We offer facial treatments, skin consultations, laser hair removal, skin treatments and other beauty treatments. Consultation appointments are available too. What are you interested in?'], INPUT_CHAT, ['Book an appointment', 'How much is a consultation?', 'Opening hours']);
        }
        if (RX.greeting.test(text)) return out(['Hello! What can I help you with today?']);
        if (RX.thanks.test(text)) return out(['You are welcome. Anything else I can help with?']);
        if (RX.human.test(text)) {
          return out(['In a live setup I would hand this over to the ' + biz.name + ' team. For this demo, I can take your details as an inquiry.'], INPUT_CHAT, ['Book an appointment', 'Services', 'Opening hours']);
        }
        return out(['I am not sure about that one. This demo knows about services, prices, opening hours, location and appointments. Try one of these:'], INPUT_CHAT, QUICK);
      }
    };
  };
})();
