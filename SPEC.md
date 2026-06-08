# FIFI CHECK AI Website — 規格文件

## 1. Concept & Vision

**FIFI CHECK** 係 HKTVmall 商戶專用嘅 24小時 AI 助理網站。商戶可以透過智能對話，查詢 HKTV 政策、上架流程、訂單處理等常見問題，唔使再等 RM 回覆。

風格：專業簡潔帶少少活潑（HKTV 品牌色 + 貓爪 🐾 icon），令商戶覺得友好而非冷冰冰嘅企業系統。

---

## 2. Design Language

### 色板 (HKTV Brand-inspired)
- **Primary**: `#E61E2A` (HKTV Red)
- **Secondary**: `#1A1A2E` (深藍黑)
- **Accent**: `#F5A623` (金橙)
- **Background**: `#F8F9FA` (淺灰白)
- **Card BG**: `#FFFFFF`
- **Text Primary**: `#1A1A2E`
- **Text Secondary**: `#6B7280`
- **Success**: `#10B981`
- **Error**: `#EF4444`

### 字體
- **標題**: "Noto Sans TC", sans-serif (Google Fonts)
- **內文**: "Inter", sans-serif
- **代碼/數字**: "JetBrains Mono", monospace

### 間距系統
- Base unit: 4px
- Spacing scale: 4, 8, 12, 16, 24, 32, 48, 64px
- Border radius: 8px (cards), 24px (buttons), 9999px (pills)

### Motion Philosophy
- 所有過渡: 200-300ms ease-out
- Chat messages: slide-in from bottom, opacity 0→1, 200ms
- Loading states: typing indicator (3 dots bouncing)
- Hover: scale(1.02) + shadow lift

### Visual Assets
- Icon library: Lucide Icons (CDN)
- Logo: 貓爪 🐾 + "FIFI CHECK" 字樣
- Avatar: AI 助手用 🐾 icon，商戶用 👤

---

## 3. Layout & Structure

### 頁面結構

```
┌─────────────────────────────────────────────┐
│  Header (固定)                               │
│  🐾 FIFI CHECK          [登出] [用戶名]      │
├─────────────────────────────────────────────┤
│                                             │
│  Main Content Area                          │
│  (根據登入狀態顯示)                          │
│                                             │
│  狀態 A: 未登入 → 顯示登入表單               │
│  狀態 B: 已登入 → 顯示 Chat 介面            │
│                                             │
└─────────────────────────────────────────────┘
```

### 響應式策略
- Mobile-first
- Desktop: max-width 900px 居中
- Chat area: 100% width, max-height 70vh

---

## 4. Features & Interactions

### 4.1 登入流程

**輸入欄位：**
- HKTV 帳戶 (email)
- Store ID (文字)
- 密碼

**驗證：**
- 所有欄位必填
- Store ID 格式：H + 7位數字 (e.g., H3626001)
- 密碼起碼8字元
- 顯示/隱藏密碼 toggle

**流程：**
1. 填寫資料 → 2. 按"登入" → 3. 驗證中 (loading) → 4. 成功 → Chat 介面
5. 失敗 → 顯示錯誤訊息 (紅色提示)

**錯誤狀態：**
- "帳戶或密碼錯誤" — 登入失敗
- "Store ID 格式不正確" — 格式驗證失敗
- "請填寫所有欄位" — 空白提交

### 4.2 Chat 介面

**頂部資訊欄：**
- 顯示登入的 Store ID
- "上次登入" 時間戳

**訊息顯示：**
- AI 助手訊息靠左，灰色底
- 商戶訊息靠右，紅色底
- 時間戳喺每組訊息下面
- 系統訊息（登入成功等）居中灰色

**輸入區：**
- Textarea (auto-expand, max 3 lines)
- 發送 button (disabled when empty)
- Enter 發送，Shift+Enter 換行
- 空輸入時禁用發送掣

**預設問句捷徑** (可點擊):
- "如何上架新產品？"
- "訂單處理要幾耐？"
- "如何設定優惠活動？"
- "聯絡我的 RM"

### 4.3 AI 回覆邏輯

**使用 FAQ 知識庫：**
- 基於 HKTV Merchant FAQ (sites.google.com/view/hktv-merc-faq)
- 整理成結構化 Q&A pairs
- 用關鍵字匹配 + LLM 總結回答

**回答風格：**
- 廣東話 / 中文混雜（配合香港商戶）
- 專業但友善
- 標明資訊來源（"根據HKTV商戶支援頁..."）
- 不確定時邀請聯絡 RM

**Loading 狀態：**
- AI typing... (3個跳動的點)
- 顯示 "🤖 FIFI 思考緊..." 文字

### 4.4 登出

- Header 右側"登出"按鈕
- 點擊 → 確認彈窗 → 確定 → 返回登入頁
- 清除所有 localStorage 資料

---

## 5. Component Inventory

### 5.1 LoginForm
- States: default, validating, loading, error, success
- Error message appears below form, red text
- Loading: button shows spinner, disabled

### 5.2 ChatWindow
- States: empty (show welcome), chatting, loading
- Welcome state: show preset question chips
- Scrolling: auto-scroll to bottom on new message

### 5.3 MessageBubble
- Variants: user (right, red), ai (left, gray), system (center, light)
- Timestamp: small gray text below bubble

### 5.4 ChatInput
- States: default, focused, disabled (while AI responding)
- Auto-resize textarea

### 5.5 Header
- Fixed top, white bg, shadow
- Logo left, user info + logout right

### 5.6 PresetQuestionChip
- Pill-shaped buttons
- Hover: lift shadow
- Click: populate input and send

---

## 6. Technical Approach

### 前端
- **Pure HTML/CSS/JavaScript** (no framework, simple deployment)
- **CDN dependencies:**
  - Google Fonts (Noto Sans TC, Inter)
  - Lucide Icons (CDN)
  - marked.js (Markdown rendering)

### AI/LLM 整合
- **Provider**: DeepSeek (性價比高) 或 OpenAI
- **方式**: 直接 from browser 呼叫 API (使用 user's own API key)
- **FAQ 知識庫**: 預先整理成 JSON，bundled in JS
- **Context**: 每次對話把 FAQ knowledge 作為 system prompt context

### 數據存儲
- **localStorage**: 儲存登入狀態 (email hash, store ID, timestamp)
- **sessionStorage**: 對話歷史 (session 結束時清除)
- **無後端**: 所有野喺 browser 運行

### 部署
- **首選**: Vercel (免費, 自動 HTTPS, 簡易部署)
- **次選**: Netlify (免費, 同樣簡單)
- **流程**: GitHub repo → Vercel import → 自動部署

### 檔案結構
```
fifi-check/
├── index.html          # 主頁 (登入 + Chat)
├── styles.css          # 所有樣式
├── app.js              # 主要邏輯
├── faq-data.js         # FAQ 知識庫 (Q&A pairs)
├── SPEC.md             # 本規格文件
└── README.md           # 部署說明
```

---

## 7. FAQ 知識庫結構

預先整理嘅常見問題類別（來自 HKTV Merchant FAQ）:

### 第一階段 (必修)
1. **基本後台設置** — 登入、權限、設定
2. **上載產品** — 步驟、圖片要求、類別
3. **庫存管理** — 更新、警告、批量操作
4. **訂單處理** — 狀態、發貨、退款
5. **建立優惠活動** — 類型、設定步驟
6. **售後服務** — 退貨、退款、客戶投訴
7. **客戶互動** — 訊息、回覆、評價
8. **良好銷售手法** — 政策、合規
9. **海外送貨** — 設置、運費、限制

### 第二階段 (選修)
10. **API** — 接入方式、文档
11. **提升出貨準確度** — 技巧、工具
12. **市場推廣要諦** — 策略、工具
13. **商户廣告投放** — 廣告類型、收費
14. **商業數據** — 報告、分析工具
15. **ShareHub** — 功能、使用方式
16. **HKTV 3PL** — 第三方程式物流

### 其他
17. **新商戶指南** — 入駐流程、培訓
18. **常見問題** — 通用問題

---

## 8. 驗收標準

- [ ] 登入頁靚觀、響應式
- [ ] Store ID 格式驗證正常
- [ ] 錯誤訊息清晰顯示
- [ ] Chat 介面流暢
- [ ] AI 回覆基於 FAQ 知識庫
- [ ] 預設問題捷徑工作正常
- [ ] 登出功能正常
- [ ] 成功部署到 Vercel/Netlify
- [ ] 可以在手機瀏覽
