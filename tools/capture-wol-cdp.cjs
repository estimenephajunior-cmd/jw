const fs = require('fs');
const { spawn } = require('child_process');

const DEBUG_PORT = 9224;
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUT = 'docs/wol-live-capture.json';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureChrome() {
  try {
    const r = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
    if (r.ok) return;
  } catch {}

  spawn(CHROME, [
    '--headless=new',
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--ignore-certificate-errors',
    '--user-data-dir=C:\\tmp\\wol-cdp-profile',
  ], { detached: true, stdio: 'ignore' }).unref();

  for (let i = 0; i < 40; i += 1) {
    try {
      const r = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
      if (r.ok) return;
    } catch {}
    await sleep(500);
  }
  throw new Error('Chrome DevTools endpoint did not become available');
}

async function newTarget() {
  const r = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/new?about:blank`, { method: 'PUT' });
  if (!r.ok) throw new Error(`Could not create target: ${r.status}`);
  return r.json();
}

class CDP {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.handlers = new Map();
  }

  async open() {
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
    this.ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(`${msg.error.message}: ${msg.error.data || ''}`));
        else resolve(msg.result || {});
        return;
      }
      if (msg.method && this.handlers.has(msg.method)) {
        for (const fn of this.handlers.get(msg.method)) fn(msg.params || {});
      }
    });
  }

  on(method, fn) {
    if (!this.handlers.has(method)) this.handlers.set(method, []);
    this.handlers.get(method).push(fn);
  }

  send(method, params = {}) {
    const id = this.nextId;
    this.nextId += 1;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }
      }, 30000);
    });
  }

  close() {
    this.ws.close();
  }
}

function normalizeHeaders(headers = {}) {
  return Object.fromEntries(
    Object.entries(headers).map(([k, v]) => [k.toLowerCase(), String(v)])
  );
}

function bodySample(text, max = 7000) {
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max)}\n...[truncated ${text.length - max} chars]` : text;
}

async function main() {
  await ensureChrome();
  const target = await newTarget();
  const cdp = new CDP(target.webSocketDebuggerUrl);
  await cdp.open();

  const requests = new Map();
  const flows = [];
  let lastActivity = Date.now();

  function inScope(url) {
    return /^https:\/\/(wol\.jw\.org|b\.jw-cdn\.org|cfp2\.jw-cdn\.org|cms-imgp\.jw-cdn\.org|assetsnffrgf-a\.akamaihd\.net)\//i.test(url);
  }

  cdp.on('Network.requestWillBeSent', (p) => {
    lastActivity = Date.now();
    if (!inScope(p.request.url)) return;
    requests.set(p.requestId, {
      id: p.requestId,
      flow: flows.at(-1)?.name || 'startup',
      method: p.request.method,
      url: p.request.url,
      documentURL: p.documentURL,
      resourceType: p.type,
      initiatorType: p.initiator?.type,
      requestHeaders: normalizeHeaders(p.request.headers),
      postData: p.request.postData || null,
      status: null,
      statusText: null,
      responseHeaders: {},
      mimeType: null,
      fromDiskCache: false,
      encodedDataLength: null,
      bodySample: null,
      bodyBase64Encoded: false,
      bodyError: null,
    });
  });

  cdp.on('Network.responseReceived', (p) => {
    lastActivity = Date.now();
    const rec = requests.get(p.requestId);
    if (!rec) return;
    rec.status = p.response.status;
    rec.statusText = p.response.statusText;
    rec.responseHeaders = normalizeHeaders(p.response.headers);
    rec.mimeType = p.response.mimeType;
    rec.fromDiskCache = Boolean(p.response.fromDiskCache);
  });

  cdp.on('Network.loadingFinished', async (p) => {
    lastActivity = Date.now();
    const rec = requests.get(p.requestId);
    if (!rec) return;
    rec.encodedDataLength = p.encodedDataLength;
    const contentType = rec.responseHeaders['content-type'] || rec.mimeType || '';
    if (!/(json|javascript|text|html|xml|svg)/i.test(contentType)) return;
    try {
      const body = await cdp.send('Network.getResponseBody', { requestId: p.requestId });
      rec.bodySample = bodySample(body.body || '');
      rec.bodyBase64Encoded = Boolean(body.base64Encoded);
    } catch (error) {
      rec.bodyError = error.message;
    }
  });

  await cdp.send('Network.enable');
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.setUserAgentOverride', {
    userAgent: USER_AGENT,
    acceptLanguage: 'en-US,en;q=0.9,ht;q=0.8',
    platform: 'Windows',
  });

  async function waitNetworkIdle(timeout = 16000, idle = 1200) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (Date.now() - lastActivity >= idle) return;
      await sleep(250);
    }
  }

  async function evaluate(expression) {
    const result = await cdp.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true,
    });
    return result.result?.value;
  }

  async function flow(name, action) {
    flows.push({ name, startedAt: new Date().toISOString() });
    console.log(`FLOW ${name}`);
    await action();
    await waitNetworkIdle();
    flows.at(-1).endedAt = new Date().toISOString();
  }

  async function navigate(url) {
    await cdp.send('Page.navigate', { url });
    await waitNetworkIdle(22000, 1500);
  }

  async function clickByText(text) {
    return evaluate(`
      (() => {
        const needle = ${JSON.stringify(text)};
        const link = [...document.querySelectorAll('a, button')].find(a => (a.textContent || '').includes(needle));
        if (!link) return false;
        link.scrollIntoView({ block: 'center', inline: 'center' });
        link.click();
        return link.href || true;
      })()
    `);
  }

  async function clickSelector(selector) {
    return evaluate(`
      (() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return false;
        el.scrollIntoView({ block: 'center', inline: 'center' });
        el.click();
        return el.href || true;
      })()
    `);
  }

  async function typeSearch(query) {
    return evaluate(`
      (() => {
        const input = document.querySelector('input[name="q"], .searchField');
        if (!input) return false;
        input.focus();
        input.value = ${JSON.stringify(query)};
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: ${JSON.stringify(query.at(-1) || 'e')} }));
        return true;
      })()
    `);
  }

  async function submitSearch(query) {
    return evaluate(`
      (() => {
        const input = document.querySelector('input[name="q"], .searchField');
        if (!input) return false;
        input.value = ${JSON.stringify(query)};
        input.closest('form')?.submit();
        return true;
      })()
    `);
  }

  await flow('en-daily-text-inline-popups', async () => {
    await navigate('https://wol.jw.org/en/wol/h/r1/lp-e');
    await evaluate(`([...document.querySelectorAll('button')].find(b => /accept/i.test(b.textContent)) || {}).click?.()`);
    await waitNetworkIdle(5000);
    await clickByText('1Cor. 12:28');
    await waitNetworkIdle(7000);
    await clickByText('w24.10 19');
    await waitNetworkIdle(7000);
    await clickByText('1Tim. 3:8');
    await waitNetworkIdle(7000);
  });

  await flow('ht-daily-text-inline-popups', async () => {
    await navigate('https://wol.jw.org/ht/wol/h/r60/lp-cr');
    await clickSelector('a.b, a[href*="/wol/bc/"], a[href*="/wol/pc/"]');
    await waitNetworkIdle(7000);
    await clickSelector('a[href*="/wol/pc/"], a[href*="/wol/d/"][href*="#h="]');
    await waitNetworkIdle(7000);
  });

  await flow('en-search-suggestions-results-open-reference', async () => {
    await navigate('https://wol.jw.org/en/wol/h/r1/lp-e');
    await typeSearch('love');
    await waitNetworkIdle(5000);
    await submitSearch('love');
    await waitNetworkIdle(10000);
    await clickSelector('li.result a[href*="/en/wol/d/"], li.linkCard a[href*="/en/wol/d/"], a[href*="/en/wol/d/"]');
    await waitNetworkIdle(10000);
    await clickSelector('a.b, a[href*="/wol/bc/"], a[href*="/wol/pc/"]');
    await waitNetworkIdle(7000);
  });

  await flow('ht-search-results-open-reference', async () => {
    await navigate('https://wol.jw.org/ht/wol/s/r60/lp-cr?q=jan%20ak%20jak&p=par&r=occ');
    await clickSelector('li.result a[href*="/ht/wol/d/"], li.linkCard a[href*="/ht/wol/d/"], a[href*="/ht/wol/d/"]');
    await waitNetworkIdle(10000);
    await clickSelector('a.b, a[href*="/wol/bc/"], a[href*="/wol/pc/"]');
    await waitNetworkIdle(7000);
  });

  await flow('en-bible-chapter-crossref-nested', async () => {
    await navigate('https://wol.jw.org/en/wol/b/r1/lp-e/nwtsty/43/3#v=43:3:16');
    await clickSelector('a.b, a[href*="/wol/bc/"]');
    await waitNetworkIdle(7000);
    await clickSelector('.tooltip a.b, .tooltip a[href*="/wol/bc/"], a[href*="/wol/bc/"]');
    await waitNetworkIdle(7000);
  });

  await flow('en-publications-meeting-workbook-article-audio', async () => {
    await navigate('https://wol.jw.org/en/wol/library/r1/lp-e/all-publications');
    await clickByText('Meeting Workbooks');
    await waitNetworkIdle(7000);
    await clickSelector('a[href*="life-and-ministry-meeting-workbook-2026"], a[href*="/wol/library/"]');
    await waitNetworkIdle(7000);
    await clickSelector('a[href*="/en/wol/d/r1/lp-e/202026"]');
    await waitNetworkIdle(10000);
    await clickSelector('button[aria-label*="play" i], .playButton, .audioPlayButton, a[href*="GETPUBMEDIALINKS"], a.b');
    await waitNetworkIdle(10000);
  });

  await flow('en-meetings-week-watchtower-materials', async () => {
    await navigate('https://wol.jw.org/en/wol/meetings/r1/lp-e/2026/20');
    await clickSelector('a[href*="/en/wol/d/r1/lp-e/2026"], a[href*="/en/wol/d/r1/lp-e/"]');
    await waitNetworkIdle(10000);
    await clickSelector('a.b, a[href*="/wol/bc/"], a[href*="/wol/pc/"]');
    await waitNetworkIdle(7000);
  });

  await flow('ht-publications-bible-meetings', async () => {
    await navigate('https://wol.jw.org/ht/wol/library/r60/lp-cr/all-publications');
    await clickSelector('a[href*="/ht/wol/library/"], a[href*="/ht/wol/d/"]');
    await waitNetworkIdle(8000);
    await navigate('https://wol.jw.org/ht/wol/binav/r60/lp-cr');
    await clickSelector('a[href*="/ht/wol/b/r60/lp-cr/"]');
    await waitNetworkIdle(8000);
    await clickSelector('a.b, a[href*="/wol/bc/"]');
    await waitNetworkIdle(7000);
  });

  const finalUrl = await evaluate('location.href');
  const title = await evaluate('document.title');
  const data = {
    capturedAt: new Date().toISOString(),
    finalUrl,
    title,
    flows,
    requests: [...requests.values()].sort((a, b) => a.url.localeCompare(b.url)),
  };
  fs.writeFileSync(OUT, JSON.stringify(data, null, 2));
  console.log(`Wrote ${OUT} (${data.requests.length} requests)`);
  cdp.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
