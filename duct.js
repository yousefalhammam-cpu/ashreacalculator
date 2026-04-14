// ── AirCalc Pro — core/helpers.js ───────────────────────────────────────
// Shared utility functions exposed on window.AppHelpers.
// These wrap (and will eventually replace) the inline helpers in app.js.

window.AppHelpers = {

  // ── DOM ──────────────────────────────────────────────────────────────
  /** Get element by id */
  G: function(id) {
    return document.getElementById(id);
  },

  // ── Formatting ───────────────────────────────────────────────────────
  /** Format number as 2-decimal money string */
  money: function(v) {
    return (Math.round((v || 0) * 100) / 100).toFixed(2);
  },

  /** Watts → BTU/h  (1 W = 3.41214 BTU/h) */
  w2b: function(w) {
    return Math.round((w || 0) * 3.41214);
  },

  /** Cubic metres → cubic feet */
  m3toft3: function(m) {
    return (m || 0) * 35.3147;
  },

  // ── UI feedback ──────────────────────────────────────────────────────
  /** Show a temporary toast notification */
  toast: function(msg) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(AppHelpers._toastTimer);
    AppHelpers._toastTimer = setTimeout(function() {
      el.classList.remove('show');
    }, 3000);
  },
  _toastTimer: null,

  /** Animate-update a metric display element */
  flash: function(id, value) {
    var el = document.getElementById(id);
    if (!el) return;
    el.classList.add('fade');
    setTimeout(function() {
      el.textContent = value;
      el.classList.remove('fade');
    }, 150);
  },

  // ── Data safety ───────────────────────────────────────────────────────
  /** Safe JSON parse with fallback */
  safeJSONParse: function(value, fallback) {
    try {
      var parsed = JSON.parse(value);
      return (parsed !== null && parsed !== undefined) ? parsed : fallback;
    } catch(e) {
      return fallback;
    }
  },

  /**
   * Validate that loaded data.json has all required keys.
   * Throws an Error with a descriptive message if anything is missing.
   */
  validateAppData: function(data) {
    var required = [
      'ROOMS',
      'DEVS',
      'AC_CATALOG',
      'UT_TO_CAT',
      'UT_LABELS_AR',
      'UT_LABELS_EN'
    ];
    if (!data || typeof data !== 'object') {
      throw new Error('data.json is empty or not a valid JSON object.');
    }
    var missing = required.filter(function(key) {
      return !(key in data);
    });
    if (missing.length > 0) {
      throw new Error('data.json is missing required keys: ' + missing.join(', '));
    }
    if (typeof data.ROOMS !== 'object' || Array.isArray(data.ROOMS)) {
      throw new Error('data.json: ROOMS must be an object (key→room).');
    }
    if (!Array.isArray(data.DEVS)) {
      throw new Error('data.json: DEVS must be an array.');
    }
    if (Object.keys(data.ROOMS).length === 0) {
      throw new Error('data.json: ROOMS is empty.');
    }
    if (data.DEVS.length === 0) {
      throw new Error('data.json: DEVS is empty.');
    }
    return true;
  }

};

console.log('[AirCalc] AppHelpers initialised');
