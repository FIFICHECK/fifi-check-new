// ================================================
// FIFI CHECK — Main Application
// HKTVmall 商戶 AI 助理
// ================================================

// 狀態管理
const state = {
  isLoggedIn: false,
  user: null,
  apiKey: null,
  apiProvider: 'openai',
  messages: [],
  isTyping: false
};

// DOM 元素緩存
const elements = {};

// API 端點配置
const API_CONFIG = {
  openai: {
    endpoint: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o'
  },
  deepseek: {
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    model: 'deepseek-chat'
  }
};

// ================================================
// 初始化
// ================================================

document.addEventListener('DOMContentLoaded', () => {
  initElements();
  initEventListeners();
  checkAuthStatus();
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

  // API Key Modal (removed - no longer needed)
  // Elements kept for compatibility but not used

  // Chat 輸入
  safeAddEvent(elements.chatInput, 'input', handleChatInput);
  safeAddEvent(elements.chatInput, 'keydown', handleChatKeydown);
  safeAddEvent(elements.btnSend, 'click', sendMessage);

  // 預設問題
  if (elements.presetChips) {
    elements.presetChips.querySelectorAll('.preset-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const question = chip.dataset.question;
        elements.chatInput.value = question;
        handleChatInput();
        sendMessage();
      });
    });
  }
}

// ================================================
// 認證管理
// ================================================

function checkAuthStatus() {
  const savedAuth = localStorage.getItem('fifi_auth');
  if (savedAuth) {
    const auth = JSON.parse(savedAuth);
    state.isLoggedIn = true;
    state.user = auth;
    state.apiKey = localStorage.getItem('fifi_api_key');
    state.apiProvider = localStorage.getItem('fifi_api_provider') || 'openai';
    
    if (state.apiKey) {
      showChatView();
    } else {
      showChatView();
    }
  }
}

function handleLogin(e) {
  e.preventDefault();
  
  // 顯示 loading
  setLoginLoading(true);
  hideError();

  // 模擬登入驗證
  setTimeout(() => {
    // 登入成功
    state.isLoggedIn = true;
    state.user = {
      storeId: 'Guest',
      loginTime: new Date().toISOString()
    };

    // 保存認證
    localStorage.setItem('fifi_auth', JSON.stringify(state.user));

    setLoginLoading(false);
    showChatView();
    
  }, 1000);
}

function handleLogout() {
  hideModal(elements.logoutModal);
  
  // 清除狀態
  state.isLoggedIn = false;
  state.user = null;
  state.messages = [];
  
  // 清除存儲
  localStorage.removeItem('fifi_auth');
  // 注意：不清除 API Key，用戶可能下次還要用

  // 重置 UI
  elements.loginForm.reset();
  elements.messagesContainer.innerHTML = '';
  elements.messagesContainer.style.display = 'none';
  elements.welcomeScreen.style.display = 'block';
  
  showLoginView();
}

// ================================================
// UI 切換
// ================================================

function showLoginView() {
  elements.loginView.style.display = 'flex';
  elements.chatView.style.display = 'none';
  elements.userInfo.style.display = 'none';
  elements.storeBadge.textContent = '';
  elements.lastLogin.textContent = '';
}

function showChatView() {
  elements.loginView.style.display = 'none';
  elements.chatView.style.display = 'flex';
  elements.userInfo.style.display = 'flex';
  elements.storeBadge.textContent = state.user.storeId;
  
  // 格式化上次登入時間
  const loginDate = new Date(state.user.loginTime);
  elements.lastLogin.textContent = `上次登入：${formatTime(loginDate)}`;
  
  // 聚焦輸入框
  elements.chatInput.focus();
}

function showError(message) {
  elements.errorMessage.textContent = message;
  elements.errorMessage.style.display = 'block';
}

function hideError() {
  elements.errorMessage.style.display = 'none';
}

function setLoginLoading(loading) {
  const btnText = elements.btnLogin.querySelector('.btn-text');
  const btnLoader = elements.btnLogin.querySelector('.btn-loader');
  
  if (loading) {
    btnText.style.display = 'none';
    btnLoader.style.display = 'block';
    elements.btnLogin.disabled = true;
  } else {
    btnText.style.display = 'block';
    btnLoader.style.display = 'none';
    elements.btnLogin.disabled = false;
  }
}

function togglePasswordVisibility() {
  const type = elements.passwordInput.type === 'password' ? 'text' : 'password';
  elements.passwordInput.type = type;
  
  const eyeOpen = elements.btnTogglePw.querySelector('.eye-open');
  const eyeClosed = elements.btnTogglePw.querySelector('.eye-closed');
  
  if (type === 'text') {
    eyeOpen.style.display = 'none';
    eyeClosed.style.display = 'block';
  } else {
    eyeOpen.style.display = 'block';
    eyeClosed.style.display = 'none';
  }
}

function showModal(modal) {
  modal.style.display = 'flex';
}

function hideModal(modal) {
  modal.style.display = 'none';
}

// ================================================
// API Key 管理
// ================================================

function handleSaveApiKey() {
  const apiKey = elements.apiKeyInput.value.trim();
  const provider = document.querySelector('input[name="apiProvider"]:checked').value;
  
  if (!apiKey) {
    alert('請輸入 API Key');
    return;
  }

  if (!apiKey.startsWith('sk-')) {
    alert('API Key 格式似乎不正確（通常以 sk- 開頭）');
    return;
  }

  state.apiKey = apiKey;
  state.apiProvider = provider;

  localStorage.setItem('fifi_api_key', apiKey);
  localStorage.setItem('fifi_api_provider', provider);

  hideModal(elements.apiKeyModal);
  showChatView();
  
  // 添加系統訊息
  addMessage('system', '✅ API Key 已設定完成！FIFI CHECK 已準備就緒。');
}

// ================================================
// Chat 功能
// ================================================

function handleChatInput() {
  const hasContent = elements.chatInput.value.trim().length > 0;
  elements.btnSend.disabled = !hasContent;
  
  // 自動調整高度
  elements.chatInput.style.height = 'auto';
  elements.chatInput.style.height = Math.min(elements.chatInput.scrollHeight, 120) + 'px';
}

function handleChatKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (!elements.btnSend.disabled) {
      sendMessage();
    }
  }
}

async function sendMessage() {
  const content = elements.chatInput.value.trim();
  if (!content || state.isTyping) return;

  // 添加用戶訊息
  addMessage('user', content);
  
  // 清空輸入框
  elements.chatInput.value = '';
  handleChatInput();
  
  // 隱藏歡迎畫面
  elements.welcomeScreen.style.display = 'none';
  elements.messagesContainer.style.display = 'flex';
  
  // 顯示 typing 指示
  showTyping(true);
  
  try {
    // 獲取 AI 回覆
    const response = await getAIResponse(content);
    addMessage('ai', response);
  } catch (error) {
    console.error('AI Error:', error);
    addMessage('ai', `抱歉，我遇到了一些問題：${error.message}\n\n請稍後再試，或聯絡 Fiona (FIFI CHECK) 商戶服務團隊的 RM。`);
  }
  
  showTyping(false);
}

function addMessage(type, content) {
  const message = { type, content, time: new Date() };
  state.messages.push(message);
  
  const messageEl = document.createElement('div');
  messageEl.className = `message ${type}`;
  
  const avatar = type === 'user' ? '👤' : '🐾';
  
  messageEl.innerHTML = `
    <div class="message-avatar">${avatar}</div>
    <div class="message-content-wrapper">
      <div class="message-bubble">
        <div class="message-content">${formatMessageContent(content)}</div>
      </div>
      <div class="message-time">${formatTime(message.time)}</div>
    </div>
  `;
  
  elements.messagesContainer.appendChild(messageEl);
  
  // 滾動到底部
  elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
}

function formatMessageContent(content) {
  // 簡單的 Markdown 處理
  let formatted = content
    // 粗體
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // 斜體
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // 換行
    .replace(/\n/g, '<br>');
  
  return formatted;
}

function showTyping(show) {
  state.isTyping = show;
  elements.typingIndicator.style.display = show ? 'flex' : 'none';
  
  if (show) {
    elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
  }
}

// ================================================
// AI 回覆邏輯
// ================================================

async function getAIResponse(userQuery) {
  // 先在 FAQ 中搜尋相關問題
  const faqMatches = searchFAQ(userQuery);
  
  // 如果有 API Key，使用 LLM
  if (state.apiKey) {
    return await getLLMResponse(userQuery, faqMatches);
  } else {
    // 沒有 API Key，使用純 FAQ 回覆
    return getFAQResponse(userQuery, faqMatches);
  }
}

async function getLLMResponse(query, faqMatches) {
  const config = API_CONFIG[state.apiProvider];
  
  // 建構 system prompt 包含 FAQ 知識
  let systemPrompt = `你係 FIFI CHECK，HKTVmall 商戶 AI 助理。

你嘅角色：
- 幫助 HKTVmall 商戶解答問題
- 用廣東話為主，適當使用英文術語
- 專業、友善、有耐心
- 回答簡潔明瞭

以下係 HKTVmall 商戶常見問題和答案，你可以從中參考：

${faqMatches.map(faq => `問題：${faq.q}\n答案：${faq.a}`).join('\n\n')}

當你根據以上資料回答時，請加上以下來源說明：
「📖 資料來源：https://sites.google.com/view/hktv-merc-faq/」

如果用戶問嘅問題喺上面找不到，你可以根據你對 HKTVmall 嘅了解回答，但如果唔確定就話「我建議你聯絡你的 RM 或 Fiona (FIFI CHECK) 商戶服務團隊的 RM」。

記住：
- 唔好胡亂猜測不確定的資訊
- 如果係需要登入後台或涉及個人資料的問題，建議用戶登入 MMS 處理
- 回答要實際有用`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: query }
  ];

  const response = await fetch(config.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${state.apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      messages: messages,
      max_tokens: 1000,
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `API 錯誤：${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

function getFAQResponse(query, faqMatches) {
  if (faqMatches.length === 0) {
    return `感謝您嘅提問！\n\n目前我未能找到完全匹配嘅答案。\n\n建議您：\n1. 嘗試使用其他關鍵字搜尋\n2. 聯絡您的 RM 查詢\n3. 聯絡 Fiona (FIFI CHECK) 商戶服務團隊的 RM\n\n或輸入「help」查看我可回答的問題範疇。`;
  }

  // 返回最匹配的 FAQ
  const bestMatch = faqMatches[0];
  
  return `根據 HKTV 商戶支援資料，我找到以下可能相關的答案：

📌 ${bestMatch.q}

${bestMatch.a}

---
📖 資料來源：https://sites.google.com/view/hktv-merc-faq/

💡 如有其他問題，請繼續提問！`;
}

// ================================================
// 工具函數
// ================================================

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
// 對外暴露 API（除錯用）
// ================================================

window.FIFI = {
  state,
  resetApiKey: () => {
    localStorage.removeItem('fifi_api_key');
    state.apiKey = null;
    showModal(elements.apiKeyModal);
  },
  clearAuth: () => {
    localStorage.clear();
    location.reload();
  },
  testAPI: async () => {
    if (!state.apiKey) {
      return '請先設定 API Key';
    }
    try {
      await getAIResponse('你好');
      return '✅ API 測試成功！';
    } catch (e) {
      return `❌ API 測試失敗：${e.message}`;
    }
  }
};

console.log('%c🐾 FIFI CHECK', 'font-size: 20px; font-weight: bold; color: #E61E2A;');
console.log('除錯指令：');
console.log('  FIFI.resetApiKey() - 重新設定 API Key');
console.log('  FIFI.clearAuth() - 清除所有登入資料');
console.log('  FIFI.testAPI() - 測試 API 連接');
