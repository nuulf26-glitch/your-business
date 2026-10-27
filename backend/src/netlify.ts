import { createServer, request as httpRequest, Server } from 'node:http';
import { createApp } from './main';

type NetlifyEvent = {
  path: string;
  rawUrl?: string;
  httpMethod: string;
  headers?: Record<string, string | undefined>;
  body?: string | null;
  isBase64Encoded?: boolean;
};

type Runtime = { server: Server; port: number };
let runtime: Promise<Runtime> | undefined;

async function startRuntime(): Promise<Runtime> {
  process.env.DATABASE_URL ||= process.env.NETLIFY_DB_URL || '';
  const app = await createApp();
  await app.init();
  const server = createServer(app.getHttpAdapter().getInstance());
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => { server.off('error', reject); resolve(); });
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Could not start local API adapter');
  return { server, port: address.port };
}

export async function handler(event: NetlifyEvent) {
  try {
    runtime ||= startRuntime();
    const { port } = await runtime;
    const sourceUrl = event.rawUrl ? new URL(event.rawUrl) : undefined;
    const functionPrefix = '/.netlify/functions/api';
    const sourcePath = sourceUrl?.pathname || event.path;
    const apiPath = sourcePath.startsWith(functionPrefix)
      ? `/api${sourcePath.slice(functionPrefix.length) || '/'}`
      : sourcePath;
    const query = sourceUrl?.search || new URLSearchParams((event as any).queryStringParameters || {}).toString();
    const path = `${apiPath}${query && !query.startsWith('?') ? `?${query}` : query}`;
    const headers = { ...(event.headers || {}) } as Record<string, string>;
    for (const name of Object.keys(headers)) {
      if (['host', 'content-length', 'connection'].includes(name.toLowerCase())) delete headers[name];
    }
    const body = event.body == null ? undefined : event.isBase64Encoded ? Buffer.from(event.body, 'base64') : Buffer.from(event.body);
    const response = await new Promise<{ statusCode: number; headers: Record<string, string | string[]>; body: Buffer }>((resolve, reject) => {
      const req = httpRequest({ hostname: '127.0.0.1', port, path, method: event.httpMethod, headers }, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
        res.on('end', () => resolve({ statusCode: res.statusCode || 200, headers: res.headers as Record<string, string | string[]>, body: Buffer.concat(chunks) }));
      });
      req.once('error', reject);
      if (body) req.write(body);
      req.end();
    });
    const outgoingHeaders: Record<string, string> = {};
    const multiValueHeaders: Record<string, string[]> = {};
    for (const [name, value] of Object.entries(response.headers)) {
      if (value == null) continue;
      if (name.toLowerCase() === 'set-cookie') multiValueHeaders[name] = Array.isArray(value) ? value : [value];
      else outgoingHeaders[name] = Array.isArray(value) ? value.join(', ') : value;
    }
    const contentType = String(response.headers['content-type'] || '');
    const isBinary = contentType.startsWith('image/') || contentType.includes('application/octet-stream');
    return {
      statusCode: response.statusCode,
      headers: outgoingHeaders,
      ...(Object.keys(multiValueHeaders).length ? { multiValueHeaders } : {}),
      body: isBinary ? response.body.toString('base64') : response.body.toString('utf8'),
      isBase64Encoded: isBinary,
    };
  } catch (error) {
    console.error('GETCYB API invocation failed', error instanceof Error ? error.message : 'Unknown error');
    return { statusCode: 503, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: 'GETCYB API is temporarily unavailable.' }) };
  }
}
