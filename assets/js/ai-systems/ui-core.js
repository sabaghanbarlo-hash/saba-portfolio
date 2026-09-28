/* AI Business Systems — shared UI: element helper, accessible modal, toast, launch buttons. */
(function () {
  'use strict';
  var AIS = window.AIS;
  var ui = (AIS.ui = AIS.ui || { demos: {} });

  /* el('div', {class:'x', text:'hi', onclick:fn}, [children]) — never uses innerHTML. */
  ui.el = function (tag, attrs, kids) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v === false || v == null) return;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : v);
    });
    (kids || []).forEach(function (c) {
      if (c == null || c === false) return;
      n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return n;
  };
  var el = ui.el;

  var dlg, titleEl, bodyEl, toastEl, resetBtn, current = null, lastTrigger = null;

  function build() {
    titleEl = el('h2', { class: 'ais-modal-title', id: 'aisModalTitle' });
    resetBtn = el('button', { type: 'button', class: 'ais-reset', text: 'Reset demo', onclick: function () { if (current && current.reset) current.reset(); } });
    var closeBtn = el('button', { type: 'button', class: 'ais-close', 'aria-label': 'Close demo', onclick: function () { dlg.close ? dlg.close() : hide(); } }, [
      el('span', { 'aria-hidden': 'true' }), el('span', { 'aria-hidden': 'true' })
    ]);
    bodyEl = el('div', { class: 'ais-modal-body' });
    toastEl = el('div', { class: 'ais-toasts', role: 'status', 'aria-live': 'polite' });
    var head = el('div', { class: 'ais-modal-head' }, [
      el('div', { class: 'ais-modal-heading' }, [
        el('p', { class: 'ais-modal-kicker' }, [el('span', { class: 'ais-badge', text: 'Interactive Demo' }), el('span', { text: 'Portfolio Demo · LUMIÈRE Studio' })]),
        titleEl
      ]),
      el('div', { class: 'ais-modal-actions' }, [resetBtn, closeBtn])
    ]);
    dlg = el('dialog', { class: 'ais-modal', 'aria-labelledby': 'aisModalTitle' }, [
      el('div', { class: 'ais-modal-shell' }, [head, bodyEl, toastEl])
    ]);
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener('close', onClosed);
    document.body.appendChild(dlg);
  }

  function hide() { dlg.removeAttribute('open'); onClosed(); }

  function onClosed() {
    document.documentElement.classList.remove('ais-lock');
    current = null;
    bodyEl.textContent = '';
    toastEl.textContent = '';
    if (lastTrigger && document.contains(lastTrigger)) lastTrigger.focus();
  }

  ui.open = function (id, trigger) {
    var demo = ui.demos[id];
    if (!demo) return;
    if (!dlg) build();
    if (trigger) lastTrigger = trigger;
    dlg.setAttribute('data-demo', id);
    titleEl.textContent = demo.title;
    bodyEl.textContent = '';
    toastEl.textContent = '';
    current = demo.mount(bodyEl, { toast: ui.toast, open: ui.open, close: function () { dlg.close ? dlg.close() : hide(); } });
    if (!dlg.hasAttribute('open')) {
      if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
      document.documentElement.classList.add('ais-lock');
    }
    bodyEl.scrollTop = 0;
    setTimeout(function () { if (current && current.focus) current.focus(); }, 30);
  };

  ui.toast = function (message) {
    if (!toastEl) return;
    var t = el('p', { class: 'ais-toast', text: message });
    toastEl.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 3200);
  };

  function init() {
    document.querySelectorAll('[data-ais-demo]').forEach(function (btn) {
      btn.addEventListener('click', function () { ui.open(btn.getAttribute('data-ais-demo'), btn); });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
