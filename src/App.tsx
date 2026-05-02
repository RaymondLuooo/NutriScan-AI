import React, { useState, useRef } from 'react';
import { Camera, Upload, Loader2, Utensils, Info, AlertCircle, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { AnalysisResult } from './analysisTypes';

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function resizeImageDataUrl(dataUrl: string, maxSize = 1280) {
  const img = await loadImage(dataUrl);
  const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('无法准备图片用于分析。');
  }

  ctx.drawImage(img, 0, 0, width, height);
  return {
    imageData: canvas.toDataURL('image/jpeg', 0.82),
    mimeType: 'image/jpeg',
  };
}

export default function App() {
  const [image, setImage] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const analysisRequestIdRef = useRef(0);
  const cameraRequestIdRef = useRef(0);
  const [isCameraActive, setIsCameraActive] = useState(false);

  // --- AI Logic ---
  const analyzeImage = async (imageData: string, mimeType: string) => {
    const requestId = ++analysisRequestIdRef.current;
    setIsAnalyzing(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imageData, mimeType }),
      });

      const responseText = await response.text();
      const payload = responseText ? JSON.parse(responseText) : {};
      if (!response.ok) {
        throw new Error(payload.error || '未收到 AI 分析结果。');
      }

      if (requestId === analysisRequestIdRef.current) {
        setResult(payload as AnalysisResult);
      }
    } catch (err) {
      console.error("Analysis Error:", err);
      if (requestId === analysisRequestIdRef.current) {
        setError("图片分析失败，请换一张更清晰的照片后重试。");
      }
    } finally {
      if (requestId === analysisRequestIdRef.current) {
        setIsAnalyzing(false);
      }
    }
  };

  // --- Handlers ---
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const originalDataUrl = await readFileAsDataUrl(file);
        const { imageData, mimeType } = await resizeImageDataUrl(originalDataUrl);
        setImage(imageData);
        setImageMimeType(mimeType);
        analyzeImage(imageData, mimeType);
      } catch (err) {
        console.error("Image Upload Error:", err);
        setError("无法处理这张图片，请换一张照片试试。");
      }
    }
  };

  const startCamera = async () => {
    const requestId = ++cameraRequestIdRef.current;
    setIsCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (requestId !== cameraRequestIdRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      } else {
        stream.getTracks().forEach(track => track.stop());
        setIsCameraActive(false);
      }
    } catch (err) {
      console.error("Camera Error:", err);
      setError("无法访问摄像头，请检查浏览器权限设置。");
      setIsCameraActive(false);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 1280 / Math.max(videoRef.current.videoWidth, videoRef.current.videoHeight));
      canvas.width = Math.max(1, Math.round(videoRef.current.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(videoRef.current.videoHeight * scale));
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const base64 = canvas.toDataURL('image/jpeg', 0.82);
        setImage(base64);
        setImageMimeType('image/jpeg');
        stopCamera();
        analyzeImage(base64, 'image/jpeg');
      }
    }
  };

  const stopCamera = () => {
    cameraRequestIdRef.current += 1;
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const reset = () => {
    analysisRequestIdRef.current += 1;
    stopCamera();
    setImage(null);
    setImageMimeType(null);
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
              重新扫描
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
                  看懂这一餐的 <br /> 营养组成。
                </h2>
                <p className="text-lg text-gray-500 mb-10">
                  上传或拍摄餐食照片，即刻识别主要食材，
                  估算营养成分，并获得健康评分。
                </p>

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center justify-center gap-3 bg-white border border-black/10 px-8 py-4 rounded-2xl font-medium hover:bg-gray-50 transition-all shadow-sm active:scale-95"
                  >
                    <Upload size={20} className="text-emerald-500" />
                    上传照片
                  </button>
                  <button
                    onClick={startCamera}
                    className="flex items-center justify-center gap-3 bg-emerald-500 text-white px-8 py-4 rounded-2xl font-medium hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-200 active:scale-95"
                  >
                    <Camera size={20} />
                    拍照分析
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
                  <span className="text-sm font-medium">取消</span>
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
                    alt="已上传的餐食"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  {isAnalyzing && (
                    <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex flex-col items-center justify-center text-emerald-600">
                      <Loader2 size={48} className="animate-spin mb-4" />
                      <p className="font-medium animate-pulse">正在分析这餐...</p>
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
                      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">健康评分</h3>
                      <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                        result.healthScore > 70 ? 'bg-emerald-100 text-emerald-700' : 
                        result.healthScore > 40 ? 'bg-amber-100 text-amber-700' : 
                        'bg-rose-100 text-rose-700'
                      }`}>
                        {result.healthScore > 70 ? '优秀' : result.healthScore > 40 ? '良好' : '一般'}
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
                      <p className="font-semibold">分析失败</p>
                      <p className="text-sm opacity-90">{error}</p>
                      <button 
                        onClick={() => image && imageMimeType && analyzeImage(image, imageMimeType)}
                        className="mt-3 text-sm font-bold underline underline-offset-4"
                      >
                        重试
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
                        <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400">营养估算</h3>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        <NutrientCard label="热量" value={result.nutrition.calories} unit="kcal" color="bg-gray-900 text-white" />
                        <NutrientCard label="蛋白质" value={result.nutrition.protein} unit="g" color="bg-emerald-50" />
                        <NutrientCard label="碳水" value={result.nutrition.carbs} unit="g" color="bg-blue-50" />
                        <NutrientCard label="脂肪" value={result.nutrition.fat} unit="g" color="bg-amber-50" />
                        <NutrientCard label="膳食纤维" value={result.nutrition.fiber} unit="g" color="bg-purple-50" />
                        {result.nutrition.sugar !== undefined && (
                          <NutrientCard label="糖" value={result.nutrition.sugar} unit="g" color="bg-rose-50" />
                        )}
                      </div>
                    </section>

                    <section>
                      <div className="flex items-center gap-2 mb-6">
                        <Utensils size={18} className="text-emerald-500" />
                        <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400">识别到的食材</h3>
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
                      <p>等待分析结果...</p>
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
          由 Gemini AI 提供分析能力；营养数据基于图片估算，仅供参考。
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
