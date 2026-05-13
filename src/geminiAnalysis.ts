import {GoogleGenAI, Type} from '@google/genai';
import type {AnalysisResult, AnalyzeRequest} from './analysisTypes';

const MODEL_NAME = 'gemini-3-flash-preview';

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    dishName: {type: Type.STRING},
    description: {type: Type.STRING},
    ingredients: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: {type: Type.STRING},
          amount: {type: Type.STRING},
          description: {type: Type.STRING},
        },
        required: ['name'],
      },
    },
    nutrition: {
      type: Type.OBJECT,
      properties: {
        calories: {type: Type.NUMBER},
        protein: {type: Type.NUMBER},
        carbs: {type: Type.NUMBER},
        fat: {type: Type.NUMBER},
        fiber: {type: Type.NUMBER},
        sugar: {type: Type.NUMBER},
        sodium: {type: Type.NUMBER},
      },
      required: ['calories', 'protein', 'carbs', 'fat', 'fiber'],
    },
    healthScore: {type: Type.NUMBER},
  },
  required: ['dishName', 'description', 'ingredients', 'nutrition', 'healthScore'],
};

function getBase64Payload(imageData: string) {
  const commaIndex = imageData.indexOf(',');
  return commaIndex === -1 ? imageData : imageData.slice(commaIndex + 1);
}

function createHttpError(message: string, statusCode: number) {
  const error = new Error(message) as Error & {statusCode: number; code?: string};
  error.statusCode = statusCode;
  return error;
}

/**
 * 包装重试逻辑：Gemini preview 模型偶发返回 5xx 时自动重试，避免让用户手动点重试
 * @param fn        待执行的异步操作
 * @param maxAttempts 最大尝试次数（含首次）
 * @param delayMs   重试前的等待时间（ms）
 */
async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3, delayMs = 800): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      // 最后一次失败不等待，直接抛出；否则等待后重试
      if (i < maxAttempts - 1) {
        await new Promise<void>(r => setTimeout(r, delayMs));
      }
    }
  }
  throw lastErr;
}

export async function analyzeDishImage(
  {imageData, mimeType}: AnalyzeRequest,
  apiKey: string | undefined,
): Promise<AnalysisResult> {
  if (!apiKey) {
    const error = createHttpError('Server is missing GEMINI_API_KEY.', 500);
    error.code = 'missing_api_key';
    throw error;
  }

  if (!imageData || !mimeType?.startsWith('image/')) {
    const error = createHttpError('A valid image and MIME type are required.', 400);
    error.code = 'invalid_image_payload';
    throw error;
  }

  const ai = new GoogleGenAI({apiKey});

  const prompt = `请分析这张餐食图片，并提供详细结果：
      1. 餐食名称。
      2. 简短描述。
      3. 识别到的主要食材列表。
      4. 对整份餐食的营养估算，包括热量、蛋白质、碳水、脂肪、膳食纤维。
      5. 基于营养均衡程度给出 1 到 100 的健康评分。
      
      请严格返回 JSON 格式。JSON 字段名保持 schema 中的英文命名，但所有字符串字段的内容必须使用简体中文。`;

  // 用 withRetry 包装 Gemini API 调用：预览模型偶发性错误时最多自动重试 3 次
  const response = await withRetry(() => ai.models.generateContent({
    model: MODEL_NAME,
    contents: [
      {
        role: 'user',
        parts: [
          {text: prompt},
          {
            inlineData: {
              mimeType,
              data: getBase64Payload(imageData),
            },
          },
        ],
      },
    ],
    config: {
      responseMimeType: 'application/json',
      responseSchema,
    },
  }));

  if (!response.text) {
    const error = createHttpError('No analysis data received from AI.', 502);
    error.code = 'empty_ai_response';
    throw error;
  }

  return JSON.parse(response.text) as AnalysisResult;
}
