// ── AirCalc Pro — modules/devices.js ─────────────────────────────────────
// Owns: device list rendering, qty changes, deletion, modal grid building
// Strategy: shadow extract — defines window.AppDevices with clean functions,
//   then re-exposes them on window for backward HTML handler compatibility.
//   app.js versions are overridden by these after this file loads (sync).
//
// Depends on at call-time (live globals from app.js):
//   devs, DEVS, lang, curRoom, G, w2b, t, toast, renderDevs

(function () {
  'use strict';

  // ── Safe accessors for live app.js globals ──────────────────────────────
  function G(id)   { return document.getElementById(id); }
  function _devs() { return typeof devs !== 'undefined' ? devs : []; }
  function _DEVS() { return typeof DEVS !== 'undefined' ? DEVS : []; }
  function _lang() { return typeof lang !== 'undefined' ? lang : 'ar'; }
  function _curRoom() { return typeof curRoom !== 'undefined' ? curRoom : null; }
  function _w2b(w) { return Math.round((w || 0) * 3.412); }
  function _t(k)   {
    if (window.AppI18n) return window.AppI18n.t(k);
    if (typeof t === 'function') return t(k);
    return k;
  }
  function _toast(msg) {
    if (window.AppHelpers) { window.AppHelpers.toast(msg); return; }
    if (typeof toast === 'function') toast(msg);
  }

  // ── totalDevBtu ──────────────────────────────────────────────────────────
  function totalDevBtu() {
    var d = _devs(), D = _DEVS();
    return d.reduce(function (s, item) {
      var c = D.filter(function (x) { return x.id === item.id; })[0];
      return s + (c ? _w2b(c.w) * item.qty : 0);
    }, 0);
  }

  // ── renderDevs ───────────────────────────────────────────────────────────
  function renderDevs() {
    var list = G('dev-list');
    if (!list) return;
    list.innerHTML = '';
    var d = _devs(), D = _DEVS(), l = _lang();

    if (!d.length) {
      var em = document.createElement('div');
      em.className = 'dev-empty';
      em.textContent = _t('dempty');
      list.appendChild(em);
      var totEl = G('dev-total');
      if (totEl) totEl.style.display = 'none';
      return;
    }

    d.forEach(function (item) {
      var c = D.filter(function (x) { return x.id === item.id; })[0];
      if (!c) return;
      var name = l === 'ar' ? c.ar : c.en;
      var btu  = _w2b(c.w) * item.qty;
      var row  = document.createElement('div');
      row.className = 'dev-row';
      row.innerHTML =
        '<div class="dev-ico">' + c.e + '</div>' +
        '<div class="dev-info">' +
          '<div class="dev-name">' + name + '</div>' +
          '<div class="dev-watt">' + c.w + 'W × ' + item.qty + ' = ' +
            (c.w * item.qty).toLocaleString() + 'W</div>' +
        '</div>' +
        '<div class="dev-qty">' +
          '<div class="qbtn" onclick="chgQty(\'' + item.id + '\',-1)">−</div>' +
          '<div class="qnum">' + item.qty + '</div>' +
          '<div class="qbtn" onclick="chgQty(\'' + item.id + '\',1)">+</div>' +
        '</div>' +
        '<div class="dev-btu">' + btu.toLocaleString() + ' BTU/h</div>' +
        '<div class="dev-del" onclick="delDev(\'' + item.id + '\')">🗑</div>';
      list.appendChild(row);
    });

    var totEl2 = G('dev-total');
    if (totEl2) totEl2.style.display = 'flex';
    var valEl = G('val-dtot');
    if (valEl) valEl.textContent = totalDevBtu().toLocaleString() + ' BTU/h';
  }

  // ── chgQty ────────────────────────────────────────────────────────────────
  function chgQty(id, delta) {
    var d = _devs();
    for (var i = 0; i < d.length; i++) {
      if (d[i].id === id) {
        d[i].qty += delta;
        if (d[i].qty <= 0) d.splice(i, 1);
        break;
      }
    }
    renderDevs();
  }

  // ── delDev ────────────────────────────────────────────────────────────────
  function delDev(id) {
    if (typeof devs !== 'undefined') {
      devs = devs.filter(function (x) { return x.id !== id; });
    }
    renderDevs();
  }

  // ── Modal: group labels ───────────────────────────────────────────────────
  var gLabel = {
    office:  { ar: '🏢 مكتبي', en: '🏢 Office' },
    light:   { ar: '💡 إنارة', en: '💡 Lighting' },
    home:    { ar: '🏠 منزلي', en: '🏠 Domestic' },
    health:  { ar: '🏥 رعاية صحية', en: '🏥 Healthcare' },
    medical: { ar: '🩺 أجهزة طبية', en: '🩺 Medical Equipment' },
    lab:     { ar: '🧪 أجهزة مختبر', en: '🧪 Laboratory Equipment' },
    support: { ar: '🧰 دعم سريري', en: '🧰 Clinical Support' }
  };

  function allowedGroups() {
    var r = _curRoom();
    if (!r) return ['office', 'light', 'home'];
    if (r.cat === 'healthcare') return ['medical', 'lab', 'support', 'health', 'light', 'office'];
    if (r.cat === 'home')       return ['home', 'light', 'office'];
    return ['office', 'light', 'home'];
  }

  function recommendedIds() {
    if (typeof getRecommendedEquipmentIds === 'function') {
      return getRecommendedEquipmentIds(_curRoom()) || [];
    }
    return [];
  }

  // ── buildGrid ─────────────────────────────────────────────────────────────
  function buildGrid(grp) {
    var grid = G('cat-grid');
    if (!grid) return;
    grid.innerHTML = '';
    var D = _DEVS(), l = _lang();
    var ag = allowedGroups();
    var groups = (grp && ag.indexOf(grp) !== -1) ? [grp] : ag;

    var recIds = recommendedIds();
    if (!grp && recIds.length) {
      var recItems = D.filter(function (d) { return recIds.indexOf(d.id) !== -1; });
      if (recItems.length) {
        var recHdr = document.createElement('div');
        recHdr.className = 'cat-hdr';
        recHdr.textContent = l === 'ar' ? '⭐ أجهزة مقترحة لهذه الغرفة' : '⭐ Recommended for this room';
        grid.appendChild(recHdr);
        recItems.forEach(function (d) {
          var wl = d.w >= 1000 ? (d.w / 1000).toFixed(1) + 'kW' : d.w + 'W';
          var card = document.createElement('div');
          card.className = 'cat-item';
          card.innerHTML =
            '<div class="cat-ico">' + d.e + '</div>' +
            '<div class="cat-name">' + (l === 'ar' ? d.ar : d.en) + '</div>' +
            '<div class="cat-w">' + wl + '</div>' +
            '<div class="cat-btu">' + _w2b(d.w).toLocaleString() + ' BTU/h</div>';
          (function (did, dname) {
            card.onclick = function () {
              var found = false;
              var d2 = _devs();
              for (var i = 0; i < d2.length; i++) {
                if (d2[i].id === did) { d2[i].qty++; found = true; break; }
              }
              if (!found) {
                if (typeof devs !== 'undefined') devs.push({ id: did, qty: 1 });
              }
              if (typeof closeModal === 'function') closeModal();
              renderDevs();
              _toast('✅ ' + dname + ' +1');
            };
          })(d.id, l === 'ar' ? d.ar : d.en);
          grid.appendChild(card);
        });
      }
    }

    groups.forEach(function (gk) {
      var items = D.filter(function (d) { return d.g === gk; });
      if (!items.length) return;

      var hdr = document.createElement('div');
      hdr.className = 'cat-hdr';
      hdr.textContent = gLabel[gk][l];
      grid.appendChild(hdr);

      items.forEach(function (d) {
        var wl   = d.w >= 1000 ? (d.w / 1000).toFixed(1) + 'kW' : d.w + 'W';
        var card = document.createElement('div');
        card.className = 'cat-item';
        card.innerHTML =
          '<div class="cat-ico">' + d.e + '</div>' +
          '<div class="cat-name">' + (l === 'ar' ? d.ar : d.en) + '</div>' +
          '<div class="cat-w">' + wl + '</div>' +
          '<div class="cat-btu">' + _w2b(d.w).toLocaleString() + ' BTU/h</div>';

        (function (did, dname) {
          card.onclick = function () {
            var found = false;
            var d2 = _devs();
            for (var i = 0; i < d2.length; i++) {
              if (d2[i].id === did) { d2[i].qty++; found = true; break; }
            }
            if (!found) {
              if (typeof devs !== 'undefined') devs.push({ id: did, qty: 1 });
            }
            if (typeof closeModal === 'function') closeModal();
            renderDevs();
            _toast('✅ ' + dname + ' +1');
          };
        })(d.id, l === 'ar' ? d.ar : d.en);

        grid.appendChild(card);
      });
    });
  }

  // ── openModal / closeModal / overlayClick / filterTab ────────────────────
  // These are already in app.js but we provide them here for completeness.
  // app.js versions will remain; these are additive shadow copies.
  function openModal() {
    buildGrid(null);
    document.querySelectorAll('.ftab').forEach(function (tab, i) {
      tab.className = 'ftab' + (i === 0 ? ' on' : '');
    });
    var ov = G('overlay');
    if (ov) ov.classList.add('on');
  }

  function closeModal() {
    var ov = G('overlay');
    if (ov) ov.classList.remove('on');
  }

  function overlayClick(e) {
    if (e.target === G('overlay')) closeModal();
  }

  function filterTab(el, grp) {
    document.querySelectorAll('.ftab').forEach(function (t) { t.className = 'ftab'; });
    el.className = 'ftab on';
    buildGrid(grp);
  }

  // ── Expose namespace ──────────────────────────────────────────────────────
  window.AppDevices = {
    totalDevBtu:  totalDevBtu,
    renderDevs:   renderDevs,
    chgQty:       chgQty,
    delDev:       delDev,
    buildGrid:    buildGrid,
    openModal:    openModal,
    closeModal:   closeModal,
    overlayClick: overlayClick,
    filterTab:    filterTab,
    allowedGroups: allowedGroups
  };

  // ── Backward-compatibility bindings for inline HTML handlers ─────────────
  // app.js defines these too; the last one to run wins at runtime.
  // Since app.js loads after (defer), app.js versions will be the live ones.
  // These are kept as fallback if app.js is ever thinned.
  window.chgQty       = chgQty;
  window.delDev       = delDev;
  window.buildGrid    = buildGrid;
  window.filterTab    = filterTab;

  console.log('[AirCalc] AppDevices initialised');
})();
