import type {IncomingMessage, ServerResponse} from 'node:http';
import {analyzeDishImage} from '../src/geminiAnalysis';

type ApiRequest = IncomingMessage & {
  body?: unknown;
  method?: string;
};

async function readJsonBody(req: ApiRequest) {
  if (req.body) {
    return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const rawBody = Buffer.concat(chunks).toString('utf8');
  return rawBody ? JSON.parse(rawBody) : {};
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

export default async function handler(req: ApiRequest, res: ServerResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    sendJson(res, 405, {error: 'Method not allowed.'});
    return;
  }

  try {
    const payload = await readJsonBody(req);
    const result = await analyzeDishImage(
      payload as Parameters<typeof analyzeDishImage>[0],
      process.env.GEMINI_API_KEY,
    );
    sendJson(res, 200, result);
  } catch (error) {
    console.error('Analysis API Error:', error);

    const statusCode =
      typeof error === 'object' &&
      error !== null &&
      'statusCode' in error &&
      typeof error.statusCode === 'number'
        ? error.statusCode
        : 500;

    const message =
      statusCode < 500 && error instanceof Error
        ? error.message
        : 'Failed to analyze the image.';

    sendJson(res, statusCode, {error: message});
  }
}
