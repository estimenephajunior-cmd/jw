const fs = require('fs');
const { spawn } = require('child_process');

const DEBUG_PORT = 9223;
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUT = 'docs/jworg-live-capture.json';

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
    '--user-data-dir=C:\\tmp\\jw-cdp-profile',
  ], { detached: true, stdio: 'ignore' }).unref();

  for (let i = 0; i < 30; i += 1) {
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

function bodySample(text, max = 6000) {
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max)}\n...[truncated ${text.length - max} chars]` : text;
}

async function main() {
  await ensureChrome();
  const target = await newTarget();
  const cdp = new CDP(target.webSocketDebuggerUrl);
  await cdp.open();

  const requests = new Map();
  const flowMarkers = [];
  let lastActivity = Date.now();

  cdp.on('Network.requestWillBeSent', (p) => {
    lastActivity = Date.now();
    const url = p.request.url;
    if (!/^https:\/\/([^/]+\.)?(jw\.org|jw-cdn\.org|akamaihd\.net)\//i.test(url)) return;
    requests.set(p.requestId, {
      id: p.requestId,
      flow: flowMarkers.at(-1)?.name || 'startup',
      method: p.request.method,
      url,
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
    if (!/(json|javascript|text|html|xml)/i.test(contentType)) return;
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
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
    acceptLanguage: 'en-US,en;q=0.9,es;q=0.8,fr;q=0.7',
    platform: 'Windows',
  });
  await cdp.send('Network.setExtraHTTPHeaders', {
    headers: {
      'Accept-Language': 'en-US,en;q=0.9,es;q=0.8,fr;q=0.7',
    },
  });

  async function waitNetworkIdle(timeout = 12000, idle = 1200) {
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
    flowMarkers.push({ name, startedAt: new Date().toISOString() });
    console.log(`FLOW ${name}`);
    await action();
    await waitNetworkIdle();
    flowMarkers.at(-1).endedAt = new Date().toISOString();
  }

  async function navigate(url) {
    await cdp.send('Page.navigate', { url });
    await waitNetworkIdle(18000, 1500);
  }

  async function clickFirst(selector) {
    return evaluate(`
      (() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return false;
        el.scrollIntoView({ block: 'center', inline: 'center' });
        el.click();
        return true;
      })()
    `);
  }

  async function clickFirstHrefContains(text) {
    return evaluate(`
      (() => {
        const link = [...document.querySelectorAll('a[href]')].find(a => a.href.includes(${JSON.stringify(text)}));
        if (!link) return false;
        link.scrollIntoView({ block: 'center', inline: 'center' });
        link.click();
        return link.href;
      })()
    `);
  }

  await flow('en-home-cookie-search', async () => {
    await navigate('https://www.jw.org/en/');
    await evaluate(`document.querySelector('button, input[type=button]')?.innerText`);
    await evaluate(`
      (() => {
        const accept = [...document.querySelectorAll('button')].find(b => /accept/i.test(b.textContent));
        if (accept) accept.click();
        return Boolean(accept);
      })()
    `);
    await waitNetworkIdle(5000);
    await evaluate(`
      (() => {
        const input = document.querySelector('input[type="search"], input[name="q"], input[aria-label*="Search"]');
        if (!input) return false;
        input.value = 'love';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.closest('form')?.requestSubmit?.();
        return true;
      })()
    `);
  });

  await flow('en-search-click-result-and-reference', async () => {
    await waitNetworkIdle();
    await clickFirst('a[href*="/en/library/"]');
    await waitNetworkIdle();
    await clickFirst('a[href*="/library/bible/"], a[href*="/finder?"][href*="bible"], a[href*="#"]');
    await waitNetworkIdle();
  });

  await flow('en-bible-chapter-cross-reference-audio', async () => {
    await navigate('https://www.jw.org/en/library/bible/study-bible/books/genesis/1/');
    await clickFirst('a.xrefLink, a.fn, a[href*="json/html"], a[href*="#v1001001"]');
    await waitNetworkIdle();
    await clickFirst('button[aria-label*="Play"], button[title*="Play"], .jsAudioPlay, .audioButton, a[href*="GETPUBMEDIALINKS"]');
    await waitNetworkIdle();
  });

  await flow('es-publications-meeting-workbook-audio-download', async () => {
    await navigate('https://www.jw.org/es/biblioteca/');
    await clickFirstHrefContains('/biblioteca/guia-actividades-reunion-testigos-jehova/');
    await waitNetworkIdle();
    await clickFirst('a[href*="/biblioteca/guia-actividades-reunion-testigos-jehova/"]');
    await waitNetworkIdle();
    await clickFirst('a[href*="/descargas"], button[aria-label*="Descargar"], button[title*="Descargar"], a[href*="finder?"]');
    await waitNetworkIdle();
    await clickFirst('button[aria-label*="Reproducir"], button[title*="Reproducir"], .jsAudioPlay');
    await waitNetworkIdle();
  });

  await flow('fr-watchtower-study-article-reference', async () => {
    await navigate('https://www.jw.org/fr/biblioth%C3%A8que/revues/');
    await clickFirst('a[href*="tour-garde-etude"], a[href*="watchtower-study"], a[href*="/revues/"]');
    await waitNetworkIdle();
    await clickFirst('a[href*="/biblioth%C3%A8que/revues/"], a[href*="/bibliotheque/revues/"]');
    await waitNetworkIdle();
    await clickFirst('a[href*="/biblioth%C3%A8que/bible/"], a[href*="/bibliotheque/bible/"], a[href*="finder?"]');
    await waitNetworkIdle();
  });

  await flow('en-media-video-play', async () => {
    await navigate('https://www.jw.org/en/library/videos/');
    await clickFirst('a[href*="/library/videos/"]');
    await waitNetworkIdle();
    await clickFirst('button[aria-label*="Play"], button[title*="Play"], .jsVideoPlay, video, a[href*="video"]');
    await waitNetworkIdle(15000, 1800);
  });

  await flow('en-meetings-page', async () => {
    await navigate('https://www.jw.org/en/jehovahs-witnesses/meetings/');
    await clickFirst('a[href*="/library/jw-meeting-workbook/"], a[href*="/meetings/"], a[href*="finder?"]');
    await waitNetworkIdle();
  });

  const finalUrl = await evaluate('location.href');
  const title = await evaluate('document.title');
  const data = {
    capturedAt: new Date().toISOString(),
    finalUrl,
    title,
    flows: flowMarkers,
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
