/**
 * plan.js — AirCalc plan management module
 * localStorage key: aircalc_plan
 * Default plan: free
 */

const PLAN_STORAGE_KEY = 'aircalc_plan';

const FEATURE_ACCESS = {
  free: {
    basicCalculations: true,
    exportCSV:         false,
    exportPDF:         false,
    unlimitedHistory:  false,
    multiCurrency:     false,
    advancedCharts:    false,
    apiAccess:         false,
    teamSharing:       false,
    prioritySupport:   false,
    customBranding:    false,
  },
  pro: {
    basicCalculations: true,
    exportCSV:         true,
    exportPDF:         true,
    unlimitedHistory:  true,
    multiCurrency:     true,
    advancedCharts:    true,
    apiAccess:         true,
    teamSharing:       false,
    prioritySupport:   true,
    customBranding:    false,
  },
  team: {
    basicCalculations: true,
    exportCSV:         true,
    exportPDF:         true,
    unlimitedHistory:  true,
    multiCurrency:     true,
    advancedCharts:    true,
    apiAccess:         true,
    teamSharing:       true,
    prioritySupport:   true,
    customBranding:    true,
  },
};

// Track selected billing period inside upgrade sheet
let _selectedPriceType = 'annual';

// ─── Core getters / setters ───────────────────────────────────────────────────

/**
 * Returns the user's current plan ('free' | 'pro' | 'team').
 */
export function getCurrentPlan() {
  try {
    const stored = localStorage.getItem(PLAN_STORAGE_KEY);
    if (stored && FEATURE_ACCESS[stored]) return stored;
  } catch (e) {
    console.warn('[plan] localStorage unavailable, defaulting to free', e);
  }
  return 'free';
}

/**
 * Persists the current plan and refreshes all plan-aware UI.
 * @param {'free'|'pro'|'team'} plan
 */
export function setCurrentPlan(plan) {
  if (!FEATURE_ACCESS[plan]) {
    console.error(`[plan] Unknown plan "${plan}". Valid values: ${Object.keys(FEATURE_ACCESS).join(', ')}`);
    return;
  }
  try {
    localStorage.setItem(PLAN_STORAGE_KEY, plan);
  } catch (e) {
    console.warn('[plan] Could not persist plan to localStorage', e);
  }
  updatePlanUI();
  document.dispatchEvent(new CustomEvent('planChanged', { detail: { plan } }));
}

// ─── Feature access helpers ───────────────────────────────────────────────────

/**
 * Returns the full feature-access map for a given plan.
 * @param {'free'|'pro'|'team'} plan
 * @returns {Object}
 */
export function getFeatureAccess(plan) {
  return FEATURE_ACCESS[plan] ?? FEATURE_ACCESS['free'];
}

/**
 * Returns true if the user's current plan includes the given feature.
 * @param {string} featureKey
 * @returns {boolean}
 */
export function hasAccess(featureKey) {
  const plan    = getCurrentPlan();
  const access  = getFeatureAccess(plan);
  return access[featureKey] === true;
}

/**
 * Guards a feature gate. If the user doesn't have access, opens the upgrade
 * sheet (with an optional custom message) and throws to halt execution.
 * @param {string} featureKey
 * @param {string} [message]
 */
export function requireFeature(featureKey, message) {
  if (hasAccess(featureKey)) return;

  const defaultMsg = `This feature requires a higher plan. Upgrade to unlock "${featureKey}".`;
  const displayMsg = message || defaultMsg;

  // Surface the message in the upgrade sheet subtitle if the element exists
  const subtitle = document.querySelector('#upgrade-sheet .upgrade-subtitle');
  if (subtitle) subtitle.textContent = displayMsg;

  openUpgradeSheet();
  throw new Error(`[plan] Access denied for feature "${featureKey}": ${displayMsg}`);
}

// ─── UI helpers ──────────────────────────────────────────────────────────────

/**
 * Refreshes every plan-aware element in the DOM:
 *  - [data-plan-badge]          → text content set to current plan label
 *  - [data-requires-feature]    → 'locked' class toggled based on access
 *  - [data-plan-visible]        → element shown only when on the named plan
 */
export function updatePlanUI() {
  const plan = getCurrentPlan();

  // Update plan badge elements
  document.querySelectorAll('[data-plan-badge]').forEach(el => {
    el.textContent = plan.charAt(0).toUpperCase() + plan.slice(1);
    el.dataset.plan = plan;
  });

  // Toggle locked state on feature-gated elements
  document.querySelectorAll('[data-requires-feature]').forEach(el => {
    const feature = el.dataset.requiresFeature;
    const locked  = !hasAccess(feature);
    el.classList.toggle('locked', locked);
    el.setAttribute('aria-disabled', String(locked));
  });

  // Show / hide plan-specific elements
  document.querySelectorAll('[data-plan-visible]').forEach(el => {
    const visibleFor = el.dataset.planVisible.split(',').map(s => s.trim());
    el.hidden = !visibleFor.includes(plan);
  });

  // Mark active plan pill inside upgrade sheet (if already open)
  document.querySelectorAll('[data-plan-option]').forEach(el => {
    el.classList.toggle('active', el.dataset.planOption === plan);
  });
}

// ─── Upgrade sheet ────────────────────────────────────────────────────────────

/**
 * Opens the upgrade bottom-sheet / modal.
 */
export function openUpgradeSheet() {
  const sheet = document.getElementById('upgrade-sheet');
  if (!sheet) {
    console.warn('[plan] #upgrade-sheet element not found in DOM');
    return;
  }
  sheet.classList.add('open');
  sheet.setAttribute('aria-hidden', 'false');
  document.body.classList.add('sheet-open');

  // Restore selected pill state
  selectPricePill(_selectedPriceType);

  // Trap focus inside sheet for accessibility
  const firstFocusable = sheet.querySelector('button, [href], input, [tabindex]:not([tabindex="-1"])');
  if (firstFocusable) firstFocusable.focus();
}

/**
 * Closes the upgrade sheet.
 * Accepts an optional Event so it can be used directly as an event listener.
 * Clicking on the backdrop (outside the sheet card) also closes the sheet.
 * @param {Event} [event]
 */
export function closeUpgradeSheet(event) {
  // If triggered by a click, only close when clicking the backdrop, not the card
  if (event && event.target) {
    const card = document.querySelector('#upgrade-sheet .sheet-card');
    if (card && card.contains(event.target) && event.target !== event.currentTarget) {
      return;
    }
  }

  const sheet = document.getElementById('upgrade-sheet');
  if (!sheet) return;

  sheet.classList.remove('open');
  sheet.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('sheet-open');
}

// ─── Pricing pill selection ───────────────────────────────────────────────────

/**
 * Highlights the chosen billing-period pill ('monthly' | 'annual') and
 * updates any price display elements.
 * @param {'monthly'|'annual'} type
 */
export function selectPricePill(type) {
  _selectedPriceType = type;

  document.querySelectorAll('[data-price-pill]').forEach(el => {
    el.classList.toggle('selected', el.dataset.pricePill === type);
  });

  // Update price display elements if present
  document.querySelectorAll('[data-price-display]').forEach(el => {
    const monthly = el.dataset.priceMonthly;
    const annual  = el.dataset.priceAnnual;
    if (type === 'annual' && annual)  el.textContent = annual;
    if (type === 'monthly' && monthly) el.textContent = monthly;
  });

  // Update savings badge visibility
  const savingsBadge = document.querySelector('.savings-badge');
  if (savingsBadge) savingsBadge.hidden = (type !== 'annual');
}

// ─── Upgrade action ───────────────────────────────────────────────────────────

/**
 * Handles the "Upgrade to Pro" CTA inside the upgrade sheet.
 * Swap this body for a real payment/subscription flow as needed.
 */
export function upgradeToPro() {
  const btn = document.querySelector('#upgrade-sheet .upgrade-cta-btn');

  const SIMULATED_NETWORK_MS = 900;

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Processing…';
  }

  // ── Replace the setTimeout block below with your real payment integration ──
  setTimeout(() => {
    setCurrentPlan('pro');
    closeUpgradeSheet();

    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Upgrade to Pro';
    }

    // Show a lightweight confirmation
    const confirmation = document.getElementById('upgrade-confirmation');
    if (confirmation) {
      confirmation.hidden = false;
      setTimeout(() => { confirmation.hidden = true; }, 4000);
    } else {
      console.info('[plan] Successfully upgraded to Pro.');
    }
  }, SIMULATED_NETWORK_MS);
}

// ─── Auto-init ────────────────────────────────────────────────────────────────

/**
 * Runs once the DOM is ready: initialises UI and wires up keyboard / backdrop
 * close behaviour for the upgrade sheet.
 */
function _init() {
  updatePlanUI();

  // Close sheet on Escape key
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeUpgradeSheet();
  });

  // Close sheet when clicking the backdrop
  const sheet = document.getElementById('upgrade-sheet');
  if (sheet) sheet.addEventListener('click', closeUpgradeSheet);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _init);
} else {
  _init();
}