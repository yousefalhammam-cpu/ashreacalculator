The current modules/plan.js exists, but it is incompatible with my app and breaks the Free/Pro switching.

Problems found:
1. plan.js uses ES module syntax like:
   export function ...
   but my index.html loads it as a normal script:
   <script src="./modules/plan.js"></script>
   so this causes a script error.

2. plan.js uses the wrong plan types:
   free / pro / team
   but my app UI uses:
   free / pro / monthly / yearly / lifetime

3. plan.js uses wrong feature keys that do not match my app, such as:
   advancedCharts, apiAccess, teamSharing, prioritySupport
   but my real app needs:
   exportCSV
   exportPDF
   techReport
   unlimitedProjects
   projectMode
   ductSizing
   espCalc

4. plan.js expects #upgrade-sheet
   but my actual index.html uses #upgrade-overlay

Please rewrite modules/plan.js completely so it works with my current app.

Requirements:
- Do NOT use export syntax
- Use plain script style with window functions
- Implement:
  - getCurrentPlan()
  - setCurrentPlan(plan)
  - getFeatureAccess(plan)
  - hasAccess(featureKey)
  - requireFeature(featureKey, message)
  - updatePlanUI()
  - openUpgradeSheet()
  - closeUpgradeSheet(event)
  - selectPricePill(type)
  - upgradeToPro()

Use localStorage key:
- aircalc_plan

Default plan:
- free

Supported plans:
- free
- pro
- monthly
- yearly
- lifetime

Feature rules:
Free:
- exportCSV = true
- exportPDF = false
- techReport = false
- unlimitedProjects = false
- projectMode = false
- ductSizing = false
- espCalc = false

Paid:
- exportCSV = true
- exportPDF = true
- techReport = true
- unlimitedProjects = true
- projectMode = true
- ductSizing = true
- espCalc = true

Use my existing HTML ids:
- #plan-status-pill
- #ptg-live-badge
- #header-plan-badge
- #tbtn-free
- #tbtn-pro
- #tbtn-monthly
- #tbtn-yearly
- #ptg-desc
- #ptg-features
- #btn-pdf
- #btn-techpdf
- #mode-btn-proj
- #upgrade-overlay
- #pp-lifetime
- #pp-yearly
- #pp-monthly

Also:
- update the UI correctly
- make free users see locked premium buttons
- allow switching plans from settings test buttons
- use the existing toast if available
- keep current app behavior intact

Return full final code for modules/plan.js only.
No pseudo-code.