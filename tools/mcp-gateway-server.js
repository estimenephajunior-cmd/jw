const http = require('http');
const { spawn } = require('child_process');
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.MCP_GATEWAY_PORT || process.env.PORT || 8788);
const DEFAULT_TIMEOUT_MS = Number(process.env.MCP_GATEWAY_TIMEOUT_MS || 60000);

const serverConfigs = {
  jw: {
    command: process.env.JW_MCP_COMMAND || 'node',
    args: splitArgs(process.env.JW_MCP_ARGS || 'vendor/mcp/jw-mcp/src/index.js'),
    transport: process.env.JW_MCP_TRANSPORT || 'line',
  },
  jworg: {
    command: process.env.JWORG_MCP_COMMAND || 'uv',
    args: splitArgs(process.env.JWORG_MCP_ARGS || '--directory vendor/mcp/jw-org-mcp run jw-org-mcp'),
    transport: process.env.JWORG_MCP_TRANSPORT || 'line',
  },
};

const clients = new Map();
const staticRoot = path.join(process.cwd(), process.env.EXPO_WEB_DIST_DIR || 'dist');
const WOL_BASE = 'https://wol.jw.org';

const knownTools = {
  jw: [
    'search_bible_books',
    'get_bible_verse',
    'get_verse_with_study',
    'get_bible_verse_url',
    'getWorkbookLinks',
    'getWorkbookContent',
    'getWatchtowerLinks',
    'getWatchtowerContent',
    'get_jw_captions',
  ],
  jworg: [
    'search_content',
    'get_article',
    'get_scripture',
    'get_cache_stats',
  ],
  wol: [
    'wol_search',
    'wol_get_document',
    'wol_browse_publications',
  ],
};

const aiToolDefinitions = [
  {
    name: 'jworg_search',
    description: 'Search JW.org content.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        language: { type: 'string', default: 'E' },
        limit: { type: 'integer', default: 10 },
        filter: { type: 'string', default: 'all' },
      },
      required: ['query'],
    },
  },
  {
    name: 'jworg_article',
    description: 'Retrieve article text from a JW.org or WOL URL.',
    input_schema: {
      type: 'object',
      properties: { url: { type: 'string' } },
      required: ['url'],
    },
  },
  {
    name: 'jworg_scripture',
    description: 'Retrieve scripture text through jw-org-mcp.',
    input_schema: {
      type: 'object',
      properties: {
        reference: { type: 'string' },
        translation: { type: 'string', default: 'nwtsty' },
      },
      required: ['reference'],
    },
  },
  {
    name: 'wol_search',
    description: 'Search Watchtower Online Library through this gateway.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        language: { type: 'string', default: 'en' },
        region: { type: 'string', default: 'r1' },
        langParam: { type: 'string', default: 'lp-e' },
        page: { type: 'integer', default: 1 },
        limit: { type: 'integer', default: 50 },
      },
      required: ['query'],
    },
  },
  {
    name: 'wol_document',
    description: 'Retrieve a WOL document by URL through this gateway.',
    input_schema: {
      type: 'object',
      properties: { url: { type: 'string' } },
      required: ['url'],
    },
  },
  {
    name: 'jw_tool',
    description: 'Call a tool from advenimus/jw-mcp.',
    input_schema: {
      type: 'object',
      properties: {
        tool: { type: 'string', enum: knownTools.jw },
        arguments: { type: 'object' },
      },
      required: ['tool'],
    },
  },
];

function splitArgs(value) {
  return value.match(/(?:[^\s"]+|"[^"]*")+/g)?.map((part) => part.replace(/^"|"$/g, '')) || [];
}

function sendJson(res, status, body) {
  res.writeHead(status, {
    'Access-Control-Allow-Origin': process.env.MCP_GATEWAY_ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Accept',
    'Content-Type': 'application/json; charset=utf-8',
  });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 2_000_000) {
        reject(new Error('Request body too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

class StdioMcpClient {
  constructor(name, config) {
    this.name = name;
    this.config = config;
    this.nextId = 1;
    this.pending = new Map();
    this.buffer = Buffer.alloc(0);
    this.initialized = false;
    this.proc = null;
  }

  async ensureStarted() {
    if (this.proc && !this.proc.killed) return;

    const spawnSpec = resolveSpawnSpec(this.config.command, this.config.args);
    this.proc = spawn(spawnSpec.command, spawnSpec.args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      shell: spawnSpec.shell,
    });

    this.proc.stdout.on('data', (chunk) => this.handleData(chunk));
    this.proc.stderr.on('data', (chunk) => {
      if (process.env.MCP_GATEWAY_DEBUG === '1') {
        process.stderr.write(`[${this.name}] ${chunk}`);
      }
    });
    this.proc.on('error', (error) => {
      for (const { reject, timer } of this.pending.values()) {
        clearTimeout(timer);
        reject(error);
      }
      this.pending.clear();
      this.initialized = false;
      this.proc = null;
    });
    this.proc.on('exit', () => {
      for (const { reject, timer } of this.pending.values()) {
        clearTimeout(timer);
        reject(new Error(`${this.name} MCP process exited`));
      }
      this.pending.clear();
      this.initialized = false;
      this.proc = null;
    });

    await this.initialize();
  }

  handleData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    if (this.config.transport === 'line') {
      this.handleLineData();
      return;
    }

    while (true) {
      const headerEnd = this.buffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) return;

      const header = this.buffer.slice(0, headerEnd).toString('utf8');
      const lengthMatch = /Content-Length:\s*(\d+)/i.exec(header);
      if (!lengthMatch) {
        this.buffer = this.buffer.slice(headerEnd + 4);
        continue;
      }

      const contentLength = Number(lengthMatch[1]);
      const messageStart = headerEnd + 4;
      const messageEnd = messageStart + contentLength;
      if (this.buffer.length < messageEnd) return;

      const rawMessage = this.buffer.slice(messageStart, messageEnd).toString('utf8');
      this.buffer = this.buffer.slice(messageEnd);

      let message;
      try {
        message = JSON.parse(rawMessage);
      } catch {
        continue;
      }

      this.resolveMessage(message);
    }
  }

  handleLineData() {
    while (true) {
      const lineEnd = this.buffer.indexOf('\n');
      if (lineEnd === -1) return;

      const rawLine = this.buffer.slice(0, lineEnd).toString('utf8').trim();
      this.buffer = this.buffer.slice(lineEnd + 1);
      if (!rawLine) continue;

      let message;
      try {
        message = JSON.parse(rawLine);
      } catch {
        continue;
      }

      this.resolveMessage(message);
    }
  }

  resolveMessage(message) {
    if (message.id !== undefined && this.pending.has(message.id)) {
      const pending = this.pending.get(message.id);
      clearTimeout(pending.timer);
      this.pending.delete(message.id);
      if (message.error) {
        pending.reject(new Error(message.error.message || 'MCP call failed'));
      } else {
        pending.resolve(message.result);
      }
    }
  }

  async initialize() {
    if (this.initialized) return;
    await this.request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'jw-study-assistant-gateway', version: '1.0.0' },
    });
    this.notify('notifications/initialized', {});
    this.initialized = true;
  }

  request(method, params) {
    if (!this.proc?.stdin) return Promise.reject(new Error(`${this.name} MCP process is not running`));
    const id = this.nextId++;
    const payload = JSON.stringify({ jsonrpc: '2.0', id, method, params });
    const message = this.config.transport === 'line'
      ? `${payload}\n`
      : `Content-Length: ${Buffer.byteLength(payload, 'utf8')}\r\n\r\n${payload}`;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${this.name} MCP request timed out`));
      }, DEFAULT_TIMEOUT_MS);
      this.pending.set(id, { resolve, reject, timer });
      this.proc.stdin.write(message);
    });
  }

  notify(method, params) {
    if (!this.proc?.stdin) return;
    const payload = JSON.stringify({ jsonrpc: '2.0', method, params });
    const message = this.config.transport === 'line'
      ? `${payload}\n`
      : `Content-Length: ${Buffer.byteLength(payload, 'utf8')}\r\n\r\n${payload}`;
    this.proc.stdin.write(message);
  }

  async callTool(name, args) {
    await this.ensureStarted();
    return this.request('tools/call', { name, arguments: args });
  }
}

function resolveSpawnSpec(command, args) {
  if (process.platform !== 'win32') return { command, args, shell: false };
  const where = spawnSync('where.exe', [command], { encoding: 'utf8' });
  const resolved = where.status === 0
    ? where.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
    : [];
  const existing = resolved.filter((line) => fs.existsSync(line));
  const candidates = [
    ...existing.filter((line) => /\.exe$/i.test(line)),
    ...existing.filter((line) => /\.cmd$/i.test(line)),
    ...existing.filter((line) => !/\.(exe|cmd)$/i.test(line)),
    `${command}.exe`,
    `${command}.cmd`,
    command,
  ];
  const executable = candidates[0] || command;
  if (/\.cmd$/i.test(executable)) {
    return {
      command: `"${executable}" ${args.map(quoteCmdArg).join(' ')}`,
      args: [],
      shell: true,
    };
  }
  return { command: executable, args, shell: false };
}

function quoteCmdArg(value) {
  const text = String(value);
  if (!/[\s"&|<>^]/.test(text)) return text;
  return `"${text.replace(/"/g, '\\"')}"`;
}

function getClient(name) {
  const config = serverConfigs[name];
  if (!config) throw new Error(`Unknown MCP server: ${name}`);
  if (!clients.has(name)) clients.set(name, new StdioMcpClient(name, config));
  return clients.get(name);
}

function toolText(result) {
  const content = Array.isArray(result?.content) ? result.content : [];
  const text = content
    .filter((part) => part?.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text)
    .join('\n')
    .trim();
  if (text) return text;
  return typeof result === 'string' ? result : JSON.stringify(result ?? {});
}

function parseMaybeJson(value) {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.results)) return value.results;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.documents)) return value.documents;
  return [];
}

function markdownSearchResults(text) {
  const results = [];
  const blocks = text.split(/\n###\s+/).slice(1).map((block) => `### ${block.split(/\n---\n/)[0]}`);
  for (const block of blocks) {
    const titleMatch = /^###\s+\d+\.\s+(.+?)\s*$/m.exec(block);
    const urlMatch = /\*\*URL:\*\*\s*(\S+)/m.exec(block);
    if (!titleMatch || !urlMatch) continue;
    const withoutMeta = block
      .replace(/^###\s+\d+\.\s+.+?$/m, '')
      .replace(/\*\*Source:\*\*.*$/m, '')
      .replace(/\*\*URL:\*\*.*$/m, '')
      .replace(/\*\*[^*]+:\*\*.*$/gm, '')
      .replace(/---\s*$/m, '')
      .trim();
    results.push({
      title: decodeBasicHtml(titleMatch[1].trim()),
      snippet: decodeBasicHtml(withoutMeta.replace(/\n{2,}/g, ' ').trim()),
      url: urlMatch[1].trim(),
    });
  }
  return results;
}

function decodeBasicHtml(value) {
  return String(value)
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

async function searchJwOrg(body) {
  const raw = await getClient('jworg').callTool('search_content', {
    query: body.query,
    language: body.language || 'E',
    limit: body.limit || 10,
    filter: body.filter || 'all',
  });
  const parsed = parseMaybeJson(toolText(raw));
  if (typeof parsed === 'string') {
    return { results: markdownSearchResults(parsed), raw: parsed };
  }
  return { results: asArray(parsed), raw: typeof parsed === 'string' ? parsed : undefined };
}

async function getJwOrgArticle(body) {
  const raw = await getClient('jworg').callTool('get_article', { url: body.url });
  const parsed = parseMaybeJson(toolText(raw));
  if (typeof parsed === 'string') {
    return { title: 'JW Source', content: parsed, url: body.url, format: 'markdown' };
  }
  return {
    title: parsed?.title || parsed?.data?.title || 'JW Source',
    content: parsed?.content || parsed?.text || parsed?.markdown || parsed?.data?.content || toolText(raw),
    url: parsed?.url || parsed?.metadata?.source_url || body.url,
    format: parsed?.format || 'markdown',
  };
}

async function getJwOrgScripture(body) {
  const raw = await getClient('jworg').callTool('get_scripture', {
    reference: body.reference,
    translation: body.translation || 'nwtsty',
  });
  const parsed = parseMaybeJson(toolText(raw));
  return typeof parsed === 'string'
    ? { reference: body.reference, text: parsed }
    : parsed;
}

async function getJwOrgCacheStats() {
  const raw = await getClient('jworg').callTool('get_cache_stats', {});
  const parsed = parseMaybeJson(toolText(raw));
  return typeof parsed === 'string' ? { text: parsed } : parsed;
}

async function searchWol(body) {
  return directWolSearch(body);
}

async function getWolDocument(body) {
  return directWolDocument(body.url);
}

async function browseWolPublications(body) {
  return directWolPublications(body);
}

async function directWolFetch(url, accept = 'text/html,application/json,*/*') {
  const parsed = new URL(url);
  if (parsed.hostname !== 'wol.jw.org') throw new Error('Only wol.jw.org URLs are allowed.');
  const response = await fetch(url, {
    headers: {
      Accept: accept,
      'Accept-Language': 'en-US,en;q=0.9',
      'User-Agent': 'JW Study Assistant MCP Gateway',
    },
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`WOL HTTP ${response.status}`);
  return {
    text: await response.text(),
    contentType: response.headers.get('content-type') || '',
    url,
  };
}

async function directWolSearch(body) {
  const language = body.language || 'en';
  const region = body.region || body.wolRegion || 'r1';
  const langParam = body.langParam || body.wolLangParam || 'lp-e';
  const page = Number(body.page || 1);
  const query = encodeURIComponent(body.query || '');
  const url = `${WOL_BASE}/${language}/wol/s/${region}/${langParam}?q=${query}&p=par&r=occ&st=a${page > 1 ? `&pg=${page}` : ''}`;
  const { text, contentType } = await directWolFetch(url);
  return {
    provider: 'direct-wol',
    html: text,
    results: parseWolHtmlResults(text).slice(0, Number(body.limit || 50)),
    sourceUrl: url,
    contentType,
  };
}

async function directWolDocument(url) {
  const { text, contentType } = await directWolFetch(url);
  return {
    provider: 'direct-wol',
    title: stripHtml(/<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(text)?.[1] || /<title[^>]*>([\s\S]*?)<\/title>/i.exec(text)?.[1] || 'WOL Document'),
    content: stripHtml(extractMainHtml(text)),
    html: text,
    url,
    format: 'html',
    contentType,
  };
}

async function directWolPublications(body) {
  const language = body.language || 'en';
  const region = body.region || 'r1';
  const langParam = body.langParam || 'lp-e';
  const type = body.type || 'all';
  const url = `${WOL_BASE}/${language}/wol/library/${region}/${langParam}`;
  const { text, contentType } = await directWolFetch(url);
  return {
    provider: 'direct-wol',
    type,
    html: text,
    content: stripHtml(extractMainHtml(text)).slice(0, 12000),
    sourceUrl: url,
    contentType,
  };
}

function parseWolHtmlResults(html) {
  const results = [];
  const docRe = /<ul\b[^>]*class="[^"]*resultContentDocument[^"]*"[^>]*>([\s\S]*?)<\/ul>/gi;
  let match;
  while ((match = docRe.exec(html)) !== null && results.length < 100) {
    const block = match[1];
    const hrefM = /<li class="caption"[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i.exec(block);
    const rawUrl = hrefM?.[1] || '';
    const url = rawUrl.startsWith('http') ? rawUrl : rawUrl ? `${WOL_BASE}${rawUrl}` : '';
    const title = stripHtml(hrefM?.[2] || '');
    const snippet = stripHtml(
      /<li class="searchResult[\s\S]*?<div class="document">([\s\S]*?)<\/div>/i.exec(block)?.[1]
      || /<li class="ref">([\s\S]*?)<\/li>/i.exec(block)?.[1]
      || '',
    );
    if (title && url) results.push({ title, snippet, url });
  }
  return results;
}

function extractMainHtml(html) {
  return /<main\b[^>]*>([\s\S]*?)<\/main>/i.exec(html)?.[1]
    || /<article\b[^>]*>([\s\S]*?)<\/article>/i.exec(html)?.[1]
    || html;
}

function stripHtml(html) {
  return decodeBasicHtml(String(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim());
}

async function callJwTool(tool, body) {
  const raw = await getClient('jw').callTool(tool, body || {});
  const parsed = parseMaybeJson(toolText(raw));
  return typeof parsed === 'string' ? { content: parsed } : parsed;
}

async function callAiTool(body) {
  const args = body.arguments || body.args || {};
  switch (body.name) {
    case 'jworg_search':
      return searchJwOrg(args);
    case 'jworg_article':
      return getJwOrgArticle(args);
    case 'jworg_scripture':
      return getJwOrgScripture(args);
    case 'wol_search':
      return compactAiResult(await searchWol(args));
    case 'wol_document':
      return compactAiResult(await getWolDocument(args));
    case 'jw_tool':
      return callJwTool(args.tool, args.arguments || {});
    default:
      throw new Error(`Unknown AI tool: ${body.name}`);
  }
}

function compactAiResult(result) {
  if (!result || typeof result !== 'object') return result;
  const copy = { ...result };
  if (typeof copy.html === 'string') delete copy.html;
  if (typeof copy.content === 'string' && copy.content.length > 12000) {
    copy.content = `${copy.content.slice(0, 12000)}\n\n[truncated]`;
  }
  return copy;
}

function serveStatic(req, res, requestUrl) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;
  if (requestUrl.pathname.startsWith('/api/') || requestUrl.pathname === '/health') return false;
  if (!fs.existsSync(staticRoot)) return false;

  const decodedPath = decodeURIComponent(requestUrl.pathname);
  const cleanPath = decodedPath.replace(/^\/+/, '') || 'index.html';
  const candidate = path.resolve(staticRoot, cleanPath);
  const root = path.resolve(staticRoot);
  let filePath = candidate.startsWith(root) && fs.existsSync(candidate) && fs.statSync(candidate).isFile()
    ? candidate
    : path.join(root, 'index.html');

  if (!filePath.startsWith(root) || !fs.existsSync(filePath)) return false;
  const contentType = mimeType(filePath);
  res.writeHead(200, { 'Content-Type': contentType });
  if (req.method === 'HEAD') {
    res.end();
    return true;
  }
  fs.createReadStream(filePath).pipe(res);
  return true;
}

function mimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
  }[ext] || 'application/octet-stream';
}

async function route(req, res) {
  if (req.method === 'OPTIONS') return sendJson(res, 204, {});

  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  if (req.method === 'GET' && url.pathname === '/health') {
    return sendJson(res, 200, {
      ok: true,
      servers: {
        ...Object.fromEntries(Object.entries(serverConfigs).map(([name, config]) => [name, {
        command: config.command,
        args: config.args,
        }])),
        wol: { mode: 'direct-http', baseUrl: WOL_BASE },
      },
    });
  }

  if (req.method === 'GET' && url.pathname === '/api/mcp/tools') {
    return sendJson(res, 200, { tools: knownTools, genericCall: '/api/mcp/call' });
  }

  if (req.method === 'GET' && url.pathname === '/api/ai/tools') {
    return sendJson(res, 200, {
      tools: aiToolDefinitions,
      openai: aiToolDefinitions.map((tool) => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.input_schema,
        },
      })),
      anthropic: aiToolDefinitions.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.input_schema,
      })),
      callEndpoint: '/api/ai/tool',
    });
  }

  if (serveStatic(req, res, url)) return;

  if (req.method !== 'POST') return sendJson(res, 404, { error: 'Not found' });

  try {
    const body = await readBody(req);
    if (url.pathname === '/api/mcp/jworg/search') return sendJson(res, 200, await searchJwOrg(body));
    if (url.pathname === '/api/mcp/jworg/article') return sendJson(res, 200, await getJwOrgArticle(body));
    if (url.pathname === '/api/mcp/jworg/scripture') return sendJson(res, 200, await getJwOrgScripture(body));
    if (url.pathname === '/api/mcp/jworg/cache-stats') return sendJson(res, 200, await getJwOrgCacheStats());
    if (url.pathname === '/api/mcp/wol/search') return sendJson(res, 200, await searchWol(body));
    if (url.pathname === '/api/mcp/wol/document') return sendJson(res, 200, await getWolDocument(body));
    if (url.pathname === '/api/mcp/wol/publications') return sendJson(res, 200, await browseWolPublications(body));
    if (url.pathname === '/api/ai/tool') return sendJson(res, 200, await callAiTool(body));
    if (url.pathname.startsWith('/api/mcp/jw/')) {
      const tool = url.pathname.slice('/api/mcp/jw/'.length);
      if (!knownTools.jw.includes(tool)) return sendJson(res, 404, { error: `Unknown jw tool: ${tool}` });
      return sendJson(res, 200, await callJwTool(tool, body));
    }
    if (url.pathname === '/api/mcp/call') {
      if (body.server === 'wol') {
        if (body.tool === 'wol_search') return sendJson(res, 200, await searchWol(body.arguments || {}));
        if (body.tool === 'wol_get_document') return sendJson(res, 200, await getWolDocument(body.arguments || {}));
        if (body.tool === 'wol_browse_publications') return sendJson(res, 200, await browseWolPublications(body.arguments || {}));
        return sendJson(res, 404, { error: `Unknown wol tool: ${body.tool}` });
      }
      const raw = await getClient(body.server).callTool(body.tool, body.arguments || {});
      return sendJson(res, 200, { result: raw, text: toolText(raw) });
    }
    return sendJson(res, 404, { error: 'Not found' });
  } catch (error) {
    return sendJson(res, 502, { error: error.message || String(error) });
  }
}

const server = http.createServer(route);
server.listen(PORT, () => {
  console.log(`JW MCP gateway listening on http://localhost:${PORT}`);
});
