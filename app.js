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

const GAS_CONFIG = {
  useBuiltInLLM: true,
  gasWebAppUrl: '',
  hermesWebhook: ''
};

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
    showChatView();
    loadConversationHistory();
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

    // 保存 Store ID 到歷史
    saveStoreId(upperId);

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
    elements.hermesBadge.title = state.hermesMode ? 'Hermes 分析：開啟' : 'Hermes 分析：關閉';
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
    elements.welcomeScreen.style.display = 'none';
  }

  addMessage('user', message);
  showTyping(true);

  try {
    const greetingResponse = checkCasualGreeting(message);
    if (greetingResponse) {
      await new Promise(r => setTimeout(r, 600));
      addHermesPanel(greetingResponse);
    } else {
      const [faqMatches, hermesAnalysis] = await Promise.all([
        Promise.resolve(searchFAQ(message)),
        state.hermesMode ? getHermesAnalysis(message) : Promise.resolve(null)
      ]);
      await showAssistantResponse(message, faqMatches, hermesAnalysis);

      // 加入對話歷史
      state.conversationHistory.push({
        q: message,
        a: hermesAnalysis?.answer || '抱歉，Hermes 分析暫時無法使用。',
        timestamp: Date.now()
      });

      // 保存到 master 記錄（所有 Store ID 的所有問題）
      saveToMasterRecord(state.user.username, message, hermesAnalysis?.answer || '');
    }
  } catch (error) {
    console.error('Error:', error);
    addMessage('assistant', `唉～衰咗衰咗... ${error.message}\n\n等我冷靜下先 😅`);
  } finally {
    showTyping(false);
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
  // 加入對話上下文
  const conversationContext = state.conversationHistory.length > 0
    ? `\n\n之前的對話記錄（用於理解上下文）：\n${state.conversationHistory.slice(-3).map(h => `問：${h.q}\n答：${h.a}`).join('\n')}`
    : '';

  const hermesPrompt = `你係 Hermes，HKTVmall 商戶支援助理 — 幫緊你幫緊你！

風格：口語化、輕鬆風趣、有時加啲emoji，但係又要專業！

用廣東話口吻回答，好似朋友傾偈咁，但係又幫到手。${conversationContext}

FAQ 知識庫：
${getFAQContext()}

用戶問題：${question}

請以 JSON 格式回覆：
{
  "answer": "主要答案（輕鬆口語化）",
  "extendedAdvice": "延伸建議/實際操作步驟",
  "relatedCategory": "相關分類",
  "warning": "警示事項（如無則留空）",
  "confidence": 0.0-1.0
}

只回覆 JSON，不要其他文字。`;

  try {
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

    if (GAS_CONFIG.useBuiltInLLM && state.apiKey) {
      return await getBuiltInHermesAnalysis(question, conversationContext);
    }

    return getDefaultHermesResponse(question);
  } catch (error) {
    console.log('Hermes analysis fallback:', error.message);
    return getDefaultHermesResponse(question);
  }
}

async function getBuiltInHermesAnalysis(question, conversationContext = '') {
  const config = API_CONFIG[state.apiProvider];

  const systemPrompt = `你係 Hermes，HKTVmall 商戶支援助理 — 幫緊你幫緊你！

風格：口語化、輕鬆風趣、有時加啲emoji，但係又要專業！

用廣東話口吻回答，好似朋友傾偈咁，但係又幫到手。${conversationContext}

FAQ 知識庫：
${getFAQContext()}

用戶問題：${question}

請以 JSON 格式回覆（只回覆 JSON）：
{
  "answer": "主要答案（輕鬆口語化，例如：唉！呢個問題問得好，常見嘅係...）",
  "extendedAdvice": "延伸建議/實際操作步驟（用bullet points，越實際越好）",
  "relatedCategory": "相關分類名稱",
  "warning": "警示事項（如無則留空）",
  "confidence": 0.0-1.0
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

function getDefaultHermesResponse(question) {
  const faqMatches = searchFAQ(question);
  if (faqMatches.length > 0) {
    return {
      answer: `哦～呢個問題好常見！ ${faqMatches[0].a}`,
      extendedAdvice: `參考咗「${faqMatches[0].q}」嘅答案～ 不過每個人情況唔同，最好再問下你嘅 RM 確認下 ^^`,
      relatedCategory: faqMatches[0].category,
      warning: '',
      confidence: 0.6
    };
  }
  return {
    answer: '唉～ 今次撞板了，我搵唔到完全Match嘅答案比你...',
    extendedAdvice: '建議你直接搵 RM 傾偈，佢哋實幫到你！或者可以試下其他關鍵字再搵過 ^^',
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
  if (hermesAnalysis && hermesAnalysis.answer) {
    const confidence = hermesAnalysis.confidence || 0.5;
    const confidenceClass = confidence >= 0.7 ? 'confidence-high' : confidence >= 0.4 ? 'confidence-medium' : 'confidence-low';
    const confidenceText = confidence >= 0.7 ? '高' : confidence >= 0.4 ? '中' : '低';

    let hermesHtml = `
      <div class="hermes-analysis">
        <div class="hermes-analysis-header">
          <span>🧠</span>
          <strong>Hermes 分析</strong>
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

    if (hermesAnalysis.warning) {
      hermesHtml += `
        <div class="hermes-warning">⚠️ ${escapeHtml(hermesAnalysis.warning)}</div>
      `;
    }

    hermesHtml += `
      <div class="hermes-source">📖 資料來源：https://sites.google.com/view/hktv-merc-faq/</div>
    </div>
    `;

    addHermesPanel(hermesHtml);
  } else {
    addMessage('assistant', '抱歉，Hermes 分析暫時無法使用。請稍後再試或聯絡您的 RM。');
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
// 日常寒暄檢測
// ================================================

function checkCasualGreeting(message) {
  const msg = message.toLowerCase().trim();
  const greetings = [
    '/', '你好', 'hello', 'hi', '嗨', '早晨', '午安', '晚安',
    '你叫咩名', '你係邊個', '你係咩', '你係誰', '你係人定鬼',
    '做緊咩', '做咩', '忙咩', '最近點', '你好嗎', '點呀',
    '喂', 'hello呀', 'hi呀', '你好呀', '早晨呀'
  ];

  const isGreeting = greetings.some(g => msg === g || msg === g + '？' || msg === g + '?');

  if (!isGreeting) return null;

  const casualResponses = [
    {
      answer: `👋 你好！我係 **FIFI** 查，你嘅 HKTVmall 商戶小幫手！`,
      extendedAdvice: `知道你有好多嘢要搞，頭都大埋啦... 不過唔洗驚！我實幫到你架！\n\n有咩想問就尽管開口啦 ^^`
    },
    {
      answer: `唉～我喺度等你問嘢咋！ 😄`,
      extendedAdvice: `我係 **FIFI 查**，專幫 HKTVmall 商戶解決疑難雜症！\n\n知道你頭痕緊，我一定幫到你掛～ 有咩就出聲啦！`
    },
    {
      answer: `喂！你好！我是 **FIFI** 嚟嘅～  :P`,
      extendedAdvice: `聽講你好頭痛嚟嘅？唔洗咁緊張！我幫過好多商戶解決問題嘅經驗✨\n\n你慢慢話我知有咩困難，我實幫到你架！`
    }
  ];

  const response = casualResponses[Math.floor(Math.random() * casualResponses.length)];

  return `
    <div class="hermes-analysis">
      <div class="hermes-analysis-header">
        <span>🧠</span>
        <strong>FIFI 查</strong>
        <span class="confidence-badge confidence-high">線上閒聊中 ^^</span>
      </div>
      <div class="hermes-section">
        <div class="hermes-section-label">💬</div>
        <div class="hermes-section-content">${response.answer}</div>
      </div>
      <div class="hermes-section">
        <div class="hermes-section-label">🤝</div>
        <div class="hermes-section-content">${response.extendedAdvice}</div>
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
