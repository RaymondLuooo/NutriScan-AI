import React, { useState, useRef } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { Camera, Upload, Loader2, Utensils, Info, AlertCircle, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---
interface Ingredient {
  name: string;
  amount?: string;
  description?: string;
}

interface Nutrition {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar?: number;
  sodium?: number;
}

interface AnalysisResult {
  dishName: string;
  description: string;
  ingredients: Ingredient[];
  nutrition: Nutrition;
  healthScore: number; // 1-100
}

// --- Constants ---
const MODEL_NAME = "gemini-3-flash-preview";

export default function App() {
  const [image, setImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);

  // --- AI Logic ---
  const analyzeImage = async (base64Data: string) => {
    setIsAnalyzing(true);
    setError(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      
      const prompt = `Analyze this dish image. Provide a detailed breakdown including:
      1. The name of the dish.
      2. A brief description of the dish.
      3. A list of main ingredients identified.
      4. Estimated nutritional values (calories, protein, carbs, fat, fiber) for the entire portion shown.
      5. A health score from 1 to 100 based on nutritional balance.
      
      Return the data strictly in JSON format.`;

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: "image/jpeg",
                  data: base64Data.split(',')[1],
                },
              },
            ],
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              dishName: { type: Type.STRING },
              description: { type: Type.STRING },
              ingredients: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    amount: { type: Type.STRING },
                    description: { type: Type.STRING },
                  },
                  required: ["name"],
                },
              },
              nutrition: {
                type: Type.OBJECT,
                properties: {
                  calories: { type: Type.NUMBER },
                  protein: { type: Type.NUMBER },
                  carbs: { type: Type.NUMBER },
                  fat: { type: Type.NUMBER },
                  fiber: { type: Type.NUMBER },
                  sugar: { type: Type.NUMBER },
                  sodium: { type: Type.NUMBER },
                },
                required: ["calories", "protein", "carbs", "fat", "fiber"],
              },
              healthScore: { type: Type.NUMBER },
            },
            required: ["dishName", "description", "ingredients", "nutrition", "healthScore"],
          },
        },
      });

      const text = response.text;
      if (text) {
        const parsedResult = JSON.parse(text) as AnalysisResult;
        setResult(parsedResult);
      } else {
        throw new Error("No analysis data received from AI.");
      }
    } catch (err) {
      console.error("Analysis Error:", err);
      setError("Failed to analyze the image. Please try again with a clearer photo.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // --- Handlers ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setImage(base64);
        analyzeImage(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const startCamera = async () => {
    setIsCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera Error:", err);
      setError("Could not access camera. Please check permissions.");
      setIsCameraActive(false);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        const base64 = canvas.toDataURL('image/jpeg');
        setImage(base64);
        stopCamera();
        analyzeImage(base64);
      }
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const reset = () => {
    setImage(null);
    setResult(null);
    setError(null);
    setIsAnalyzing(false);
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] font-sans selection:bg-emerald-100">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-black/5 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-200">
              <Utensils size={22} />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">NutriScan AI</h1>
          </div>
          {image && (
            <button 
              onClick={reset}
              className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
            >
              <RefreshCw size={16} />
              New Scan
            </button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        <AnimatePresence mode="wait">
          {!image && !isCameraActive ? (
            <motion.div
              key="upload-area"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center justify-center min-h-[60vh] text-center"
            >
              <div className="max-w-xl">
                <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
                  Know exactly what's <br /> on your plate.
                </h2>
                <p className="text-lg text-gray-500 mb-10">
                  Upload a photo of your meal to get instant nutritional analysis, 
                  ingredient identification, and health insights.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center justify-center gap-3 bg-white border border-black/10 px-8 py-4 rounded-2xl font-medium hover:bg-gray-50 transition-all shadow-sm active:scale-95"
                  >
                    <Upload size={20} className="text-emerald-500" />
                    Upload Photo
                  </button>
                  <button
                    onClick={startCamera}
                    className="flex items-center justify-center gap-3 bg-emerald-500 text-white px-8 py-4 rounded-2xl font-medium hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-200 active:scale-95"
                  >
                    <Camera size={20} />
                    Take Photo
                  </button>
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/*"
                  className="hidden"
                />
              </div>
            </motion.div>
          ) : isCameraActive ? (
            <motion.div
              key="camera-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-black flex flex-col"
            >
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="flex-1 object-cover"
              />
              <div className="absolute bottom-12 left-0 right-0 flex items-center justify-center gap-8">
                <button
                  onClick={stopCamera}
                  className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/30"
                >
                  <span className="text-sm font-medium">Cancel</span>
                </button>
                <button
                  onClick={capturePhoto}
                  className="w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-2xl active:scale-90 transition-transform"
                >
                  <div className="w-16 h-16 rounded-full border-4 border-black/5" />
                </button>
                <div className="w-16" /> {/* Spacer */}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="results-view"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-12"
            >
              {/* Left Column: Image & Basic Info */}
              <div className="lg:col-span-5 space-y-8">
                <div className="relative aspect-square rounded-3xl overflow-hidden shadow-2xl ring-1 ring-black/5">
                  <img
                    src={image!}
                    alt="Uploaded dish"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  {isAnalyzing && (
                    <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex flex-col items-center justify-center text-emerald-600">
                      <Loader2 size={48} className="animate-spin mb-4" />
                      <p className="font-medium animate-pulse">Analyzing your meal...</p>
                    </div>
                  )}
                </div>

                {result && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white p-8 rounded-3xl shadow-sm border border-black/5"
                  >
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Health Score</h3>
                      <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                        result.healthScore > 70 ? 'bg-emerald-100 text-emerald-700' : 
                        result.healthScore > 40 ? 'bg-amber-100 text-amber-700' : 
                        'bg-rose-100 text-rose-700'
                      }`}>
                        {result.healthScore > 70 ? 'Excellent' : result.healthScore > 40 ? 'Good' : 'Moderate'}
                      </div>
                    </div>
                    <div className="flex items-end gap-4">
                      <span className="text-6xl font-bold tracking-tighter">{result.healthScore}</span>
                      <span className="text-gray-400 mb-2 font-medium">/ 100</span>
                    </div>
                    <div className="mt-6 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${result.healthScore}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className={`h-full rounded-full ${
                          result.healthScore > 70 ? 'bg-emerald-500' : 
                          result.healthScore > 40 ? 'bg-amber-500' : 
                          'bg-rose-500'
                        }`}
                      />
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Right Column: Analysis Data */}
              <div className="lg:col-span-7 space-y-10">
                {error && (
                  <div className="bg-rose-50 border border-rose-100 p-6 rounded-2xl flex items-start gap-4 text-rose-800">
                    <AlertCircle className="shrink-0" />
                    <div>
                      <p className="font-semibold">Analysis Failed</p>
                      <p className="text-sm opacity-90">{error}</p>
                      <button 
                        onClick={() => image && analyzeImage(image)}
                        className="mt-3 text-sm font-bold underline underline-offset-4"
                      >
                        Try Again
                      </button>
                    </div>
                  </div>
                )}

                {result ? (
                  <div className="space-y-12">
                    <section>
                      <h2 className="text-4xl font-bold tracking-tight mb-4">{result.dishName}</h2>
                      <p className="text-lg text-gray-500 leading-relaxed">{result.description}</p>
                    </section>

                    <section>
                      <div className="flex items-center gap-2 mb-6">
                        <Info size={18} className="text-emerald-500" />
                        <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400">Nutritional Breakdown</h3>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        <NutrientCard label="Calories" value={result.nutrition.calories} unit="kcal" color="bg-gray-900 text-white" />
                        <NutrientCard label="Protein" value={result.nutrition.protein} unit="g" color="bg-emerald-50" />
                        <NutrientCard label="Carbs" value={result.nutrition.carbs} unit="g" color="bg-blue-50" />
                        <NutrientCard label="Fat" value={result.nutrition.fat} unit="g" color="bg-amber-50" />
                        <NutrientCard label="Fiber" value={result.nutrition.fiber} unit="g" color="bg-purple-50" />
                        {result.nutrition.sugar !== undefined && (
                          <NutrientCard label="Sugar" value={result.nutrition.sugar} unit="g" color="bg-rose-50" />
                        )}
                      </div>
                    </section>

                    <section>
                      <div className="flex items-center gap-2 mb-6">
                        <Utensils size={18} className="text-emerald-500" />
                        <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400">Ingredients Identified</h3>
                      </div>
                      <div className="grid grid-cols-1 gap-3">
                        {result.ingredients.map((ing, idx) => (
                          <motion.div
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            key={idx}
                            className="group flex items-center justify-between p-4 bg-white rounded-2xl border border-black/5 hover:border-emerald-200 transition-all"
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-2 h-2 rounded-full bg-emerald-400" />
                              <div>
                                <p className="font-semibold text-gray-900">{ing.name}</p>
                                {ing.description && <p className="text-xs text-gray-400 mt-0.5">{ing.description}</p>}
                              </div>
                            </div>
                            {ing.amount && (
                              <span className="text-sm font-medium text-gray-400 bg-gray-50 px-3 py-1 rounded-lg">
                                {ing.amount}
                              </span>
                            )}
                          </motion.div>
                        ))}
                      </div>
                    </section>
                  </div>
                ) : (
                  !isAnalyzing && !error && (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 py-20">
                      <Loader2 size={40} className="animate-spin mb-4 opacity-20" />
                      <p>Waiting for analysis...</p>
                    </div>
                  )
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="max-w-5xl mx-auto px-6 py-12 border-t border-black/5 text-center">
        <p className="text-sm text-gray-400">
          Powered by Gemini AI • Nutritional values are estimates based on visual analysis.
        </p>
      </footer>
    </div>
  );
}

function NutrientCard({ label, value, unit, color }: { label: string; value: number; unit: string; color: string }) {
  return (
    <div className={`p-6 rounded-3xl border border-black/5 flex flex-col justify-between ${color}`}>
      <span className="text-xs font-bold uppercase tracking-wider opacity-60 mb-4">{label}</span>
      <div className="flex items-baseline gap-1">
        <span className="text-3xl font-bold tracking-tighter">{value}</span>
        <span className="text-sm font-medium opacity-60">{unit}</span>
      </div>
    </div>
  );
}
