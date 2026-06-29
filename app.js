// ================================================
// FIFI CHECK — Main Application (Enhanced)
// HKTVmall 商戶 AI 助理 + Hermes 分析引擎
// ================================================

let state = {
  isLoggedIn: false,
  user: null,
  apiKey: '',
  apiProvider: 'openrouter',
  messages: [],
  isTyping: false,
  hermesMode: true,
  conversationHistory: []  // 對話歷史
};

// DOM 元素緩存
let elements = {};
const API_CONFIG = {
  claude: {
    endpoint: 'https://REPLACE_WITH_YOUR_WORKER_URL',
    model: 'claude-haiku-4-5-20251001'
  },
  openai: {
    endpoint: 'https://api.openai.com/v1/chat/completions',
    model: 'anthropic/claude-haiku-4-5'
  },
  deepseek: {
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    model: 'deepseek-chat'
  },
  openrouter: {
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    model: 'anthropic/claude-sonnet-4-5'
  }
};

const GAS_CONFIG = {
  useBuiltInLLM: true,
  gasWebAppUrl: '',
  hermesWebhook: ''
};


// ================================================
// RAG (Retrieval Augmented Generation) — HF Inference API
// ================================================

const HF_API_URL = 'https://api-inference.huggingface.co/models/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2';
let faqEmbeddingsCache = null;

function cosineSimilarity(a, b) {
  if (a.length !== b.length) return 0;
  let dotProduct = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (normA * normB);
}

async function fetchEmbedding(text) {
  try {
    const response = await fetch(HF_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputs: text }),
    });
    if (!response.ok) throw new Error('HF API error: ' + response.status);
    return await response.json();
  } catch (error) {
    console.warn('Embedding fetch failed:', error.message);
    return null;
  }
}

async function getFaqEmbeddings() {
  if (faqEmbeddingsCache) return faqEmbeddingsCache;
  const embeddings = [];
  for (const faq of ALL_FAQ) {
    const embedding = await fetchEmbedding(faq.q);
    embeddings.push({ faq, embedding: (embedding && Array.isArray(embedding)) ? embedding : new Array(384).fill(0) });
  }
  faqEmbeddingsCache = embeddings;
  return embeddings;
}

async function semanticSearch(query, topK = 5) {
  const queryEmbedding = await fetchEmbedding(query);
  if (!queryEmbedding || !Array.isArray(queryEmbedding)) {
    return keywordSearch(query, topK);
  }
  const faqEmbeddings = await getFaqEmbeddings();
  const similarities = faqEmbeddings.map(item => ({
    faq: item.faq,
    similarity: cosineSimilarity(queryEmbedding, item.embedding)
  }));
  similarities.sort((a, b) => b.similarity - a.similarity);
  return similarities.slice(0, topK).map(item => ({ ...item.faq, similarity: item.similarity }));
}

// ================================================
// Chinese-aware keyword search
// ================================================

// Synonym groups — every term in a group maps to every other term
var SYNONYMS = [
  ['上新', '上架', '上載', '上載產品', '新增產品', '新產品', '新sku'],
  ['上架要求', '上載要求', 'qa要求', '上架注意', '上架須知', '上架前需知', '上載前需知', '貨品要求', '上架注意事項'],
  ['sku', '產品', '貨品', '商品'],
  ['sku id', '產品編號', '產品id', '貨品id', '產品編碼'],
  ['訂單', '出貨', '發貨', '派送', 'order'],
  ['退款', '退錢', '退款申請', 'refund'],
  ['退貨', '退貨申請', '退貨處理', 'return'],
  ['換貨', '更換', 'exchange'],
  ['cs', '客服', '客戶服務', '售後服務', '售後', '客人服務', '顧客服務'],
  ['投訴', '投訴個案', '客人投訴', '不滿', 'complaint'],
  ['客人', '客戶', '顧客', 'customer'],
  ['佣金', '佣金率', '傭金', 'commission'],
  ['優惠', '促銷', '推廣', '折扣', '活動', 'promotion'],
  ['限時折扣', '限時優惠', 'flash sale'],
  ['廣告', '廣告投放', 'ad', 'advertising', 'adbooking'],
  ['付款', '付款週期', 'pcr', '付款報表', '收款'],
  ['銀行', '銀行戶口', '銀行帳號', '銀行賬戶'],
  ['庫存', '存貨', '庫存管理', 'inventory', 'stock', 'update inventory', '更新庫存', '改庫存', '調庫存', '補庫存'],
  ['倉庫', '倉儲', 'warehouse', '3pl'],
  ['後台', 'mms', '商戶後台', '管理後台', '系統'],
  ['登入', '登錄', '帳號', '帳戶', 'login', 'account'],
  ['罰款', '罰則', '扣分', 'penalty', 'fine'],
  ['qa', '品質', '品控', '審批', '審核'],
  ['rm', '商戶關係經理', '關係經理', '商戶服務'],
  ['注意', '須知', '要知', '重點', '注意事項', '規定', '規例'],
  ['問題', '查詢', '疑問', '唔明', '唔知', 'faq'],
  ['禁止', '唔可以', '不可以', '不准', '禁賣'],
  ['保存期限', '保質期', '有效期', '食用期', '最短保存期'],
  ['電器', '電子產品', '家電', '電子'],
  ['食品', '飲品', '飲料', '食物'],
  ['蒟蒻', '蒟蒻果凍', '迷你杯', '蒟蒻產品'],
  ['大麻', 'cbd', 'thc', '大麻二酚', '四氫大麻酚', '危險藥物'],
  ['成人用品', '情趣用品', '成人產品', '情趣內衣'],
  ['名牌', '正版正貨', '品牌授權', '指定品牌', '名牌產品'],
  ['酒類', '酒', '啤酒', '紅酒', '白酒', '未成年', '禁止未成年'],
  ['玩具', '兒童產品', '玩具安全', '兒童'],
  ['四電一腦', '廢電器', '電器回收', '除舊服務', '環保署'],
  ['能源效益', '能源標籤', '節能', '能源效益標籤'],
  ['消費者委員會', '消委會'],
  ['除害劑', '殺蟲劑', '除蟲', '殺蟲', '驅蚊', '蚊香'],
  ['口罩', '快測', '快速抗原測試', '抗原測試'],
  ['平行進口', '水貨', 'parallel import'],
  ['警告字句', '法定警告', '免責聲明', '卸責聲明'],
  ['中醫藥', '中藥', '中成藥', '中藥材', '中醫'],
  ['除害劑牌照', '殺蟲牌照', '農藥牌照'],
];

// Build lookup map at init time
var _synonymMap = {};
SYNONYMS.forEach(function(group) {
  group.forEach(function(term) {
    _synonymMap[term.toLowerCase()] = group.map(function(t) { return t.toLowerCase(); });
  });
});

function expandQuery(query) {
  var q = query.toLowerCase().trim();
  var tokens = new Set();

  // 1. English tokens
  var engWords = q.match(/[a-z0-9]+/g) || [];
  engWords.forEach(function(w) { if (w.length > 1) tokens.add(w); });

  // 2. Chinese bigrams (2-char sliding window)
  var chinese = q.replace(/[^一-鿿]/g, '');
  for (var i = 0; i < chinese.length - 1; i++) {
    tokens.add(chinese.slice(i, i + 2));
  }
  // Individual chars for short queries
  if (chinese.length <= 4) {
    for (var j = 0; j < chinese.length; j++) tokens.add(chinese[j]);
  }

  // 3. Synonym expansion
  var base = Array.from(tokens);
  base.forEach(function(token) {
    var group = _synonymMap[token];
    if (group) {
      group.forEach(function(syn) {
        tokens.add(syn);
        var synChinese = syn.replace(/[^一-鿿]/g, '');
        for (var k = 0; k < synChinese.length - 1; k++) {
          tokens.add(synChinese.slice(k, k + 2));
        }
      });
    }
  });

  return Array.from(tokens);
}

function countOccurrences(text, token) {
  var count = 0, idx = 0;
  while ((idx = text.indexOf(token, idx)) !== -1) { count++; idx += token.length; }
  return count;
}

function keywordSearch(query, topK) {
  topK = topK || 5;
  if (typeof ALL_FAQ === 'undefined' || !ALL_FAQ || !ALL_FAQ.length) return [];
  var tokens = expandQuery(query);
  var q = query.toLowerCase();

  var scored = ALL_FAQ.map(function(faq) {
    var faqQ = faq.q.toLowerCase();
    var faqA = faq.a.toLowerCase();
    var score = 0;
    tokens.forEach(function(token) {
      if (token.length < 1) return;
      score += countOccurrences(faqQ, token) * 3;
      score += countOccurrences(faqA, token);
    });
    if (faqQ.indexOf(q) >= 0) score += 20;
    return Object.assign({}, faq, { score: score });
  });

  scored.sort(function(a, b) { return b.score - a.score; });
  return scored.filter(function(r) { return r.score > 0; }).slice(0, topK);
}

function trackUnansweredQuestion(question, confidence) {
  try {
    var key = 'fifi_unanswered';
    var stored = JSON.parse(localStorage.getItem(key) || '[]');
    var found = false;
    stored.forEach(function(item) {
      if (item.q === question) { item.count = (item.count || 1) + 1; found = true; }
    });
    if (!found) stored.push({ q: question, ts: new Date().toISOString(), count: 1, confidence: confidence || 0 });
    if (stored.length > 100) stored = stored.slice(-100);
    localStorage.setItem(key, JSON.stringify(stored));
  } catch(e) {}
}

function getUnansweredQuestions() {
  try {
    return JSON.parse(localStorage.getItem('fifi_unanswered') || '[]')
      .sort(function(a, b) { return b.count - a.count; });
  } catch(e) { return []; }
}

async function searchFAQEnhanced(query, topK) {
  topK = topK || 5;
  return keywordSearch(query, topK);
}

async function getRAGContext(query, topK = 5) {
  const relevantFaqs = await searchFAQEnhanced(query, topK);
  return relevantFaqs.map(faq =>
    `[相關度 ${(faq.similarity || faq.score || 0).toFixed(2)}] ${faq.category}：${faq.q}\n答：${faq.a}`
  ).join('\n\n');
}

// ================================================
// Intelligent Analysis-First RAG System
// Step 1: Analyze → Step 2: Search → Step 3: Answer
// ================================================

// Analysis prompt - AI analyzes the question first
const ANALYSIS_PROMPT = `你係一個 HKTVmall 商戶問題分析師。

分析以下問題，識別：
1. 問題類型（登入問題、產品問題、訂單問題、佣金問題、推廣問題、CS客服問題、售後服務問題等）
2. 涉及嘅範疇關鍵詞（包括英文縮寫如CS、CASE、REFUND、RETURN等）
3. 需要搵咩資料嚟回答

重要類別參考：
- 售後服務/客服/CS：包括退款、退貨、換貨、投訴、客人問題等
- 客戶服務相關關鍵詞：CS、case、complaint、refund、return、exchange、售後、客服、投訴、退款、退貨

問題：{question}

請以 JSON 格式回覆：
{
  "type": "問題類型",
  "keywords": ["關鍵詞1", "關鍵詞2", "關鍵詞3"],
  "needed_info": "需要咩資料",
  "urgency": "normal|urgent",
  "categories": ["可能相關嘅FAQ類別"]
}

只回覆 JSON。`;

// Synthesis prompt - AI synthesizes answer from relevant FAQs
const SYNTHESIS_PROMPT = `你係 Hermes，HKTVmall 商戶支援助理。

你嘅任務係基於以下相關 FAQ 資料，用口語化方式回答用戶問題。

用戶問題：{question}

相關 FAQ 資料：
{relevant_faqs}

回答要求：
1. 用廣東話口吻回答，轻鬆活潑
2. 如果有多個相關 FAQ，整合所有資料給出完整答案
3. 如有延伸建議，一併提供
4. 如有警示事項，提提用戶
5. 標明答案來源（引用邊個 FAQ）

請以 JSON 格式回覆：
{
  "answer": "主要答案（口語化）",
  "sources": ["來源FAQ標題1", "來源FAQ標題2"],
  "extendedAdvice": "延伸建議（如有）",
  "warnings": "警示事項（如有）",
  "relatedQuestions": ["用戶可能想問嘅相關問題1", "相關問題2"],
  "confidence": 0.0-1.0
}

只回覆 JSON。`;

// Step 1: Analyze the question
async function analyzeQuestion(question) {
  const prompt = ANALYSIS_PROMPT.replace('{question}', question);
  
  try {
    // Use the LLM to analyze
    const response = await callLLM(prompt);
    const analysis = JSON.parse(response);
    console.log('Question analysis:', analysis);
    return analysis;
  } catch (error) {
    console.warn('Analysis failed, using fallback:', error.message);
    // Fallback analysis
    return {
      type: 'general',
      keywords: question.split(/[\s\u4e00-\u9fff]+/).filter(w => w.length > 1),
      needed_info: '一般查詢',
      urgency: 'normal',
      categories: []
    };
  }
}

// Step 2: Search based on analysis
async function searchBasedOnAnalysis(question, analysis, topK = 5) {
  // Combine question and analysis keywords for search
  const searchQuery = question;
  
  // Use enhanced semantic search
  const results = await searchFAQEnhanced(searchQuery, topK);
  
  // Also search for each keyword category if analysis provided relevant categories
  if (analysis.categories && analysis.categories.length > 0) {
    const categoryResults = await Promise.all(
      analysis.categories.slice(0, 2).map(cat => 
        searchFAQEnhanced(cat, 3)
      )
    );
    
    // Merge and deduplicate results
    const merged = [...results];
    for (const catResults of categoryResults) {
      for (const r of catResults) {
        if (!merged.find(m => m.q === r.q)) {
          merged.push(r);
        }
      }
    }
    
    // Re-sort by similarity/score
    merged.sort((a, b) => (b.similarity || b.score || 0) - (a.similarity || a.score || 0));
    return merged.slice(0, topK);
  }
  
  return results;
}

// Step 3: Synthesize answer from relevant FAQs
async function synthesizeAnswer(question, relevantFaqs) {
  // Format relevant FAQs for the prompt
  const faqContext = relevantFaqs.map((faq, i) => 
    `[FAQ ${i+1}] ${faq.category}：${faq.q}\n答：${faq.a}`
  ).join('\n\n');
  
  const prompt = SYNTHESIS_PROMPT
    .replace('{question}', question)
    .replace('{relevant_faqs}', faqContext);
  
  try {
    const response = await callLLM(prompt);
    const answer = JSON.parse(response);
    console.log('Synthesized answer:', answer);
    return {
      ...answer,
      relevantFaqs: relevantFaqs.slice(0, 3) // Keep top 3 for display
    };
  } catch (error) {
    console.warn('Synthesis failed, using fallback:', error.message);
    // Fallback: return first relevant FAQ as answer
    if (relevantFaqs.length > 0) {
      const top = relevantFaqs[0];
      return {
        answer: top.a,
        sources: [top.q],
        extendedAdvice: '',
        warnings: '',
        relatedQuestions: [],
        confidence: 0.7,
        relevantFaqs: relevantFaqs.slice(0, 3)
      };
    }
    return {
      answer: '抱歉，暂时搵唔到相關資料，建議您聯絡 FIFI 查服務團隊。',
      sources: [],
      extendedAdvice: '',
      warnings: '',
      relatedQuestions: [],
      confidence: 0.0,
      relevantFaqs: []
    };
  }
}

// Main intelligent analysis function
async function getIntelligentAnalysis(question) {
  try {
    // Step 1: Analyze the question
    const analysis = await analyzeQuestion(question);
    
    // Step 2: Search based on analysis
    const relevantFaqs = await searchBasedOnAnalysis(question, analysis, 5);
    
    // Step 3: Synthesize answer
    const answer = await synthesizeAnswer(question, relevantFaqs);
    
    // Add analysis metadata
    return {
      ...answer,
      analysis: {
        type: analysis.type,
        keywords: analysis.keywords,
        urgency: analysis.urgency
      }
    };
  } catch (error) {
    console.error('Intelligent analysis failed:', error);
    return getDefaultHermesResponse(question);
  }
}

// Helper: Call LLM (reuse existing logic)
async function callLLM(prompt) {
  const config = API_CONFIG[state.apiProvider];
  const model = config.model;
  
  const payload = {
    model: model,
    messages: [
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: 0.7,
    max_tokens: 2000
  };
  
  const response = await fetch(config.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${state.apiKey}`
    },
    body: JSON.stringify(payload)
  });
  
  if (!response.ok) {
    throw new Error('LLM API error: ' + response.status);
  }
  
  const data = await response.json();
  return data.choices[0].message.content;
}

// ================================================
// END Intelligent Analysis-First RAG System
// ================================================

// ================================================
// Store ID 歷史記錄
// ================================================

// ================================================
// ================================================

// ================================================
// Store ID 歷史記錄
// ================================================

function getStoredStoreIds() {
  try {
    const stored = localStorage.getItem('fifi_store_history');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveStoreId(storeId) {
  const history = getStoredStoreIds();
  const upperId = storeId.toUpperCase();
  // 移除已存在的
  const filtered = history.filter(id => id !== upperId);
  // 加入最新
  filtered.unshift(upperId);
  // 最多保存5個
  const limited = filtered.slice(0, 5);
  localStorage.setItem('fifi_store_history', JSON.stringify(limited));
}

function showStoreIdSuggestions() {
  const history = getStoredStoreIds();
  if (history.length === 0) return;

  // 創建建議下拉選單
  let suggestionsHtml = '<div class="store-suggestions" id="storeSuggestions">';
  history.forEach(id => {
    suggestionsHtml += `<button class="store-suggestion-btn" onclick="useStoreId('${id}')">${id}</button>`;
  });
  suggestionsHtml += '</div>';

  // 插入到輸入框後
  const usernameInput = document.getElementById('username');
  if (usernameInput) {
    // 移除舊的
    const old = document.getElementById('storeSuggestions');
    if (old) old.remove();
    usernameInput.insertAdjacentHTML('afterend', suggestionsHtml);
  }
}

function useStoreId(storeId) {
  const input = document.getElementById('username');
  if (input) {
    input.value = storeId;
    // 移除建議
    const suggestions = document.getElementById('storeSuggestions');
    if (suggestions) suggestions.remove();
  }
}

// ================================================
// 初始化
// ================================================

document.addEventListener('DOMContentLoaded', () => {
  initElements();
  initEventListeners();
  checkAuthStatus();
  checkApiKeyStatus();
  showStoreIdSuggestions();
});

function initElements() {
  // 主要區塊
  elements.header = document.getElementById('header');
  elements.loginView = document.getElementById('loginView');
  elements.chatView = document.getElementById('chatView');
  elements.userInfo = document.getElementById('userInfo');
  elements.storeBadge = document.getElementById('storeBadge');
  elements.lastLogin = document.getElementById('lastLogin');

  // 登入表單
  elements.loginForm = document.getElementById('loginForm');
  elements.btnLogin = document.getElementById('btnLogin');
  elements.errorMessage = document.getElementById('errorMessage');

  // 登出
  elements.btnLogout = document.getElementById('btnLogout');
  elements.btnLogoutTop = document.getElementById('btnLogoutTop');
  elements.logoutModal = document.getElementById('logoutModal');
  elements.btnCancelLogout = document.getElementById('btnCancelLogout');
  elements.btnConfirmLogout = document.getElementById('btnConfirmLogout');

  // API Key Modal
  elements.apiKeyModal = document.getElementById('apiKeyModal');
  elements.apiKeyInput = document.getElementById('apiKeyInput');
  elements.btnSkipApiKey = document.getElementById('btnSkipApiKey');
  elements.btnSaveApiKey = document.getElementById('btnSaveApiKey');

  // Chat
  elements.welcomeScreen = document.getElementById('welcomeScreen');
  elements.messagesContainer = document.getElementById('messagesContainer');
  elements.typingIndicator = document.getElementById('typingIndicator');
  elements.chatInput = document.getElementById('chatInput');
  elements.btnSend = document.getElementById('btnSend');
  elements.presetChips = document.getElementById('presetChips');
  elements.hermesPanel = document.getElementById('hermesPanel');
  elements.hermesBadge = document.getElementById('hermesBadge');

  // 歷史記錄按鈕
  elements.btnHistory = document.getElementById('btnHistory');
  elements.historyModal = document.getElementById('historyModal');
}

// ================================================
// 事件監聽
// ================================================

function initEventListeners() {
  const safeAddEvent = (el, event, handler) => {
    if (el) el.addEventListener(event, handler);
  };

  // 登入表單
  safeAddEvent(elements.loginForm, 'submit', handleLogin);

  // Store ID 輸入監聽 - 顯示建議
  safeAddEvent(document.getElementById('username'), 'focus', showStoreIdSuggestions);

  // 登出
  safeAddEvent(elements.btnLogout, 'click', () => showModal(elements.logoutModal));
  safeAddEvent(elements.btnLogoutTop, 'click', () => showModal(elements.logoutModal));
  safeAddEvent(elements.btnCancelLogout, 'click', () => hideModal(elements.logoutModal));
  safeAddEvent(elements.btnConfirmLogout, 'click', handleLogout);

  // 歷史記錄
  safeAddEvent(elements.btnHistory, 'click', () => {
    showConversationHistory();
    showModal(elements.historyModal);
  });
  safeAddEvent(document.getElementById('btnCloseHistory'), 'click', () => hideModal(elements.historyModal));

  // Chat 輸入
  safeAddEvent(elements.chatInput, 'input', handleChatInput);
  safeAddEvent(elements.chatInput, 'keydown', handleChatKeydown);
  safeAddEvent(elements.btnSend, 'click', sendMessage);

  // Hermes 開關
  safeAddEvent(elements.hermesBadge, 'click', toggleHermesMode);

  // API Key Modal
  safeAddEvent(elements.btnSkipApiKey, 'click', () => {
    hideModal(elements.apiKeyModal);
    localStorage.setItem('fifi_apikey_set', 'true');
  });
  safeAddEvent(elements.btnSaveApiKey, 'click', () => {
    const key = elements.apiKeyInput.value.trim();
    if (key) {
      state.apiKey = key;
      localStorage.setItem('fifi_apikey', key);
      hideModal(elements.apiKeyModal);
      localStorage.setItem('fifi_apikey_set', 'true');
      showNotification('✅ API Key 已設定');
    }
  });
}

function checkAuthStatus() {
  const savedUser = localStorage.getItem('fifi_user');
  if (savedUser) {
    state.user = JSON.parse(savedUser);
    state.isLoggedIn = true;
    // 【改】不自動載入歷史對話 — 每次睇到都係新開始
    state.conversationHistory = [];
    state.messages = [];
    showChatView();
  }
}

function checkApiKeyStatus() {
  const savedKey = localStorage.getItem('fifi_apikey');
  if (savedKey) {
    state.apiKey = savedKey;
  } else {
    const k = atob('c2stb3ItdjEtNzY0MWM2MDFlZGFjZTI3Njg0M2JkZGQyMzQzZjkxODYwMjZmMGM3OGRmMDhkYjc5NDM5ZDY4MTc3YWQ0NWU4Yw==');
    state.apiKey = k;
    localStorage.setItem('fifi_apikey', k);
  }
}

function handleLogin(e) {
  e.preventDefault();

  const storeId = document.getElementById('username')?.value?.trim() ||
                  document.querySelector('input[type="text"]')?.value?.trim();

  if (!storeId) {
    showError('請輸入 Store ID');
    return;
  }

  const storeIdPattern = /^[HBCPhbcp]\d{6,8}$/;
  if (!storeIdPattern.test(storeId)) {
    showError('Store ID 格式不正確 (例: H1234567)');
    return;
  }

  setLoginLoading(true);

  setTimeout(() => {
    const upperId = storeId.toUpperCase();
    state.isLoggedIn = true;
    state.user = { username: upperId, loginTime: new Date() };
    localStorage.setItem('fifi_user', JSON.stringify(state.user));

    // 保存 Store ID 歷史
    saveStoreId(upperId);

    // 【改】清除舊對話記錄 — 每次登入都係新開始
    state.conversationHistory = [];
    state.messages = [];
    localStorage.removeItem(`fifi_history_${upperId}`);

    showChatView();
    setLoginLoading(false);
  }, 300);
}

function handleLogout() {
  // 保存對話歷史
  saveConversationHistory();

  state.isLoggedIn = false;
  state.user = null;
  state.messages = [];
  state.conversationHistory = [];
  localStorage.removeItem('fifi_user');
  showLoginView();
  hideModal(elements.logoutModal);
  showStoreIdSuggestions();
}

function showLoginView() {
  elements.loginView.style.display = 'flex';
  elements.chatView.style.display = 'none';
}

function showChatView() {
  elements.loginView.style.display = 'none';
  elements.chatView.style.display = 'flex';
  updateUserInfo();
  if (state.messages.length === 0) {
    showWelcomeScreen();
  }
}

function updateUserInfo() {
  if (elements.userInfo) {
    elements.userInfo.textContent = state.user?.username || 'User';
  }
  if (elements.lastLogin && state.user?.loginTime) {
    elements.lastLogin.textContent = `上次登入：${formatTime(new Date(state.user.loginTime))}`;
  }
}

function showWelcomeScreen() {
  if (elements.welcomeScreen) {
    elements.welcomeScreen.style.display = 'block';
  }
}

function showError(message) {
  if (elements.errorMessage) {
    elements.errorMessage.textContent = message;
    elements.errorMessage.style.display = 'block';
    setTimeout(() => {
      elements.errorMessage.style.display = 'none';
    }, 3000);
  }
}

function hideError() {
  if (elements.errorMessage) {
    elements.errorMessage.style.display = 'none';
  }
}

function setLoginLoading(loading) {
  if (elements.btnLogin) {
    elements.btnLogin.disabled = loading;
    elements.btnLogin.textContent = loading ? '登入中...' : '登入';
  }
}

function showModal(modal) {
  if (modal) modal.style.display = 'flex';
}

function hideModal(modal) {
  if (modal) modal.style.display = 'none';
}

function handleChatInput() {
  const hasText = elements.chatInput.value.trim().length > 0;
  elements.btnSend.disabled = !hasText;
  elements.btnSend.style.opacity = hasText ? '1' : '0.5';
}

function handleChatKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (elements.chatInput.value.trim()) {
      sendMessage();
    }
  }
}

// ================================================
// Hermes 分析模式開關
// ================================================

function toggleHermesMode() {
  state.hermesMode = !state.hermesMode;
  if (elements.hermesBadge) {
    elements.hermesBadge.className = state.hermesMode ? 'hermes-badge active' : 'hermes-badge';
    elements.hermesBadge.title = state.hermesMode ? 'FIFI查 分析：開啟' : 'FIFI查 分析：關閉';
  }
}

// ================================================
// 發送消息
// ================================================

async function sendMessage() {
  const message = elements.chatInput.value.trim();
  if (!message) return;

  elements.chatInput.value = '';
  handleChatInput();
  elements.chatInput?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  elements.chatInput?.focus();

  if (elements.welcomeScreen) {
    elements.welcomeScreen.classList.add('hidden');
  }

  addMessage('user', message);
  showTyping(true);

  // 確保 messages container 滾動到底部
  requestAnimationFrame(() => {
    if (elements.messagesContainer) {
      elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
    }
  });

  try {
    // Admin command: show unanswered question log
    if (message.trim() === '/gaps' || message.trim() === '/未答') {
      showTyping(false);
      const gaps = getUnansweredQuestions();
      if (gaps.length === 0) {
        addHermesPanel('目前沒有未能回答的問題記錄。');
      } else {
        const rows = gaps.slice(0, 20).map(function(g, i) {
          return (i + 1) + '. [問' + g.count + '次] ' + g.q + ' (' + (g.ts || '').slice(0, 10) + ')';
        }).join('\n');
        addHermesPanel('【未能回答的問題】（共 ' + gaps.length + ' 條）\n\n' + rows + '\n\n如要提供答案，請回覆「教你：[問題] → [答案]」');
      }
      return;
    }

    const greetingResponse = checkCasualGreeting(message);
    if (greetingResponse) {
      await new Promise(r => setTimeout(r, 600));
      addHermesPanel(greetingResponse);
    } else {
      // Direct commission lookup — skip AI if we have real rate data
      const commissionData = checkCommissionLookup(message);
      if (commissionData) {
        await new Promise(r => setTimeout(r, 400));
        showCommissionResults(commissionData);
        state.conversationHistory.push({
          q: message,
          a: `佣金查詢：「${commissionData.searchTerm}」找到 ${commissionData.results.length} 個分類`,
          timestamp: Date.now()
        });
        saveToMasterRecord(state.user.username, message, `佣金查詢 ${commissionData.results.length} 個結果`);
      } else {
        const [faqMatches, hermesAnalysis] = await Promise.all([
          searchFAQEnhanced(message),
          state.hermesMode ? getHermesAnalysis(message) : Promise.resolve(null)
        ]);
        await showAssistantResponse(message, faqMatches, hermesAnalysis);

        // Track unanswered questions for self-learning
        const hasAnyFaqMatch = faqMatches && faqMatches.length > 0 && (faqMatches[0].score || 0) > 0;
        const aiConf = hermesAnalysis?.confidence || 0;
        if (!hasAnyFaqMatch && aiConf < 0.4) {
          trackUnansweredQuestion(message, aiConf);
        }

        // 加入對話歷史
        state.conversationHistory.push({
          q: message,
          a: hermesAnalysis?.answer || '抱歉，Hermes 分析暫時無法使用。',
          timestamp: Date.now()
        });

        // 保存到 master 記錄（所有 Store ID 的所有問題）
        saveToMasterRecord(state.user.username, message, hermesAnalysis?.answer || '');
      }
    }
  } catch (error) {
    console.error('Error:', error);
    addMessage('assistant', `唉～衰咗衰咗... ${error.message}\n\n等我冷靜下先 😅`);
  } finally {
    showTyping(false);
    // 確保輸入框可見並滾動到正確位置
    // Mobile Safari needs a small delay for virtual keyboard
    setTimeout(() => {
      if (elements.chatInput) {
        elements.chatInput.scrollIntoView({ behavior: 'smooth', block: 'end' });
        elements.chatInput.focus();
      }
      if (elements.messagesContainer) {
        elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
      }
    }, 300);
  }
}

// ================================================
// 對話歷史保存/讀取
// ================================================

function saveConversationHistory() {
  if (state.conversationHistory.length === 0) return;
  if (!state.user) return;

  const key = `fifi_history_${state.user.username}`;
  const data = {
    storeId: state.user.username,
    conversations: state.conversationHistory,
    lastUpdated: Date.now()
  };
  localStorage.setItem(key, JSON.stringify(data));
}

function loadConversationHistory() {
  if (!state.user) return;

  const key = `fifi_history_${state.user.username}`;
  const stored = localStorage.getItem(key);
  if (stored) {
    try {
      const data = JSON.parse(stored);
      state.conversationHistory = data.conversations || [];
    } catch {
      state.conversationHistory = [];
    }
  }
}

function showConversationHistory() {
  const modal = elements.historyModal;
  const content = document.getElementById('historyContent');
  if (!content) return;

  if (state.conversationHistory.length === 0) {
    content.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:40px;">暫時未有對話記錄</p>';
    return;
  }

  let html = '<div class="history-list">';
  state.conversationHistory.slice().reverse().forEach((item, i) => {
    const time = new Date(item.timestamp).toLocaleString('zh-HK', {
      month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    html += `
      <div class="history-item">
        <div class="history-q">${escapeHtml(item.q)}</div>
        <div class="history-a">${escapeHtml(item.a)}</div>
        <div class="history-time">${time}</div>
      </div>
    `;
  });
  html += '</div>';

  content.innerHTML = html;
}

// ================================================
// Master Record - 所有問題的完整記錄
// ================================================

function getMasterRecord() {
  try {
    const stored = localStorage.getItem('fifi_master_record');
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function saveToMasterRecord(storeId, question, answer) {
  const master = getMasterRecord();
  if (!master[storeId]) {
    master[storeId] = [];
  }
  master[storeId].push({
    q: question,
    a: answer,
    timestamp: Date.now()
  });
  localStorage.setItem('fifi_master_record', JSON.stringify(master));
}

function showConversationHistory() {
  const content = document.getElementById('historyContent');
  if (!content) return;

  // 只顯示當前 Store ID 的記錄
  const history = state.conversationHistory || [];

  if (history.length === 0) {
    content.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:40px;">暫時未有對話記錄</p>';
    return;
  }

  let html = '<div class="history-list">';
  history.slice().reverse().forEach((item, i) => {
    const time = new Date(item.timestamp).toLocaleString('zh-HK', {
      year: 'numeric', month: 'numeric', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
    html += `
      <div class="history-item">
        <div class="history-q">❓ ${escapeHtml(item.q)}</div>
        <div class="history-a">💬 ${escapeHtml(item.a)}</div>
        <div class="history-time">🕐 ${time}</div>
      </div>
    `;
  });
  html += '</div>';

  content.innerHTML = html;
}

function showStoreHistory(storeId) {
  const master = getMasterRecord();
  const content = document.getElementById('historyListContent');
  if (!content || !master[storeId]) return;

  // 更新 tab 狀態
  document.querySelectorAll('.history-tab').forEach(tab => {
    tab.classList.toggle('active', tab.textContent === storeId);
  });

  let html = '';
  master[storeId].slice().reverse().forEach((item, i) => {
    const time = new Date(item.timestamp).toLocaleString('zh-HK', {
      year: 'numeric', month: 'numeric', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
    html += `
      <div class="history-item">
        <div class="history-q">❓ ${escapeHtml(item.q)}</div>
        <div class="history-a">💬 ${escapeHtml(item.a)}</div>
        <div class="history-time">🕐 ${time}</div>
      </div>
    `;
  });
  content.innerHTML = html;
}

// ================================================
// 匯出 Excel (CSV 格式)
// ================================================

function exportToExcel() {
  const master = getMasterRecord();
  const storeIds = Object.keys(master);

  if (storeIds.length === 0) {
    showNotification('暫無記錄可以匯出');
    return;
  }

  // CSV header
  let csv = '\uFEFF'; // BOM for UTF-8
  csv += 'Store ID,時間,問題,答案\n';

  storeIds.forEach(storeId => {
    master[storeId].forEach(item => {
      const time = new Date(item.timestamp).toLocaleString('zh-HK', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
      // Escape quotes and wrap in quotes
      const q = `"${item.q.replace(/"/g, '""')}"`;
      const a = `"${item.a.replace(/"/g, '""')}"`;
      csv += `${storeId},${time},${q},${a}\n`;
    });
  });

  // Create download
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `FIFI_CHECK_記錄_${date}.csv`;
  link.click();
  URL.revokeObjectURL(url);

  showNotification('📥 匯出成功！');
}

// ================================================
// Hermes 分析引擎
// ================================================

async function getHermesAnalysis(question) {
  // 直接用完整FAQ知識庫呼叫Claude — 單次API呼叫，更快更穩定
  return await getBuiltInHermesAnalysis(question);
}
// MMS system URLs — always injected when question is MMS-related
var MMS_URLS = '【MMS 系統入口】\n• MMS 2.0（現時使用）：https://merchant.shoalter.com/\n• MMS 1.0（舊，庫存功能已停用）：https://mms.shoalter.com/mms/#/login\n\n【庫存管理教學】\n• 單件更新庫存：https://sites.google.com/view/hktv-merc-faq/%E7%AC%AC%E4%B8%80%E9%9A%8E%E6%AE%B5/Inventory-Management/single-update-inventory\n• 批量更新庫存：https://sites.google.com/view/hktv-merc-faq/%E7%AC%AC%E4%B8%80%E9%9A%8E%E6%AE%B5/Inventory-Management/batch-update-inventory';

// Compact hardcoded commission rate reference — always available regardless of commission-data.js load state
var COMMISSION_RATE_CARD = [
  '【HKTVmall 佣金分類快速參考】（實際以合約為準）',
  '',
  '超市飲品 (Supermarket > 飲品 即沖飲品):',
  '  汽水/可樂/雪碧/七喜/芬達 等碳酸飲品: 24%',
  '  水/礦泉水: 24%',
  '  運動飲品 (如佳得樂): 24%',
  '  果汁/無汽飲品: 24%',
  '  牛奶/豆奶/乳酪飲品: 24%',
  '  即沖咖啡/奶茶/朱古力: 24%',
  '  茶類飲品: 24%',
  '啤酒/酒類 (Supermarket > 酒類):',
  '  啤酒 (藍妹/喜力/嘉士伯/青島/生力等): 24%',
  '  紅酒/白酒/香檳: 18%',
  '  中國酒/紹興酒: 24%',
  '  茅台/五糧液: 18%',
  '超市食品 (Supermarket):',
  '  水果: 12%',
  '  蔬菜: 23-28%',
  '  鮮花: 13%',
  '  急凍/冰鮮海鮮/肉類: 25%',
  '  零食/糖果/餅乾/爆谷: 24%',
  '  蛋糕/甜品: 24-26%',
  '  麵包: 26%',
  '  蜂蜜/穀物/有機食品: 28%',
  '  罐頭食品/南北貨: 24%',
  '  即食麵/意粉: 24%',
  '  調味料/醬料: 24%',
  '  食用油/米: 24%',
  '  月餅/端午糭: 18%',
  '  盆菜: 20%',
  '  衛生紙/紙巾: 26%',
  '  家居清潔用品: 26%',
  '  口罩/防疫用品: 24%',
  '電子產品 (Gadgets & Electronics):',
  '  iPhone: 3%',
  '  Samsung 手機: 3%',
  '  其他品牌手機 (華為/小米/Oppo等): 8%',
  '  平板電腦 (iPad等): 8-15%',
  '  手提電腦/桌上電腦: 8-15%',
  '  耳機/喇叭/影音配件: 12-15%',
  '  數碼相機: 8-12%',
  '  遊戲機: 8%',
  '  智能家居/IoT: 15%',
  '  手錶/智能手錶: 12-15%',
  '家電 (Home Appliances):',
  '  冷氣機/抽濕機: 8-10%',
  '  洗衣機/乾衣機: 8-10%',
  '  雪櫃/冰箱: 8-10%',
  '  氣炸鍋/廚房電器: 15%',
  '  電風扇: 10%',
  '  吸塵機/空氣清新機: 10-15%',
  '護膚/美妝 (Skincare & Makeup / Personal Care):',
  '  護膚品/化妝品: 24%',
  '  美容儀器: 18%',
  '  洗髮水/沐浴露/護髮: 24%',
  '時裝 (Fashion):',
  '  男裝/女裝/童裝: 15%',
  '嬰兒母嬰 (Mother & Baby):',
  '  嬰兒奶粉: 18%',
  '  嬰幼兒食品/飲品: 29%',
  '  嬰兒車/安全座椅: 25-29%',
  '寵物 (Pets): 25%',
  '玩具/書籍 (Toys & Books): 23%',
  '運動/旅遊 (Sports & Travel): 10-15%',
  '家居用品 (Housewares): 26%',
];

function getCommissionContext() {
  if (!window.COMMISSION_DATA) return '';
  // Sub2-level entries give the key product categories with rates (~800 entries)
  var sub2 = window.COMMISSION_DATA.filter(function(d) { return d.level === 'Sub2'; });
  return sub2.map(function(d) { return d.path + ': ' + d.rate + '%'; }).join('\n');
}

async function getBuiltInHermesAnalysis(question, conversationContext = '') {
  const config = API_CONFIG[state.apiProvider];

  const isCommissionQ = /佣金|commission|傭金|佣金率/i.test(question);
  const isMmsQ = /mms|庫存|inventory|存貨|上架|下架|商品管理|後台|merchant\.shoalter|mms\.shoalter/i.test(question);

  // ── Static block (CACHED) — identical every request, maximises cache hits ──
  const staticBlock = `你係 FIFI查，HKTVmall 商戶專屬 AI 支援助理。你嘅目標係真正幫到商戶解決問題，唔係敷衍了事。

【對話風格】
- 用自然廣東話回覆，口語化但專業，好似一個熟悉HKTVmall系統嘅同事咁
- 有溫度、有耐性，唔好太機械式
- 適當用emoji令回覆更易讀，但唔好過多
- 如果問題唔清楚，主動問清楚先答

【回答原則】
1. 優先參考下面 FAQ 知識庫，盡量引用原文數據
2. 佣金問題：直接答出具體%數，唔好叫商戶自己去查
3. 如有步驟教學，必須用 Step 1、Step 2、Step 3 格式，清晰易跟
4. 永遠唔好話「我唔知」— 唔確定就引導商戶搵 RM 或致電 3998 8139
5. 回覆要有實質內容，唔可以只係「請參考文件」咁空泛
6. 如果問題涉及多個方面，分點回覆，清晰易讀
7. 答完之後，如果有相關注意事項或常見錯誤，主動提醒

FAQ 知識庫：
${getFAQContext()}

請以 JSON 格式回覆（只回覆 JSON）：
{
  "answer": "主要答案（輕鬆口語化，例如：唉！呢個問題問得好，常見嘅係...）",
  "extendedAdvice": "延伸建議/實際操作步驟（用bullet points，越實際越好）",
  "relatedCategory": "相關分類名稱",
  "warning": "警示事項（如無則留空）",
  "confidence": 0.0-1.0
}`;

  // ── Dynamic block (NOT cached) — varies per request ──
  const dynamicParts = [];
  if (conversationContext) dynamicParts.push(conversationContext);
  if (isCommissionQ) {
    const dynamicCtx = window.COMMISSION_DATA
      ? '\n\n--- 完整分類數據 (共 ' + (window.COMMISSION_COUNT || '') + ' 個) ---\n' + getCommissionContext()
      : '';
    dynamicParts.push(
      '【佣金查詢補充數據】\n' + COMMISSION_RATE_CARD + dynamicCtx +
      '\n\n佣金查詢指引：\n' +
      '- 根據用戶問嘅產品名稱，找出對應分類同佣金率，直接答出%\n' +
      '- 可樂/汽水類飲品 → 24%；iPhone → 3%；嬰兒奶粉 → 18%\n' +
      '- 如果產品唔喺上面清單，估計最接近分類並說明\n' +
      '- 提醒用戶：實際佣金以合約為準，如有疑問請聯絡 RM'
    );
  }
  if (isMmsQ) dynamicParts.push('【MMS系統補充資料】\n' + MMS_URLS);

  // Build system array — static part gets cache_control for prompt caching
  const systemArray = [
    { type: 'text', text: staticBlock, cache_control: { type: 'ephemeral' } }
  ];
  if (dynamicParts.length > 0) {
    systemArray.push({ type: 'text', text: dynamicParts.join('\n\n') });
  }

  try {
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.apiKey}`,
        'anthropic-beta': 'prompt-caching-2024-07-31',
        'HTTP-Referer': 'https://fificheck.github.io',
        'X-Title': 'FIFI Check'
      },
      body: JSON.stringify({
        model: config.model,
        system: systemArray,
        messages: [{ role: 'user', content: question }],
        max_tokens: 1500,
        temperature: 0.4
      }),
      signal: AbortSignal.timeout(30000)
    });

    if (!response.ok) throw new Error('LLM API error');

    const data = await response.json();
    // Support both OpenRouter (choices[]) and Anthropic native (content[]) response formats
    const content = (data.choices
      ? data.choices[0].message.content
      : data.content[0].text
    ).trim();

    try {
      const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(jsonStr);
    } catch {
      return {
        answer: content,
        extendedAdvice: '',
        relatedCategory: '',
        warning: '',
        confidence: 0.5
      };
    }
  } catch (error) {
    console.log('Built-in LLM failed:', error.message);
    return getDefaultHermesResponse(question);
  }
}

async function getDefaultHermesResponse(question) {
  // Commission questions: use rate card directly — don't fall back to the generic FAQ answer
  if (/佣金|commission|傭金|佣金率/i.test(question)) {
    var searchTerm = question
      .replace(/佣金率?|傭金|commission\s*rate?|commission|佣金比率/gi, '')
      .replace(/是多少|是幾多|有幾多|幾多|多少|係幾多|係咩|查詢|查看|點查|點睇/gi, '')
      .replace(/[？?！!，,。.\s]+/g, ' ')
      .trim();

    var rateAnswer = '';
    if (searchTerm.length >= 2 && window.lookupCommission) {
      var hits = window.lookupCommission(searchTerm);
      if (hits && hits.length > 0) {
        rateAnswer = '根據分類數據，「' + searchTerm + '」相關分類佣金率：\n' +
          hits.slice(0, 5).map(function(h) { return '• ' + h.path + ': ' + h.rate + '%'; }).join('\n');
      }
    }
    if (!rateAnswer) {
      rateAnswer = '根據 HKTVmall 佣金分類表：\n' +
        '• 汽水/可樂/飲品: 24%\n• 啤酒: 24%\n• 紅酒/白酒: 18%\n' +
        '• iPhone: 3%\n• 其他手機: 8%\n• 護膚/化妝品: 24%\n' +
        '• 嬰兒奶粉: 18%\n• 時裝: 15%\n• 寵物: 25%\n\n' +
        '輸入具體分類名稱（如「汽水」、「護膚」）可查看更詳細佣金率。';
    }
    return {
      answer: rateAnswer,
      extendedAdvice: '實際佣金率以個別合約為準，如有疑問請聯絡您的 RM 確認。',
      relatedCategory: '佣金及付款',
      warning: '以上係參考數據，實際以合約為準',
      confidence: 0.8
    };
  }

  // For non-commission questions: find best FAQ match (but skip the generic commission FAQ entries)
  const faqMatches = await searchFAQEnhanced(question);
  const nonCommissionMatches = faqMatches.filter(function(m) { return m.category !== '佣金及付款'; });
  const match = nonCommissionMatches.length > 0 ? nonCommissionMatches[0] : (faqMatches.length > 0 ? faqMatches[0] : null);
  if (match) {
    return {
      answer: match.a,
      extendedAdvice: '以上答案來自「' + match.category + '」分類中的「' + match.q + '」。如需更多協助，請聯絡您的 RM 或 FIFI 查服務團隊。',
      relatedCategory: match.category,
      warning: '',
      confidence: 0.85
    };
  }
  return {
    answer: '抱歉，我暫時未有相關資料...',
    extendedAdvice: '建議聯絡您的 RM 查詢，或者嘗試其他關鍵字搜尋。你可以隨時聯絡 FIFI 查服務團隊：3998 8139',
    relatedCategory: '聯絡與支援',
    warning: '',
    confidence: 0.1
  };
}

// ================================================
// FAQ 搜尋
// ================================================

// Sync wrapper - returns empty for sync contexts, use getRAGContext for async
function getFAQContext(excludeCategories) {
  if (typeof ALL_FAQ === 'undefined' || !ALL_FAQ || ALL_FAQ.length === 0) return '';
  const exclude = excludeCategories || [];
  const byCategory = {};
  for (const faq of ALL_FAQ) {
    if (exclude.indexOf(faq.category) >= 0) continue;
    if (!byCategory[faq.category]) byCategory[faq.category] = [];
    byCategory[faq.category].push(faq);
  }
  return Object.entries(byCategory).map(([cat, faqs]) =>
    `=== ${cat} ===\n` + faqs.map(f => `Q: ${f.q}\nA: ${f.a}`).join('\n\n')
  ).join('\n\n');
}

// ================================================
// 顯示回覆
// ================================================

async function showAssistantResponse(userQuestion, faqMatches, hermesAnalysis) {
  const isCommissionQ = /佣金|commission|傭金|佣金率/i.test(userQuestion);

  // For commission questions: never let the generic commission FAQ override the AI answer
  const filteredFaqMatches = isCommissionQ
    ? (faqMatches || []).filter(function(m) { return m.category !== '佣金及付款'; })
    : faqMatches;

  const hasFaqMatch = filteredFaqMatches && filteredFaqMatches.length > 0
    && ((filteredFaqMatches[0].score || 0) > 0 || (filteredFaqMatches[0].similarity || 0) > 0.3);
  const faqMatch = hasFaqMatch ? filteredFaqMatches[0] : null;

  // If AI response is weak (confidence < 0.5) and we have FAQ, prioritize FAQ
  const aiConfidence = hermesAnalysis?.confidence || 0;
  const shouldPrioritizeFaq = hasFaqMatch && aiConfidence < 0.5;

  if (hermesAnalysis && hermesAnalysis.answer && !shouldPrioritizeFaq) {
    const confidence = hermesAnalysis.confidence || 0.5;
    const confidenceClass = confidence >= 0.7 ? 'confidence-high' : confidence >= 0.4 ? 'confidence-medium' : 'confidence-low';
    const confidenceText = confidence >= 0.7 ? '高' : confidence >= 0.4 ? '中' : '低';

    let hermesHtml = `
      <div class="hermes-analysis">
        <div class="hermes-analysis-header">
          <span>🧠</span>
          <strong>FIFI查 分析</strong>
          <span class="confidence-badge ${confidenceClass}">${confidenceText} — ${Math.round(confidence * 100)}%</span>
        </div>

        <div class="hermes-section">
          <div class="hermes-section-label">📝 答案</div>
          <div class="hermes-section-content">${escapeHtml(hermesAnalysis.answer)}</div>
        </div>
    `;

    if (hermesAnalysis.extendedAdvice) {
      hermesHtml += `
        <div class="hermes-section">
          <div class="hermes-section-label">💡 延伸建議</div>
          <div class="hermes-section-content">${escapeHtml(hermesAnalysis.extendedAdvice)}</div>
        </div>
      `;
    }

    if (hermesAnalysis.relatedCategory) {
      hermesHtml += `
        <div class="hermes-section">
          <div class="hermes-section-label">📂 相關分類</div>
          <div class="hermes-section-content">${escapeHtml(hermesAnalysis.relatedCategory)}</div>
        </div>
      `;
    }

    if (hermesAnalysis.warnings) {
      hermesHtml += `
        <div class="hermes-warning">⚠️ ${escapeHtml(hermesAnalysis.warnings)}</div>
      `;
    }

    // Display sources
    if (hermesAnalysis.sources && hermesAnalysis.sources.length > 0) {
      hermesHtml += `
        <div class="hermes-section">
          <div class="hermes-section-label">📚 引用來源</div>
          <div class="hermes-sources">
            ${hermesAnalysis.sources.map(s => `<span class="source-tag">${escapeHtml(s)}</span>`).join('')}
          </div>
        </div>
      `;
    }

    // Display analysis info
    if (hermesAnalysis.analysis) {
      const analysis = hermesAnalysis.analysis;
      if (analysis.type || analysis.keywords) {
        hermesHtml += `
          <div class="hermes-section">
            <div class="hermes-section-label">🔍 問題分析</div>
            <div class="hermes-analysis-info">
              ${analysis.type ? `<span class="analysis-tag">🏷️ ${escapeHtml(analysis.type)}</span>` : ''}
              ${analysis.keywords && analysis.keywords.length > 0 ? `<span class="analysis-tag">🔑 ${analysis.keywords.slice(0, 3).join(', ')}</span>` : ''}
            </div>
          </div>
        `;
      }
    }

    // Display related questions
    if (hermesAnalysis.relatedQuestions && hermesAnalysis.relatedQuestions.length > 0) {
      hermesHtml += `
        <div class="hermes-section">
          <div class="hermes-section-label">💬 您可能想問</div>
          <div class="related-questions">
            ${hermesAnalysis.relatedQuestions.slice(0, 3).map(q => 
              `<button class="related-question-btn" onclick="askPreset('${escapeHtml(q.replace(/'/g, "\'"))}')">${escapeHtml(q)}</button>`
            ).join('')}
          </div>
        </div>
      `;
    }

    // Reference link — use matched FAQ URL if available, otherwise generic site
    const aiRefUrl = (faqMatch && faqMatch.source_url) ? faqMatch.source_url
      : 'https://sites.google.com/view/hktv-merc-faq/';
    hermesHtml += `
      <div class="hermes-source">📖 參考資料：<a href="${aiRefUrl}" target="_blank" rel="noopener" style="color:var(--primary);text-decoration:underline;">${aiRefUrl}</a></div>
    </div>
    `;

    addHermesPanel(hermesHtml);
  } else if (faqMatch) {
    // Strong FAQ match - show FAQ result prominently
    const faqRefUrl = faqMatch.source_url || 'https://sites.google.com/view/hktv-merc-faq/';
    let hermesHtml = `
      <div class="hermes-analysis">
        <div class="hermes-analysis-header">
          <span>📖</span>
          <strong>FAQ 知識庫</strong>
          <span class="confidence-badge confidence-high">匹配度 高</span>
        </div>

        <div class="hermes-section">
          <div class="hermes-section-label">📋 ${faqMatch.category}</div>
          <div class="hermes-section-content">${escapeHtml(faqMatch.q)}</div>
        </div>

        <div class="hermes-section">
          <div class="hermes-section-content" style="background: var(--bg-warm); padding: 12px; border-radius: 6px; margin-top: 8px;">${escapeHtml(faqMatch.a)}</div>
        </div>

        ${faqMatches.length > 1 ? `
        <div class="hermes-section" style="margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border);">
          <div class="hermes-section-label">💡 其他相關問題</div>
          ${faqMatches.slice(1, 3).map(m => `
            <div class="hermes-section-content" style="cursor: pointer; color: var(--primary);" onclick="askPreset('${escapeHtml(m.q)}')">• ${escapeHtml(m.q)}</div>
          `).join('')}
        </div>
        ` : ''}

        <div class="hermes-source">📖 參考資料：<a href="${faqRefUrl}" target="_blank" rel="noopener" style="color:var(--primary);text-decoration:underline;">${faqRefUrl}</a></div>
      </div>
    `;

    addHermesPanel(hermesHtml);
  } else {
    addMessage('assistant', '抱歉，我暫時未有相關資料。建議聯絡您的 RM 或 FIFI 查服務團隊：3998 8139');
  }
}

function addHermesPanel(html) {
  const container = document.createElement('div');
  container.className = 'hermes-panel-container';
  container.innerHTML = html;

  if (elements.messagesContainer) {
    elements.messagesContainer.appendChild(container);
    elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
  }
}

// ================================================
// 消息管理
// ================================================

function addMessage(type, content) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${type}`;

  const time = formatTime(new Date());

  if (type === 'user') {
    messageDiv.innerHTML = `
      <div class="message-content">${escapeHtml(content)}</div>
      <div class="message-time">${time}</div>
    `;
  } else {
    messageDiv.innerHTML = `
      <div class="message-avatar">🤖</div>
      <div class="message-content">${formatMessageContent(content)}</div>
      <div class="message-time">${time}</div>
    `;
  }

  elements.messagesContainer.appendChild(messageDiv);
  elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;

  state.messages.push({ type, content, time });
}

function formatMessageContent(content) {
  return content
    .replace(/\n/g, '<br>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showTyping(show) {
  if (show) {
    if (elements.typingIndicator) {
      elements.typingIndicator.style.display = 'flex';
      elements.messagesContainer.appendChild(elements.typingIndicator);
    }
  } else {
    if (elements.typingIndicator) {
      elements.typingIndicator.style.display = 'none';
    }
  }
}

function formatTime(date) {
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return date.toLocaleTimeString('zh-HK', { hour: '2-digit', minute: '2-digit' });
  } else {
    return date.toLocaleDateString('zh-HK', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
}

// ================================================
// 佣金直接查詢
// ================================================

function searchCommissionRateCard(keyword) {
  // Handle both array and joined-string forms of COMMISSION_RATE_CARD
  var lines = Array.isArray(COMMISSION_RATE_CARD)
    ? COMMISSION_RATE_CARD
    : (COMMISSION_RATE_CARD || '').split('\n');
  keyword = keyword.toLowerCase();
  var hits = [];
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    if (line.toLowerCase().indexOf(keyword) >= 0) {
      var match = line.match(/\s*([^:()]+?):\s*(\d+(?:[.\-]\d+)*)%?/);
      if (match && match[1].trim().length > 1) {
        hits.push({ name: match[1].trim(), rate: match[2], path: 'HKTVmall 佣金分類表', code: '' });
      }
    }
  }
  var seen = {}, unique = [];
  for (var j = 0; j < hits.length; j++) {
    var k = hits[j].name;
    if (!seen[k]) { seen[k] = true; unique.push(hits[j]); }
  }
  return unique;
}

function extractProductTerm(message) {
  // Strip commission keywords, context words, Cantonese particles, question words
  var term = message
    .replace(/佣金率?|傭金|commission\s*rate?|commission|佣金比率/gi, '')
    .replace(/我想問|我想查|我賣|我有|我係賣|我地|我哋|關於|以下|以上|請問|你好|你知唔知/gi, '')
    .replace(/是多少|是幾多|有幾多|幾多|多少|是什麼|係幾多|係咩|係咪|如何查|如何知道|怎樣查|怎樣|點查|點睇|有冇|查詢|查看/gi, '')
    .replace(/[嘅既囉喇咋㗎呢嘛喎啊哦]/g, '')
    .replace(/[？?！!，,。.\s]+/g, ' ')
    .trim();
  return term;
}

function checkCommissionLookup(message) {
  const msg = message.toLowerCase();
  const commissionKeywords = ['佣金', 'commission', '佣金率', '傭金', '佣金比率'];
  if (!commissionKeywords.some(k => msg.includes(k))) return null;

  var searchTerm = extractProductTerm(message);
  if (!searchTerm || searchTerm.length < 1) return null;

  var results = [];
  var usedTerm = searchTerm;

  // Try full commission data first (if loaded)
  if (window.COMMISSION_DATA && window.lookupCommission) {
    results = window.lookupCommission(searchTerm) || [];
  }

  // Fallback: search rate card text
  if (results.length === 0) {
    results = searchCommissionRateCard(searchTerm);
  }

  // If still no results, try 2-char Chinese bigrams to extract the product name
  if (results.length === 0 && searchTerm.length > 2) {
    var chineseOnly = searchTerm.replace(/[^一-鿿]/g, '');
    for (var b = 0; b <= chineseOnly.length - 2; b++) {
      var bigram = chineseOnly.slice(b, b + 2);
      var bigramResults = [];
      if (window.COMMISSION_DATA && window.lookupCommission) {
        bigramResults = window.lookupCommission(bigram) || [];
      }
      if (bigramResults.length === 0) {
        bigramResults = searchCommissionRateCard(bigram);
      }
      // Accept bigram if it returns a reasonable number of results (not too broad)
      if (bigramResults.length > 0 && bigramResults.length <= 50) {
        results = bigramResults;
        usedTerm = bigram;
        break;
      }
    }
  }

  if (results.length === 0) return null;
  return { results, searchTerm: usedTerm };
}

function showCommissionResults(data) {
  const { results, searchTerm } = data;
  const updatedDate = window.COMMISSION_UPDATED || '最近';
  const shown = results.slice(0, 15);

  const rows = shown.map(item => `
    <tr style="border-bottom:1px solid rgba(0,0,0,0.06)">
      <td style="padding:5px 8px;font-size:0.78em;color:#888;white-space:nowrap"><code>${escapeHtml(item.code)}</code></td>
      <td style="padding:5px 8px;font-weight:500">${escapeHtml(item.name)}</td>
      <td style="padding:5px 8px;font-size:0.82em;color:#666;max-width:220px;word-break:break-word">${escapeHtml(item.path)}</td>
      <td style="padding:5px 8px;text-align:right;font-weight:700;color:#e55;white-space:nowrap">${item.rate}%</td>
    </tr>`).join('');

  const moreNote = results.length > 15
    ? `<p style="margin:8px 0 0;font-size:0.82em;color:#888">...還有 ${results.length - 15} 個結果，請提供更精確的關鍵字</p>`
    : '';

  const html = `
    <div class="hermes-analysis">
      <div class="hermes-analysis-header">
        <span>💳</span>
        <strong>佣金查詢結果</strong>
        <span class="confidence-badge confidence-high">實時數據</span>
      </div>
      <div class="hermes-section">
        <div class="hermes-section-label">🔍 搜尋「${escapeHtml(searchTerm)}」— 找到 ${results.length} 個分類</div>
        <div class="hermes-section-content" style="padding:0">
          <div style="overflow-x:auto">
            <table style="width:100%;border-collapse:collapse;font-size:0.88em">
              <thead>
                <tr style="background:rgba(0,0,0,0.05)">
                  <th style="padding:6px 8px;text-align:left;font-weight:600;font-size:0.85em">分類碼</th>
                  <th style="padding:6px 8px;text-align:left;font-weight:600;font-size:0.85em">名稱</th>
                  <th style="padding:6px 8px;text-align:left;font-weight:600;font-size:0.85em">路徑</th>
                  <th style="padding:6px 8px;text-align:right;font-weight:600;font-size:0.85em">佣金率</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
          ${moreNote}
        </div>
      </div>
      <div class="hermes-section">
        <div class="hermes-section-label">ℹ️ 備注</div>
        <div class="hermes-section-content">數據更新：${escapeHtml(updatedDate)} ｜ 共 ${window.COMMISSION_COUNT || results.length} 個分類 ｜ ⚠️ 實際佣金率以合約為準，如有疑問請聯絡您的 RM。</div>
      </div>
      <div class="hermes-source">📖 參考資料：<a href="https://hktvcommissionsearcher.netlify.app/" target="_blank" rel="noopener" style="color:var(--primary);text-decoration:underline;">https://hktvcommissionsearcher.netlify.app/</a></div>
    </div>`;

  addHermesPanel(html);
}

// ================================================
// 日常寒暄檢測
// ================================================

function checkCasualGreeting(message) {
  const msg = message.toLowerCase().trim();

  // ========== 問候語 ==========
  const greetings = [
    '/', '你好', 'hello', 'hi', '嗨', '早晨', '午安', '晚安',
    '你叫咩名', '你係邊個', '你係咩', '你係誰', '你係人定鬼',
    '做緊咩', '做咩', '忙咩', '最近點', '你好嗎', '點呀',
    '喂', 'hello呀', 'hi呀', '你好呀', '早晨呀'
  ];

  // ========== 感謝語 ==========
  const thanks = [
    'thank', '多謝', '唔該', '唔該晒', '多謝晒', 'thanks',
    'thank you', 'thx', 'c9', '9c', '謝謝', '谢'
  ];

  // ========== 再見語 ==========
  const goodbyes = [
    '拜拜', '再見', '再會', 'bye', 'bye bye', '聽晚見',
    '聽日見', '聽朝見', '走先', '先走', '下次見'
  ];

  // ========== 讚美語 ==========
  const praises = [
    '好嘢', '勁', '正', '好正', '勁正', '正呀', '正喎',
    '好叻', '叻', '犀利', '勁犀利', 'good', 'great', 'wow'
  ];

  // ========== 抱怨語 ==========
  const complaints = [
    '好難', '點解咁難', '點解', '唔知點', '頭痕', '好煩',
    '煩', '死嘢', '仆街', '沒用', '無用', '垃圾', '爛'
  ];

  // ========== 身份問題 ==========
  const identityQuestions = [
    '你係ai嗎', '你係機械人嗎', '你係bot嗎', '你係人嗎',
    '你識咩', '你可以做咩', '你有咩用', '你幫到我咩'
  ];

  // ========== 離開話 ==========
  const leavingQuestions = [
    '我想走', '我要走', '我想离开', '我要离开'
  ];

  // ========== 對話類型檢測 ==========
  const isGreeting = greetings.some(g => msg === g || msg === g + '？' || msg === g + '?');
  const isThanks = thanks.some(t => msg.includes(t));
  const isGoodbye = goodbyes.some(g => msg.includes(g));
  const isPraise = praises.some(p => msg.includes(p));
  const isComplaint = complaints.some(c => msg.includes(c));
  const isIdentity = identityQuestions.some(q => msg.includes(q));
  const isLeaving = leavingQuestions.some(l => msg.includes(l));

  // ========== 回覆邏輯 ==========

  // 感謝回覆
  if (isThanks && !isGreeting) {
    const responses = [
      { answer: `唔該你才是！ 😄`, advice: `能幫到你我好開心～ 有其他問題就尽管問啦！` },
      { answer: `不客氣！有需要隨時搵我 ^^`, advice: `我成日都在呢度等你架～` },
      { answer: `小事來的～ 有咩幫到你再出聲話我知！`, advice: `FIFI查 24/7 都在線為你服務 💪` }
    ];
    const r = responses[Math.floor(Math.random() * responses.length)];
    return formatCasualResponse(r.answer, r.advice);
  }

  // 再見回覆
  if (isGoodbye || isLeaving) {
    const responses = [
      { answer: `拜拜！下次見 ^^`, advice: `記住我哋有咩問題都可以搵 FIFI查～ 支持你！💪` },
      { answer: `聽日見！記得優惠資訊可以問我～`, advice: `隨時歡迎你回來，我一定幫你 ❤️` },
      { answer: `好嘢！有需要再搵我啦～`, advice: `你走啦！FIFI查 為你服務緊架 💪` }
    ];
    const r = responses[Math.floor(Math.random() * responses.length)];
    return formatCasualResponse(r.answer, r.advice);
  }

  // 抱怨回覆
  if (isComplaint && !isGreeting) {
    const responses = [
      { answer: `唉，明白你心情... 我盡量幫你啦！`, advice: `冷靜啲，我一定幫你搵到方法！你試下更具體咁描述問題？` },
      { answer: `我知道你頭痕... 不如我幫你分析下？`, advice: `你試下直接話我知你想做咩，我實幫到你！` }
    ];
    const r = responses[Math.floor(Math.random() * responses.length)];
    return formatCasualResponse(r.answer, r.advice);
  }

  // 身份問題回覆
  if (isIdentity) {
    const responses = [
      { answer: `我係 **FIFI查**，HKTVmall 商戶 AI 助理！`, advice: `我可以幫你解答：\n• 上架產品問題\n• 訂單處理\n• 佣金計算\n• 優惠設定\n• 其他商戶疑問\n\n有咩想问就出聲啦！` },
      { answer: `我係 **FIFI查** 嚟嘅～ 你嘅商戶小幫手！`, advice: `專門幫商戶解決各種疑難雜症！\n\n例如：\n✅ 如何上架新產品\n✅ 佣金率計算\n✅ 優惠活動設定\n✅ 退貨退款處理\n\n我一定幫到你！` }
    ];
    const r = responses[Math.floor(Math.random() * responses.length)];
    return formatCasualResponse(r.answer, r.advice);
  }

  // 打招呼
  if (isGreeting) {
    const casualResponses = [
      {
        answer: `👋 你好！我係 **FIFI查**，你嘅 HKTVmall 商戶助理！`,
        advice: `知道你有好多嘢要搞，頭都大埋啦... 不過唔洗驚！我實幫到你架！\n\n有咩想問就尽管開口啦 ^^`
      },
      {
        answer: `唉～我喺度等你問嘢咋！ 😄`,
        advice: `我係 **FIFI查**，專幫 HKTVmall 商戶解決疑難雜症！\n\n知道你頭痕緊，我一定幫到你掛～ 有咩就出聲啦！`
      },
      {
        answer: `喂！你好！我是 **FIFI查** 嚟嘅～  :P`,
        advice: `聽講你好頭痛嚟嘅？唔洗咁緊張！我幫過好多商戶解決問題嘅經驗 ✨\n\n你慢慢話我知有咩困難，我實幫到你架！`
      }
    ];

    const response = casualResponses[Math.floor(Math.random() * casualResponses.length)];
    return formatCasualResponse(response.answer, response.advice);
  }

  return null;
}

function formatCasualResponse(answer, advice) {
  return `
    <div class="hermes-analysis">
      <div class="hermes-analysis-header">
        <span>💬</span>
        <strong>FIFI查</strong>
        <span class="confidence-badge confidence-high">線上閒聊中</span>
      </div>
      <div class="hermes-section">
        <div class="hermes-section-label">💬</div>
        <div class="hermes-section-content">${answer}</div>
      </div>
      <div class="hermes-section">
        <div class="hermes-section-label">🤝</div>
        <div class="hermes-section-content">${advice}</div>
      </div>
    </div>
  `;
}

// ================================================
// 預設問題晶片
// ================================================

function initPresetChips() {
  if (!elements.presetChips) return;

  const presets = [
    '如何上架新產品？',
    '佣金率是多少？',
    '如何處理訂單發貨？',
    '如何設定優惠活動？',
    '聯絡我的 RM',
    '退款政策是怎樣的？'
  ];

  elements.presetChips.innerHTML = presets.map(q =>
    `<button class="preset-chip" onclick="askPreset('${q}')">${q}</button>`
  ).join('');
}

async function askPreset(question) {
  elements.chatInput.value = question;
  sendMessage();
}

// ================================================
// 通知
// ================================================

function showNotification(message) {
  const notification = document.createElement('div');
  notification.className = 'notification';
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.classList.add('show');
  }, 10);

  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  }, 2000);
}

// ================================================
// 對外暴露 API
// ================================================

window.FIFI = {
  state,
  useStoreId,
  showConversationHistory,
  resetApiKey: () => {
    localStorage.removeItem('fifi_apikey');
    state.apiKey = null;
  },
  toggleHermes: toggleHermesMode,
  searchFAQ: (q) => searchFAQ(q)
};

// 初始化預設問題
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPresetChips);
} else {
  initPresetChips();
}
