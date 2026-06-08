# FIFI CHECK 🐾

HKTVmall 商戶 AI 助理網站 — 24小時即時回覆商戶查詢

## 功能

- 🔐 **身份驗證** — HKTV 帳戶 + Store ID 登入
- 💬 **AI Chatbot** — 基於 HKTV Merchant FAQ 知識庫
- 📚 **FAQ 知識庫** — 涵蓋上架、訂單、推廣、售後等範疇
- 🤖 **LLM 整合** — 支持 OpenAI GPT-4o 和 DeepSeek
- 📱 **響應式設計** — 支持桌面和移動設備

## 快速開始

### 方法一：直接在瀏覽器打開

1. 下載所有檔案
2. 雙擊 `index.html` 在瀏覽器中打開

> 注意：部分瀏覽器可能限制 localStorage 和某些功能。建議使用 Chrome 或 Firefox。

### 方法二：部署到 Vercel（推薦）

1. **Fork 此專案到 GitHub**

2. **在 Vercel 匯入專案**
   - 前往 [vercel.com](https://vercel.com)
   - 點擊 "Import Project"
   - 選擇您 Fork 的 repo
   - 點擊 "Deploy"

3. **完成！**
   - Vercel 會自動部署
   - 獲得一個 `.vercel.app` 域名

### 方法三：部署到 Netlify

1. **Fork 此專案到 GitHub**

2. **在 Netlify 匯入專案**
   - 前往 [app.netlify.com](https://app.netlify.com)
   - 點擊 "Add new site" → "Import an existing project"
   - 選擇 GitHub 並授權
   - 選擇您的 repo
   - 點擊 "Deploy"

## 使用方式

### 首次使用

1. 開啟網站，輸入 HKTV 帳戶電郵、Store ID 和密碼
2. 設定您的 AI API Key（可選）：
   - **OpenAI**：需要 GPT-4o API key
   - **DeepSeek**：需要 DeepSeek API key（更平）
3. 開始使用！

### 沒有 API Key？

您仍可以使用基本 FAQ 搜尋功能，AI 會從內置的知識庫中找答案。

### 登入資料

測試用的示範資料：
- Store ID: `H3626001`
- 任何有效的電郵格式和 8 位元密碼

## 檔案結構

```
fifi-check/
├── index.html      # 主頁面
├── styles.css      # 樣式表
├── app.js          # 主要應用邏輯
├── faq-data.js     # FAQ 知識庫
├── SPEC.md         # 規格文件
└── README.md       # 本文件
```

## 自訂

### 修改 FAQ 知識庫

編輯 `faq-data.js` 來添加或修改問答內容。

### 修改品牌

- 顏色：在 `styles.css` 的 `:root` 中修改 CSS 變數
- Logo：替換 `index.html` 中的 🐾 emoji 或使用圖片
- 名稱：在 `index.html` 中搜尋 "FIFI CHECK" 並替換

### 添加更多功能

現有架構支援：
- 更多 API 提供商
- 第三方服務整合
- 分析和追蹤

## 技術棧

- **前端**：原生 HTML + CSS + JavaScript
- **字體**：Google Fonts (Noto Sans TC, Inter)
- **AI**：OpenAI GPT-4o / DeepSeek Chat
- **部署**：Vercel / Netlify / GitHub Pages

## 安全注意

- API Key 只保存在瀏覽器 localStorage
- 不要將包含真實 API Key 的版本部署到公開倉庫
- 建議使用環境變數或後端代理 API 請求

## 授權

© 2026 HKTV. All rights reserved.
