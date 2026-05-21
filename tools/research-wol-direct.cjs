const fs = require('fs');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const OUT = 'docs/wol-direct-research.json';

const requestHeaders = {
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7',
  'accept-language': 'en-US,en;q=0.9,ht;q=0.8',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
};

const requests = [
  ['en_home', 'https://wol.jw.org/en/wol/h/r1/lp-e'],
  ['ht_home', 'https://wol.jw.org/ht/wol/h/r60/lp-cr'],
  ['en_daily_text_page', 'https://wol.jw.org/en/wol/dt/r1/lp-e/2026/5/19'],
  ['ht_daily_text_page', 'https://wol.jw.org/ht/wol/dt/r60/lp-cr/2026/5/19'],
  ['en_daily_text_json', 'https://wol.jw.org/wol/dt/r1/lp-e/2026/5/19'],
  ['ht_daily_text_json', 'https://wol.jw.org/wol/dt/r60/lp-cr/2026/5/19'],
  ['en_scripture_popup_bc', 'https://wol.jw.org/wol/bc/r1/lp-e/1102026204/50/0'],
  ['ht_scripture_popup_bc', 'https://wol.jw.org/wol/bc/r60/lp-cr/1102026204/50/0'],
  ['en_publication_popup_pc', 'https://wol.jw.org/wol/pc/r1/lp-e/1102026204/12/0'],
  ['ht_publication_popup_pc', 'https://wol.jw.org/wol/pc/r60/lp-cr/1102026204/12/0'],
  ['en_citation_api', 'https://wol.jw.org/wol/api/v1/citation/r1/lp-e/publication/1102026204/38/41'],
  ['ht_citation_api', 'https://wol.jw.org/wol/api/v1/citation/r60/lp-cr/publication/1102026204/38/41'],
  ['en_search_suggestions', 'https://wol.jw.org/wol/sg/r1/lp-e?q=love'],
  ['ht_search_suggestions', 'https://wol.jw.org/wol/sg/r60/lp-cr?q=jan%20ak%20ja'],
  ['en_search_results', 'https://wol.jw.org/en/wol/s/r1/lp-e?q=love&p=par&r=occ&st=a'],
  ['ht_search_results', 'https://wol.jw.org/ht/wol/s/r60/lp-cr?q=jan%20ak%20jak&p=par&r=occ'],
  ['en_scripture_lookup_redirect', 'https://wol.jw.org/en/wol/qt/r1/lp-e?q=John%203%3A16&p=par&r=occ&st=b'],
  ['en_scripture_lookup_page', 'https://wol.jw.org/en/wol/l/r1/lp-e?q=John+3%3A16'],
  ['en_bible_nav', 'https://wol.jw.org/en/wol/binav/r1/lp-e'],
  ['ht_bible_nav', 'https://wol.jw.org/ht/wol/binav/r60/lp-cr'],
  ['en_bible_chapter', 'https://wol.jw.org/en/wol/b/r1/lp-e/nwtsty/43/3'],
  ['ht_bible_chapter', 'https://wol.jw.org/ht/wol/b/r60/lp-cr/nwt/43/3'],
  ['en_publications_index', 'https://wol.jw.org/en/wol/library/r1/lp-e/all-publications'],
  ['ht_publications_index', 'https://wol.jw.org/ht/wol/library/r60/lp-cr/all-publications'],
  ['en_meeting_workbook_month', 'https://wol.jw.org/en/wol/library/r1/lp-e/all-publications/meeting-workbooks/life-and-ministry-meeting-workbook-2026/may'],
  ['en_meeting_article', 'https://wol.jw.org/en/wol/d/r1/lp-e/202026162'],
  ['ht_article_from_search', 'https://wol.jw.org/ht/wol/d/r60/lp-cr/2022241?q=jan+ak+jak&p=par'],
  ['en_meetings_week', 'https://wol.jw.org/en/wol/meetings/r1/lp-e/2026/20'],
  ['ht_meetings_week', 'https://wol.jw.org/ht/wol/meetings/r60/lp-cr/2026/20'],
  ['en_document_audio_daily_text', 'https://b.jw-cdn.org/apis/pub-media/GETPUBMEDIALINKS?langwritten=E&txtCMSLang=E&fileformat=mp3&docid=1102026204&output=json'],
  ['ht_document_audio_daily_text', 'https://b.jw-cdn.org/apis/pub-media/GETPUBMEDIALINKS?langwritten=CR&txtCMSLang=CR&fileformat=mp3&docid=1102026204&output=json'],
  ['en_document_audio_meeting', 'https://b.jw-cdn.org/apis/pub-media/GETPUBMEDIALINKS?langwritten=E&txtCMSLang=E&fileformat=mp3&docid=202026162&output=json'],
  ['en_wol_ls_document_options', 'https://wol.jw.org/wol/ls?locale=en&type=documentOptions&wtlocale=E'],
  ['ht_wol_ls_document_options', 'https://wol.jw.org/wol/ls?locale=ht&type=documentOptions&wtlocale=CR'],
  ['en_publication_thumbnail', 'https://wol.jw.org/en/wol/publication/r1/lp-e/nwtsty/thumbnail'],
  ['en_article_thumbnail', 'https://wol.jw.org/en/wol/d/r1/lp-e/202026162/thumbnail']
];

function pickHeaders(headers) {
  const wanted = [
    'access-control-allow-origin',
    'age',
    'cache-control',
    'content-encoding',
    'content-length',
    'content-type',
    'date',
    'etag',
    'expires',
    'last-modified',
    'location',
    'server',
    'strict-transport-security',
    'vary',
    'via',
    'x-amz-cf-id',
    'x-amz-cf-pop',
    'x-cache',
  ];
  const out = {};
  for (const key of wanted) {
    const value = headers.get(key);
    if (value != null) out[key] = value;
  }
  return out;
}

function sampleJsonShape(value, depth = 0) {
  if (depth > 3) return Array.isArray(value) ? ['...'] : typeof value;
  if (Array.isArray(value)) return value.length ? [sampleJsonShape(value[0], depth + 1)] : [];
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).slice(0, 50)) out[key] = sampleJsonShape(value[key], depth + 1);
    return out;
  }
  return typeof value;
}

function extractHtmlInfo(text) {
  const title = (text.match(/<title>([\s\S]*?)<\/title>/i) || [])[1]?.replace(/\s+/g, ' ').trim();
  const hiddenInputs = [...text.matchAll(/<input[^>]+type=["']hidden["'][^>]*>/gi)]
    .map((m) => m[0].replace(/\s+/g, ' '))
    .filter((tag) => /locale|rsconf|lib|lang|title|share|today|audio|pub|content/i.test(tag))
    .slice(0, 60);
  const scripts = [...text.matchAll(/<script[^>]+src=["']([^"']+)/gi)].map((m) => m[1]).slice(0, 20);
  const links = [...text.matchAll(/href=["']([^"']+)/gi)]
    .map((m) => m[1].replace(/&amp;/g, '&'))
    .filter((href) => /\/wol\/(bc|pc|d|b|s|sg|dt|meetings|library|publication|api|mp|ls)|GETPUBMEDIALINKS/i.test(href))
    .slice(0, 120);
  return { title, hiddenInputs, scripts, relevantLinks: links };
}

function bodyInfo(contentType, text) {
  const info = { length: text.length, sample: text.slice(0, 2200) };
  if (/json/i.test(contentType)) {
    try {
      const json = JSON.parse(text);
      info.jsonShape = sampleJsonShape(json);
      info.sample = JSON.stringify(json, null, 2).slice(0, 2200);
    } catch {}
  } else if (/html/i.test(contentType)) {
    info.html = extractHtmlInfo(text);
  }
  return info;
}

async function fetchOne(name, url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(url, {
      redirect: 'manual',
      signal: controller.signal,
      headers: requestHeaders,
    });
    const contentType = response.headers.get('content-type') || '';
    const isBinary = /image|audio|video|font|octet-stream/i.test(contentType);
    const text = isBinary ? '' : await response.text();
    return {
      name,
      request: { method: 'GET', url, headers: requestHeaders },
      response: {
        status: response.status,
        statusText: response.statusText,
        headers: pickHeaders(response.headers),
        contentType,
        binary: isBinary,
        ...bodyInfo(contentType, text),
      },
    };
  } catch (error) {
    return { name, request: { method: 'GET', url, headers: requestHeaders }, error: `${error.name}: ${error.message}` };
  } finally {
    clearTimeout(timeout);
  }
}

(async () => {
  const results = [];
  for (const [name, url] of requests) {
    console.log(name, url);
    results.push(await fetchOne(name, url));
  }
  fs.writeFileSync(OUT, JSON.stringify({
    capturedAt: new Date().toISOString(),
    note: 'WOL-focused direct request research. Body samples are intentionally truncated.',
    results,
  }, null, 2));
  console.log(`Wrote ${OUT}`);
})();
