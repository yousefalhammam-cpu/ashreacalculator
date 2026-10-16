'use strict';

const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { createAirCalcServer } = require('../local-static-server');

const APP_PORT = 5510;
const DEBUG_PORT = 9223;
const HOST = '127.0.0.1';
const APP_URL = `http://${HOST}:${APP_PORT}/app/index.html`;
const REPORT_PATH = path.join(process.cwd(), 'dist', 'browser-smoke-report.json');

function requestJson(url, timeoutMs = 1000) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (err) {
          reject(err);
        }
      });
    });
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`Timeout requesting ${url}`));
    });
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
  const candidates = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
  ];

  return candidates.find((candidate) => fs.existsSync(candidate));
}

function send(ws, method, params) {
  send.nextId = (send.nextId || 0) + 1;
  const id = send.nextId;
  ws.send(JSON.stringify({ id, method, params: params || {} }));
  return id;
}

function isBlockingLogError(entry) {
  const text = String((entry && entry.text) || '');
  const url = String((entry && entry.url) || '');

  if (/favicon\.ico/i.test(text) || /favicon\.ico/i.test(url)) return false;
  if (/Failed to load resource/i.test(text) && !/\.(js|css|json|html)(\?|$)/i.test(url)) return false;

  return true;
}

function closeBrowser(browser) {
  return new Promise((resolve) => {
    if (!browser || browser.killed) return resolve();
    browser.once('exit', () => resolve());
    browser.kill();
    setTimeout(resolve, 3000);
  });
}

async function run() {
  if (typeof WebSocket === 'undefined') {
    throw new Error('Node WebSocket global is unavailable. Use Node 22 or newer.');
  }

  const browserPath = findBrowser();
  if (!browserPath) {
    throw new Error('No supported Edge/Chrome executable was found.');
  }

  const server = createAirCalcServer({ host: HOST, port: APP_PORT });
  await new Promise((resolve) => server.listen(APP_PORT, HOST, resolve));

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'aircalc-browser-smoke-'));
  const browser = spawn(browserPath, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${profile}`,
    APP_URL
  ], { stdio: 'ignore' });

  const errors = [];
  const warnings = [];
  let status = 'failed';

  try {
    const target = await waitForTarget();
    await new Promise((resolve, reject) => {
      const ws = new WebSocket(target.webSocketDebuggerUrl);
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('Browser smoke test timed out.'));
      }, 15000);

      ws.onopen = () => {
        send(ws, 'Runtime.enable');
        send(ws, 'Log.enable');
        send(ws, 'Page.enable');
        send(ws, 'Page.reload', { ignoreCache: true });
        setTimeout(() => {
          send(ws, 'Runtime.evaluate', {
            expression: 'document.body && document.body.innerText.slice(0, 300)',
            returnByValue: true
          });
        }, 5000);
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.method === 'Runtime.exceptionThrown') {
          errors.push(msg.params.exceptionDetails.text || 'Runtime exception');
        }
        if (msg.method === 'Log.entryAdded') {
          const entry = msg.params.entry || {};
          if (entry.level === 'error' && isBlockingLogError(entry)) errors.push(entry.text || 'Log error');
          if (entry.level === 'warning') warnings.push(entry.text || 'Log warning');
        }
        if (msg.result && msg.result.result && msg.result.result.type === 'string') {
          clearTimeout(timeout);
          ws.close();
          resolve(msg.result.result.value);
        }
      };

      ws.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('WebSocket connection to browser failed.'));
      };
    });

    if (errors.length) {
      console.error('Browser smoke test found errors:');
      errors.forEach((error) => console.error(`- ${error}`));
      process.exitCode = 1;
    } else {
      status = 'passed';
      console.log(`Browser smoke test passed for ${APP_URL}`);
      console.log(`Warnings: ${warnings.length}`);
    }
  } finally {
    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
    fs.writeFileSync(REPORT_PATH, JSON.stringify({
      name: 'AirCalc Pro browser smoke report',
      generatedAt: new Date().toISOString(),
      url: APP_URL,
      status,
      errors,
      warnings
    }, null, 2));
    await closeBrowser(browser);
    server.close();
    try {
      fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 250 });
    } catch (err) {
      console.warn(`Browser profile cleanup warning: ${err.message || err}`);
    }
  }
}

run().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
