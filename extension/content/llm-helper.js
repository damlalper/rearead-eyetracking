// ============================================================================
// LLM Integration Module (Isolated, Optional, User-Triggered Only)
// ============================================================================
// This module handles all LLM interactions separately from core reading logic
// Author: ReaRead Team
// Purpose: Provide AI-powered reading assistance without affecting core features

// GESTURE NAVIGATION STATE - Use window object to prevent redeclaration on multiple loads
if (!window.reareadGestureMenuNavigation) {
  window.reareadGestureMenuNavigation = {
    enabled: false,
    currentIndex: 0,
    options: [],
    menuElement: null,
    lastNavTime: 0,
    navCooldown: 300 // OPTIMIZED: 300ms for faster hands-free navigation (was 500ms)
  };
}
const gestureMenuNavigation = window.reareadGestureMenuNavigation;

// Listen for gestures from content script
window.addEventListener('message', (event) => {
  // Verify origin for security
  if (event.origin !== window.location.origin) {
    console.warn('[GESTURE NAV] Message from different origin, ignoring:', event.origin);
    return;
  }

  if (event.data.type === 'REAREAD_GESTURE') {
    console.log('[GESTURE NAV] Received gesture:', event.data.gesture, 'enabled:', gestureMenuNavigation.enabled);
    if (gestureMenuNavigation.enabled) {
      handleMenuGesture(event.data.gesture);
    } else {
      console.log('[GESTURE NAV] Gesture navigation disabled, ignoring gesture');
    }
  }
});

function handleMenuGesture(gesture) {
  const now = Date.now();
  if (now - gestureMenuNavigation.lastNavTime < gestureMenuNavigation.navCooldown) {
    console.log('[GESTURE NAV] Cooldown active, ignoring gesture');
    return;
  }

  if (!gestureMenuNavigation.menuElement || !document.body.contains(gestureMenuNavigation.menuElement)) {
    console.warn('[GESTURE NAV] Menu element not found or disconnected, disabling navigation');
    gestureMenuNavigation.enabled = false;
    return;
  }

  if (!gesture || typeof gesture !== 'object') {
    console.warn('[GESTURE NAV] Invalid gesture object:', gesture);
    return;
  }

  // Double Blink = Select / Click
  if (gesture.double_blink) {
    console.log('[GESTURE NAV] Double blink detected - Selecting option index:', gestureMenuNavigation.currentIndex);
    const selectedBtn = gestureMenuNavigation.options[gestureMenuNavigation.currentIndex];
    if (selectedBtn) {
      console.log('[GESTURE NAV] Button found, clicking:', selectedBtn.getAttribute('data-option'));
      gestureMenuNavigation.lastNavTime = now;
      
      // Add visual feedback before clicking
      selectedBtn.style.transform = 'scale(0.98)';
      selectedBtn.style.background = '#FF9B45';
      selectedBtn.style.color = '#000';
      
      setTimeout(() => {
        console.log('[GESTURE NAV] Executing click on button');
        selectedBtn.click();
      }, 150);
    } else {
      console.error('[GESTURE NAV] Selected button not found at index:', gestureMenuNavigation.currentIndex);
    }
    return;
  }

  // Head Left = Previous Option
  if (gesture.head_left) {
    console.log('[GESTURE NAV] Head left - Previous option (current:', gestureMenuNavigation.currentIndex, ')');
    gestureMenuNavigation.currentIndex = (gestureMenuNavigation.currentIndex - 1 + gestureMenuNavigation.options.length) % gestureMenuNavigation.options.length;
    console.log('[GESTURE NAV] New index:', gestureMenuNavigation.currentIndex);
    updateMenuSelection();
    gestureMenuNavigation.lastNavTime = now;
    return;
  }

  // Head Right = Next Option
  if (gesture.head_right) {
    console.log('[GESTURE NAV] Head right - Next option (current:', gestureMenuNavigation.currentIndex, ')');
    gestureMenuNavigation.currentIndex = (gestureMenuNavigation.currentIndex + 1) % gestureMenuNavigation.options.length;
    console.log('[GESTURE NAV] New index:', gestureMenuNavigation.currentIndex);
    updateMenuSelection();
    gestureMenuNavigation.lastNavTime = now;
    return;
  }
  
  // Head Up = Close Menu (Cancel)
  if (gesture.head_up) {
    console.log('[GESTURE NAV] Closing menu');
    // Find the cancel button - look for button with "Cancel" text or last button without data-option
    const menu = document.getElementById('rearead-help-menu');
    if (menu) {
      const menuContainer = menu.querySelector('div');
      // Try to find cancel button by text content
      const allButtons = menuContainer.querySelectorAll('button');
      let closeBtn = null;
      for (const btn of allButtons) {
        if (btn.textContent.includes('Cancel') || btn.textContent.includes('✕')) {
          closeBtn = btn;
          break;
        }
      }
      // Fallback: last button without data-option
      if (!closeBtn) {
        for (let i = allButtons.length - 1; i >= 0; i--) {
          if (!allButtons[i].hasAttribute('data-option')) {
            closeBtn = allButtons[i];
            break;
          }
        }
      }
      
      if (closeBtn) {
        console.log('[GESTURE NAV] Found close button, clicking');
        closeBtn.click();
      } else {
        // Fallback: close menu directly
        console.log('[GESTURE NAV] Close button not found, closing menu directly');
        menu.style.animation = 'fadeOut 0.3s ease-out';
        if (menuContainer) {
          menuContainer.style.animation = 'slideOutToRight 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
        }
        setTimeout(() => {
          menu.remove();
          // Notify content-script: Menu closed (resume tracking)
          window.postMessage({
            type: 'REAREAD_MENU_STATE',
            data: { open: false }
          }, '*');
        }, 400);
        gestureMenuNavigation.enabled = false;
      }
    }
    gestureMenuNavigation.lastNavTime = now;
  }
}

function updateMenuSelection() {
  if (gestureMenuNavigation.options.length === 0) {
    console.warn('[GESTURE NAV] No options available for selection');
    return;
  }

  console.log('[GESTURE NAV] Updating selection, current index:', gestureMenuNavigation.currentIndex, 'total options:', gestureMenuNavigation.options.length);
  
  gestureMenuNavigation.options.forEach((btn, index) => {
    if (index === gestureMenuNavigation.currentIndex) {
      // Highlight selected (grid layout compatible)
      btn.style.borderColor = '#FF9B45';
      btn.style.background = 'linear-gradient(135deg, rgba(255, 155, 69, 0.2), rgba(255, 155, 69, 0.1))';
      btn.style.transform = 'scale(1.02)';
      btn.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      console.log('[GESTURE NAV] Highlighted option:', btn.getAttribute('data-option'));
    } else {
      // Reset others
      btn.style.borderColor = '#2a2a2a';
      btn.style.background = '#222';
      btn.style.transform = 'scale(1)';
    }
  });
}

/**
 * Core LLM call function - isolated and reusable (Gemini primary, Groq fallback)
 * @param {Object} options - Configuration object
 * @param {string} options.mode - Help mode: "summary", "simplify", "explain", "ask_question", etc.
 * @param {string} options.text - Raw paragraph text to analyze
 * @param {string} options.question - User's question (for ask_question mode)
 * @returns {Promise<string>} - LLM response text
 */
async function callLLM({ mode, text, question = '' }) {
  // Use Groq only (Gemini disabled for demo)
  return await callGroq({ mode, text, question });
}

/**
 * Call Gemini API (Primary LLM)
 */
async function callGemini({ mode, text, question }) {
  // Load Gemini API key from storage
  let apiKey = await loadGeminiApiKey();

  // If no API key, request it from user
  if (!apiKey) {
    apiKey = await requestGeminiApiKeyFromUser();
    if (!apiKey) {
      throw new Error('Gemini API key required. Get a free key from aistudio.google.com');
    }
    await saveGeminiApiKey(apiKey);
  }

  const GEMINI_CONFIG = {
    apiEndpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent',
    apiKey: apiKey,
    model: 'gemini-2.0-flash-exp',
    maxTokens: 500,
    temperature: 0.7
  };

  // Auto-detect language
  const lang = detectLanguage(text);

  // Build prompt
  const prompt = buildPrompt({ mode, text, question, lang });

  try {
    const response = await fetch(`${GEMINI_CONFIG.apiEndpoint}?key=${GEMINI_CONFIG.apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: GEMINI_CONFIG.temperature,
          maxOutputTokens: GEMINI_CONFIG.maxTokens
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Gemini API error: ${response.status} - ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();

    // Extract text from Gemini API response
    if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0]) {
      return data.candidates[0].content.parts[0].text.trim();
    }

    throw new Error('Invalid Gemini API response format');

  } catch (error) {
    console.error('[GEMINI] Error:', error);
    throw error;
  }
}

/**
 * Call Groq API (Fallback LLM)
 */
async function callGroq({ mode, text, question }) {
  // Load Groq API key from storage (configured in config.js or chrome storage)
  let apiKey = await loadApiKey();

  // If no API key found, try loading from chrome.storage.local (set by background script)
  if (!apiKey) {
    apiKey = await loadGroqApiKeyFromLocal();
  }

  // If still no API key, throw error without showing popup
  if (!apiKey) {
    throw new Error('Groq API key not configured. Please add your key to config.js');
  }

  // Configuration
  const LLM_CONFIG = {
    apiEndpoint: 'https://api.groq.com/openai/v1/chat/completions',
    apiKey: apiKey,
    model: 'llama-3.3-70b-versatile', // Fast and free model
    maxTokens: 500,
    temperature: 0.7
  };

  // Auto-detect language
  const lang = detectLanguage(text);

  // Build prompt
  const prompt = buildPrompt({ mode, text, question, lang });

  try {
    const response = await fetch(LLM_CONFIG.apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LLM_CONFIG.apiKey}`
      },
      body: JSON.stringify({
        model: LLM_CONFIG.model,
        messages: [{
          role: 'user',
          content: prompt
        }],
        max_tokens: LLM_CONFIG.maxTokens,
        temperature: LLM_CONFIG.temperature
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Groq API error: ${response.status} - ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();

    // Extract text from Groq/OpenAI API response format
    if (data.choices?.[0]?.message?.content) {
      return data.choices[0].message.content.trim();
    }

    throw new Error('Invalid Groq API response format');

  } catch (error) {
    console.error('[GROQ] Error:', error);
    throw error;
  }
}

/**
 * Auto-detect language from text
 */
function detectLanguage(text) {
  const turkishChars = /[ğüşıöçĞÜŞİÖÇ]/;
  const turkishWords = /\b(ve|bir|bu|için|olan|ile|daha|çok|var|gibi|her|veya|ama|ancak|şey)\b/i;

  if (turkishChars.test(text) || turkishWords.test(text)) {
    return 'tr';
  }
  return 'en';
}

/**
 * Build prompt based on mode
 */
function buildPrompt({ mode, text, question, lang }) {
  // Mode-specific prompts with improved prompt engineering
  const PROMPTS = {
    summary: lang === 'tr'
      ? `Sen bir okuma asistanısın. Görevin metinleri özetlemek.

KURALLAR:
- Özeti 2-3 cümle ile sınırla
- Metnin ana fikrini ve önemli detayları koru
- Gereksiz kelimeleri çıkar, öze odaklan
- Sadece özeti yaz, başka açıklama yapma
- Özet Türkçe olmalı

METİN:
${text}

ÖZET:`
      : `You are a reading assistant. Your task is to summarize text.

RULES:
- Limit summary to 2-3 sentences
- Keep the main idea and important details
- Remove unnecessary words, focus on essence
- Write ONLY the summary, no other explanations
- Summary must be in English (same language as input)

TEXT:
${text}

SUMMARY:`,

    audio: `${text}`, // Audio mode uses original text directly (no LLM processing)

    simplify: lang === 'tr'
      ? `Sen bir öğretim asistanısın. Görevin karmaşık metinleri basitleştirmek.

KURALLAR:
- Teknik terimleri sade dille açıkla
- Kısa ve net cümleler kullan
- Basit kelimeler tercih et
- Ana fikri koru, anlamı değiştirme
- Sadece basitleştirilmiş metni yaz, başka açıklama yapma

METİN:
${text}

BASİTLEŞTİRİLMİŞ METİN:`
      : `You are a teaching assistant. Your task is to simplify complex text.

RULES:
- Explain technical terms in plain language
- Use short and clear sentences
- Prefer simple words
- Keep the main idea, don't change meaning
- Write ONLY the simplified text, no other explanations

TEXT:
${text}

SIMPLIFIED TEXT:`,

    vocabulary: lang === 'tr'
      ? `Sen bir kelime öğretmeni asistanısın. Metindeki zor/teknik kelimeleri tespit et ve açıkla.

KURALLAR:
- En fazla 5 zor kelime seç
- Her kelimeyi şu formatta açıkla: "KELİME: Açıklama (örnek kullanım)"
- Basit ve anlaşılır açıklamalar yap
- Kelimeleri zorluk sırasına göre sırala (en zor → en kolay)

METİN:
${text}

ZOR KELİMELER:`
      : `You are a vocabulary teacher. Identify and explain difficult/technical words in the text.

RULES:
- Select maximum 5 difficult words
- Explain each word in this format: "WORD: Explanation (example usage)"
- Use simple and clear explanations
- Sort words by difficulty (hardest → easiest)

TEXT:
${text}

DIFFICULT WORDS:`,

    ask_question: lang === 'tr'
      ? `Sen akıllı bir okuma asistanısın. Kullanıcının paragraf hakkındaki sorusuna SADECE paragraftaki bilgileri kullanarak cevap ver.

KRİTİK KURALLAR:
- SADECE aşağıdaki paragraftaki bilgilere dayanarak cevap ver
- Paragrafta cevap yoksa "Bu paragrafta bu konuyla ilgili bilgi bulunmuyor" de
- Kısa ve öz cevap ver (2-4 cümle)
- Basit ve anlaşılır dil kullan
- Gerekirse paragraftan alıntı yap

PARAGRAF İÇERİĞİ:
"""
${text}
"""

KULLANICI SORUSU:
${question}

CEVAP (sadece paragraf bilgisine dayalı):`
      : `You are an intelligent reading assistant. Answer the user's question ONLY using information from the provided paragraph.

CRITICAL RULES:
- Answer ONLY based on the paragraph below
- If the answer is not in the paragraph, say "This paragraph doesn't contain information about that"
- Give a concise answer (2-4 sentences)
- Use simple and clear language
- Quote from the paragraph when relevant

PARAGRAPH CONTENT:
"""
${text}
"""

USER QUESTION:
${question}

ANSWER (based only on paragraph):`,

    keypoints: lang === 'tr'
      ? `Sen bir not alma asistanısın. Metindeki ana fikirleri madde madde çıkar.

KURALLAR:
- En fazla 5 madde çıkar
- Her madde bir cümle olmalı
- Önemli detayları vurgula
- Sadece maddeleri yaz, başka açıklama yapma
- Format: "• Madde 1\n• Madde 2\n..."

METİN:
${text}

ANA FİKİRLER:`
      : `You are a note-taking assistant. Extract key points from the text in bullet format.

RULES:
- Extract maximum 5 points
- Each point should be one sentence
- Highlight important details
- Write ONLY the points, no other explanations
- Format: "• Point 1\n• Point 2\n..."

TEXT:
${text}

KEY POINTS:`,

    default: lang === 'tr'
      ? `Sen bir okuma yardımcısısın. Bu metni anlamama yardım et:

${text}`
      : `You are a reading assistant. Help me understand this text:

${text}`
  };

  return PROMPTS[mode] || PROMPTS.default;
}

/**
 * Show help menu with 3 options
 * @param {Object} options - Request options
 * @param {string} options.key - Paragraph key
 * @param {string} options.text - Paragraph text
 */
export async function requestHelp({ key, text }) {
  if (!text || text.length < 10) {
    console.warn('[LLM] Text too short for analysis');
    return;
  }

  // Show menu with 3 options
  showHelpMenu({ key, text });
}

/**
 * Create and display help menu
 */
function showHelpMenu({ key, text }) {
  // Remove existing menu if any
  const existingMenu = document.getElementById('rearead-help-menu');
  if (existingMenu) existingMenu.remove();

  // Create menu overlay without backdrop (transparent clickable area)
  const menuOverlay = document.createElement('div');
  menuOverlay.id = 'rearead-help-menu';
  menuOverlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 999999;
    display: flex;
    align-items: stretch;
    justify-content: flex-end;
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif;
  `;

  // Create menu container with dark theme (RIGHT SIDEBAR STYLE)
  const menuContainer = document.createElement('div');
  menuContainer.style.cssText = `
    background: #181818;
    border-left: 1px solid #2a2a2a;
    padding: 32px 28px;
    width: 420px;
    max-width: 90vw;
    height: 100%;
    overflow-y: auto;
    box-shadow: -8px 0 32px rgba(0, 0, 0, 0.8);
    animation: slideInFromRight 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    display: flex;
    flex-direction: column;
    scrollbar-width: thin;
    scrollbar-color: #2a2a2a #0d0d0d;
  `;

  // Custom scrollbar for webkit browsers
  menuContainer.style.setProperty('scrollbar-width', 'thin');
  menuContainer.style.setProperty('scrollbar-color', '#2a2a2a #0d0d0d');

  // Add keyframes for animations and scrollbar styles
  if (!document.getElementById('rearead-animations')) {
    const style = document.createElement('style');
    style.id = 'rearead-animations';
    style.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
      }
      @keyframes slideInFromRight {
        from {
          transform: translateX(100%);
          opacity: 0.8;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      @keyframes slideOutToRight {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(100%);
          opacity: 0.8;
        }
      }
      @keyframes slideUp {
        from {
          opacity: 0;
          transform: translateY(20px) scale(0.95);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }

      /* Custom scrollbar for sidebar */
      #rearead-help-menu div::-webkit-scrollbar {
        width: 8px;
      }
      #rearead-help-menu div::-webkit-scrollbar-track {
        background: #0d0d0d;
      }
      #rearead-help-menu div::-webkit-scrollbar-thumb {
        background: #2a2a2a;
        border-radius: 4px;
      }
      #rearead-help-menu div::-webkit-scrollbar-thumb:hover {
        background: #3a3a3a;
      }
    `;
    document.head.appendChild(style);
  }

  // Menu title with gradient - COMPACT VERSION
  const title = document.createElement('div');
  title.innerHTML = `
    <h3 style="
      margin: 0 0 4px 0;
      font-size: 20px;
      font-weight: 700;
      background: linear-gradient(135deg, #ffffff, #FF9B45);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      letter-spacing: -0.02em;
    ">🎯 Reading Assistance</h3>
    <div style="
      font-size: 10px;
      color: rgba(255,255,255,0.4);
      margin-bottom: 20px;
    ">
      👁️👁️ Double blink • ⬆️ Up to close
    </div>
  `;

  // CATEGORIZED OPTIONS - Cleaner organization
  const categories = [
    {
      title: '🤖 AI Assistance',
      options: [
        { id: 'summary', icon: '📝', label: 'Summarize' },
        { id: 'keypoints', icon: '🎯', label: 'Key Points' },
        { id: 'vocabulary', icon: '📚', label: 'Vocabulary' },
        { id: 'ask_question', icon: '💬', label: 'Ask Question' }
      ]
    },
    {
      title: '🎧 Audio & Reading',
      options: [
        { id: 'audio', icon: '🔊', label: 'Read Aloud' },
        { id: 'auto_read', icon: '🎧', label: 'Auto Read' },
        { id: 'zoom', icon: '🔍', label: 'Zoom Text' }
      ]
    }
  ];

  menuContainer.appendChild(title);

  // Render categories with grid layout
  categories.forEach((category, categoryIndex) => {
    // Category header
    const categoryHeader = document.createElement('div');
    categoryHeader.style.cssText = `
      font-size: 12px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.6);
      margin-bottom: 12px;
      margin-top: ${categoryIndex > 0 ? '24px' : '0'};
      letter-spacing: 0.5px;
      text-transform: uppercase;
    `;
    categoryHeader.textContent = category.title;
    menuContainer.appendChild(categoryHeader);

    // Grid container for options
    const gridContainer = document.createElement('div');
    gridContainer.style.cssText = `
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
      margin-bottom: 8px;
    `;

    category.options.forEach(option => {
      const optionBtn = document.createElement('button');
      optionBtn.setAttribute('data-option', option.id);
      optionBtn.style.cssText = `
        padding: 16px 12px;
        border: 1px solid #2a2a2a;
        border-radius: 10px;
        background: #222;
        cursor: pointer;
        text-align: center;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
      `;

      // Descriptions for each option
      const descriptions = {
        'summary': 'Concise summary',
        'keypoints': 'Bullet points',
        'vocabulary': 'Word meanings',
        'ask_question': 'Ask anything',
        'audio': 'Listen to text',
        'auto_read': 'BT headphones • 4 languages',
        'zoom': 'Larger text'
      };

      optionBtn.innerHTML = `
        <span style="font-size: 32px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">${option.icon}</span>
        <div style="font-weight: 600; font-size: 13px; color: #ffffff; letter-spacing: -0.01em;">
          ${option.label}
        </div>
        <div class="option-desc" style="font-size: 10px; color: rgba(255, 255, 255, 0.4); margin-top: 2px; line-height: 1.2;">
          ${descriptions[option.id]}
        </div>
      `;

      optionBtn.onmouseover = () => {
        optionBtn.style.borderColor = '#FF9B45';
        optionBtn.style.background = 'rgba(255, 155, 69, 0.12)';
        optionBtn.style.transform = 'translateX(-6px)';
        optionBtn.style.boxShadow = '0 4px 16px rgba(255, 155, 69, 0.15)';
        // Brighten description on hover
        const desc = optionBtn.querySelector('.option-desc');
        if (desc) desc.style.color = 'rgba(255, 155, 69, 0.8)';
      };

      optionBtn.onmouseout = () => {
        optionBtn.style.borderColor = '#2a2a2a';
        optionBtn.style.background = '#222';
        optionBtn.style.transform = 'translateX(0)';
        optionBtn.style.boxShadow = 'none';
        // Restore description color
        const desc = optionBtn.querySelector('.option-desc');
        if (desc) desc.style.color = 'rgba(255, 255, 255, 0.4)';
      };

      optionBtn.onclick = () => {
        menuOverlay.style.animation = 'fadeOut 0.3s ease-out';
        menuContainer.style.animation = 'slideOutToRight 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
        setTimeout(() => {
          menuOverlay.remove();
          // Notify content-script: Menu closed (resume tracking)
          window.postMessage({
            type: 'REAREAD_MENU_STATE',
            data: { open: false }
          }, '*');
          handleHelpOption({ option: option.id, key, text });
        }, 300);
      };

      gridContainer.appendChild(optionBtn);
    });

    menuContainer.appendChild(gridContainer);
  });

  // Close button with modern styling
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕ Cancel';
  closeBtn.style.cssText = `
    width: 100%;
    padding: 14px;
    margin-top: 6px;
    border: 1px solid #2a2a2a;
    border-radius: 10px;
    background: transparent;
    color: #a0a0a0;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    font-family: inherit;
  `;
  closeBtn.onmouseover = () => {
    closeBtn.style.borderColor = '#ff5252';
    closeBtn.style.color = '#ff5252';
    closeBtn.style.background = 'rgba(255, 82, 82, 0.08)';
  };
  closeBtn.onmouseout = () => {
    closeBtn.style.borderColor = '#2a2a2a';
    closeBtn.style.color = '#a0a0a0';
    closeBtn.style.background = 'transparent';
  };
  closeBtn.onclick = () => {
    menuOverlay.style.animation = 'fadeOut 0.3s ease-out';
    menuContainer.style.animation = 'slideOutToRight 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
    setTimeout(() => {
      menuOverlay.remove();
      // Notify content-script: Menu closed (resume tracking)
      window.postMessage({
        type: 'REAREAD_MENU_STATE',
        data: { open: false }
      }, '*');
    }, 300);
  };

  menuContainer.appendChild(closeBtn);
  menuOverlay.appendChild(menuContainer);
  document.body.appendChild(menuOverlay);

  // Notify content-script: Menu opened (pause tracking)
  window.postMessage({
    type: 'REAREAD_MENU_STATE',
    data: { open: true }
  }, '*');

  // Prevent clicks inside menu from closing it
  menuContainer.onclick = (e) => {
    e.stopPropagation();
  };

  // Close on overlay click (outside menu) with animation
  menuOverlay.onclick = (e) => {
    if (e.target === menuOverlay) {
      menuContainer.style.animation = 'slideOutToRight 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
      setTimeout(() => {
        menuOverlay.remove();
        // Notify content-script: Menu closed (resume tracking)
        window.postMessage({
          type: 'REAREAD_MENU_STATE',
          data: { open: false }
        }, '*');
      }, 400);
    }
  };

  // GESTURE NAVIGATION: Enable gesture control for this menu
  const optionButtons = menuContainer.querySelectorAll('button[data-option]');
  console.log('[GESTURE NAV] Found', optionButtons.length, 'option buttons');
  
  gestureMenuNavigation.enabled = true;
  gestureMenuNavigation.currentIndex = 0;
  gestureMenuNavigation.options = Array.from(optionButtons);
  gestureMenuNavigation.menuElement = menuOverlay;
  gestureMenuNavigation.lastNavTime = 0; // Reset cooldown

  // Highlight first option
  if (gestureMenuNavigation.options.length > 0) {
    updateMenuSelection();
    console.log('[GESTURE NAV] Menu opened with', gestureMenuNavigation.options.length, 'options, first option highlighted');
  } else {
    console.warn('[GESTURE NAV] No option buttons found! Menu may not work with gestures.');
  }
}

/**
 * Handle selected help option
 */
async function handleHelpOption({ option, key, text }) {
  try {
    // ANALYTICS: Notify content script of LLM usage
    window.postMessage({
      type: 'REAREAD_LLM_USAGE',
      data: { mode: option, paragraphKey: key, timestamp: Date.now() }
    }, '*');

    if (option === 'summary') {
      // Show loading
      showLoadingIndicator('Generating summary...');

      const response = await callLLM({ mode: 'summary', text });

      hideLoadingIndicator();
      showResultModal({ title: 'Paragraph Summary', content: response, key });

    } else if (option === 'vocabulary') {
      // Show loading
      showLoadingIndicator('Finding difficult words...');

      const response = await callLLM({ mode: 'vocabulary', text });

      hideLoadingIndicator();
      showResultModal({ title: 'Vocabulary Builder', content: response, key });

    } else if (option === 'ask_question') {
      // Show question input modal
      const question = await showQuestionInputModal();

      if (!question || question.trim() === '') {
        return; // User cancelled or entered empty question
      }

      // Show loading
      showLoadingIndicator('Finding answer...');

      const response = await callLLM({ mode: 'ask_question', text, question: question.trim() });

      hideLoadingIndicator();
      showResultModal({ title: '💬 Answer', content: response, key });

    } else if (option === 'keypoints') {
      // Show loading
      showLoadingIndicator('Extracting key points...');

      const response = await callLLM({ mode: 'keypoints', text });

      hideLoadingIndicator();
      showResultModal({ title: 'Key Points', content: response, key });

    } else if (option === 'audio') {
      // Show loading
      showLoadingIndicator('Generating audio...');

      // Generate audio using ElevenLabs TTS
      await generateElevenLabsAudio(text);

      hideLoadingIndicator();

    } else if (option === 'auto_read') {
      // Enable auto-read mode with language selection
      await enableAutoReadMode();

    } else if (option === 'zoom') {
      // Show zoomed paragraph (no LLM needed)
      zoomParagraph({ key, text });
    }

  } catch (error) {
    hideLoadingIndicator();
    console.error('[LLM] Failed to get help:', error);
    alert(`Failed to get assistance: ${error.message}\n\nPlease check your API settings.`);
  }
}

/**
 * Show question input modal for Ask Question feature
 * Returns Promise<string> with the user's question
 */
function showQuestionInputModal() {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.85);
      backdrop-filter: blur(8px);
      z-index: 999999;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: fadeIn 0.2s ease-out;
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif;
    `;

    const modal = document.createElement('div');
    modal.style.cssText = `
      background: #181818;
      border: 1px solid #2a2a2a;
      border-radius: 16px;
      padding: 28px;
      max-width: 500px;
      width: 90%;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
      animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    `;

    modal.innerHTML = `
      <div style="font-size: 20px; font-weight: 700; color: #ffffff; margin-bottom: 12px; letter-spacing: -0.02em;">
        💬 Ask a Question
      </div>
      <div style="font-size: 14px; color: #a0a0a0; margin-bottom: 20px; line-height: 1.5;">
        Ask anything about this paragraph. The answer will be based only on the paragraph content.
      </div>
      <textarea
        id="rearead-question-input"
        placeholder="What is the main idea of this paragraph?"
        style="
          width: 100%;
          padding: 14px;
          border: 1px solid #2a2a2a;
          border-radius: 10px;
          background: #0d0d0d;
          color: #ffffff;
          font-size: 14px;
          font-family: inherit;
          resize: vertical;
          min-height: 100px;
          margin-bottom: 20px;
          transition: border-color 0.3s ease;
        "
      ></textarea>
      <div style="display: flex; gap: 10px;">
        <button id="rearead-question-submit" style="
          flex: 1;
          padding: 14px;
          border: none;
          border-radius: 10px;
          background: linear-gradient(135deg, #FF9B45 0%, #FF7B29 100%);
          color: #ffffff;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          font-family: inherit;
        ">
          Ask Question
        </button>
        <button id="rearead-question-cancel" style="
          padding: 14px 24px;
          border: 1px solid #2a2a2a;
          border-radius: 10px;
          background: transparent;
          color: #a0a0a0;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          font-family: inherit;
        ">
          Cancel
        </button>
      </div>
    `;

    const input = modal.querySelector('#rearead-question-input');
    const submitBtn = modal.querySelector('#rearead-question-submit');
    const cancelBtn = modal.querySelector('#rearead-question-cancel');

    // Focus input
    setTimeout(() => input.focus(), 100);

    // Handle submit
    submitBtn.onclick = () => {
      const question = input.value.trim();
      overlay.remove();
      resolve(question);
    };

    // Handle cancel
    cancelBtn.onclick = () => {
      overlay.remove();
      resolve(null);
    };

    // Handle Enter key (with Shift+Enter for new line)
    input.onkeydown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submitBtn.click();
      }
    };

    // Hover effects
    submitBtn.onmouseover = () => {
      submitBtn.style.transform = 'translateY(-2px)';
      submitBtn.style.boxShadow = '0 8px 20px rgba(255, 155, 69, 0.4)';
    };
    submitBtn.onmouseout = () => {
      submitBtn.style.transform = 'translateY(0)';
      submitBtn.style.boxShadow = 'none';
    };

    cancelBtn.onmouseover = () => {
      cancelBtn.style.borderColor = '#ff5252';
      cancelBtn.style.color = '#ff5252';
      cancelBtn.style.background = 'rgba(255, 82, 82, 0.08)';
    };
    cancelBtn.onmouseout = () => {
      cancelBtn.style.borderColor = '#2a2a2a';
      cancelBtn.style.color = '#a0a0a0';
      cancelBtn.style.background = 'transparent';
    };

    // Input focus effect
    input.onfocus = () => {
      input.style.borderColor = '#FF9B45';
    };
    input.onblur = () => {
      input.style.borderColor = '#2a2a2a';
    };

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Close on overlay click
    overlay.onclick = (e) => {
      if (e.target === overlay) {
        overlay.remove();
        resolve(null);
      }
    };
  });
}

/**
 * Show loading indicator with modern dark theme
 */
function showLoadingIndicator(message) {
  const loader = document.createElement('div');
  loader.id = 'rearead-loader';
  loader.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: #181818;
    border: 1px solid #2a2a2a;
    padding: 28px 40px;
    border-radius: 16px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
    z-index: 1000000;
    text-align: center;
    animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif;
  `;

  loader.innerHTML = `
    <div style="
      width: 48px;
      height: 48px;
      margin: 0 auto 16px;
      border: 3px solid #2a2a2a;
      border-top-color: #FF9B45;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    "></div>
    <div style="font-size: 15px; font-weight: 600; color: #ffffff; margin-bottom: 8px; letter-spacing: -0.01em;">${message}</div>
    <div style="font-size: 13px; color: #a0a0a0;">Please wait...</div>
  `;

  // Add spin animation if not already added
  if (!document.getElementById('rearead-spin-animation')) {
    const style = document.createElement('style');
    style.id = 'rearead-spin-animation';
    style.textContent = `
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(loader);
}

/**
 * Hide loading indicator
 */
function hideLoadingIndicator() {
  const loader = document.getElementById('rearead-loader');
  if (loader) loader.remove();
}

/**
 * Show result modal with modern dark theme
 */
function showResultModal({ title, content, key, isAudio = false }) {
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(8px);
    z-index: 999999;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: fadeIn 0.2s ease-out;
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif;
  `;

  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background: #181818;
    border: 1px solid #2a2a2a;
    border-radius: 16px;
    padding: 28px;
    max-width: 680px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
    animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  `;

  // Custom scrollbar for modal
  modalContent.style.scrollbarWidth = 'thin';
  modalContent.style.scrollbarColor = '#2a2a2a #0d0d0d';

  const iconMap = {
    'Paragraph Summary': '📝',
    'Vocabulary Builder': '📚',
    'Comprehension Quiz': '❓',
    'Key Points': '🎯'
  };

  modalContent.innerHTML = `
    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
      <span style="font-size: 32px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">${iconMap[title] || '✨'}</span>
      <h3 style="
        margin: 0;
        font-size: 22px;
        font-weight: 700;
        background: linear-gradient(135deg, #ffffff, #FF9B45);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        letter-spacing: -0.02em;
      ">${title}</h3>
    </div>

    <div style="
      font-size: 15px;
      line-height: 1.8;
      color: #e0e0e0;
      white-space: pre-wrap;
      padding: 20px;
      background: #0d0d0d;
      border: 1px solid #2a2a2a;
      border-radius: 12px;
      margin-bottom: 20px;
    ">${content}</div>

    ${isAudio ? `<div style="
      margin-bottom: 20px;
      padding: 16px;
      background: rgba(255, 155, 69, 0.1);
      border: 1px solid rgba(255, 155, 69, 0.3);
      border-radius: 10px;
      display: flex;
      align-items: center;
      gap: 12px;
    ">
      <span style="font-size: 24px; animation: pulse 2s ease-in-out infinite;">🔊</span>
      <span style="color: #FF9B45; font-weight: 600; font-size: 14px;">Playing audio...</span>
    </div>` : ''}

    <button onclick="this.closest('div').parentElement.remove()" style="
      margin-top: 4px;
      width: 100%;
      padding: 14px;
      border: none;
      border-radius: 10px;
      background: #FF9B45;
      color: #000;
      cursor: pointer;
      font-size: 15px;
      font-weight: 600;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 4px 12px rgba(255, 155, 69, 0.25);
      font-family: inherit;
    " onmouseover="this.style.background='#ffaa5e'; this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(255, 155, 69, 0.35)';" onmouseout="this.style.background='#FF9B45'; this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(255, 155, 69, 0.25)';">✓ Close</button>
  `;

  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  modal.onclick = (e) => {
    if (e.target === modal) {
      modal.style.animation = 'fadeOut 0.2s ease-out';
      setTimeout(() => modal.remove(), 150);
    }
  };
}

/**
 * Generate and play audio using ElevenLabs TTS API
 * Supports multilingual synthesis with high-quality voices
 */
async function generateElevenLabsAudio(text) {
  // Load TTS API key from storage
  let apiKey = await loadTTSApiKey();

  // If no API key, request it from user with custom UI
  if (!apiKey) {
    apiKey = await requestTTSApiKeyFromUser();
    if (!apiKey) {
      throw new Error('TTS API key required. Get a free key from elevenlabs.io');
    }
    // Save for future use
    await saveTTSApiKey(apiKey);
  }

  const ELEVENLABS_CONFIG = {
    apiKey: apiKey,
    voiceId: 'EXAVITQu4vr4xnSDxMaL', // Sarah - multilingual female voice (supports Turkish & English)
    modelId: 'eleven_multilingual_v2',
    apiEndpoint: 'https://api.elevenlabs.io/v1/text-to-speech'
  };

  try {
    const response = await fetch(`${ELEVENLABS_CONFIG.apiEndpoint}/${ELEVENLABS_CONFIG.voiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_CONFIG.apiKey
      },
      body: JSON.stringify({
        text: text,
        model_id: ELEVENLABS_CONFIG.modelId,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.0,
          use_speaker_boost: true
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`ElevenLabs API error: ${response.status} - ${errorData.detail?.message || response.statusText}`);
    }

    // Get audio blob
    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);

    // Create and play audio
    const audio = new Audio(audioUrl);

    // Show audio player modal
    showAudioPlayerModal(audio, text);

    // Play audio
    await audio.play();

    console.log('[ELEVENLABS] Audio generated and playing');

  } catch (error) {
    console.error('[ELEVENLABS] Error:', error);
    throw error;
  }
}

/**
 * Show audio player modal with modern dark theme controls
 */
function showAudioPlayerModal(audio, text) {
  const modal = document.createElement('div');
  modal.id = 'rearead-audio-player';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(8px);
    z-index: 999999;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: fadeIn 0.2s ease-out;
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif;
  `;

  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background: #181818;
    border: 1px solid #2a2a2a;
    border-radius: 16px;
    padding: 28px;
    max-width: 680px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
    animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  `;

  modalContent.innerHTML = `
    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
      <span style="font-size: 32px; animation: pulse 2s ease-in-out infinite;">🔊</span>
      <h3 style="
        margin: 0;
        font-size: 22px;
        font-weight: 700;
        background: linear-gradient(135deg, #ffffff, #FF9B45);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        letter-spacing: -0.02em;
      ">Audio Player</h3>
    </div>

    <div style="
      font-size: 15px;
      line-height: 1.8;
      color: #e0e0e0;
      white-space: pre-wrap;
      padding: 20px;
      background: #0d0d0d;
      border: 1px solid #2a2a2a;
      border-radius: 12px;
      margin-bottom: 20px;
      max-height: 300px;
      overflow-y: auto;
    ">${text}</div>

    <div style="
      background: rgba(255, 155, 69, 0.1);
      border: 1px solid rgba(255, 155, 69, 0.3);
      padding: 20px;
      border-radius: 12px;
      text-align: center;
      margin-bottom: 20px;
    ">
      <div style="color: #FF9B45; font-weight: 600; font-size: 15px; margin-bottom: 16px; display: flex; align-items: center; justify-content: center; gap: 10px;">
        <span style="animation: pulse 2s ease-in-out infinite;">🎵</span>
        <span>Playing audio...</span>
      </div>
      <div style="display: flex; gap: 12px; justify-content: center;">
        <button id="rearead-audio-stop" style="
          padding: 12px 24px;
          border: 1px solid #ff5252;
          border-radius: 10px;
          background: transparent;
          color: #ff5252;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          font-family: inherit;
        ">⏹ Stop</button>
        <button id="rearead-audio-close" style="
          padding: 12px 24px;
          border: 1px solid #2a2a2a;
          border-radius: 10px;
          background: transparent;
          color: #a0a0a0;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          font-family: inherit;
        ">Close</button>
      </div>
    </div>
  `;

  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  // Event handlers
  const stopBtn = document.getElementById('rearead-audio-stop');
  const closeBtn = document.getElementById('rearead-audio-close');

  // Button hover effects
  stopBtn.onmouseover = () => {
    stopBtn.style.background = 'rgba(255, 82, 82, 0.1)';
    stopBtn.style.transform = 'translateY(-2px)';
  };
  stopBtn.onmouseout = () => {
    stopBtn.style.background = 'transparent';
    stopBtn.style.transform = 'translateY(0)';
  };

  closeBtn.onmouseover = () => {
    closeBtn.style.borderColor = '#FF9B45';
    closeBtn.style.color = '#FF9B45';
    closeBtn.style.background = 'rgba(255, 155, 69, 0.08)';
  };
  closeBtn.onmouseout = () => {
    closeBtn.style.borderColor = '#2a2a2a';
    closeBtn.style.color = '#a0a0a0';
    closeBtn.style.background = 'transparent';
  };

  stopBtn.onclick = () => {
    audio.pause();
    audio.currentTime = 0;
    modal.style.animation = 'fadeOut 0.2s ease-out';
    setTimeout(() => modal.remove(), 150);
  };

  closeBtn.onclick = () => {
    modal.style.animation = 'fadeOut 0.2s ease-out';
    setTimeout(() => modal.remove(), 150);
  };

  modal.onclick = (e) => {
    if (e.target === modal) {
      modal.style.animation = 'fadeOut 0.2s ease-out';
      setTimeout(() => modal.remove(), 150);
    }
  };

  // Auto-remove when audio ends
  audio.onended = () => {
    setTimeout(() => {
      if (document.body.contains(modal)) {
        modal.style.animation = 'fadeOut 0.2s ease-out';
        setTimeout(() => modal.remove(), 150);
      }
    }, 500);
  };
}

/**
 * Zoom paragraph with modern dark theme
 */
function zoomParagraph({ key, text }) {
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.9);
    backdrop-filter: blur(12px);
    z-index: 999999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px;
    animation: fadeIn 0.2s ease-out;
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif;
  `;

  const zoomedText = document.createElement('div');
  zoomedText.style.cssText = `
    background: #181818;
    border: 1px solid #2a2a2a;
    border-radius: 20px;
    padding: 48px;
    max-width: 960px;
    width: 90%;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 20px 80px rgba(0, 0, 0, 0.7);
    animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  `;

  zoomedText.innerHTML = `
    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 32px;">
      <span style="font-size: 36px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">🔍</span>
      <h3 style="
        margin: 0;
        font-size: 24px;
        font-weight: 700;
        background: linear-gradient(135deg, #ffffff, #FF9B45);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        letter-spacing: -0.02em;
      ">Zoomed View</h3>
    </div>

    <div style="
      font-size: 26px;
      line-height: 2;
      color: #f0f0f0;
      letter-spacing: 0.01em;
      padding: 32px;
      background: #0d0d0d;
      border: 1px solid #2a2a2a;
      border-radius: 16px;
      margin-bottom: 32px;
    ">${text}</div>

    <button onclick="this.closest('div').parentElement.remove()" style="
      width: 100%;
      padding: 18px;
      border: none;
      border-radius: 12px;
      background: #FF9B45;
      color: #000;
      cursor: pointer;
      font-size: 16px;
      font-weight: 600;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 4px 12px rgba(255, 155, 69, 0.25);
      font-family: inherit;
    " onmouseover="this.style.background='#ffaa5e'; this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(255, 155, 69, 0.35)';" onmouseout="this.style.background='#FF9B45'; this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(255, 155, 69, 0.25)';">✓ Close</button>
  `;

  modal.appendChild(zoomedText);
  document.body.appendChild(modal);

  modal.onclick = (e) => {
    if (e.target === modal) {
      modal.style.animation = 'fadeOut 0.2s ease-out';
      setTimeout(() => modal.remove(), 150);
    }
  };
}

/**
 * Load LLM API key from chrome storage
 * @returns {Promise<string>} API key
 */
export async function loadApiKey() {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(['llmApiKey'], (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(result.llmApiKey || '');
      }
    });
  });
}

/**
 * Load Groq API key from chrome.storage.local (set by background script from config.js)
 * @returns {Promise<string>} API key
 */
async function loadGroqApiKeyFromLocal() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['groqApiKey'], (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(result.groqApiKey || '');
      }
    });
  });
}

/**
 * Save LLM API key to chrome storage
 * @param {string} apiKey - API key to save
 */
export async function saveApiKey(apiKey) {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set({ llmApiKey: apiKey }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Load Gemini API key from chrome storage
 * @returns {Promise<string>} API key
 */
export async function loadGeminiApiKey() {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(['geminiApiKey'], (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(result.geminiApiKey || '');
      }
    });
  });
}

/**
 * Save Gemini API key to chrome storage
 * @param {string} apiKey - API key to save
 */
export async function saveGeminiApiKey(apiKey) {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set({ geminiApiKey: apiKey }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Load TTS API key from chrome storage
 * @returns {Promise<string>} API key
 */
export async function loadTTSApiKey() {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(["ttsApiKey"], (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(result.ttsApiKey || "");
      }
    });
  });
}

/**
 * Save TTS API key to chrome storage
 * @param {string} apiKey - API key to save
 */
export async function saveTTSApiKey(apiKey) {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set({ ttsApiKey: apiKey }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Request API key from user with custom UI dialog (Groq)
 * @returns {Promise<string|null>} API key or null if cancelled
 */
function requestApiKeyFromUser() {
  return new Promise((resolve) => {
    // Create modal dialog with modern dark theme
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.85);
      backdrop-filter: blur(8px);
      z-index: 9999999;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: fadeIn 0.2s ease-out;
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif;
    `;

    modal.innerHTML = `
      <div style="
        background: #181818;
        border: 1px solid #2a2a2a;
        padding: 32px;
        border-radius: 16px;
        max-width: 520px;
        width: 90%;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
        animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      ">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
          <span style="font-size: 32px;">🔑</span>
          <h2 style="
            margin: 0;
            font-size: 22px;
            font-weight: 700;
            background: linear-gradient(135deg, #ffffff, #FF9B45);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            letter-spacing: -0.02em;
          ">Groq API Key Required</h2>
        </div>

        <p style="margin: 0 0 20px 0; color: #a0a0a0; line-height: 1.6; font-size: 14px;">
          Get a free API key from <a href="https://console.groq.com" target="_blank" style="color: #FF9B45; text-decoration: none; font-weight: 600;">console.groq.com</a>
        </p>

        <input
          type="text"
          id="groq-api-key-input"
          placeholder="gsk_..."
          style="
            width: 100%;
            padding: 14px;
            background: #0d0d0d;
            border: 1px solid #2a2a2a;
            border-radius: 10px;
            font-size: 14px;
            color: #ffffff;
            box-sizing: border-box;
            margin-bottom: 20px;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            font-family: 'SF Mono', 'Menlo', 'Monaco', 'Courier New', monospace;
          "
        />

        <div style="display: flex; gap: 12px; justify-content: flex-end;">
          <button id="groq-cancel-btn" style="
            padding: 12px 24px;
            background: transparent;
            border: 1px solid #2a2a2a;
            border-radius: 10px;
            color: #a0a0a0;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            font-family: inherit;
          ">Cancel</button>
          <button id="groq-save-btn" style="
            padding: 12px 24px;
            background: #FF9B45;
            border: none;
            border-radius: 10px;
            color: #000;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 4px 12px rgba(255, 155, 69, 0.25);
            font-family: inherit;
          ">Save Key</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const input = document.getElementById('groq-api-key-input');
    const saveBtn = document.getElementById('groq-save-btn');
    const cancelBtn = document.getElementById('groq-cancel-btn');

    // Input focus effect
    input.onfocus = () => {
      input.style.borderColor = '#FF9B45';
      input.style.boxShadow = '0 0 0 3px rgba(255, 155, 69, 0.1)';
    };
    input.onblur = () => {
      input.style.borderColor = '#2a2a2a';
      input.style.boxShadow = 'none';
    };

    // Button hover effects
    cancelBtn.onmouseover = () => {
      cancelBtn.style.borderColor = '#ff5252';
      cancelBtn.style.color = '#ff5252';
      cancelBtn.style.background = 'rgba(255, 82, 82, 0.08)';
    };
    cancelBtn.onmouseout = () => {
      cancelBtn.style.borderColor = '#2a2a2a';
      cancelBtn.style.color = '#a0a0a0';
      cancelBtn.style.background = 'transparent';
    };

    saveBtn.onmouseover = () => {
      saveBtn.style.background = '#ffaa5e';
      saveBtn.style.transform = 'translateY(-2px)';
      saveBtn.style.boxShadow = '0 6px 20px rgba(255, 155, 69, 0.35)';
    };
    saveBtn.onmouseout = () => {
      saveBtn.style.background = '#FF9B45';
      saveBtn.style.transform = 'translateY(0)';
      saveBtn.style.boxShadow = '0 4px 12px rgba(255, 155, 69, 0.25)';
    };

    // Focus input
    setTimeout(() => input.focus(), 100);

    // Handle save
    saveBtn.addEventListener('click', () => {
      const apiKey = input.value.trim();
      modal.style.animation = 'fadeOut 0.2s ease-out';
      setTimeout(() => {
        modal.remove();
        resolve(apiKey || null);
      }, 150);
    });

    // Handle cancel
    cancelBtn.addEventListener('click', () => {
      modal.style.animation = 'fadeOut 0.2s ease-out';
      setTimeout(() => {
        modal.remove();
        resolve(null);
      }, 150);
    });

    // Handle Enter key
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const apiKey = input.value.trim();
        modal.style.animation = 'fadeOut 0.2s ease-out';
        setTimeout(() => {
          modal.remove();
          resolve(apiKey || null);
        }, 150);
      }
    });

    // Handle Escape key
    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        modal.style.animation = 'fadeOut 0.2s ease-out';
        setTimeout(() => {
          modal.remove();
          resolve(null);
        }, 150);
      }
    });
  });
}

/**
 * Request Gemini API key from user (DISABLED - no popup for demo)
 * @returns {Promise<string|null>} API key or null if cancelled
 */
function requestGeminiApiKeyFromUser() {
  // Return null immediately - no popup for demo
  return Promise.resolve(null);
}

/**
 * Enable Auto Read Mode with language selection and Bluetooth audio
 */
async function enableAutoReadMode() {
  // Show language selection modal
  const selectedLanguage = await showLanguageSelectionModal();

  if (!selectedLanguage) {
    return; // User cancelled
  }

  // Notify content script to enable auto-read mode
  window.postMessage({
    type: 'REAREAD_AUTO_READ_MODE',
    data: { enabled: true, language: selectedLanguage }
  }, '*');

  // Show confirmation
  showAutoReadConfirmation(selectedLanguage);
}

/**
 * Show language selection modal for Auto Read Mode
 * @returns {Promise<string|null>} Selected language code or null if cancelled
 */
function showLanguageSelectionModal() {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.85);
      backdrop-filter: blur(8px);
      z-index: 999999;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: fadeIn 0.2s ease-out;
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif;
    `;

    const modal = document.createElement('div');
    modal.style.cssText = `
      background: #181818;
      border: 1px solid #2a2a2a;
      border-radius: 16px;
      padding: 32px;
      max-width: 480px;
      width: 90%;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
      animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    `;

    const languages = [
      { code: 'auto', name: 'Auto-Detect', icon: '🌍', description: 'Read in original language (no translation)' },
      { code: 'tr', name: 'Türkçe', icon: '🇹🇷', description: 'Translate and read in Turkish' },
      { code: 'en', name: 'English', icon: '🇺🇸', description: 'Translate and read in English' },
      { code: 'de', name: 'Deutsch', icon: '🇩🇪', description: 'Translate and read in German' }
    ];

    modal.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
        <span style="font-size: 32px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">🎧</span>
        <div>
          <h2 style="
            margin: 0;
            font-size: 22px;
            font-weight: 700;
            background: linear-gradient(135deg, #ffffff, #4CAF50);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            letter-spacing: -0.02em;
          ">Auto Read Mode</h2>
          <p style="margin: 4px 0 0 0; font-size: 13px; color: #a0a0a0;">
            Select voice language - works with Bluetooth headphones
          </p>
        </div>
      </div>

      <div id="language-options" style="margin-bottom: 20px;"></div>

      <div style="
        background: rgba(76, 175, 80, 0.1);
        border: 1px solid rgba(76, 175, 80, 0.3);
        padding: 16px;
        border-radius: 10px;
        margin-bottom: 20px;
      ">
        <div style="display: flex; align-items: start; gap: 12px;">
          <span style="font-size: 24px;">💡</span>
          <div style="font-size: 13px; color: #e0e0e0; line-height: 1.5;">
            <div style="font-weight: 600; color: #4CAF50; margin-bottom: 4px;">How it works:</div>
            • Paragraphs you look at will be read aloud automatically<br>
            • Connect your Bluetooth headphones for best experience<br>
            • You can disable this mode anytime
          </div>
        </div>
      </div>

      <button id="lang-cancel-btn" style="
        width: 100%;
        padding: 14px;
        border: 1px solid #2a2a2a;
        border-radius: 10px;
        background: transparent;
        color: #a0a0a0;
        cursor: pointer;
        font-size: 14px;
        font-weight: 600;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        font-family: inherit;
      ">Cancel</button>
    `;

    // Add language option buttons
    const optionsContainer = modal.querySelector('#language-options');
    languages.forEach(lang => {
      const langBtn = document.createElement('button');
      langBtn.className = 'lang-option-btn';
      langBtn.style.cssText = `
        width: 100%;
        padding: 16px;
        margin-bottom: 10px;
        border: 1px solid #2a2a2a;
        border-radius: 10px;
        background: #0d0d0d;
        cursor: pointer;
        text-align: left;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        display: flex;
        align-items: center;
        gap: 14px;
      `;

      langBtn.innerHTML = `
        <span style="font-size: 28px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">${lang.icon}</span>
        <div style="flex: 1;">
          <div style="font-weight: 600; font-size: 15px; color: #ffffff; margin-bottom: 2px;">
            ${lang.name}
          </div>
          <div style="font-size: 12px; color: #a0a0a0;">
            ${lang.description}
          </div>
        </div>
      `;

      langBtn.onmouseover = () => {
        langBtn.style.borderColor = '#4CAF50';
        langBtn.style.background = 'rgba(76, 175, 80, 0.08)';
        langBtn.style.transform = 'translateX(4px)';
      };

      langBtn.onmouseout = () => {
        langBtn.style.borderColor = '#2a2a2a';
        langBtn.style.background = '#0d0d0d';
        langBtn.style.transform = 'translateX(0)';
      };

      langBtn.onclick = () => {
        overlay.style.animation = 'fadeOut 0.2s ease-out';
        setTimeout(() => {
          overlay.remove();
          resolve(lang.code);
        }, 150);
      };

      optionsContainer.appendChild(langBtn);
    });

    const cancelBtn = modal.querySelector('#lang-cancel-btn');
    cancelBtn.onmouseover = () => {
      cancelBtn.style.borderColor = '#ff5252';
      cancelBtn.style.color = '#ff5252';
      cancelBtn.style.background = 'rgba(255, 82, 82, 0.08)';
    };
    cancelBtn.onmouseout = () => {
      cancelBtn.style.borderColor = '#2a2a2a';
      cancelBtn.style.color = '#a0a0a0';
      cancelBtn.style.background = 'transparent';
    };
    cancelBtn.onclick = () => {
      overlay.style.animation = 'fadeOut 0.2s ease-out';
      setTimeout(() => {
        overlay.remove();
        resolve(null);
      }, 150);
    };

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Close on overlay click
    overlay.onclick = (e) => {
      if (e.target === overlay) {
        overlay.style.animation = 'fadeOut 0.2s ease-out';
        setTimeout(() => {
          overlay.remove();
          resolve(null);
        }, 150);
      }
    };
  });
}

/**
 * Show confirmation that Auto Read Mode is enabled
 */
function showAutoReadConfirmation(language) {
  const languageNames = {
    'auto': 'Auto-Detect',
    'tr': 'Türkçe',
    'en': 'English',
    'de': 'Deutsch',
    'fr': 'Français',
    'es': 'Español',
    'it': 'Italiano',
    'ja': '日本語',
    'zh': '中文'
  };

  const confirmation = document.createElement('div');
  confirmation.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #181818;
    border: 1px solid #4CAF50;
    border-radius: 12px;
    padding: 20px 24px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    z-index: 999999;
    animation: slideInRight 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif;
  `;

  confirmation.innerHTML = `
    <div style="display: flex; align-items: center; gap: 12px;">
      <span style="font-size: 24px;">🎧</span>
      <div style="flex: 1;">
        <div style="font-weight: 600; color: #4CAF50; margin-bottom: 4px;">
          Auto Read Mode Enabled
        </div>
        <div style="font-size: 13px; color: #a0a0a0;">
          Language: ${languageNames[language]}
        </div>
      </div>
      <button id="auto-read-stop-btn" style="
        padding: 8px 16px;
        background: rgba(255, 82, 82, 0.15);
        border: 1px solid rgba(255, 82, 82, 0.3);
        border-radius: 8px;
        color: #ff5252;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        font-family: inherit;
      ">Stop</button>
    </div>
  `;

  // Add slide in animation
  if (!document.getElementById('rearead-slide-animation')) {
    const style = document.createElement('style');
    style.id = 'rearead-slide-animation';
    style.textContent = `
      @keyframes slideInRight {
        from { transform: translateX(400px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(400px); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(confirmation);

  // Stop button handler
  const stopBtn = confirmation.querySelector('#auto-read-stop-btn');
  stopBtn.onmouseover = () => {
    stopBtn.style.background = 'rgba(255, 82, 82, 0.25)';
    stopBtn.style.borderColor = '#ff5252';
  };
  stopBtn.onmouseout = () => {
    stopBtn.style.background = 'rgba(255, 82, 82, 0.15)';
    stopBtn.style.borderColor = 'rgba(255, 82, 82, 0.3)';
  };
  stopBtn.onclick = () => {
    // Stop auto-read mode
    window.postMessage({
      type: 'REAREAD_AUTO_READ_MODE',
      data: { enabled: false }
    }, '*');

    // Stop current speech (both browser TTS and ElevenLabs)
    window.postMessage({
      type: 'REAREAD_STOP_AUDIO'
    }, '*');

    confirmation.style.animation = 'slideOutRight 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
    setTimeout(() => confirmation.remove(), 300);
  };

  // Notification kalıcı - sadece Stop butonu ile kapanır
  // Kullanıcı istediği zaman auto-read'i durdurabilmeli
}

/**
 * Request TTS API key from user with custom UI dialog
 * @returns {Promise<string|null>} API key or null if cancelled
 */
function requestTTSApiKeyFromUser() {
  return new Promise((resolve) => {
    // Create modal dialog with modern dark theme
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.85);
      backdrop-filter: blur(8px);
      z-index: 9999999;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: fadeIn 0.2s ease-out;
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif;
    `;

    modal.innerHTML = `
      <div style="
        background: #181818;
        border: 1px solid #2a2a2a;
        padding: 32px;
        border-radius: 16px;
        max-width: 520px;
        width: 90%;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
        animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      ">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
          <span style="font-size: 32px;">🎙️</span>
          <h2 style="
            margin: 0;
            font-size: 22px;
            font-weight: 700;
            background: linear-gradient(135deg, #ffffff, #FF9B45);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            letter-spacing: -0.02em;
          ">ElevenLabs API Key Required</h2>
        </div>

        <p style="margin: 0 0 20px 0; color: #a0a0a0; line-height: 1.6; font-size: 14px;">
          Get a free API key from <a href="https://elevenlabs.io" target="_blank" style="color: #FF9B45; text-decoration: none; font-weight: 600;">elevenlabs.io</a>
        </p>

        <input
          type="text"
          id="elevenlabs-api-key-input"
          placeholder="sk_..."
          style="
            width: 100%;
            padding: 14px;
            background: #0d0d0d;
            border: 1px solid #2a2a2a;
            border-radius: 10px;
            font-size: 14px;
            color: #ffffff;
            box-sizing: border-box;
            margin-bottom: 20px;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            font-family: 'SF Mono', 'Menlo', 'Monaco', 'Courier New', monospace;
          "
        />

        <div style="display: flex; gap: 12px; justify-content: flex-end;">
          <button id="elevenlabs-cancel-btn" style="
            padding: 12px 24px;
            background: transparent;
            border: 1px solid #2a2a2a;
            border-radius: 10px;
            color: #a0a0a0;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            font-family: inherit;
          ">Cancel</button>
          <button id="elevenlabs-save-btn" style="
            padding: 12px 24px;
            background: #FF9B45;
            border: none;
            border-radius: 10px;
            color: #000;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 4px 12px rgba(255, 155, 69, 0.25);
            font-family: inherit;
          ">Save Key</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const input = document.getElementById('elevenlabs-api-key-input');
    const saveBtn = document.getElementById('elevenlabs-save-btn');
    const cancelBtn = document.getElementById('elevenlabs-cancel-btn');

    // Input focus effect
    input.onfocus = () => {
      input.style.borderColor = '#FF9B45';
      input.style.boxShadow = '0 0 0 3px rgba(255, 155, 69, 0.1)';
    };
    input.onblur = () => {
      input.style.borderColor = '#2a2a2a';
      input.style.boxShadow = 'none';
    };

    // Button hover effects
    cancelBtn.onmouseover = () => {
      cancelBtn.style.borderColor = '#ff5252';
      cancelBtn.style.color = '#ff5252';
      cancelBtn.style.background = 'rgba(255, 82, 82, 0.08)';
    };
    cancelBtn.onmouseout = () => {
      cancelBtn.style.borderColor = '#2a2a2a';
      cancelBtn.style.color = '#a0a0a0';
      cancelBtn.style.background = 'transparent';
    };

    saveBtn.onmouseover = () => {
      saveBtn.style.background = '#ffaa5e';
      saveBtn.style.transform = 'translateY(-2px)';
      saveBtn.style.boxShadow = '0 6px 20px rgba(255, 155, 69, 0.35)';
    };
    saveBtn.onmouseout = () => {
      saveBtn.style.background = '#FF9B45';
      saveBtn.style.transform = 'translateY(0)';
      saveBtn.style.boxShadow = '0 4px 12px rgba(255, 155, 69, 0.25)';
    };

    // Focus input
    setTimeout(() => input.focus(), 100);

    // Handle save
    saveBtn.addEventListener('click', () => {
      const apiKey = input.value.trim();
      modal.style.animation = 'fadeOut 0.2s ease-out';
      setTimeout(() => {
        modal.remove();
        resolve(apiKey || null);
      }, 150);
    });

    // Handle cancel
    cancelBtn.addEventListener('click', () => {
      modal.style.animation = 'fadeOut 0.2s ease-out';
      setTimeout(() => {
        modal.remove();
        resolve(null);
      }, 150);
    });

    // Handle Enter key
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const apiKey = input.value.trim();
        modal.style.animation = 'fadeOut 0.2s ease-out';
        setTimeout(() => {
          modal.remove();
          resolve(apiKey || null);
        }, 150);
      }
    });

    // Handle Escape key
    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        modal.style.animation = 'fadeOut 0.2s ease-out';
        setTimeout(() => {
          modal.remove();
          resolve(null);
        }, 150);
      }
    });
  });
}

// Note: Gesture navigation is handled by handleMenuGesture() function defined earlier
// Duplicate functions removed - using existing implementation

function playBeep(frequency = 440, duration = 100) {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration / 1000);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration / 1000);
  } catch (e) {
    // Audio not supported
  }
}

// Expose requestHelp to window for easier access from content script
// This allows the function to be called even if dynamic import fails
if (typeof window !== 'undefined') {
  window.reareadRequestHelp = requestHelp;
  console.log('[LLM Helper] requestHelp function exposed to window');
}