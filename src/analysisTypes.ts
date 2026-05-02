export interface Ingredient {
  name: string;
  amount?: string;
  description?: string;
}

export interface Nutrition {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar?: number;
  sodium?: number;
}

export interface AnalysisResult {
  dishName: string;
  description: string;
  ingredients: Ingredient[];
  nutrition: Nutrition;
  healthScore: number;
}

export interface AnalyzeRequest {
  imageData: string;
  mimeType: string;
}
