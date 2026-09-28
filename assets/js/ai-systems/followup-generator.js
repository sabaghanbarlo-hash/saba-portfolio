/* AI Lead Follow-Up — recommendation, message generation and scheduling (no DOM).
   Template-based for the demo. Replace generate() with a real AI/messaging
   service later; the dashboard only needs { subject?, body }. */
(function () {
  'use strict';
  var AIS = window.AIS, U = AIS.util, biz = AIS.config.business;

  var CHANNELS = [
    { id: 'email', label: 'Email' },
    { id: 'sms', label: 'SMS' },
    { id: 'whatsapp', label: 'WhatsApp' }
  ];

  function attempts(lead) {
    return (lead.timeline || []).filter(function (t) { return t.type === 'followup'; }).length;
  }
  function when(lead, now) {
    var n = U.dayDiff(new Date(lead.received), now || new Date());
    return n <= 0 ? 'today' : n === 1 ? 'yesterday' : n + ' days ago';
  }

  AIS.followup = {
    channels: CHANNELS,
    attempts: attempts,

    canUse: function (lead, channel) {
      return channel === 'email' ? !!lead.email : !!lead.phone;
    },

    recommend: function (lead, now) {
      var first = U.firstName(lead.name), svc = lead.service.toLowerCase(), w = when(lead, now), n = attempts(lead);
      switch (lead.status) {
        case 'Booked':
          return { action: 'View', headline: first + ' is booked. No follow-up needed.',
            reason: 'A short reminder closer to the appointment would keep the visit top of mind.' };
        case 'New':
          return { action: 'Follow up', headline: first + ' asked about ' + svc + ' ' + w + ' but has not booked an appointment.',
            reason: 'A friendly check-in within a day keeps the conversation warm.' };
        case 'Contacted':
          return { action: 'Follow up', headline: first + ' was contacted but has not replied or booked yet.',
            reason: 'Wait a couple of days, then send a gentle second message.' };
        case 'Follow-up':
          return { action: 'Follow up', headline: first + ' is interested in ' + svc + ' and is due another touchpoint.',
            reason: 'Offer to find a convenient time rather than repeating the first message.' };
        default:
          return { action: 'Re-engage', headline: first + ' has not responded after ' + n + ' follow-up' + (n === 1 ? '' : 's') + '.',
            reason: 'Send one last, low-pressure message, then pause outreach.' };
      }
    },

    /* → { subject?, body } */
    generate: function (lead, channel) {
      var first = U.firstName(lead.name), svc = lead.service.toLowerCase(), n = attempts(lead);
      var core;
      if (n === 0) core = 'Just checking in regarding your ' + svc + ' inquiry. If you\'d like, I can help you find a convenient appointment time.';
      else if (n === 1) core = 'Following up on your ' + svc + ' inquiry. There are appointments available this week, and I\'d be happy to help you choose one.';
      else core = 'One last note about your ' + svc + ' inquiry. If the timing isn\'t right, no problem at all. Just reply whenever you\'re ready and we\'ll take it from there.';

      if (channel === 'email') {
        return {
          subject: 'Your ' + svc + ' inquiry at ' + biz.name,
          body: 'Hi ' + first + ',\n\n' + core + '\n\nYou can reply to this email or request a time through our booking page.\n\nKind regards,\n' + biz.name
        };
      }
      if (channel === 'sms') return { body: 'Hi ' + first + '! ' + core + ' – ' + biz.name };
      return { body: 'Hi ' + first + '! ' + core + '\n\n– ' + biz.name };
    },

    /* Next follow-up date (ISO) after a status change, or null. */
    nextDate: function (lead, now) {
      var base = now || new Date();
      var gap = { 'New': 1, 'Contacted': 2, 'Follow-up': 3, 'No Response': 7 }[lead.status];
      if (!gap) return null;
      var d = U.addDays(base, gap); d.setHours(10, 0, 0, 0);
      return d.toISOString();
    }
  };
})();
