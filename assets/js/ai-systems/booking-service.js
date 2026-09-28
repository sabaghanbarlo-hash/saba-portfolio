/* AI Booking System — availability and booking data (no DOM).
   Local demo data only. Replace slotsFor()/create() with calls to a real
   calendar or booking API later; the booking UI depends only on these methods. */
(function () {
  'use strict';
  var AIS = window.AIS, U = AIS.util;
  var KEY = 'bookings';
  var MAX_DAYS = 60;

  function hash(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function service(id) {
    for (var i = 0; i < AIS.services.length; i++) if (AIS.services[i].id === id) return AIS.services[i];
    return null;
  }
  function toMin(hhmm) { var p = hhmm.split(':'); return +p[0] * 60 + +p[1]; }
  function toTime(m) { return U.pad(Math.floor(m / 60)) + ':' + U.pad(m % 60); }

  var api = AIS.booking = {
    maxDays: MAX_DAYS,
    service: service,
    all: function () { return AIS.storage.get(KEY, []); },
    clear: function () { AIS.storage.remove(KEY); },
    minDate: function () { return U.isoDate(U.today()); },
    maxDate: function () { return U.isoDate(U.addDays(U.today(), MAX_DAYS)); },

    validateDate: function (iso) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return 'Please choose a date.';
      if (iso < api.minDate()) return 'That date has passed. Please choose today or a later date.';
      if (iso > api.maxDate()) return 'Appointments can be requested up to ' + MAX_DAYS + ' days ahead.';
      return '';
    },

    /* → { error?, closed?, slots: [{ time, label, available, reason? }] } */
    slotsFor: function (iso, serviceId) {
      var err = api.validateDate(iso);
      if (err) return { error: err, slots: [] };
      var svc = service(serviceId);
      if (!svc) return { error: 'Please choose a service first.', slots: [] };
      var d = U.parseDate(iso);
      var hrs = AIS.hours[d.getDay()];
      if (!hrs) return { closed: true, slots: [] };

      var now = new Date();
      var isToday = iso === api.minDate();
      var cutoff = now.getHours() * 60 + now.getMinutes() + 60;
      var existing = api.all().filter(function (b) { return b.date === iso; });
      var slots = [];
      for (var m = hrs[0] * 60; m + svc.minutes <= hrs[1] * 60; m += 30) {
        if (isToday && m < cutoff) continue;
        var time = toTime(m), reason = '';
        if (hash(iso + time) % 100 < 30) reason = 'Unavailable';
        for (var i = 0; i < existing.length; i++) {
          var s = toMin(existing[i].time), e = s + existing[i].minutes;
          if (m < e && m + svc.minutes > s) reason = 'Booked';
        }
        slots.push({ time: time, label: U.formatTime(time), available: !reason, reason: reason });
      }
      return { slots: slots };
    },

    nextAvailableDates: function (serviceId, count) {
      var out = [], d = U.today();
      for (var i = 0; i <= MAX_DAYS && out.length < count; i++, d = U.addDays(d, 1)) {
        var res = api.slotsFor(U.isoDate(d), serviceId);
        if (res.slots.some(function (s) { return s.available; })) out.push(U.isoDate(d));
      }
      return out;
    },

    /* → { ok, errors?, booking? } */
    create: function (input) {
      var errors = {};
      var svc = service(input.serviceId);
      if (!svc) errors.service = 'Please choose a service.';
      var de = api.validateDate(input.date); if (de) errors.date = de;
      var ne = AIS.validate.name(input.name); if (ne) errors.name = ne;
      var ee = AIS.validate.email(input.email); if (ee) errors.email = ee;
      var pe = AIS.validate.phone(input.phone, false); if (pe) errors.phone = pe;
      if (!errors.service && !errors.date) {
        var slot = api.slotsFor(input.date, input.serviceId).slots.filter(function (s) { return s.time === input.time; })[0];
        if (!slot || !slot.available) errors.time = 'That time is no longer available. Please choose another.';
      }
      if (Object.keys(errors).length) return { ok: false, errors: errors };
      var booking = {
        id: U.uid('bk'), serviceId: svc.id, serviceName: svc.name, minutes: svc.minutes,
        date: input.date, time: input.time, name: input.name.trim(), email: input.email.trim(),
        phone: input.phone.trim(), createdAt: new Date().toISOString()
      };
      var list = api.all(); list.push(booking); AIS.storage.set(KEY, list);
      return { ok: true, booking: booking };
    }
  };
})();
