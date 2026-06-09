// ================================================
// FIFI CHECK — Main Application (Hermes Enhanced)
// HKTVmall 商戶 AI 助理 + Hermes 分析引擎
// ================================================

let state = {
  isLoggedIn: false,
  user: null,
  apiKey: '',
  apiProvider: 'openrouter',
  messages: [],
  isTyping: false,
  hermesMode: true  // Hermes 分析模式開關
};

// DOM 元素緩存
let elements = {};
const API_CONFIG = {
  openai: {
    endpoint: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o'
  },
  deepseek: {
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    model: 'deepseek-chat'
  },
  openrouter: {
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    model: 'mistralai/mistral-7b-instruct'
  }
};

// Hermes/GAS 配置 — 請替換為你的 GAS Web App URL
const GAS_CONFIG = {
  // 當你没有設定 GAS URL 時，使用內置 LLM 分析
  useBuiltInLLM: true,
  gasWebAppUrl: '',  // 例如: 'https://script.google.com/macros/s/XXX/exec'
  hermesWebhook: ''   // Discord webhook URL for Hermes (可選)
};

// ================================================
// 初始化
// ================================================

document.addEventListener('DOMContentLoaded', () => {
  initElements();
  initEventListeners();
  checkAuthStatus();
  checkApiKeyStatus();
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
  
  // Hermes 增強面板
  elements.hermesPanel = document.getElementById('hermesPanel');
  elements.hermesBadge = document.getElementById('hermesBadge');
}

// ================================================
// 事件監聽
// ================================================

function initEventListeners() {
  // Helper to safely add event listener
  const safeAddEvent = (el, event, handler) => {
    if (el) el.addEventListener(event, handler);
  };

  // 登入表單
  safeAddEvent(elements.loginForm, 'submit', handleLogin);

  // 登出
  safeAddEvent(elements.btnLogout, 'click', () => showModal(elements.logoutModal));
  safeAddEvent(elements.btnCancelLogout, 'click', () => hideModal(elements.logoutModal));
  safeAddEvent(elements.btnConfirmLogout, 'click', handleLogout);

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
    showChatView();
  }
}

function checkApiKeyStatus() {
  const savedKey = localStorage.getItem('fifi_apikey');
  if (savedKey) {
    state.apiKey = savedKey;
  } else {
    setTimeout(() => showModal(elements.apiKeyModal), 500);
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

  // 驗證 Store ID 格式 (H/B/C/P + 數字)
  const storeIdPattern = /^[HBCPhbcp]\d{6,8}$/;
  if (!storeIdPattern.test(storeId)) {
    showError('Store ID 格式不正確 (例: H1234567)');
    return;
  }

  setLoginLoading(true);
  
  setTimeout(() => {
    state.isLoggedIn = true;
    state.user = { username: storeId.toUpperCase(), loginTime: new Date() };
    localStorage.setItem('fifi_user', JSON.stringify(state.user));
    showChatView();
    setLoginLoading(false);
  }, 300);
}

function handleLogout() {
  state.isLoggedIn = false;
  state.user = null;
  state.messages = [];
  localStorage.removeItem('fifi_user');
  showLoginView();
  hideModal(elements.logoutModal);
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
    elements.hermesBadge.title = state.hermesMode ? 'Hermes 分析：開啟' : 'Hermes 分析：關閉';
  }
}

// ================================================
// 發送消息
// ================================================

async function sendMessage() {
  const message = elements.chatInput.value.trim();
  if (!message) return;

  // 清空輸入框
  elements.chatInput.value = '';
  handleChatInput();

  // 隱藏歡迎畫面
  if (elements.welcomeScreen) {
    elements.welcomeScreen.style.display = 'none';
  }

  // 加入用戶消息
  addMessage('user', message);
  
  // 顯示 typing 狀態
  showTyping(true);

  try {
    // 同時獲取 FAQ 匹配和 Hermes 分析
    const [faqMatches, hermesAnalysis] = await Promise.all([
      Promise.resolve(searchFAQ(message)),
      state.hermesMode ? getHermesAnalysis(message) : Promise.resolve(null)
    ]);

    // 顯示助理回覆
    await showAssistantResponse(message, faqMatches, hermesAnalysis);
  } catch (error) {
    console.error('Error:', error);
    addMessage('assistant', `抱歉，發生錯誤：${error.message}\n\n請稍後再試。`);
  } finally {
    showTyping(false);
  }
}

// ================================================
// Hermes 分析引擎
// ================================================

async function getHermesAnalysis(question) {
  // 構建 Hermes 系統提示詞
  const hermesPrompt = `你係 Hermes Agent，HKTVmall 商戶支援分析專家。

你的任務：根據以下 FAQ 知識庫，分析用戶問題，提供：
1. 精確答案（基於 FAQ）
2. 延伸建議（實際操作步驟）
3. 相關分類建議
4. 警示事項（如有）

FAQ 知識庫：
${getFAQContext()}

用戶問題：${question}

請以 JSON 格式回覆：
{
  "answer": "主要答案",
  "extendedAdvice": "延伸建議/步驟",
  "relatedCategory": "相關分類",
  "warning": "警示事項（如無則留空）",
  "confidence": 0.0-1.0
}

只回覆 JSON，不要其他文字。`;

  try {
    // 嘗試使用 GAS Web App
    if (GAS_CONFIG.gasWebAppUrl) {
      const response = await fetch(GAS_CONFIG.gasWebAppUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'hermesAnalysis', 
          question: question,
          faqContext: getFAQContext()
        }),
        signal: AbortSignal.timeout(25000)
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.answer) return data;
      }
    }
    
    // Fallback: 使用內置 LLM 分析
    if (GAS_CONFIG.useBuiltInLLM && state.apiKey) {
      return await getBuiltInHermesAnalysis(question);
    }
    
    // 無法分析時返回預設
    return getDefaultHermesResponse(question);
    
  } catch (error) {
    console.log('Hermes analysis fallback:', error.message);
    return getDefaultHermesResponse(question);
  }
}

async function getBuiltInHermesAnalysis(question) {
  const config = API_CONFIG[state.apiProvider];
  
  const systemPrompt = `你係 Hermes Agent，HKTVmall 商戶支援分析專家。

根據以下 FAQ 知識庫，分析用戶問題，提供結構化的分析結果。

FAQ 知識庫：
${getFAQContext()}

用戶問題：${question}

請以 JSON 格式回覆（只回覆 JSON）：
{
  "answer": "主要答案（基於 FAQ）",
  "extendedAdvice": "延伸建議/實際操作步驟",
  "relatedCategory": "相關分類名稱",
  "warning": "警示事項（如無則留空）",
  "confidence": 0.0-1.0（信心度）
}`;

  try {
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: question }
        ],
        max_tokens: 800,
        temperature: 0.3
      }),
      signal: AbortSignal.timeout(20000)
    });

    if (!response.ok) throw new Error('LLM API error');
    
    const data = await response.json();
    const content = data.choices[0].message.content.trim();
    
    // 嘗試解析 JSON
    try {
      // 移除可能有的 markdown code block
      const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(jsonStr);
    } catch {
      // 無法解析時返回文字
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

function getDefaultHermesResponse(question) {
  const faqMatches = searchFAQ(question);
  if (faqMatches.length > 0) {
    return {
      answer: faqMatches[0].a,
      extendedAdvice: `📌 關鍵字匹配到「${faqMatches[0].q}」，可作為參考答案。\n\n如需更精確的答案，請聯絡您的 RM。`,
      relatedCategory: faqMatches[0].category,
      warning: '',
      confidence: 0.6
    };
  }
  return {
    answer: '抱歉，我未能找到完全匹配的分析結果。',
    extendedAdvice: '建議聯絡您的 RM 或 FIFI CHECK 商戶服務團隊獲取詳細協助。',
    relatedCategory: '聯絡與支援',
    warning: '',
    confidence: 0.2
  };
}

// ================================================
// FAQ 搜尋
// ================================================

function getFAQContext() {
  return ALL_FAQ.map(item => 
    `[${item.category}] ${item.q}\n${item.a}`
  ).join('\n\n');
}

// ================================================
// 顯示回覆
// ================================================

async function showAssistantResponse(userQuestion, faqMatches, hermesAnalysis) {
  let responseText = '';
  let hermesHtml = '';

  // 如果有 Hermes 分析結果
  if (hermesAnalysis && hermesAnalysis.answer) {
    const confidence = hermesAnalysis.confidence || 0.5;
    const confidenceColor = confidence >= 0.7 ? '#2ecc71' : confidence >= 0.4 ? '#f39c12' : '#e74c3c';
    
    hermesHtml = `
      <div class="hermes-analysis" style="
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 12px;
        padding: 16px;
        margin-top: 12px;
        color: #fff;
      ">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
          <span style="font-size: 18px;">🧠</span>
          <strong>Hermes 分析</strong>
          <span style="
            background: ${confidenceColor};
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 11px;
            margin-left: auto;
          ">信心度 ${Math.round(confidence * 100)}%</span>
        </div>
        
        <div style="margin-bottom: 10px;">
          <strong style="display: block; margin-bottom: 4px;">📝 答案：</strong>
          <span>${hermesAnalysis.answer}</span>
        </div>
        
        ${hermesAnalysis.extendedAdvice ? `
        <div style="margin-bottom: 10px;">
          <strong style="display: block; margin-bottom: 4px;">💡 延伸建議：</strong>
          <span style="opacity: 0.9;">${hermesAnalysis.extendedAdvice}</span>
        </div>
        ` : ''}
        
        ${hermesAnalysis.relatedCategory ? `
        <div style="margin-bottom: 10px;">
          <strong style="display: block; margin-bottom: 4px;">📂 相關分類：</strong>
          <span>${hermesAnalysis.relatedCategory}</span>
        </div>
        ` : ''}
        
        ${hermesAnalysis.warning ? `
        <div style="
          background: rgba(231, 76, 60, 0.3);
          padding: 8px 12px;
          border-radius: 8px;
          margin-top: 10px;
        ">
          <strong>⚠️ 警示：</strong> ${hermesAnalysis.warning}
        </div>
        ` : ''}
        
        <div style="
          margin-top: 10px;
          padding-top: 10px;
          border-top: 1px solid rgba(255,255,255,0.2);
          font-size: 11px;
          opacity: 0.7;
        ">
          📖 資料來源：https://sites.google.com/view/hktv-merc-faq/
        </div>
      </div>
    `;
  }

  // 生成 FAQ 回覆文字
  if (faqMatches.length > 0) {
    const bestMatch = faqMatches[0];
    responseText = `📌 ${bestMatch.q}\n\n${bestMatch.a}\n\n---\n📖 資料來源：https://sites.google.com/view/hktv-merc-faq/`;
  } else {
    responseText = `感謝您嘅提問！\n\n目前我未能找到完全匹配嘅答案。\n\n建議您：\n1. 嘗試使用其他關鍵字搜尋\n2. 聯絡您的 RM 查詢\n3. 聯絡 FIFI CHECK 商戶服務團隊的 RM\n\n📖 資料來源：https://sites.google.com/view/hktv-merc-faq/`;
  }

  // 加入助理消息
  addMessage('assistant', responseText);
  
  // 加入 Hermes 分析面板
  if (hermesHtml) {
    addHermesPanel(hermesHtml);
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
  // 簡單的 Markdown -like 格式化
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
// 對外暴露 API（除錯用）
// ================================================

window.FIFI = {
  state,
  resetApiKey: () => {
    localStorage.removeItem('fifi_api_key');
    state.apiKey = null;
  },
  toggleHermes: toggleHermesMode,
  searchFAQ: (q) => searchFAQ(q),
  getFAQContext: () => getFAQContext()
};

// 初始化預設問題
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPresetChips);
} else {
  initPresetChips();
}
