import {analyzeDishImage} from '../../src/geminiAnalysis';

declare const Netlify: {
  env: {
    get(name: string): string | undefined;
  };
};

function getGeminiApiKey() {
  return typeof Netlify === 'undefined' ? undefined : Netlify.env.get('GEMINI_API_KEY');
}

function jsonResponse(payload: unknown, status = 200) {
  return Response.json(payload, {status});
}

export default async (req: Request) => {
  if (req.method !== 'POST') {
    return jsonResponse({error: 'Method not allowed.'}, 405);
  }

  try {
    const result = await analyzeDishImage(await req.json(), getGeminiApiKey());
    return jsonResponse(result);
  } catch (error) {
    console.error('Analysis Function Error:', error);

    const statusCode =
      typeof error === 'object' &&
      error !== null &&
      'statusCode' in error &&
      typeof error.statusCode === 'number'
        ? error.statusCode
        : 500;

    const code =
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof error.code === 'string'
        ? error.code
        : 'analysis_failed';

    const message =
      statusCode < 500 && error instanceof Error
        ? error.message
        : 'Failed to analyze the image.';

    return jsonResponse({error: message, code}, statusCode);
  }
};

export const config = {
  path: '/api/analyze',
  method: 'POST',
};
