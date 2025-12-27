// ============================================================================
// LLM Integration Module (Isolated, Optional, User-Triggered Only)
// ============================================================================
// This module handles all LLM interactions separately from core reading logic
// Author: ReaRead Team
// Purpose: Provide AI-powered reading assistance without affecting core features

/**
 * Get stored API key from Chrome storage
 * @returns {Promise<string|null>} - API key or null if not set
 */
async function getStoredAPIKey() {
  try {
    const result = await chrome.storage.local.get(['groq_api_key']);
    return result.groq_api_key || null;
  } catch (error) {
    console.error('[LLM] Error retrieving API key:', error);
    return null;
  }
}

/**
 * Save API key to Chrome storage
 * @param {string} apiKey - The API key to store
 */
async function saveAPIKey(apiKey) {
  try {
    await chrome.storage.local.set({ groq_api_key: apiKey });
    console.log('[LLM] API key saved successfully');
  } catch (error) {
    console.error('[LLM] Error saving API key:', error);
  }
}

/**
 * Core LLM call function - isolated and reusable (Groq API)
 * @param {Object} options - Configuration object
 * @param {string} options.mode - Help mode: "summary", "simplify", "explain", etc.
 * @param {string} options.text - Raw paragraph text to analyze
 * @returns {Promise<string>} - LLM response text
 */
async function callLLM({ mode, text }) {
  // Get API key from Chrome storage (stored in popup settings)
  const apiKey = await getStoredAPIKey();

  if (!apiKey) {
    console.error('[LLM] No API key found. Please set it in extension popup.');
    return 'Error: API key not configured. Click the extension icon to add your Groq API key.';
  }

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

  // Create menu overlay
  const menuOverlay = document.createElement('div');
  menuOverlay.id = 'rearead-help-menu';
  menuOverlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    z-index: 999999;
    display: flex;
    align-items: center;
    justify-content: center;
  `;

  // Create menu container
  const menuContainer = document.createElement('div');
  menuContainer.style.cssText = `
    background: white;
    border-radius: 12px;
    padding: 24px;
    max-width: 400px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  `;

  // Menu title
  const title = document.createElement('h3');
  title.textContent = 'Reading Assistance Options';
  title.style.cssText = `
    margin: 0 0 16px 0;
    font-size: 18px;
    font-weight: 600;
    color: #333;
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
      margin-bottom: 12px;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      background: white;
      cursor: pointer;
      text-align: left;
      transition: all 0.2s;
    `;

    optionBtn.innerHTML = `
      <div style="display: flex; align-items: start; gap: 12px;">
        <span style="font-size: 24px;">${option.icon}</span>
        <div style="flex: 1;">
          <div style="font-weight: 600; font-size: 16px; color: #333; margin-bottom: 4px;">
            ${option.label}
          </div>
          <div style="font-size: 14px; color: #666;">
            ${option.description}
          </div>
        </div>
      </div>
    `;

    optionBtn.onmouseover = () => {
      optionBtn.style.borderColor = '#ff9800';
      optionBtn.style.background = '#fff8f0';
    };

    optionBtn.onmouseout = () => {
      optionBtn.style.borderColor = '#e0e0e0';
      optionBtn.style.background = 'white';
    };

    optionBtn.onclick = () => {
      menuOverlay.remove();
      handleHelpOption({ option: option.id, key, text });
    };

    menuContainer.appendChild(optionBtn);
  });

  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Cancel';
  closeBtn.style.cssText = `
    width: 100%;
    padding: 12px;
    border: none;
    border-radius: 6px;
    background: #f5f5f5;
    color: #666;
    cursor: pointer;
    font-size: 14px;
  `;
  closeBtn.onclick = () => menuOverlay.remove();

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
 * Show loading indicator
 */
function showLoadingIndicator(message) {
  const loader = document.createElement('div');
  loader.id = 'rearead-loader';
  loader.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    padding: 24px 32px;
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
    z-index: 1000000;
    text-align: center;
  `;
  loader.innerHTML = `
    <div style="font-size: 16px; color: #333; margin-bottom: 12px;">${message}</div>
    <div style="color: #ff9800;">⏳ Please wait...</div>
  `;
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
 * Show result modal
 */
function showResultModal({ title, content, key, isAudio = false }) {
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    z-index: 999999;
    display: flex;
    align-items: center;
    justify-content: center;
  `;

  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background: white;
    border-radius: 12px;
    padding: 24px;
    max-width: 600px;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  `;

  modalContent.innerHTML = `
    <h3 style="margin: 0 0 16px 0; font-size: 20px; color: #333;">${title}</h3>
    <div style="font-size: 16px; line-height: 1.6; color: #555; white-space: pre-wrap;">${content}</div>
    ${isAudio ? '<div style="margin-top: 16px; color: #ff9800; font-size: 14px;">🔊 Playing audio...</div>' : ''}
    <button onclick="this.closest('div').parentElement.remove()" style="
      margin-top: 20px;
      width: 100%;
      padding: 12px;
      border: none;
      border-radius: 6px;
      background: #ff9800;
      color: white;
      cursor: pointer;
      font-size: 16px;
    ">Close</button>
  `;

  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  modal.onclick = (e) => {
    if (e.target === modal) modal.remove();
  };
}

/**
 * Generate and play audio using ElevenLabs TTS API
 * Supports multilingual synthesis with high-quality voices
 */
async function generateElevenLabsAudio(text) {
  const ELEVENLABS_CONFIG = {
    apiKey: prompt('Enter your ElevenLabs API key (get from elevenlabs.io):') || '', // TODO: Store in chrome.storage
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
 * Show audio player modal with controls
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
    background: rgba(0, 0, 0, 0.5);
    z-index: 999999;
    display: flex;
    align-items: center;
    justify-content: center;
  `;

  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background: white;
    border-radius: 12px;
    padding: 24px;
    max-width: 600px;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  `;

  modalContent.innerHTML = `
    <h3 style="margin: 0 0 16px 0; font-size: 20px; color: #333;">🔊 Audio Player</h3>
    <div style="font-size: 16px; line-height: 1.6; color: #555; white-space: pre-wrap; margin-bottom: 20px;">${text}</div>
    <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; text-align: center;">
      <div style="color: #ff9800; font-size: 14px; margin-bottom: 12px;">🎵 Playing audio...</div>
      <button id="rearead-audio-stop" style="
        padding: 10px 24px;
        border: none;
        border-radius: 6px;
        background: #ff5722;
        color: white;
        cursor: pointer;
        font-size: 14px;
        margin-right: 8px;
      ">⏹ Stop</button>
      <button id="rearead-audio-close" style="
        padding: 10px 24px;
        border: none;
        border-radius: 6px;
        background: #757575;
        color: white;
        cursor: pointer;
        font-size: 14px;
      ">Close</button>
    </div>
  `;

  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  // Event handlers
  const stopBtn = document.getElementById('rearead-audio-stop');
  const closeBtn = document.getElementById('rearead-audio-close');

  stopBtn.onclick = () => {
    audio.pause();
    audio.currentTime = 0;
    modal.remove();
  };

  closeBtn.onclick = () => {
    modal.remove();
  };

  modal.onclick = (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  };

  // Auto-remove when audio ends
  audio.onended = () => {
    setTimeout(() => {
      if (document.body.contains(modal)) {
        modal.remove();
      }
    }, 500);
  };
}

/**
 * Zoom paragraph
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
    z-index: 999999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px;
  `;

  const zoomedText = document.createElement('div');
  zoomedText.style.cssText = `
    background: white;
    border-radius: 12px;
    padding: 48px;
    max-width: 900px;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  `;

  zoomedText.innerHTML = `
    <div style="font-size: 24px; line-height: 1.8; color: #333;">${text}</div>
    <button onclick="this.closest('div').parentElement.remove()" style="
      margin-top: 32px;
      padding: 16px 32px;
      border: none;
      border-radius: 8px;
      background: #ff9800;
      color: white;
      cursor: pointer;
      font-size: 18px;
    ">Close</button>
  `;

  modal.appendChild(zoomedText);
  document.body.appendChild(modal);

  modal.onclick = (e) => {
    if (e.target === modal) modal.remove();
  };
}

/**
 * Load API key from chrome storage
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
 * Save API key to chrome storage
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
