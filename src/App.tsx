import React, { useState, useRef } from 'react'; // useState/useRef: 管理图片状态与 DOM 引用
import { Camera, Upload, Loader2, Utensils, AlertCircle } from 'lucide-react'; // 仅保留实际渲染中使用的图标
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
    <div className="min-h-screen" style={{ background: 'var(--bg-page)', color: 'var(--text-primary)' }}>
      {/* Nav：毛玻璃顶栏，内容极简，品牌名居中或左对齐 */}
      <header
        style={{
          position: 'sticky', top: 0, zIndex: 50,
          background: 'rgba(245,245,247,0.82)',
          backdropFilter: 'saturate(180%) blur(20px)',
          WebkitBackdropFilter: 'saturate(180%) blur(20px)',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div className="max-w-[1280px] mx-auto px-6 sm:px-10 lg:px-16 w-full" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 52 }}>
          {/* Logo + 品牌名：字重 600，tracking 略收紧 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 28, height: 28, background: 'var(--color-accent)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Utensils size={15} color="#fff" />
            </div>
            <span style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.3px', color: 'var(--text-primary)' }}>NutriScan AI</span>
          </div>
          {/* 重新扫描：文字按钮，不用图标干扰 */}
          {image && (
            <button
              onClick={reset}
              style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-accent)', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '-0.1px' }}
            >
              重新扫描
            </button>
          )}
        </div>
      </header>

      {/* 主内容区：水平 padding 宽松，给内容足够呼吸空间，增加 overflow-x-hidden 避免动画引发横向滚动 */}
      <main className="max-w-[1280px] mx-auto px-6 sm:px-10 lg:px-16 w-full overflow-x-hidden">
        <AnimatePresence mode="wait">
          {!image && !isCameraActive ? (
            <motion.div
              key="upload-area"
              initial={{ opacity: 0, y: 32 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '72vh', textAlign: 'center' }}
            >
              {/* Hero：Apple 式超大标题，字重 700，tracking 极收紧 */}
              <div style={{ maxWidth: 680 }}>
                {/* 标签徽章：极克制中性灰，字母间距拉开增加精致感 */}
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--color-accent-subtle)', borderRadius: 100, padding: '5px 14px', marginBottom: 32 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-accent-mid)' }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-accent-mid)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>AI 营养分析</span>
                </div>

                <h2 style={{ fontSize: 'clamp(44px, 7vw, 72px)', fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1.06, color: 'var(--text-primary)', margin: '0 0 24px' }}>
                  看懂这一餐的<br />营养组成。
                </h2>

                <p style={{ fontSize: 19, fontWeight: 400, color: 'var(--text-tertiary)', lineHeight: 1.6, letterSpacing: '-0.01em', margin: '0 0 56px', maxWidth: 480, marginLeft: 'auto', marginRight: 'auto' }}>
                  拍一张照片，AI 即刻识别食材、估算热量与营养比例，并给出健康评分。
                </p>

                {/* CTA 按钮组：主操作深色填充，次操作浅色轮廓 */}
                <div className="flex flex-col sm:flex-row gap-3 justify-center w-full mt-2">
                  <button
                    onClick={startCamera}
                    className="flex justify-center items-center gap-2 w-full sm:w-auto"
                    style={{
                      background: 'var(--color-accent)', color: '#fff',
                      padding: '14px 28px', borderRadius: 980, border: 'none',
                      fontSize: 16, fontWeight: 600, letterSpacing: '-0.2px',
                      cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
                      transition: 'transform 0.15s, box-shadow 0.15s',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 28px rgba(0,0,0,0.24)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = ''; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 20px rgba(0,0,0,0.18)'; }}
                  >
                    <Camera size={18} />
                    拍照分析
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex justify-center items-center gap-2 w-full sm:w-auto"
                    style={{
                      background: 'rgba(255,255,255,0.9)', color: 'var(--text-secondary)',
                      padding: '14px 28px', borderRadius: 980,
                      border: '1px solid var(--border-medium)',
                      fontSize: 16, fontWeight: 500, letterSpacing: '-0.2px',
                      cursor: 'pointer', boxShadow: 'var(--shadow-card)',
                      transition: 'transform 0.15s, background 0.15s',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLButtonElement).style.background = '#fff'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = ''; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.9)'; }}
                  >
                    <Upload size={18} />
                    上传照片
                  </button>
                </div>

                <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" style={{ display: 'none' }} />
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
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 py-8 md:py-16"
            >
              {/* 左列：图片 + 健康评分卡 (视口滚动时从左侧飞入) */}
              <motion.div 
                className="lg:col-span-5 flex flex-col gap-6"
                initial={{ opacity: 0, x: -40 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-5%" }}
                transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
              >
                {/* 图片容器：16:9 比例感，大圆角 + 多层阴影 */}
                <div style={{ position: 'relative', borderRadius: 24, overflow: 'hidden', boxShadow: 'var(--shadow-deep)', aspectRatio: '1 / 1' }}>
                  <img src={image!} alt="已上传的餐食" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} referrerPolicy="no-referrer" />
                  {/* 分析中遮罩：毛玻璃 + 脉冲动画 */}
                  {isAnalyzing && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.72)', backdropFilter: 'blur(12px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                      <Loader2 size={36} style={{ color: 'var(--color-accent-mid)', animation: 'spin 1s linear infinite' }} />
                      <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-accent-mid)', letterSpacing: '-0.1px' }}>正在分析这餐…</p>
                    </div>
                  )}
                </div>

                {/* 健康评分卡：Apple 风格大数字 + 进度条 */}
                {result && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    style={{ background: 'var(--bg-card)', borderRadius: 20, padding: '24px 24px 20px', boxShadow: 'var(--shadow-card)', border: '1px solid var(--border-subtle)' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-quaternary)' }}>健康评分</span>
                      {/* 等级标签：用灰阶语义色，不用饱和彩色 */}
                      <span style={{
                        fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 100,
                        background: result.healthScore > 70 ? 'rgba(0,0,0,0.06)' : result.healthScore > 40 ? 'rgba(0,0,0,0.05)' : 'rgba(0,0,0,0.05)',
                        color: result.healthScore > 70 ? 'var(--text-primary)' : result.healthScore > 40 ? 'var(--text-secondary)' : 'var(--text-tertiary)',
                      }}>
                        {result.healthScore > 70 ? '优秀' : result.healthScore > 40 ? '良好' : '一般'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 16 }}>
                      <span style={{ fontSize: 56, fontWeight: 700, letterSpacing: '-0.05em', lineHeight: 1, color: 'var(--text-primary)' }}>{result.healthScore}</span>
                      <span style={{ fontSize: 16, fontWeight: 400, color: 'var(--text-quaternary)' }}>/ 100</span>
                    </div>
                    {/* 进度条：细线设计，不用粗色块 */}
                    <div style={{ height: 3, background: 'rgba(0,0,0,0.06)', borderRadius: 99, overflow: 'hidden' }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${result.healthScore}%` }}
                        transition={{ duration: 1.2, ease: [0.25, 0.46, 0.45, 0.94] }}
                        style={{ height: '100%', borderRadius: 99, background: result.healthScore > 70 ? 'var(--color-accent)' : result.healthScore > 40 ? 'var(--color-accent-mid)' : '#3A3A3C' }}
                      />
                    </div>
                  </motion.div>
                )}
              </motion.div>

              {/* 右列：菜名 + 营养卡片 + 食材列表 */}
              <div className="lg:col-span-7 flex flex-col gap-10 lg:gap-12 lg:pt-1">
                {/* 错误提示：极简样式，不抢主内容 */}
                {error && (
                  <div style={{ background: 'rgba(255,59,48,0.06)', border: '1px solid rgba(255,59,48,0.15)', borderRadius: 16, padding: '18px 20px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <AlertCircle size={18} style={{ color: '#ff3b30', flexShrink: 0, marginTop: 1 }} />
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: '#c0392b', marginBottom: 4 }}>分析失败</p>
                      <p style={{ fontSize: 13, color: '#c0392b', opacity: 0.8 }}>{error}</p>
                      <button onClick={() => image && imageMimeType && analyzeImage(image, imageMimeType)} style={{ marginTop: 10, fontSize: 13, fontWeight: 600, color: '#ff3b30', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline', textUnderlineOffset: 3 }}>重试</button>
                    </div>
                  </div>
                )}

                {result ? (
                  <>
                    {/* 菜名 + 描述：Apple 式大标题，描述文字次级灰 (从右侧飞入) */}
                    <motion.section
                      initial={{ opacity: 0, x: 40 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true, margin: "-5%" }}
                      transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
                    >
                      <h2 style={{ fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.1, color: 'var(--text-primary)', margin: '0 0 12px' }}>
                        {result.dishName}
                      </h2>
                      <p style={{ fontSize: 16, color: 'var(--text-tertiary)', lineHeight: 1.65, margin: 0, letterSpacing: '-0.01em' }}>{result.description}</p>
                    </motion.section>

                    {/* 营养卡片网格：热量卡深色突出，其余白底 (带有层级延迟的右侧飞入) */}
                    <motion.section
                      initial={{ opacity: 0, x: 40 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true, margin: "-5%" }}
                      transition={{ duration: 0.7, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
                    >
                      <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-quaternary)', marginBottom: 14 }}>营养估算</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <NutrientCard label="热量" value={result.nutrition.calories} unit="kcal" accent />
                        <NutrientCard label="蛋白质" value={result.nutrition.protein} unit="g" />
                        <NutrientCard label="碳水" value={result.nutrition.carbs} unit="g" />
                        <NutrientCard label="脂肪" value={result.nutrition.fat} unit="g" />
                        <NutrientCard label="膳食纤维" value={result.nutrition.fiber} unit="g" />
                        {result.nutrition.sugar !== undefined && (
                          <NutrientCard label="糖" value={result.nutrition.sugar} unit="g" />
                        )}
                      </div>
                    </motion.section>

                    {/* 食材列表：一行一项，极简分隔线风格 */}
                    <motion.section
                      initial={{ opacity: 0, x: 40 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true, margin: "-5%" }}
                      transition={{ duration: 0.7, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
                    >
                      <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-quaternary)', marginBottom: 14 }}>识别到的食材</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 0, background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border-subtle)', overflow: 'hidden', boxShadow: 'var(--shadow-card)' }}>
                        {result.ingredients.map((ing, idx) => (
                          <motion.div
                            key={idx}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: idx * 0.04 }}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: idx < result.ingredients.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              {/* 小圆点：中性深灰，不用强调色 */}
                              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-accent-mid)', flexShrink: 0 }} />
                              <div>
                                <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>{ing.name}</p>
                                {ing.description && <p style={{ fontSize: 12, color: 'var(--text-quaternary)', margin: '2px 0 0' }}>{ing.description}</p>}
                              </div>
                            </div>
                            {ing.amount && (
                              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-tertiary)', background: 'var(--bg-page)', padding: '3px 10px', borderRadius: 8, flexShrink: 0 }}>
                                {ing.amount}
                              </span>
                            )}
                          </motion.div>
                        ))}
                      </div>
                    </motion.section>
                  </>
                ) : (
                  !isAnalyzing && !error && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', color: 'var(--text-quaternary)' }}>
                      <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', marginBottom: 12, opacity: 0.3 }} />
                      <p style={{ fontSize: 14 }}>等待分析结果…</p>
                    </div>
                  )
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer：一行极小字说明，不抢主内容注意力 */}
      <footer className="max-w-[1280px] mx-auto w-full px-6 sm:px-10 lg:px-16 py-10 text-center" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <p style={{ fontSize: 12, color: 'var(--text-quaternary)', letterSpacing: '0.01em' }}>
          由 Gemini AI 提供分析能力 · 营养数据基于图片估算，仅供参考
        </p>
      </footer>
    </div>
  );
}

/**
 * NutrientCard — 单个营养指标展示卡
 * Apple 风格：数字巨大突出，label 极小克制，背景用浅底色而非彩色
 */
function NutrientCard({ label, value, unit, accent }: { label: string; value: number; unit: string; accent?: boolean }) {
  return (
    <div
      className="p-4 sm:p-5 flex flex-col gap-2 sm:gap-3 rounded-[20px]"
      style={{
        background: accent ? 'var(--text-primary)' : 'var(--bg-card)',
        border: accent ? 'none' : '1px solid var(--border-subtle)',
        boxShadow: accent ? '0 4px 16px rgba(0,0,0,0.12)' : 'var(--shadow-card)',
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: accent ? 'rgba(255,255,255,0.5)' : 'var(--text-quaternary)' }}>
        {label}
      </span>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
        <span style={{ fontSize: 'clamp(24px, 6vw, 32px)', fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1, color: accent ? '#fff' : 'var(--text-primary)' }}>
          {value}
        </span>
        <span style={{ fontSize: 13, fontWeight: 500, color: accent ? 'rgba(255,255,255,0.45)' : 'var(--text-tertiary)' }}>
          {unit}
        </span>
      </div>
    </div>
  );
}
