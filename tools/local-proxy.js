const http = require('http');
const https = require('https');

const PORT = Number(process.env.JW_PROXY_PORT || 3001);
const ALLOWED_HOSTS = new Set([
  'wol.jw.org',
  'www.jw.org',
  'b.jw-cdn.org',
  'cfp2.jw-cdn.org',
  'cms-imgp.jw-cdn.org',
]);

function send(res, status, body, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(status, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,HEAD,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Accept,Accept-Language,Content-Type,Range',
    'Content-Type': contentType,
  });
  res.end(body);
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    send(res, 204, '');
    return;
  }

  const requestUrl = new URL(req.url || '/', `http://localhost:${PORT}`);
  if (requestUrl.pathname === '/ollama') {
    proxyOllama(req, res);
    return;
  }

  if (requestUrl.pathname !== '/proxy') {
    send(res, 404, 'Not found');
    return;
  }

  const targetRaw = requestUrl.searchParams.get('url');
  if (!targetRaw) {
    send(res, 400, 'Missing url');
    return;
  }

  let target;
  try {
    target = new URL(targetRaw);
  } catch {
    send(res, 400, 'Invalid url');
    return;
  }

  if (target.protocol !== 'https:' || !ALLOWED_HOSTS.has(target.hostname)) {
    send(res, 403, 'Host not allowed');
    return;
  }

  proxyTarget(target, req, res, 0);
});

function proxyTarget(target, req, res, redirects) {
  const headers = {
    Accept: req.headers.accept || '*/*',
    'Accept-Language': req.headers['accept-language'] || 'en-US,en;q=0.9',
    'User-Agent': 'Mozilla/5.0 JW Study Assistant Local Proxy',
  };
  if (req.headers.range) headers.Range = req.headers.range;

  const upstream = https.request(
    {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || 443,
      path: `${target.pathname}${target.search}`,
      method: 'GET',
      family: 4,
      rejectUnauthorized: false,
      headers,
    },
    (upstreamRes) => {
      const location = upstreamRes.headers.location;
      if (
        location
        && upstreamRes.statusCode
        && upstreamRes.statusCode >= 300
        && upstreamRes.statusCode < 400
        && redirects < 5
      ) {
        upstreamRes.resume();
        const next = new URL(location, target);
        proxyTarget(next, req, res, redirects + 1);
        return;
      }
      res.writeHead(upstreamRes.statusCode || 200, {
        ...upstreamRes.headers,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,HEAD,OPTIONS',
        'Access-Control-Allow-Headers': 'Accept,Accept-Language,Content-Type,Range',
      });
      upstreamRes.pipe(res);
    },
  );

  upstream.setTimeout(25000, () => {
    upstream.destroy(new Error('Upstream timeout'));
  });
  upstream.on('error', (error) => {
    if (!res.headersSent) {
      send(res, 502, error.message);
    } else {
      res.destroy(error);
    }
  });
  upstream.end();
}

function proxyOllama(req, res) {
  if (req.method !== 'POST') {
    send(res, 405, 'Method not allowed');
    return;
  }

  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', () => {
    const body = Buffer.concat(chunks);
    const upstream = http.request(
      {
        protocol: 'http:',
        hostname: '127.0.0.1',
        port: 11434,
        path: '/api/generate',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': body.length,
        },
      },
      (upstreamRes) => {
        res.writeHead(upstreamRes.statusCode || 200, {
          ...upstreamRes.headers,
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,HEAD,POST,OPTIONS',
          'Access-Control-Allow-Headers': 'Accept,Accept-Language,Content-Type,Range',
        });
        upstreamRes.pipe(res);
      },
    );
    upstream.setTimeout(120000, () => upstream.destroy(new Error('Ollama timeout')));
    upstream.on('error', (error) => {
      if (!res.headersSent) send(res, 502, `Ollama unavailable: ${error.message}`);
      else res.destroy(error);
    });
    upstream.end(body);
  });
}

server.on('error', (error) => {
  if (error && error.code === 'EADDRINUSE') {
    console.log(`JW local proxy already running on http://localhost:${PORT}`);
    process.exit(0);
  }
  throw error;
});

server.listen(PORT, () => {
  console.log(`JW local proxy listening on http://localhost:${PORT}`);
});
