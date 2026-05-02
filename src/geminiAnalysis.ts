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

  const response = await ai.models.generateContent({
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
  });

  if (!response.text) {
    const error = createHttpError('No analysis data received from AI.', 502);
    error.code = 'empty_ai_response';
    throw error;
  }

  return JSON.parse(response.text) as AnalysisResult;
}
