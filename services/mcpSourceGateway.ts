interface SearchJWOrgInput {
  query: string;
  language?: string;
  limit?: number;
  useMCP?: boolean;
}

interface ArticleInput {
  url: string;
  useMCP?: boolean;
  fallbackToDirect?: boolean;
}

interface GatewaySearchItem {
  title?: string;
  snippet?: string;
  description?: string;
  content?: string;
  url?: string;
  link?: string;
  href?: string;
}

interface GatewayArticle {
  title?: string;
  content?: string;
  text?: string;
  markdown?: string;
  html?: string;
  url?: string;
  format?: string;
}

const sameOriginGateway = typeof window !== 'undefined' && window.location?.origin
  ? window.location.origin
  : '';
const gatewayBaseUrl = (process.env.EXPO_PUBLIC_MCP_GATEWAY_URL || sameOriginGateway).replace(/\/+$/, '');

function assertGatewayEnabled(useMCP?: boolean): string {
  if (!useMCP) throw new Error('MCP disabled for this request.');
  if (!gatewayBaseUrl) {
    throw new Error('EXPO_PUBLIC_MCP_GATEWAY_URL is not configured.');
  }
  return gatewayBaseUrl;
}

async function postGateway<T>(path: string, body: unknown, useMCP?: boolean): Promise<T> {
  const baseUrl = assertGatewayEnabled(useMCP);
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const message = await response.text().catch(() => '');
    throw new Error(`MCP gateway request failed (${response.status}): ${message}`);
  }

  return response.json() as Promise<T>;
}

export async function searchJWOrgWithMCP(input: SearchJWOrgInput): Promise<{ results: GatewaySearchItem[] }> {
  const data = await postGateway<{ results?: GatewaySearchItem[] }>(
    '/api/mcp/jworg/search',
    {
      query: input.query,
      language: input.language ?? 'en',
      limit: input.limit ?? 10,
    },
    input.useMCP,
  );

  return { results: Array.isArray(data.results) ? data.results : [] };
}

export async function getArticleWithMCP(input: ArticleInput): Promise<{
  title: string;
  content: string;
  url: string;
  format: string;
}> {
  const data = await postGateway<GatewayArticle>(
    '/api/mcp/jworg/article',
    { url: input.url },
    input.useMCP,
  );

  return {
    title: data.title ?? 'JW Source',
    content: data.content ?? data.text ?? data.markdown ?? data.html ?? '',
    url: data.url ?? input.url,
    format: data.format ?? (data.html ? 'html' : 'markdown'),
  };
}

export async function searchWOLWithMCP(
  query: string,
  langSymbol = 'en',
  _wolRegion = 'r1',
  _wolLangParam = 'lp-e',
  page = 1,
): Promise<string> {
  const data = await postGateway<{ results?: GatewaySearchItem[]; html?: string; content?: string }>(
    '/api/mcp/wol/search',
    {
      query,
      language: langSymbol,
      page,
      limit: 50,
    },
    true,
  );

  if (data.html) return data.html;
  if (data.content) return data.content;
  return wolResultsToSearchHtml(Array.isArray(data.results) ? data.results : []);
}

export async function callMcpTool<T = unknown>(
  server: 'jw' | 'jworg' | 'wol',
  tool: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  return postGateway<T>('/api/mcp/call', { server, tool, arguments: args }, true);
}

export async function getMcpTools(): Promise<unknown> {
  const baseUrl = assertGatewayEnabled(true);
  const response = await fetch(`${baseUrl}/api/mcp/tools`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`MCP tools request failed (${response.status}).`);
  return response.json();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function wolResultsToSearchHtml(results: GatewaySearchItem[]): string {
  return results.map((item) => {
    const url = item.url ?? item.link ?? item.href ?? '';
    const title = item.title ?? 'WOL result';
    const snippet = item.snippet ?? item.description ?? item.content ?? '';
    return [
      '<ul class="resultContentDocument">',
      `<li class="caption"><a href="${escapeHtml(url)}">${escapeHtml(title)}</a></li>`,
      `<li class="searchResult"><div class="document">${escapeHtml(snippet)}</div></li>`,
      '</ul>',
    ].join('');
  }).join('\n');
}
