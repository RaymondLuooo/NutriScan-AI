# NutriScan AI 🍽️

> 基于 Gemini AI 的智能食物营养分析应用。上传或拍摄你的餐食照片，即可获得即时营养分析、食材识别和健康评分。

## 技术栈 (Tech Stack)

- **框架 (Framework)**: React 19 + TypeScript
- **构建工具 (Build Tool)**: Vite 6
- **样式 (Styling)**: Tailwind CSS v4
- **动画 (Animation)**: Motion (Framer Motion)
- **AI**: Google Gemini AI (`@google/genai`)

---

## 本地开发 (Local Development)

**前置要求 (Prerequisites)**: Node.js 18+

```bash
# 1. 安装依赖 (Install dependencies)
npm install

# 2. 配置环境变量 (Configure environment variables)
cp .env.example .env.local
# 编辑 .env.local，填入你的 Gemini API Key

# 3. 启动开发服务器 (Start dev server)
npm run dev
# 访问 http://localhost:3000
```

### 获取 Gemini API Key

前往 [Google AI Studio](https://aistudio.google.com/app/apikey) 免费获取 API Key。

---

## 部署说明 (Deployment)

Gemini API Key 现在只在服务端 `/api/analyze` 使用，不会被注入前端 bundle。

GitHub Pages 只能托管静态文件，不能运行 `/api/analyze`。Netlify 部署会使用 `netlify/functions/analyze.ts` 提供该接口。

本地开发和 `npm run preview` 时，Vite 会提供 `/api/analyze` middleware。

### 首次配置步骤

**1. 配置环境变量**

在服务端运行环境中配置：

| Secret 名称 | 说明 |
|---|---|
| `GEMINI_API_KEY` | 仅供 `/api/analyze` 服务端接口读取的 Gemini API Key |

**2. 构建前端**

```bash
npm run build
```

---

## 可用脚本 (Scripts)

| 命令 | 说明 |
|---|---|
| `npm run dev` | 启动开发服务器（端口 3000） |
| `npm run build` | 类型检查 + 构建生产包 |
| `npm run preview` | 本地预览构建产物 |
| `npm run clean` | 清除 dist 目录 |
| `npm run lint` | TypeScript 类型检查 |

---

## 项目结构 (Project Structure)

```
NutriScan-AI/
├── .github/
│   └── workflows/
│       └── deploy.yml      # GitHub Pages 静态前端部署配置
├── api/
│   └── analyze.ts          # 服务端分析接口
├── netlify/
│   └── functions/
│       └── analyze.ts      # Netlify Function 分析接口
├── src/
│   ├── analysisTypes.ts    # 前后端共享类型
│   ├── App.tsx             # 主应用组件
│   ├── geminiAnalysis.ts   # Gemini 服务端调用逻辑
│   ├── main.tsx            # 应用入口
│   └── index.css           # 全局样式
├── .env.example            # 环境变量模板
├── .gitignore
├── index.html
├── netlify.toml            # Netlify 构建配置
├── package.json
├── tsconfig.json
└── vite.config.ts
```
