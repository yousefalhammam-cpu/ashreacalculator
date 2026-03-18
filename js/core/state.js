// ── AirCalc Pro — core/state.js ──────────────────────────────────────────
// Centralised app state. All values here mirror the defaults in app.js.
// This is a READ reference for new code; existing app.js vars are still
// the live source of truth until the full migration is complete.

window.AppState = {

  // ── Language & Theme ────────────────────────────────────────────────
  lang:       'ar',       // 'ar' | 'en'
  theme:      'dark',     // 'dark' | 'light'

  // ── Room / Device state ─────────────────────────────────────────────
  curRoom:    null,       // current ROOMS entry object
  devs:       [],         // [{id, qty}]

  // ── History & Quotation ─────────────────────────────────────────────
  hist:       [],         // array of saved room calc records
  qlines:     [],         // [{qty, up, unitType, selectedBtu}] — parallel to hist
  editIdx:    -1,         // index of record being edited (-1 = new)

  // ── Quotation settings ───────────────────────────────────────────────
  vatOn:      true,
  instPct:    10,
  qsValidity: 14,
  qsNotes:    '',

  // ── Quote mode ───────────────────────────────────────────────────────
  quoteMode:  'room',     // 'room' | 'proj'

  // ── Bundle mode ──────────────────────────────────────────────────────
  bundleOn:   false,
  bundleConfig: {
    unitType:    'package',
    selectedBtu: 0,
    qty:         1,
    unitPrice:   0,
    designBasis: 'required',
    supplyFpm:   1000,
    returnFpm:   800,
    cfmPerTr:    400
  },

  // ── Project mode state ───────────────────────────────────────────────
  projState: {
    sysType: 'split',
    selBtu:  0,
    qty:     1,
    up:      0
  },

  // ── Data tables (populated after data.json fetch) ────────────────────
  data: {
    ROOMS:        {},
    DEVS:         [],
    AC_CATALOG:   {},
    UT_TO_CAT:    {},
    UT_LABELS_AR: {},
    UT_LABELS_EN: {},
    DUCT_WIDTHS:  [150,200,250,300,350,400,450,500,600,700,800,900,1000,1100,1200],
    DUCT_HEIGHTS: [100,150,200,250,300,350,400,450,500,600,700,800]
  }
};

// Sync helper — call after any state change to keep legacy vars aligned
// (Used transitionally until app.js vars are replaced)
window.AppState.syncToLegacy = function() {
  if (typeof lang       !== 'undefined') lang       = AppState.lang;
  if (typeof _theme     !== 'undefined') _theme     = AppState.theme;
  if (typeof curRoom    !== 'undefined') curRoom    = AppState.curRoom;
  if (typeof devs       !== 'undefined') devs       = AppState.devs;
  if (typeof hist       !== 'undefined') hist       = AppState.hist;
  if (typeof qlines     !== 'undefined') qlines     = AppState.qlines;
  if (typeof editIdx    !== 'undefined') editIdx    = AppState.editIdx;
  if (typeof vatOn      !== 'undefined') vatOn      = AppState.vatOn;
  if (typeof instPct    !== 'undefined') instPct    = AppState.instPct;
  if (typeof qsValidity !== 'undefined') qsValidity = AppState.qsValidity;
  if (typeof qsNotes    !== 'undefined') qsNotes    = AppState.qsNotes;
  if (typeof quoteMode  !== 'undefined') quoteMode  = AppState.quoteMode;
  if (typeof bundleOn   !== 'undefined') bundleOn   = AppState.bundleOn;
};

console.log('[AirCalc] AppState initialised');
