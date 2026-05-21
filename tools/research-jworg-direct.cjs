const fs = require('fs');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const OUT = 'docs/jworg-direct-research.json';

const requests = [
  ['home_en', 'https://www.jw.org/en/'],
  ['search_en_love', 'https://www.jw.org/en/search/?q=love'],
  ['library_en', 'https://www.jw.org/en/library/'],
  ['bible_chapter_en', 'https://www.jw.org/en/library/bible/study-bible/books/genesis/1/'],
  ['bible_json_data_en', 'https://www.jw.org/en/library/bible/study-bible/books/json/data/1001000-1001999'],
  ['bible_json_html_en_crossrefs', 'https://www.jw.org/en/library/bible/study-bible/books/json/html/19102025,23042005,23045018,45001020,58001010,66004011,66010006'],
  ['bible_json_translations_en', 'https://www.jw.org/en/library/bible/study-bible/books/json/translations/1001001-1001001'],
  ['bible_json_translations_html_en', 'https://www.jw.org/en/library/bible/study-bible/books/json/translations-html/1001001-1001001'],
  ['bible_audio_en', 'https://b.jw-cdn.org/apis/pub-media/GETPUBMEDIALINKS?booknum=1&output=json&pub=nwt&fileformat=MP3&alllangs=0&track=1&langwritten=E&txtCMSLang=E'],
  ['media_videos_en', 'https://www.jw.org/en/library/videos/'],
  ['mediator_languages_en', 'https://b.jw-cdn.org/apis/mediator/v1/languages/E/all?clientType=www'],
  ['mediator_translations_en', 'https://b.jw-cdn.org/apis/mediator/v1/translations/E?clientType=www'],
  ['mediator_categories_en', 'https://b.jw-cdn.org/apis/mediator/v1/categories/E?detailed=1&clientType=www'],
  ['mediator_featured_media_en', 'https://b.jw-cdn.org/apis/mediator/v1/categories/E/FeaturedLibraryLanding?detailed=1&mediaLimit=3&clientType=www'],
  ['mediator_latest_media_en', 'https://b.jw-cdn.org/apis/mediator/v1/categories/E/LatestVideos?detailed=1&mediaLimit=3&clientType=www'],
  ['mediator_media_item_en', 'https://b.jw-cdn.org/apis/mediator/v1/media-items/E/pub-mwbv_202605_1_VIDEO?clientType=www'],
  ['jworg_jwt', 'https://b.jw-cdn.org/tokens/jworg.jwt'],
  ['finder_doc_en', 'https://www.jw.org/finder?wtlocale=E&docid=202026162&prefer=content'],
  ['finder_bible_en', 'https://www.jw.org/finder?wtlocale=E&pub=nwt&bible=1001001-1001001&prefer=content'],
  ['open_doc_en', 'https://www.jw.org/open?wtlocale=E&docid=202026162'],
  ['meeting_page_en', 'https://www.jw.org/en/jehovahs-witnesses/meetings/'],
  ['meeting_workbook_index_en', 'https://www.jw.org/en/library/jw-meeting-workbook/'],
  ['meeting_workbook_index_es', 'https://www.jw.org/es/biblioteca/guia-actividades-reunion-testigos-jehova/'],
  ['meeting_workbook_media_es', 'https://b.jw-cdn.org/apis/pub-media/GETPUBMEDIALINKS?pub=mwb&issue=202605&langwritten=S&fileformat=PDF,EPUB,JWPUB,MP3&output=json'],
  ['magazines_fr', 'https://www.jw.org/fr/biblioth%C3%A8que/revues/'],
  ['watchtower_study_fr_march_2026', 'https://www.jw.org/fr/biblioth%C3%A8que/revues/tour-de-garde-etude-mars-2026/'],
  ['watchtower_study_media_fr_march_2026', 'https://b.jw-cdn.org/apis/pub-media/GETPUBMEDIALINKS?issue=202603&output=json&pub=w&fileformat=PDF,EPUB,JWPUB,RTF,TXT,BRL,BES,DAISY&alllangs=0&langwritten=F&txtCMSLang=F'],
  ['i18n_en', 'https://www.jw.org/en/i18n.js?v=2552828400'],
  ['i18n_es', 'https://www.jw.org/es/i18n.js?v=2552828400'],
  ['i18n_fr', 'https://www.jw.org/fr/i18n.js?v=2552828400'],
];

const requestHeaders = {
  'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7',
  'accept-language': 'en-US,en;q=0.9,es;q=0.8,fr;q=0.7',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
};

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
    'x-built-on',
    'x-cache',
    'x-frame-options',
    'x-page-built',
  ];
  const out = {};
  for (const key of wanted) {
    const value = headers.get(key);
    if (value != null) out[key] = value;
  }
  return out;
}

function extractPageConfig(text) {
  const attrs = {};
  for (const match of text.matchAll(/\s(data-[a-zA-Z0-9_-]+)="([^"]*)"/g)) {
    if (/api|url|link|jwt|locale|pub|bible|media|lang|page|body|finder|open|wol/i.test(match[1])) {
      attrs[match[1]] = match[2].replace(/&amp;/g, '&');
    }
  }
  const hidden = [];
  for (const match of text.matchAll(/<input[^>]+type=["']hidden["'][^>]*>/gi)) {
    const tag = match[0].replace(/\s+/g, ' ');
    if (/api|locale|docid|pub|prefer|srcid|lang|download|media|bible/i.test(tag)) hidden.push(tag);
  }
  const scripts = [...text.matchAll(/<script[^>]+src=["']([^"']+)/gi)].map((m) => m[1]).slice(0, 20);
  const links = [...text.matchAll(/href=["']([^"']+)/gi)]
    .map((m) => m[1].replace(/&amp;/g, '&'))
    .filter((href) => /\/(library|biblioteca|biblioth|search|finder|open|bible|videos|jw-meeting|revues|reunion)|apis|json|GETPUB|mediator/i.test(href))
    .slice(0, 80);
  return { dataAttributes: attrs, hiddenInputs: hidden.slice(0, 40), scripts, relevantLinks: links };
}

function sampleJsonShape(value, depth = 0) {
  if (depth > 3) return Array.isArray(value) ? ['...'] : typeof value;
  if (Array.isArray(value)) return value.length ? [sampleJsonShape(value[0], depth + 1)] : [];
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).slice(0, 40)) out[key] = sampleJsonShape(value[key], depth + 1);
    return out;
  }
  return typeof value;
}

function bodyInfo(contentType, text) {
  const info = { length: text.length, sample: text.slice(0, 1800) };
  if (/json/i.test(contentType)) {
    try {
      const json = JSON.parse(text);
      info.jsonShape = sampleJsonShape(json);
      info.sample = JSON.stringify(json, null, 2).slice(0, 1800);
    } catch {}
  } else if (/html/i.test(contentType)) {
    info.pageConfig = extractPageConfig(text);
    const title = text.match(/<title>([\s\S]*?)<\/title>/i);
    if (title) info.title = title[1].replace(/\s+/g, ' ').trim();
  } else if (/javascript|text/i.test(contentType)) {
    const endpointTerms = [];
    for (const term of ['GETPUBMEDIALINKS', 'mediator', 'wol-link', 'insight/events', 'tokens/jworg.jwt', 'apis/i18n', 'json/data', 'json/html', 'json/translations', 'finder?', 'open?']) {
      const index = text.indexOf(term);
      if (index >= 0) endpointTerms.push({ term, snippet: text.slice(Math.max(0, index - 180), index + 360) });
    }
    info.endpointTerms = endpointTerms;
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
    const text = await response.text();
    const responseHeaders = pickHeaders(response.headers);
    return {
      name,
      request: { method: 'GET', url, headers: requestHeaders },
      response: {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        contentType: response.headers.get('content-type') || '',
        ...bodyInfo(response.headers.get('content-type') || '', text),
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
    note: 'JW.org-focused direct request research. Body samples are intentionally truncated.',
    results,
  }, null, 2));
  console.log(`Wrote ${OUT}`);
})();
