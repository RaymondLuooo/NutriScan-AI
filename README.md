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

## 部署到 GitHub Pages (Deploy to GitHub Pages)

本项目使用 **GitHub Actions** 自动部署，每次推送到 `main` 分支时触发构建和部署。

### 首次配置步骤

**1. 启用 GitHub Pages**

进入仓库 `Settings → Pages`，将 **Source** 设置为 `GitHub Actions`。

**2. 配置 Secrets**

进入仓库 `Settings → Secrets and variables → Actions → New repository secret`：

| Secret 名称 | 说明 |
|---|---|
| `GEMINI_API_KEY` | 你的 Gemini API Key |

> ⚠️ **注意**: `GEMINI_API_KEY` 会在构建时被注入到前端 bundle，对外可见。建议在 Google AI Studio 中为该 Key 设置 HTTP Referrer 限制，只允许你的 GitHub Pages 域名访问。

**3. 推送代码触发部署**

```bash
git add .
git commit -m "feat: initial setup"
git push origin main
```

部署完成后，访问 `https://<你的用户名>.github.io/<仓库名>/`。

### 手动触发部署

进入仓库 `Actions` 标签页 → `Deploy to GitHub Pages` → `Run workflow`。

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
│       └── deploy.yml      # GitHub Actions 部署配置
├── src/
│   ├── App.tsx             # 主应用组件
│   ├── main.tsx            # 应用入口
│   └── index.css           # 全局样式
├── .env.example            # 环境变量模板
├── .gitignore
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```
