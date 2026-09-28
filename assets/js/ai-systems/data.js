/* AI Business Systems — shared demo data, storage and helpers.
   Everything here is local sample data for a fictional business. */
(function () {
  'use strict';
  var AIS = (window.AIS = window.AIS || {});

  AIS.config = {
    prefix: 'ais:v1:',
    business: {
      name: 'LUMIÈRE Studio',
      address: '24 Aldine Street, London (demo address)',
      hoursText: 'Monday to Friday 9 AM–7 PM, Saturday 10 AM–5 PM. Closed on Sundays.'
    }
  };

  AIS.services = [
    { id: 'consultation', name: 'Consultation', minutes: 30, blurb: 'A relaxed first conversation about your goals and skin.' },
    { id: 'facial', name: 'Facial Treatment', minutes: 60, blurb: 'A tailored facial with a skin assessment.' },
    { id: 'laser', name: 'Laser Hair Removal', minutes: 45, blurb: 'Treatment sessions after an initial consultation.' },
    { id: 'skin', name: 'Skin Treatment', minutes: 60, blurb: 'Targeted care for texture, tone and clarity.' }
  ];

  /* Opening hours by weekday (0 = Sunday): [openHour, closeHour] or null. */
  AIS.hours = { 0: null, 1: [9, 19], 2: [9, 19], 3: [9, 19], 4: [9, 19], 5: [9, 19], 6: [10, 17] };

  /* localStorage with an in-memory fallback so demos still work when storage is blocked. */
  var mem = {};
  AIS.storage = {
    get: function (key, fallback) {
      var k = AIS.config.prefix + key;
      try {
        var raw = window.localStorage.getItem(k);
        if (raw == null) return key in mem ? mem[key] : fallback;
        return JSON.parse(raw);
      } catch (e) { return key in mem ? mem[key] : fallback; }
    },
    set: function (key, value) {
      mem[key] = value;
      try { window.localStorage.setItem(AIS.config.prefix + key, JSON.stringify(value)); return true; }
      catch (e) { return false; }
    },
    remove: function (key) {
      delete mem[key];
      try { window.localStorage.removeItem(AIS.config.prefix + key); } catch (e) { /* ignore */ }
    }
  };

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  AIS.util = {
    pad: pad,
    isoDate: function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); },
    parseDate: function (iso) { var p = String(iso).slice(0, 10).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); },
    today: function () { var d = new Date(); d.setHours(0, 0, 0, 0); return d; },
    addDays: function (d, n) { var x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; },
    dayDiff: function (a, b) {
      var A = new Date(a.getFullYear(), a.getMonth(), a.getDate());
      var B = new Date(b.getFullYear(), b.getMonth(), b.getDate());
      return Math.round((B - A) / 86400000);
    },
    uid: function (p) { return (p || 'id') + '_' + Math.random().toString(36).slice(2, 9); },
    firstName: function (name) { return String(name || '').trim().split(/\s+/)[0] || 'there'; },
    formatLong: function (iso) {
      return AIS.util.parseDate(iso).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
    },
    formatShort: function (d) {
      var x = typeof d === 'string' ? new Date(d) : d;
      return x.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    },
    formatTime: function (hhmm) {
      var p = hhmm.split(':'); var h = +p[0]; var m = p[1];
      return ((h % 12) || 12) + ':' + m + ' ' + (h >= 12 ? 'PM' : 'AM');
    },
    formatStamp: function (iso) {
      var d = new Date(iso);
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ', ' +
        d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase();
    },
    /* "Today", "Tomorrow", "In 3 days", "2 days ago" relative to now. */
    relDay: function (value, now) {
      var d = typeof value === 'string' ? new Date(value) : value;
      var n = AIS.util.dayDiff(now || new Date(), d);
      if (n === 0) return 'Today';
      if (n === 1) return 'Tomorrow';
      if (n === -1) return 'Yesterday';
      return n > 0 ? 'In ' + n + ' days' : Math.abs(n) + ' days ago';
    }
  };

  AIS.validate = {
    name: function (v) {
      v = String(v || '').trim();
      if (v.length < 2) return 'Please enter your name.';
      if (!/^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ .'’-]{1,58}$/.test(v)) return 'Please use letters only for your name.';
      return '';
    },
    email: function (v) {
      v = String(v || '').trim();
      if (!v) return 'Please enter your email.';
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? '' : 'Please enter a valid email address.';
    },
    phone: function (v, optional) {
      v = String(v || '').trim();
      if (!v) return optional ? '' : 'Please enter your phone number.';
      if (!/^[+\d][\d\s().-]*$/.test(v)) return 'Use digits, spaces and + only.';
      var digits = v.replace(/\D/g, '');
      return digits.length >= 7 && digits.length <= 15 ? '' : 'Please enter a valid phone number.';
    }
  };
})();
