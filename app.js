// Initialize Lucide icons
lucide.createIcons();

// --- Application State ---
let apiKey = localStorage.getItem('fluency_api_key') || '';
let selectedModel = localStorage.getItem('fluency_model') || 'gemini-1.5-flash';
let targetLanguage = localStorage.getItem('fluency_target_lang') || 'en';
let userProfile = JSON.parse(localStorage.getItem('fluency_user_profile')) || null;
let currentScenario = null;
let chatHistory = []; 

// --- Voice State ---
let speechRecognition = null;
let isRecording = false;
let synthesisVoices = [];

// Load voices when available
window.speechSynthesis.onvoiceschanged = () => {
    synthesisVoices = window.speechSynthesis.getVoices();
};

// --- DOM Elements ---
const dom = {
    mobileMenuBtn: document.getElementById('mobile-menu-btn'),
    closeSidebarBtn: document.getElementById('close-sidebar-btn'),
    sidebar: document.getElementById('sidebar'),
    scenariosList: document.getElementById('scenarios-list'),
    
    langToggleBtn: document.getElementById('lang-toggle-btn'),
    langFlag: document.getElementById('lang-flag'),
    langText: document.getElementById('lang-text'),
    
    settingsBtn: document.getElementById('settings-btn'),
    profileBtn: document.getElementById('profile-btn'),
    closeSettingsBtn: document.getElementById('close-settings-btn'),
    saveSettingsBtn: document.getElementById('save-settings-btn'),
    settingsModal: document.getElementById('settings-modal'),
    apiKeyInput: document.getElementById('api-key-input'),
    modelSelect: document.getElementById('model-select'),
    loadModelsBtn: document.getElementById('load-models-btn'),
    
    onboardingModal: document.getElementById('onboarding-modal'),
    obProfession: document.getElementById('ob-profession'),
    obLevel: document.getElementById('ob-level'),
    obScenario: document.getElementById('ob-scenario'),
    obFrequency: document.getElementById('ob-frequency'),
    obGoal: document.getElementById('ob-goal'),
    obApiKey: document.getElementById('ob-api-key'),
    finishOnboardingBtn: document.getElementById('finish-onboarding-btn'),
    closeOnboardingBtn: document.getElementById('close-onboarding-btn'),
    
    chatMessages: document.getElementById('chat-messages'),
    messageInput: document.getElementById('message-input'),
    micBtn: document.getElementById('mic-btn'),
    sendBtn: document.getElementById('send-btn')
};

function updateLangUI() {
    if(targetLanguage === 'th') {
         dom.langFlag.textContent = '🇹🇭';
         dom.langText.textContent = 'TH';
         dom.messageInput.placeholder = 'พูดภาษาไทยบางอย่าง...'; // Say something in Thai...
    } else {
         dom.langFlag.textContent = '🇺🇸';
         dom.langText.textContent = 'EN';
         dom.messageInput.placeholder = 'Say something in English...';
    }
}

// --- Initialization ---
function init() {
    updateLangUI();
    setupEventListeners();
    setupSpeechRecognition();
    
    // Force onboarding if first time or if old version lacking "frequency"
    if (!userProfile || !userProfile.frequency) {
        dom.onboardingModal.classList.add('active');
        return;
    }
    
    // If profile exists, render scenarios
    renderScenarios();
    
    if (apiKey) {
        dom.apiKeyInput.value = apiKey;
        dom.modelSelect.value = selectedModel;
    } else {
        openSettings();
    }
}

// --- Event Listeners ---
function setupEventListeners() {
    // Sidebar toggle (Mobile)
    dom.mobileMenuBtn.addEventListener('click', () => dom.sidebar.classList.add('open'));
    dom.closeSidebarBtn.addEventListener('click', () => dom.sidebar.classList.remove('open'));
    
    // Settings Modal
    dom.settingsBtn.addEventListener('click', openSettings);
    dom.closeSettingsBtn.addEventListener('click', closeSettings);
    dom.saveSettingsBtn.addEventListener('click', saveSettings);
    if (dom.loadModelsBtn) {
        dom.loadModelsBtn.addEventListener('click', loadAvailableModels);
    }
    
    // Language Toggle
    if (dom.langToggleBtn) {
        dom.langToggleBtn.addEventListener('click', () => {
            targetLanguage = targetLanguage === 'en' ? 'th' : 'en';
            localStorage.setItem('fluency_target_lang', targetLanguage);
            updateLangUI();
            
            // Clear chat and reset initial welcome
            chatHistory = [];
            dom.chatMessages.innerHTML = `
                <div class="welcome-container">
                    <div class="welcome-icon">
                        <i data-lucide="message-circle"></i>
                    </div>
                    <h2>${targetLanguage === 'th' ? 'ยินดีต้อนรับสู่ Fluency' : 'Welcome to Fluency'}</h2>
                    <p>${targetLanguage === 'th' ? "ฉันชื่อ Emma โค้ชภาษาไทยของคุณ เลือกสถานการณ์ทางด้านซ้ายเพื่อเริ่มต้น!" : "I'm Emma, your English speaking coach. Choose a scenario on the left or type below to start!"}</p>
                </div>
            `;
            lucide.createIcons();
            
            if (speechRecognition) {
                speechRecognition.lang = targetLanguage === 'th' ? 'th-TH' : 'en-US';
            }
        });
    }
    
    // Onboarding
    if (dom.finishOnboardingBtn) {
        dom.finishOnboardingBtn.addEventListener('click', finishOnboarding);
    }
    
    if (dom.profileBtn) {
        dom.profileBtn.addEventListener('click', openProfileEditor);
    }
    
    if (dom.closeOnboardingBtn) {
        dom.closeOnboardingBtn.addEventListener('click', () => {
             dom.onboardingModal.classList.remove('active');
        });
    }
    
    // Voice Input Handling
    if (dom.micBtn) {
        dom.micBtn.addEventListener('click', toggleRecording);
    }
    
    // Input Handling
    dom.messageInput.addEventListener('input', () => {
        // Auto-resize textarea
        dom.messageInput.style.height = 'auto';
        dom.messageInput.style.height = (dom.messageInput.scrollHeight) + 'px';
        // Enable/Disable send button
        dom.sendBtn.disabled = dom.messageInput.value.trim() === '';
    });
    
    dom.messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    dom.sendBtn.addEventListener('click', sendMessage);
}

// --- Settings Logic ---
function openSettings() {
    dom.settingsModal.classList.add('active');
}

function closeSettings() {
    dom.settingsModal.classList.remove('active');
}

function saveSettings() {
    const key = dom.apiKeyInput.value.trim();
    if (key) {
        apiKey = key;
        selectedModel = dom.modelSelect.value || 'gemini-1.5-flash';
        localStorage.setItem('fluency_api_key', apiKey);
        localStorage.setItem('fluency_model', selectedModel);
        closeSettings();
    } else {
        alert("Please enter a valid API Key.");
    }
}

async function loadAvailableModels() {
    const key = dom.apiKeyInput.value.trim() || apiKey;
    if (!key) {
        alert("Please enter your API Key first to fetch models.");
        return;
    }
    
    dom.loadModelsBtn.textContent = 'Loading...';
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        const data = await response.json();
        
        if (data.error) throw new Error(data.error.message);
        
        // Filter for models that support generateContent
        const validModels = data.models.filter(m => 
            m.supportedGenerationMethods && m.supportedGenerationMethods.includes("generateContent") &&
            m.name.includes("gemini")
        );
        
        dom.modelSelect.innerHTML = '';
        validModels.forEach(m => {
            const val = m.name.replace('models/', '');
            const option = document.createElement('option');
            option.value = val;
            option.textContent = val;
            dom.modelSelect.appendChild(option);
        });
        
        // Try to re-select previous
        let attemptSelect = Array.from(dom.modelSelect.options).find(o => o.value === selectedModel);
        if (attemptSelect) {
            dom.modelSelect.value = selectedModel;
        } else if (dom.modelSelect.options.length > 0) {
            dom.modelSelect.selectedIndex = 0;
        }
        
    } catch (err) {
        alert("Failed to load models: " + err.message);
    }
    dom.loadModelsBtn.textContent = 'Load Models';
}

function finishOnboarding() {
    const prof = dom.obProfession.value.trim() || '上班族';
    const lvl = dom.obLevel.options[dom.obLevel.selectedIndex].text;
    const scen = dom.obScenario.value;
    const freq = dom.obFrequency ? dom.obFrequency.options[dom.obFrequency.selectedIndex].text : '每天練習';
    const goal = dom.obGoal.options[dom.obGoal.selectedIndex].text;
    const apik = dom.obApiKey.value.trim();
    
    userProfile = { profession: prof, level: lvl, primaryScenario: scen, frequency: freq, goal: goal };
    localStorage.setItem('fluency_user_profile', JSON.stringify(userProfile));
    
    if (apik) {
        apiKey = apik;
        localStorage.setItem('fluency_api_key', apiKey);
        dom.apiKeyInput.value = apiKey;
    }
    
    dom.onboardingModal.classList.remove('active');
    renderScenarios();
    lucide.createIcons();
    
    if (!apiKey) openSettings();
}

function openProfileEditor() {
    if (userProfile) {
        dom.obProfession.value = userProfile.profession;
        dom.obScenario.value = userProfile.primaryScenario;
        
        // Helper to select option by text
        const setSelectByText = (selectElem, textVal) => {
             if(!selectElem) return;
             for(let i=0; i<selectElem.options.length; i++) {
                  if(selectElem.options[i].text === textVal) {
                       selectElem.selectedIndex = i;
                       break;
                  }
             }
        };
        
        setSelectByText(dom.obLevel, userProfile.level);
        setSelectByText(dom.obFrequency, userProfile.frequency);
        setSelectByText(dom.obGoal, userProfile.goal);
    }
    document.getElementById('onboarding-title').textContent = 'My Profile';
    if(dom.closeOnboardingBtn) dom.closeOnboardingBtn.style.display = 'flex';
    dom.onboardingModal.classList.add('active');
}

// --- Scenario Logic ---
function buildScenarios() {
    if (!userProfile) return [];
    const base = userProfile.primaryScenario;
    if (base === 'Daily Office') {
        return [
            { id: 'daily_standup', title: 'Daily Standup', desc: 'Give updates on your work', icon: 'users' },
            { id: 'water_cooler', title: 'Water Cooler', desc: 'Casual chat in the office', icon: 'coffee' },
            { id: 'ask_help', title: 'Asking for Help', desc: 'Asking a colleague for assistance', icon: 'life-buoy' }
        ];
    } else if (base === 'Business Meeting') {
        return [
            { id: 'project_kickoff', title: 'Project Kickoff', desc: 'Starting a new project', icon: 'rocket' },
            { id: 'client_presentation', title: 'Client Presentation', desc: 'Presenting to a client', icon: 'monitor' },
            { id: 'negotiation', title: 'Negotiation', desc: 'Discussing terms and budget', icon: 'briefcase' }
        ];
    } else if (base === 'Travel') {
        return [
            { id: 'airport_checkin', title: 'Airport Check-in', desc: 'At the airport counter', icon: 'plane' },
            { id: 'hotel_booking', title: 'Hotel Booking', desc: 'Checking into your hotel', icon: 'home' },
            { id: 'restaurant_order', title: 'Ordering Food', desc: 'At a local restaurant', icon: 'utensils' }
        ];
    } else if (base === 'Daily Life') {
        return [
            { id: 'grocery_shopping', title: 'Grocery Shopping', desc: 'Buying food at the supermarket', icon: 'shopping-cart' },
            { id: 'asking_directions', title: 'Asking Directions', desc: 'Finding your way around town', icon: 'map-pin' },
            { id: 'making_friends', title: 'Making Friends', desc: 'Chatting with a new neighbor', icon: 'smile' }
        ];
    } else if (base === 'Outdoor Sports') {
        return [
            { id: 'gym_workout', title: 'Gym Workout', desc: 'Talking to a personal trainer', icon: 'activity' },
            { id: 'hiking_trip', title: 'Hiking Trip', desc: 'Planning a hike with friends', icon: 'sun' },
            { id: 'renting_bike', title: 'Renting Equipment', desc: 'Booking gear for the trail', icon: 'compass' }
        ];
    } else {
        return [
            { id: 'speaking_part1', title: 'Speaking Part 1', desc: 'General topics (IELTS/TOEFL)', icon: 'mic' },
            { id: 'describe_image', title: 'Describe Image', desc: 'Describe a graph or picture', icon: 'image' },
            { id: 'debate', title: 'Express Opinion', desc: 'Debate a specific topic', icon: 'message-square' }
        ];
    }
}

function renderScenarios() {
    const scenarios = buildScenarios();
    dom.scenariosList.innerHTML = '';
    scenarios.forEach(sc => {
        const div = document.createElement('div');
        div.className = `scenario-card ${currentScenario?.id === sc.id ? 'active' : ''}`;
        div.innerHTML = `
            <div class="scenario-icon">
                <i data-lucide="${sc.icon}"></i>
            </div>
            <div class="scenario-info">
                <span class="scenario-title">${sc.title}</span>
                <span class="scenario-desc">${sc.desc}</span>
            </div>
        `;
        div.addEventListener('click', () => selectScenario(sc));
        dom.scenariosList.appendChild(div);
    });
    lucide.createIcons();
    
    // Auto select first
    if (scenarios.length > 0 && !currentScenario) {
        selectScenario(scenarios[0]);
    }
}

function selectScenario(scenario) {
    currentScenario = scenario;
    chatHistory = []; // Reset chat when changing scenario
    renderScenarios(); // Update active state
    dom.sidebar.classList.remove('open'); // Close sidebar on mobile
    
    // Clear chat area
    dom.chatMessages.innerHTML = '';
    
    // System instruction push logically, but we will send it as instruction to Gemini
    
    // Start the conversation
    const promptContext = `We are now starting the scenario: "${scenario.title}" - ${scenario.desc}. Please start the conversation naturally based on this scenario.`;
    generateAIResponse(promptContext, true);
}


// --- Chat UI Logic ---
async function sendMessage() {
    const text = dom.messageInput.value.trim();
    if (!text || !apiKey) {
        if (!apiKey) openSettings();
        return;
    }
    
    // Add User Message
    appendMessage('user', text);
    chatHistory.push({ role: 'user', parts: [{ text }] });
    
    // Clear Input
    dom.messageInput.value = '';
    dom.messageInput.style.height = 'auto';
    dom.sendBtn.disabled = true;
    
    // Fetch AI Response
    await generateAIResponse();
}

function appendMessage(role, text, correction = null, translation = null) {
    const wrapper = document.createElement('div');
    wrapper.className = `message-wrapper ${role}`;
    
    const isUser = role === 'user';
    const avatarIcon = isUser ? 'user' : 'sparkles';
    
    let correctionHtml = '';
    if (correction && correction.hasError) {
        correctionHtml = `
            <div class="correction-block">
                <div class="correction-title">
                    <i data-lucide="info"></i> 語法/用詞建議
                </div>
                <div class="correction-text">${correction.explanation}</div>
            </div>
        `;
    }
    
    let translationHtml = '';
    if (translation) {
        translationHtml = `
            <div class="translation-toggle" style="cursor: pointer; opacity: 0.7; font-size: 0.8rem; margin-top: 8px; display: inline-flex; align-items: center; gap: 4px;">
                <i data-lucide="languages" style="width: 14px; height: 14px;"></i> <span>顯示翻譯</span>
            </div>
            <div class="translation-content" style="display: none; margin-top: 4px; color: var(--text-secondary); font-size: 0.9rem; padding: 8px; background: var(--bg-surface); border-radius: 6px;">
                ${translation}
            </div>
        `;
    }
    
    wrapper.innerHTML = `
        <div class="avatar">
            <i data-lucide="${avatarIcon}"></i>
        </div>
        <div class="message-content-container">
            <div class="message-bubble">
                ${text}
                ${!isUser ? `<button class="play-button" onclick="playVoice(this, \`${text.replace(/`/g, "'").replace(/"/g, "&quot;")}\`)"><i data-lucide="volume-2"></i></button>` : ''}
            </div>
            ${translationHtml}
            ${correctionHtml}
        </div>
    `;
    
    dom.chatMessages.appendChild(wrapper);
    lucide.createIcons({ root: wrapper });
    
    if (translation) {
        const toggleBtn = wrapper.querySelector('.translation-toggle');
        const content = wrapper.querySelector('.translation-content');
        if (toggleBtn && content) {
            toggleBtn.addEventListener('click', () => {
                if (content.style.display === 'none') {
                    content.style.display = 'block';
                    toggleBtn.querySelector('span').textContent = '隱藏翻譯';
                } else {
                    content.style.display = 'none';
                    toggleBtn.querySelector('span').textContent = '顯示翻譯';
                }
                scrollToBottom();
            });
        }
    }
    
    scrollToBottom();
}

function addTypingIndicator() {
    const wrapper = document.createElement('div');
    wrapper.id = 'typing-indicator-wrapper';
    wrapper.className = 'message-wrapper ai';
    wrapper.innerHTML = `
        <div class="avatar"><i data-lucide="sparkles"></i></div>
        <div class="message-content-container">
            <div class="message-bubble">
                <div class="typing-indicator">
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                </div>
            </div>
        </div>
    `;
    dom.chatMessages.appendChild(wrapper);
    lucide.createIcons({ root: wrapper });
    scrollToBottom();
}

function removeTypingIndicator() {
    const indicator = document.getElementById('typing-indicator-wrapper');
    if (indicator) indicator.remove();
}

function scrollToBottom() {
    dom.chatMessages.scrollTop = dom.chatMessages.scrollHeight;
}


// --- Gemini API Logic ---
function getSystemInstruction() {
    if (!userProfile) return '';
    
    if (targetLanguage === 'th') {
        return `你是 Emma，一位友善且有耐心的泰語口語教練。
你的學生是一位「${userProfile.profession}」，目前的泰語程度為「${userProfile.level}」。
學生的練習頻率是「${userProfile.frequency || '隨機'}」，練習目標是「${userProfile.goal}」，主要對話測試場景為「${userProfile.primaryScenario}」。

溝通規則：
1. 全程使用泰文 (Thai) 對話。
2. 語速與詞彙需適應其 ${userProfile.level} 程度。
3. 如果學生之前的話有語法、用詞或時態錯誤，請務必糾正；如果沒錯，則 explanation 留空。
4. 始終保持鼓勵與正面。

回覆格式規定 (JSON)：
- reply (string): 用泰文進行正常的對話回覆。
- translation (string): 附上 reply 的繁體中文翻譯。
- correction.hasError (boolean): 學生有沒有文法、用詞或時態錯誤。
- correction.explanation (string): 糾錯原因需使用 **繁體中文** 解釋。格式建議可參考：指出錯誤點 -> 提供修改建議。`;
    } else {
        return `你是 Emma，一位友善且有耐心的美式英語口語教練。
你的學生是一位「${userProfile.profession}」，目前的英語程度為「${userProfile.level}」。
學生的練習頻率是「${userProfile.frequency || '隨機'}」，練習目標是「${userProfile.goal}」，主要對話測試場景為「${userProfile.primaryScenario}」。

溝通規則：
1. 全程使用美式英語 (American English) 對話。
2. 語速與詞彙需適應其 ${userProfile.level} 程度。
3. 如果學生之前的話有語法、用詞或時態錯誤，請務必糾正；如果沒錯，則 explanation 留空。
4. 始終保持鼓勵與正面。

回覆格式規定 (JSON)：
- reply (string): 用英語進行正常的對話回覆。
- translation (string): 附上 reply 的繁體中文翻譯。
- correction.hasError (boolean): 學生有沒有文法、用詞或時態錯誤。
- correction.explanation (string): 糾錯原因需使用 **繁體中文** 解釋。格式建議可參考：指出錯誤點 -> 提供修改建議。`;
    }
}

async function generateAIResponse(triggerPrompt = null, isInitial = false) {
    if (!apiKey) return;
    
    addTypingIndicator();
    
    const apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`;
    
    // Build Payload
    const contents = [...chatHistory];
    
    if (triggerPrompt) {
        contents.push({ role: 'user', parts: [{ text: triggerPrompt }] });
    }
    
    const payload = {
        systemInstruction: {
            parts: [{ text: getSystemInstruction() }]
        },
        contents: contents,
        generationConfig: {
            temperature: 0.7,
            responseMimeType: "application/json",
            responseSchema: {
                type: "object",
                properties: {
                    reply: {
                        type: "string",
                        description: "Your text reply to the user in the target language. Maintain simple vocabulary and friendly tone."
                    },
                    translation: {
                        type: "string",
                        description: "The highly accurate Traditional Chinese translation of your reply."
                    },
                    correction: {
                        type: "object",
                        properties: {
                            hasError: { type: "boolean", description: "True if the user made a grammar, vocabulary, or tense error in their last message." },
                            explanation: { type: "string", description: "If hasError is true, explain the error and provide the correct way to say it in Traditional Chinese. Keep it encouraging." }
                        },
                        required: ["hasError"]
                    }
                },
                required: ["reply", "translation", "correction"]
            }
        }
    };
    
    try {
        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        removeTypingIndicator();
        
        if (data.error) {
            console.error("Gemini API Error:", data.error);
            if (data.error.message.includes('Quota exceeded') && data.error.message.includes('limit: 0')) {
                 alert(`API Region Error: 您所在地區的 ${selectedModel} 沒有免費額度 (limit: 0)。\n解決方法：\n1. 在設定中將 Model 改為 gemini-1.5-flash 試試看。\n2. 或者開啟 VPN 連線到日本/美國。\n3. 或者在 Google AI Studio 綁定信用卡開啟付費帳號。`);
            } else {
                 alert("API Error: " + data.error.message);
            }
            return;
        }
        
        const responseText = data.candidates[0].content.parts[0].text;
        const result = JSON.parse(responseText);
        
        // Append AI response to UI
        appendMessage('model', result.reply, result.correction, result.translation);
        
        // Play the voice automatically
        playVoice(null, result.reply);
        
        // Save to chat history depending on context
        if (triggerPrompt && isInitial) {
            // For the initial prompt, just feed the AI's actual reply to history so it doesn't see the system trigger as a "user" message literally.
            // Actually, standard behavior requires alternating role: user, model.
            chatHistory.push({ role: 'user', parts: [{ text: triggerPrompt }] });
        }
        chatHistory.push({ role: 'model', parts: [{ text: JSON.stringify(result) }] }); // Storing as JSON string is fine for the model context
        
    } catch (error) {
        removeTypingIndicator();
        console.error("Fetch Error:", error);
        alert("Failed to connect to the API. Check console for details.");
    }
}

// --- Text-to-Speech (TTS) ---
window.playVoice = function(btn, text) {
    if (!text) return;
    
    // Stop any ongoing speech
    window.speechSynthesis.cancel();
    
    // For Thai, use Google Translate TTS as a robust fallback since many OS lack Thai voice packs natively.
    if (targetLanguage === 'th') {
        const chars = Array.from(text);
        const chunks = [];
        let current = "";
        for (let char of chars) {
            if (current.length >= 150 && (char === ' ' || char === '.' || char === '!' || char === '?' || char === '。' || char === '，' || char === ',')) {
                current += char;
                chunks.push(current);
                current = "";
            } else if (current.length >= 180) {
                chunks.push(current);
                current = char;
            } else {
                current += char;
            }
        }
        if (current) chunks.push(current);
        
        let i = 0;
        function playNextChunk() {
            if (i >= chunks.length) return;
            const url = `https://translate.googleapis.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(chunks[i])}&tl=th&client=gtx`;
            const audio = new Audio(url);
            audio.onended = () => {
                i++;
                playNextChunk();
            };
            audio.play().catch(e => {
                 console.log("Audio API failed on chunk:", e);
                 alert(`手機播放限制或失敗（錯誤碼: ${e.message}）。正在切換回內建引擎...`);
                 if (i === 0) playLocalTTS(text); // Only fallback if first chunk fails
            });
        }
        
        playNextChunk();
        return;
    }
    
    playLocalTTS(text);
}

function playLocalTTS(text) {
    const utterance = new SpeechSynthesisUtterance(text);
    
    let currentVoices = window.speechSynthesis.getVoices();
    if (currentVoices.length > 0) {
        synthesisVoices = currentVoices;
    }
    
    let selectedVoice = null;
    if (targetLanguage === 'th') {
        let thVoices = synthesisVoices.filter(v => v.lang.startsWith('th'));
        selectedVoice = thVoices.find(v => v.name.includes('Female')) || thVoices[0] || null;
    } else {
        let usEngVoices = synthesisVoices.filter(v => 
            v.lang === 'en-US' || 
            v.lang === 'en_US' || 
            v.lang.includes('US')
        );
        selectedVoice = usEngVoices.find(v => v.name.includes('Female')) || 
                            usEngVoices.find(v => v.name.includes('Google US English')) || 
                            usEngVoices.find(v => v.name.includes('Zira')) || 
                            usEngVoices.find(v => v.name.includes('Samantha')) || 
                            usEngVoices[0] ||
                            synthesisVoices.filter(v => v.lang.startsWith('en'))[0] || null;
    }
                        
    if (selectedVoice) {
        utterance.voice = selectedVoice;
    }
    
    utterance.lang = targetLanguage === 'th' ? 'th-TH' : 'en-US';
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    
    window.speechSynthesis.speak(utterance);
}

// --- Speech-to-Text (STT) ---
function setupSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
        speechRecognition = new SpeechRecognition();
        speechRecognition.continuous = true;
        speechRecognition.interimResults = true;
        speechRecognition.lang = targetLanguage === 'th' ? 'th-TH' : 'en-US';
        
        speechRecognition.onstart = () => {
            isRecording = true;
            dom.micBtn.classList.add('listening');
        };
        
        speechRecognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';
            
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }
            
            // Append final bits to the current value, and show interim at the end
            // To make this smooth, it's easiest to just overwrite the value cleanly if we rely solely on results
            if (finalTranscript) {
                dom.messageInput.value += (dom.messageInput.value ? ' ' : '') + finalTranscript;
            }
            
            // Trigger auto-resize
            dom.messageInput.style.height = 'auto';
            dom.messageInput.style.height = (dom.messageInput.scrollHeight) + 'px';
            dom.sendBtn.disabled = dom.messageInput.value.trim() === '';
        };
        
        speechRecognition.onerror = (event) => {
            console.error('Speech recognition error', event.error);
            stopRecording();
        };
        
        speechRecognition.onend = () => {
            isRecording = false;
            dom.micBtn.classList.remove('listening');
        };
    } else {
        console.warn('Speech Recognition API not supported in this browser.');
        if (dom.micBtn) dom.micBtn.style.display = 'none';
    }
}

function toggleRecording() {
    if (!speechRecognition) return;
    
    if (isRecording) {
        stopRecording();
    } else {
        startRecording();
    }
}

function startRecording() {
    if (speechRecognition && !isRecording) {
        // clear initial state if needed
        speechRecognition.start();
    }
}

function stopRecording() {
    if (speechRecognition && isRecording) {
        speechRecognition.stop();
    }
}

// Start App
init();
