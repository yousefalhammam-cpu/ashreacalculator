'use strict';

const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { createAirCalcServer } = require('../local-static-server');

const APP_PORT = 5512;
const DEBUG_PORT = 9225;
const HOST = '127.0.0.1';
const APP_URL = process.env.AIRCALC_TEST_URL || `http://${HOST}:${APP_PORT}/app/index.html`;
const DIST = path.join(process.cwd(), 'dist');
const REPORT_PATH = path.join(DIST, 'core-ux-e2e-report.json');
const SCREENSHOT_PATH = path.join(DIST, 'core-ux-e2e-dashboard.png');

function requestJson(url, timeoutMs = 1000) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (err) { reject(err); }
      });
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error(`Timeout requesting ${url}`)));
    req.on('error', reject);
  });
}

async function waitForTarget() {
  const deadline = Date.now() + 20000;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const targets = await requestJson(`http://${HOST}:${DEBUG_PORT}/json`);
      const target = targets.find((item) => item.url && item.url.includes('/app/index.html')) || targets[0];
      if (target && target.webSocketDebuggerUrl) return target;
    } catch (err) {
      lastError = err;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw lastError || new Error('Browser target was not available.');
}

function findBrowser() {
  return [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
  ].find((candidate) => fs.existsSync(candidate));
}

function closeBrowser(browser) {
  return new Promise((resolve) => {
    if (!browser || browser.killed) return resolve();
    browser.once('exit', () => resolve());
    browser.kill();
    setTimeout(resolve, 3000);
  });
}

function isBlockingLogError(entry) {
  const text = String((entry && entry.text) || '');
  const url = String((entry && entry.url) || '');
  if (/favicon\.ico/i.test(text) || /favicon\.ico/i.test(url)) return false;
  if (/Failed to load resource/i.test(text) && !/\.(js|css|json|html)(\?|$)/i.test(url)) return false;
  return true;
}

async function withPage(target, callback) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    const pending = new Map();
    let nextId = 0;
    const errors = [];
    const warnings = [];
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('Core UX E2E timed out.'));
    }, 60000);

    function send(method, params) {
      const id = ++nextId;
      ws.send(JSON.stringify({ id, method, params: params || {} }));
      return new Promise((res, rej) => pending.set(id, { res, rej, method }));
    }

    async function evaluate(expression) {
      const msg = await send('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true
      });
      if (msg.result && msg.result.exceptionDetails) {
        const exception = msg.result.exceptionDetails;
        const detail = exception.exception && exception.exception.description
          ? exception.exception.description
          : (exception.text || 'Runtime evaluation failed.');
        throw new Error(detail);
      }
      return msg.result && msg.result.result ? msg.result.result.value : undefined;
    }

    ws.onopen = async () => {
      try {
        await send('Runtime.enable');
        await send('Log.enable');
        await send('Page.enable');
        await send('Emulation.setDeviceMetricsOverride', {
          width: 1440,
          height: 1000,
          deviceScaleFactor: 1,
          mobile: false
        });
        await send('Page.reload', { ignoreCache: true });
        await new Promise((res) => setTimeout(res, 6000));
        const result = await callback({ send, evaluate, errors, warnings });
        clearTimeout(timeout);
        ws.close();
        resolve({ result, errors, warnings });
      } catch (err) {
        clearTimeout(timeout);
        ws.close();
        reject(err);
      }
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && pending.has(msg.id)) {
        const waiter = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) waiter.rej(new Error(`${waiter.method}: ${msg.error.message}`));
        else waiter.res(msg);
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        errors.push(msg.params.exceptionDetails.text || 'Runtime exception');
      }
      if (msg.method === 'Log.entryAdded') {
        const entry = msg.params.entry || {};
        if (entry.level === 'error' && isBlockingLogError(entry)) errors.push(entry.text || 'Log error');
        if (entry.level === 'warning') warnings.push(entry.text || 'Log warning');
      }
    };
    ws.onerror = () => {
      clearTimeout(timeout);
      reject(new Error('WebSocket connection to browser failed.'));
    };
  });
}

async function run() {
  if (typeof WebSocket === 'undefined') throw new Error('Node WebSocket global is unavailable. Use Node 22 or newer.');
  const browserPath = findBrowser();
  if (!browserPath) throw new Error('No supported Edge/Chrome executable was found.');

  fs.mkdirSync(DIST, { recursive: true });
  const server = createAirCalcServer({ host: HOST, port: APP_PORT });
  await new Promise((resolve) => server.listen(APP_PORT, HOST, resolve));
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'aircalc-core-ux-'));
  const browser = spawn(browserPath, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${profile}`,
    APP_URL
  ], { stdio: 'ignore' });

  try {
    const target = await waitForTarget();
    const { result, errors, warnings } = await withPage(target, async (page) => {
      const healthNavigation=await page.evaluate(`(()=>{openDesktopView('tech');AppHvacDesignCopilot.refresh();const b=document.querySelector('.copilot-metric-action[onclick*="airflow"]');if(!b)return false;b.click();const editor=document.getElementById('health-airflow-controls');const ok=!!editor && editor.getBoundingClientRect().height>0;returnToHealthDashboard();openDesktopView('calc');window.scrollTo({top:0,behavior:'instant'});return ok;})()`);
      if(!healthNavigation)throw new Error('Airflow health metric did not open its editor.');
      const inlineControls=await page.evaluate(`(()=>{const p=document.getElementById('health-airflow-controls');const s=p && p.querySelector('select[name="height"]');return !!s && [...s.options].some(o=>o.value==='100') && [...s.options].some(o=>o.value==='500') && !!p.querySelector('select[name="filterType"]');})()`);
      if(!inlineControls)throw new Error('Inline airflow dimension and filter selectors are missing.');
      await new Promise(resolve=>setTimeout(resolve,500));
      const point=await page.evaluate(`(()=>{const b=document.getElementById('topbar-account-btn');const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
      await page.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,x:point.x,y:point.y});
      await page.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,x:point.x,y:point.y});
      const visible=await page.evaluate(`(()=>{const o=document.getElementById('auth-overlay');const r=o.getBoundingClientRect();return !o.classList.contains('hidden') && getComputedStyle(o).display!=='none' && r.width>0 && r.height>0;})()`);
      if(!visible) throw new Error('Real pointer click did not display account dialog.');
      await page.evaluate('closeAuthModal()');
      const state = await page.evaluate(`(async function(){
        function ready(name){ return typeof window[name] === 'function'; }
        localStorage.clear();
        if(typeof lang !== 'undefined') lang = 'en';
        if(ready('applyLang')) applyLang('en');
        if(typeof quoteMode !== 'undefined') quoteMode = 'proj';
        if(ready('ensureProjectSystems')) {
          projectSystems = [normalizeProjectSystem({ id:'sys_e2e', unitType:'split', selectedBtu:18000, qty:1 })];
          saveProjectSystems();
        }
        if(ready('renderProjBlock')) renderProjBlock();
        var capacitySelect = document.querySelector('.project-capacity-control .qi-cap-sel');
        if(!capacitySelect) throw new Error('No project capacity select was rendered.');
        var capacityOptions = Array.prototype.slice.call(capacitySelect.options)
          .filter(function(o){ return /^\\d+$/.test(String(o.value || '')) && Number(o.value) > 0; });
        var equipmentOptions = Array.prototype.slice.call(capacitySelect.options)
          .filter(function(o){ return String(o.value || '').indexOf('equip:') === 0; });
        if(!capacityOptions.length) throw new Error('No numeric standard capacity option in project capacity select.');
        if(equipmentOptions.length) throw new Error('Project capacity select should not show manufacturer equipment options.');
        capacitySelect.value = capacityOptions[0].value;
        capacitySelect.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise(function(resolve){ setTimeout(resolve, 100); });
        var selectedCapacitySystem = projectSystems[0];
        var selectedPerformance = getInstalledEquipmentPerformance(selectedCapacitySystem);
        var selectedCapacity = getProjectCentralSelectedBtu();
        updateProjectSystem('sys_e2e', 'qty', 2);
        await new Promise(function(resolve){ setTimeout(resolve, 100); });
        var qtyCapacity = getProjectCentralSelectedBtu();
        applyProjectSystemManualCapacity('sys_e2e', 24000);
        await new Promise(function(resolve){ setTimeout(resolve, 100); });
        var manual = projectSystems[0];
        openModal();
        var deviceOpen = document.getElementById('overlay').classList.contains('on') && document.querySelectorAll('#cat-grid .cat-item').length > 0;
        var firstDevice = document.querySelector('#cat-grid .cat-item');
        if(firstDevice) firstDevice.click();
        var deviceApplied = Array.isArray(devs) && devs.length > 0 && totalDevBtu() > 0;
        if(typeof lang !== 'undefined') lang = 'ar';
        if(ready('applyLang')) applyLang('ar');
        var arState = {
          lang: document.documentElement.lang,
          dir: document.documentElement.dir,
          nav: (document.getElementById('desktop-nav-dashboard') || {}).textContent || '',
          sidebarRight: getComputedStyle(document.querySelector('.desktop-sidebar')).right
        };
        if(typeof lang !== 'undefined') lang = 'en';
        if(ready('applyLang')) applyLang('en');
        var enState = {
          lang: document.documentElement.lang,
          dir: document.documentElement.dir,
          nav: (document.getElementById('desktop-nav-dashboard') || {}).textContent || '',
          sidebarLeft: getComputedStyle(document.querySelector('.desktop-sidebar')).left
        };
        document.getElementById('topbar-account-btn').click();
        var accountOpen = !document.getElementById('auth-overlay').classList.contains('hidden');
        document.getElementById('auth-tab-create').click();
        var registrationOpen = document.getElementById('auth-fullname-row').style.display !== 'none';
        document.getElementById('auth-primary-btn').click();
        await new Promise(resolve => setTimeout(resolve, 20));
        var validationMessage = document.getElementById('auth-message').textContent;
        document.getElementById('auth-later-btn').click();
        var accountClosed = document.getElementById('auth-overlay').classList.contains('hidden');
        openDesktopView('settings');
        document.getElementById('auth-open-btn').click();
        var settingsAccountOpen = !document.getElementById('auth-overlay').classList.contains('hidden');
        document.getElementById('auth-tab-signin').click();
        document.getElementById('auth-email').value = 'aircalc-diagnostic@example.invalid';
        document.getElementById('auth-password').value = 'diagnostic-only';
        document.getElementById('auth-primary-btn').click();
        await new Promise(resolve => setTimeout(resolve, 6000));
        var firebaseAuthMessage = document.getElementById('auth-message').textContent;
        var firebaseAuthButtonEnabled = !document.getElementById('auth-primary-btn').disabled;
        closeAuthModal();

        // Only the isolated browser profile gets a test identity. No cloud writes occur.
        var originalUser = AppAuth.getCurrentUser;
        AppAuth.getCurrentUser = () => ({uid:'local-e2e', email:'test@example.invalid'});
        hist = [{id:'room-e2e', roomType:'Office', ar:'Office', en:'Office', btu:93482, requiredBtu:93482, mkt:96000, cfm:3392, tr:7.79, area:100, vol:300, roomCount:1}];
        projectSystems = [normalizeProjectSystem({id:'pricing-e2e', unitType:'split', selectedBtu:24000, qty:4})];
        quoteMode = 'proj'; vatOn = true;
        syncQuotationDraftFromEquipment(projectSystems[0]);
        openDesktopView('hist');
        renderQuote();
        function enter(selector, value){
          var field = document.querySelector(selector);
          if(!field) throw Error('Missing pricing field: ' + selector);
          field.focus(); field.value = value;
          field.dispatchEvent(new Event('input', {bubbles:true}));
          field.dispatchEvent(new Event('change', {bubbles:true}));
          field.blur();
        }
        enter('[data-auto-quote-line-key="equipment"] [data-auto-quote-line-field="unitPrice"]', '3400');
        enter('[data-auto-quote-line-key="installation"] [data-auto-quote-line-field="unitPrice"]', '200');
        enter('[data-auto-quote-draft-field="discount"]', '100');
        var pricingTotals = getQuotationDraftTotals(projectSystems[0].quotationDraft);
        var visibleGrand = document.querySelector('[data-auto-quote-summary="grand"]').textContent;
        openDesktopView('tech');renderTechReportFoundation();
        function chooseDuctField(name,value){
          var el=document.querySelector('#health-airflow-controls [name="'+name+'"]');
          if(!el)throw Error('Missing duct control: '+name);
          el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));
        }
        chooseDuctField('width','450');
        if(document.querySelector('#health-airflow-controls [name="width"]').value!=='450')throw Error('Width was lost before height selection');
        chooseDuctField('height','300');chooseDuctField('retWidth','450');chooseDuctField('retHeight','300');
        chooseDuctField('filterType','other');chooseDuctField('fanType','centrifugal_backward');
        chooseDuctField('drop','100');chooseDuctField('operating','200');chooseDuctField('shutoff','500');
        var ductReview=getDuctFilterReviewState(),copilotSnapshot=AirCalcCopilotStateAdapter.readProjectSnapshot();
        if(!ductReview.estimated || copilotSnapshot.totals.selectedCfm!==ductReview.effectiveCfm)throw Error('Filtered CFM is not synchronized with health snapshot');
        if(!document.querySelector('#quote-project-context [data-duct-filter-summary]'))throw Error('Quotation is missing duct/filter selection');
        var invoice=buildInvoiceHTML(),technical=buildPage2(invCommon());
        if(!invoice.includes('450 × 300 mm') || !invoice.includes('data-duct-filter-summary'))throw Error('Invoice export is missing duct dimensions');
        if(!technical.includes('450 × 300 mm') || !technical.includes('data-duct-filter-summary'))throw Error('Technical report export is missing duct dimensions');
        if(getQuotationDraftTotals(projectSystems[0].quotationDraft).grand!==pricingTotals.grand)throw Error('Duct selection changed commercial prices');
        document.getElementById('desktop-project').value = 'Isolated acceptance project';
        syncDesktopProjectFields('desktop');
        saveCurrentProject({silentNavigate:true, skipCloudSync:true});
        var saved = AppProjects.getProjects().find(p => p.name === 'Isolated acceptance project');
        if(!saved) throw Error('Project save did not create a record');
        projectSystems = [];
        AppProjects.loadProject(saved.id);
        var restoredTotals = getQuotationDraftTotals(projectSystems[0].quotationDraft);
        if(projState.ductDimensions.sup.w!==450 || projState.ductFilter.type!=='other')throw Error('Duct/filter selection was not restored with project');
        openDesktopView('projects');
        renderProjects();
        var projectVisible = document.body.textContent.includes('Isolated acceptance project');
        var scenarios = generateHvacDesignScenarios({requiredCapacityBtuH:93482, requiredAirflowCfm:3392, roomCount:4});
        AppAuth.getCurrentUser = originalUser;
        return {
          accountOpen, registrationOpen, validationMessage, accountClosed, settingsAccountOpen,
          firebaseAuthMessage, firebaseAuthButtonEnabled,
          pricingTotals, restoredTotals, visibleGrand, projectVisible, scenarioCount: scenarios.length,
          capacityOptionCount: capacityOptions.length,
          equipmentOptionCount: equipmentOptions.length,
          selectedCapacityMode: selectedCapacitySystem.selectionMode,
          selectedCapacityHasSnapshot: !!(selectedCapacitySystem.equipmentSnapshot && selectedCapacitySystem.equipmentSnapshot.record),
          selectedEquipmentId: selectedCapacitySystem.equipmentId || selectedCapacitySystem.equipmentDatabaseId || '',
          selectedManufacturer: selectedCapacitySystem.selectedManufacturer || '',
          selectedModel: selectedCapacitySystem.selectedModel || '',
          unitCapacity: selectedPerformance.unitCapacityBtuH,
          unitAirflow: selectedPerformance.unitAirflowCfm,
          selectedCapacity: selectedCapacity,
          qtyCapacity: qtyCapacity,
          manualMode: manual.selectionMode,
          manualCapacity: manual.manualCapacityBtuH,
          deviceOpen: deviceOpen,
          deviceApplied: deviceApplied,
          arState: arState,
          enState: enState
        };
      })()`);

      const shot = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      fs.writeFileSync(SCREENSHOT_PATH, Buffer.from(shot.result.data, 'base64'));
      return state;
    });

    const failures = [];
    if (!result.accountOpen || !result.registrationOpen || !result.validationMessage || !result.accountClosed || !result.settingsAccountOpen) failures.push('Account modal or settings account flow failed.');
    if (!result.firebaseAuthMessage || !/incorrect|wrong|invalid|غير صحيح|غير صحيحة/i.test(result.firebaseAuthMessage)) failures.push(`Firebase sign-in did not return a credential error: ${result.firebaseAuthMessage || '(empty)'}`);
    if (!result.firebaseAuthButtonEnabled) failures.push('Firebase sign-in button remained disabled.');
    if (!result.projectVisible) failures.push('Saved project not visible.');
    if (result.pricingTotals.grand !== 15755 || result.restoredTotals.grand !== 15755 || !result.visibleGrand.includes('15,755')) failures.push('Pricing totals or save/reopen persistence failed.');
    if (result.scenarioCount !== 3) failures.push('Expected three project-level scenarios.');
    if (errors.length) failures.push(`Console errors: ${errors.join(' | ')}`);
    if (result.equipmentOptionCount !== 0) failures.push('Project capacity dropdown still exposes manufacturer equipment options.');
    if (result.selectedCapacityMode !== 'manual') failures.push('Numeric capacity selection did not persist selectionMode=manual.');
    if (result.selectedCapacityHasSnapshot) failures.push('Numeric capacity selection should not bind an equipment snapshot.');
    if (result.selectedEquipmentId || result.selectedManufacturer || result.selectedModel) failures.push('Numeric capacity selection should not persist manufacturer/model fields.');
    if (!result.unitCapacity || result.selectedCapacity !== result.unitCapacity) failures.push('Selected numeric unit capacity did not enter project calculation.');
    if (result.qtyCapacity !== result.selectedCapacity * 2) failures.push('Quantity change did not recalculate installed numeric capacity.');
    if (result.manualMode !== 'manual' || result.manualCapacity !== 24000) failures.push('Manual capacity fallback did not persist correctly.');
    if (!result.deviceOpen || !result.deviceApplied) failures.push('Device picker did not open and apply a device load.');
    const enState = result.enState || {};
    const arState = result.arState || {};
    if (enState.lang !== 'en' || enState.dir !== 'ltr' || enState.nav !== 'Project design') failures.push('English language/sidebar state is incomplete.');
    if (arState.lang !== 'ar' || arState.dir !== 'rtl') failures.push('Arabic language/sidebar state is incomplete.');

    const report = {
      name: 'AirCalc Pro core UX E2E',
      generatedAt: new Date().toISOString(),
      url: APP_URL,
      status: failures.length ? 'failed' : 'passed',
      result,
      errors,
      warnings,
      screenshot: SCREENSHOT_PATH,
      failures
    };
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
    if (failures.length) {
      failures.forEach((failure) => console.error(`- ${failure}`));
      process.exit(1);
    }
    console.log(`Core UX E2E passed for ${APP_URL}`);
    console.log(`Screenshot: ${SCREENSHOT_PATH}`);
  } finally {
    await closeBrowser(browser);
    server.close();
    try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 250 }); } catch (err) {
      console.warn(`Browser profile cleanup warning: ${err.message || err}`);
    }
  }
}

run().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
