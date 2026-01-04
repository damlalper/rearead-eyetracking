// ============================================================================
// LLM Integration Module (Isolated, Optional, User-Triggered Only)
// ============================================================================
// This module handles all LLM interactions separately from core reading logic
// Author: ReaRead Team
// Purpose: Provide AI-powered reading assistance without affecting core features

/**
 * Core LLM call function - isolated and reusable (Groq API)
 * @param {Object} options - Configuration object
 * @param {string} options.mode - Help mode: "summary", "simplify", "explain", etc.
 * @param {string} options.text - Raw paragraph text to analyze
 * @returns {Promise<string>} - LLM response text
 */
async function callLLM({ mode, text }) {
  // Load API key from storage
  let apiKey = await loadApiKey();

  // If no API key, request it from user with custom UI
  if (!apiKey) {
    apiKey = await requestApiKeyFromUser();
    if (!apiKey) {
      throw new Error('API key required. Get a free key from console.groq.com');
    }
    // Save for future use
    await saveApiKey(apiKey);
  }

  // Configuration
  const LLM_CONFIG = {
    apiEndpoint: 'https://api.groq.com/openai/v1/chat/completions',
    apiKey: apiKey,
    model: 'llama-3.3-70b-versatile', // Fast and free model
    maxTokens: 500,
    temperature: 0.7
  };

  // Auto-detect language from text (simple heuristic)
  const detectLanguage = (text) => {
    const turkishChars = /[ğüşıöçĞÜŞİÖÇ]/;
    const turkishWords = /\b(ve|bir|bu|için|olan|ile|daha|çok|var|gibi|her|veya|ama|ancak|şey)\b/i;

    if (turkishChars.test(text) || turkishWords.test(text)) {
      return 'tr';
    }
    return 'en';
  };

  const lang = detectLanguage(text);

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

    quiz: lang === 'tr'
      ? `Sen bir öğretmensin. Bu metni okuduktan sonra anlama düzeyini test edecek sorular oluştur.

KURALLAR:
- 3 çoktan seçmeli soru oluştur
- Her soru için 4 şık sun (A, B, C, D)
- Doğru cevabı belirt
- Sorular metni anlamayı ölçmeli, ezberlemeyi değil
- Format: "SORU 1: ... \nA) ... \nB) ... \nC) ... \nD) ... \nDOĞRU: X"

METİN:
${text}

ANLAMA SORULARI:`
      : `You are a teacher. Create comprehension questions to test understanding of this text.

RULES:
- Create 3 multiple choice questions
- Provide 4 options (A, B, C, D) for each
- Indicate the correct answer
- Questions should test comprehension, not memorization
- Format: "QUESTION 1: ... \nA) ... \nB) ... \nC) ... \nD) ... \nCORRECT: X"

TEXT:
${text}

COMPREHENSION QUESTIONS:`,

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

  const prompt = PROMPTS[mode] || PROMPTS.default;

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
    if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
      return data.choices[0].message.content.trim();
    }

    throw new Error('Invalid Groq API response format');

  } catch (error) {
    console.error('[LLM] Error:', error);
    throw error;
  }
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

  // Create menu overlay with animation
  const menuOverlay = document.createElement('div');
  menuOverlay.id = 'rearead-help-menu';
  menuOverlay.style.cssText = `
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

  // Create menu container with dark theme
  const menuContainer = document.createElement('div');
  menuContainer.style.cssText = `
    background: #181818;
    border: 1px solid #2a2a2a;
    border-radius: 16px;
    padding: 28px;
    max-width: 440px;
    width: 90%;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
    animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  `;

  // Add keyframes for animations
  if (!document.getElementById('rearead-animations')) {
    const style = document.createElement('style');
    style.id = 'rearead-animations';
    style.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
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
    `;
    document.head.appendChild(style);
  }

  // Menu title with gradient
  const title = document.createElement('h3');
  title.textContent = '🎯 Reading Assistance';
  title.style.cssText = `
    margin: 0 0 20px 0;
    font-size: 20px;
    font-weight: 700;
    background: linear-gradient(135deg, #ffffff, #FF9B45);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    letter-spacing: -0.02em;
  `;

  // Menu options
  const options = [
    {
      id: 'summary',
      icon: '📝',
      label: 'Summarize',
      description: 'Get a concise summary of this paragraph'
    },
    {
      id: 'vocabulary',
      icon: '📚',
      label: 'Vocabulary',
      description: 'Explain difficult words with examples'
    },
    {
      id: 'quiz',
      icon: '❓',
      label: 'Quiz',
      description: 'Test comprehension with questions'
    },
    {
      id: 'keypoints',
      icon: '🎯',
      label: 'Key Points',
      description: 'Extract main ideas in bullet format'
    },
    {
      id: 'audio',
      icon: '🔊',
      label: 'Read Aloud',
      description: 'Listen to this paragraph with text-to-speech'
    },
    {
      id: 'zoom',
      icon: '🔍',
      label: 'Zoom',
      description: 'View this paragraph in larger, more readable text'
    }
  ];

  menuContainer.appendChild(title);

  options.forEach(option => {
    const optionBtn = document.createElement('button');
    optionBtn.style.cssText = `
      width: 100%;
      padding: 16px;
      margin-bottom: 10px;
      border: 1px solid #2a2a2a;
      border-radius: 10px;
      background: #0d0d0d;
      cursor: pointer;
      text-align: left;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
      overflow: hidden;
    `;

    optionBtn.innerHTML = `
      <div style="display: flex; align-items: start; gap: 14px; position: relative; z-index: 1;">
        <span style="font-size: 28px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">${option.icon}</span>
        <div style="flex: 1;">
          <div style="font-weight: 600; font-size: 15px; color: #ffffff; margin-bottom: 4px; letter-spacing: -0.01em;">
            ${option.label}
          </div>
          <div style="font-size: 13px; color: #a0a0a0; line-height: 1.4;">
            ${option.description}
          </div>
        </div>
      </div>
    `;

    optionBtn.onmouseover = () => {
      optionBtn.style.borderColor = '#FF9B45';
      optionBtn.style.background = 'rgba(255, 155, 69, 0.08)';
      optionBtn.style.transform = 'translateX(4px)';
    };

    optionBtn.onmouseout = () => {
      optionBtn.style.borderColor = '#2a2a2a';
      optionBtn.style.background = '#0d0d0d';
      optionBtn.style.transform = 'translateX(0)';
    };

    optionBtn.onclick = () => {
      menuOverlay.style.animation = 'fadeOut 0.2s ease-out';
      setTimeout(() => {
        menuOverlay.remove();
        handleHelpOption({ option: option.id, key, text });
      }, 150);
    };

    menuContainer.appendChild(optionBtn);
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
    menuOverlay.style.animation = 'fadeOut 0.2s ease-out';
    setTimeout(() => menuOverlay.remove(), 150);
  };

  menuContainer.appendChild(closeBtn);
  menuOverlay.appendChild(menuContainer);
  document.body.appendChild(menuOverlay);

  // Close on overlay click
  menuOverlay.onclick = (e) => {
    if (e.target === menuOverlay) menuOverlay.remove();
  };
}

/**
 * Handle selected help option
 */
async function handleHelpOption({ option, key, text }) {
  try {
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

    } else if (option === 'quiz') {
      // Show loading
      showLoadingIndicator('Creating quiz questions...');

      const response = await callLLM({ mode: 'quiz', text });

      hideLoadingIndicator();
      showResultModal({ title: 'Comprehension Quiz', content: response, key });

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
 * Request API key from user with custom UI dialog
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
