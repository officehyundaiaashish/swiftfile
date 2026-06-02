// ==========================================
// SWIFT ASSISTANT LOGIC
// ==========================================
let remarksModeActive = false;
let lastRemarksPartName = '';
let lastRemarksNature = '';
let chatHistory = []; // stores {role: 'user'|'assistant', content: '...', timestamp: '...'}
let currentConversationId = null;
let currentAbortController = null;
let isGenerating = false;
let activeTesseractWorker = null;
let attachedFile = null;
let detectedUserLocation = '';
let recognition = null;
let isListening = false;

// Web Search Toggle State: 'off', 'auto', 'on'
let webSearchState = localStorage.getItem('web-search-state') || 'auto';

// Vercel proxy URL - UPDATE THIS after deploying your Vercel project
// Vercel proxy URL - dynamically uses the current domain if hosted on Vercel,
// or falls back to your Vercel deployment URL if hosted on GitHub Pages.
// UPDATE the URL below with your actual Vercel app URL (e.g. https://swiftfile.vercel.app/api/chat).
const VERCEL_PROXY_URL = window.location.hostname.includes('vercel.app')
    ? '/api/chat'
    : 'https://swiftfile.vercel.app/api/chat';

// DOM Element References (cached dynamically)
let assistantSettingsToggleBtn, assistantSettingsPopover, assistantHistoryToggleBtn, assistantHistoryPopover;
let conversationsList, newChatBtn, assistantProvider, assistantModel, assistantEndpoint, assistantEndpointContainer;
let assistantApiKey, assistantConnectBtn, statusDot, statusText, assistantChatLog, assistantInput, assistantSendBtn;
let assistantCloseBtn, assistantNewChatBtn, remarksToggleBtn, remarksInputsContainer, remarksPartName, remarksNature;
let searchWebToggle, searchWebLabel, searchStatusLabel, assistantAttachBtn, assistantFileInput, attachedFilesContainer, assistantVoiceBtn;

function initAssistantUI() {
    assistantSettingsToggleBtn = document.getElementById('assistant-settings-toggle-btn');
    assistantSettingsPopover = document.getElementById('assistant-settings-popover');
    assistantHistoryToggleBtn = document.getElementById('assistant-history-toggle-btn');
    assistantHistoryPopover = document.getElementById('assistant-history-popover');
    conversationsList = document.getElementById('conversations-list');
    newChatBtn = document.getElementById('new-chat-btn');

    assistantProvider = document.getElementById('assistant-provider');
    assistantModel = document.getElementById('assistant-model');
    assistantEndpoint = document.getElementById('assistant-endpoint');
    assistantEndpointContainer = document.getElementById('assistant-endpoint-container');
    assistantApiKey = document.getElementById('assistant-api-key');
    assistantConnectBtn = document.getElementById('assistant-connect-btn');
    statusDot = document.getElementById('status-dot');
    statusText = document.getElementById('status-text');

    assistantChatLog = document.getElementById('assistant-chat-log');
    assistantInput = document.getElementById('assistant-input');
    assistantSendBtn = document.getElementById('assistant-send-btn');
    assistantCloseBtn = document.getElementById('assistant-close-btn');
    assistantNewChatBtn = document.getElementById('assistant-new-chat-btn');

    remarksToggleBtn = document.getElementById('remarks-toggle-btn');
    remarksInputsContainer = document.getElementById('remarks-inputs-container');
    remarksPartName = document.getElementById('remarks-part-name');
    remarksNature = document.getElementById('remarks-nature');

    searchWebToggle = document.getElementById('search-web-toggle');
    searchWebLabel = document.getElementById('search-web-label');
    searchStatusLabel = document.getElementById('search-status-label');

    assistantAttachBtn = document.getElementById('assistant-attach-btn');
    assistantFileInput = document.getElementById('assistant-file-input');
    attachedFilesContainer = document.getElementById('attached-files-container');
    assistantVoiceBtn = document.getElementById('assistant-voice-btn');

    // Bind Event Listeners
    if (assistantCloseBtn) {
        assistantCloseBtn.addEventListener('click', () => {
            document.getElementById('swift-assistant').classList.remove('mobile-fullscreen');
            switchTab(lastActiveTabId);
            if (window.history.state?.panel === 'assistant') {
                window.history.back();
            }
        });
    }

    const activeTitleEl = document.getElementById('active-conversation-title');
    const editConversationTitleBtn = document.getElementById('edit-conversation-title-btn');

    if (activeTitleEl) {
        activeTitleEl.addEventListener('click', renameActiveConversation);
    }
    if (editConversationTitleBtn) {
        editConversationTitleBtn.addEventListener('click', renameActiveConversation);
    }

    if (searchWebToggle) {
        searchWebToggle.addEventListener('click', () => {
            if (webSearchState === 'off') {
                webSearchState = 'auto';
            } else if (webSearchState === 'auto') {
                webSearchState = 'on';
            } else {
                webSearchState = 'off';
            }
            localStorage.setItem('web-search-state', webSearchState);
            updateSearchWebToggleUI();
        });
    }

    // Initial Search Web toggle UI sync
    updateSearchWebToggleUI();

    if (assistantInput) {
        // Auto-grow and scrollbar management for assistant input
        assistantInput.addEventListener('input', () => {
            assistantInput.style.height = 'auto';
            assistantInput.style.height = Math.min(assistantInput.scrollHeight, 200) + 'px';
            if (assistantInput.scrollHeight > assistantInput.clientHeight) {
                assistantInput.style.overflowY = 'auto';
            } else {
                assistantInput.style.overflowY = 'hidden';
            }
        });

        // Trigger send on enter (without shift) - desktop only
        assistantInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey && window.innerWidth > 768) {
                e.preventDefault();
                sendAssistantMessage();
            }
        });
    }

    if (assistantNewChatBtn) {
        assistantNewChatBtn.addEventListener('click', () => {
            chatHistory = [];
            currentConversationId = null;
            renderChatHistory();
            notify('Started new chat.', 'info');
        });
    }

    if (assistantSettingsToggleBtn) {
        assistantSettingsToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (assistantHistoryPopover) assistantHistoryPopover.classList.add('hidden');
            if (assistantSettingsPopover) assistantSettingsPopover.classList.toggle('hidden');
        });
    }

    if (assistantHistoryToggleBtn) {
        assistantHistoryToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (assistantSettingsPopover) assistantSettingsPopover.classList.add('hidden');
            if (assistantHistoryPopover) {
                assistantHistoryPopover.classList.toggle('hidden');
                if (!assistantHistoryPopover.classList.contains('hidden')) {
                    loadConversationsList();
                }
            }
        });
    }

    document.addEventListener('click', (e) => {
        if (assistantSettingsPopover && !assistantSettingsPopover.classList.contains('hidden')) {
            if (!assistantSettingsPopover.contains(e.target) && !assistantSettingsToggleBtn.contains(e.target)) {
                assistantSettingsPopover.classList.add('hidden');
            }
        }
        if (assistantHistoryPopover && !assistantHistoryPopover.classList.contains('hidden')) {
            if (!assistantHistoryPopover.contains(e.target) &&
                !assistantHistoryToggleBtn.contains(e.target) &&
                !e.target.closest('#custom-confirm-modal') &&
                e.target.id !== 'custom-confirm-modal') {
                assistantHistoryPopover.classList.add('hidden');
            }
        }
    });

    if (assistantProvider) {
        assistantProvider.addEventListener('change', () => {
            updateProviderUI();
            localStorage.setItem('assistant-provider', assistantProvider.value);
            loadProviderSettings();
            // Restore connection state for this provider
            const prov = assistantProvider.value;
            if (prov === 'builtin') {
                if (statusDot) statusDot.style.backgroundColor = '#22c55e';
                if (statusText) {
                    statusText.textContent = 'Connected';
                    statusText.style.color = '#22c55e';
                }
            } else {
                const savedState = localStorage.getItem(`assistant-connection-state-${prov}`) || 'disconnected';
                if (savedState === 'connected') {
                    if (statusDot) statusDot.style.backgroundColor = '#22c55e';
                    if (statusText) {
                        statusText.parentElement.style.color = '#22c55e';
                        statusText.textContent = 'Connected';
                    }
                } else {
                    setDisconnectedStatus();
                }
            }
        });

        if (localStorage.getItem('assistant-provider')) {
            assistantProvider.value = localStorage.getItem('assistant-provider');
        }
        loadProviderSettings();
        updateProviderUI();
        restoreVisualConnectionState();
    }

    if (assistantConnectBtn) {
        assistantConnectBtn.addEventListener('click', testApiConnection);
    }

    if (assistantModel) {
        assistantModel.addEventListener('input', () => {
            saveAssistantSettings();
            setDisconnectedStatus();
        });
    }
    if (assistantEndpoint) {
        assistantEndpoint.addEventListener('input', () => {
            saveAssistantSettings();
            setDisconnectedStatus();
        });
    }
    if (assistantApiKey) {
        assistantApiKey.addEventListener('input', () => {
            saveAssistantSettings();
            setDisconnectedStatus();
        });
    }

    if (remarksToggleBtn) {
        remarksToggleBtn.addEventListener('click', () => {
            remarksModeActive = !remarksModeActive;
            const sparklesIcon = remarksToggleBtn.querySelector('[data-lucide="sparkles"]');
            const searchWebToggle = document.getElementById('search-web-toggle');
            if (remarksModeActive) {
                remarksToggleBtn.classList.add('active');
                if (sparklesIcon) sparklesIcon.style.color = '#ffffff';

                if (searchWebToggle) searchWebToggle.style.display = 'none';
                if (assistantNewChatBtn) assistantNewChatBtn.style.display = 'none';
                if (remarksInputsContainer) remarksInputsContainer.style.display = 'flex';
                if (assistantInput && assistantInput.parentNode) assistantInput.parentNode.style.display = 'none';
                if (assistantAttachBtn) assistantAttachBtn.style.display = 'none';
                if (assistantVoiceBtn) assistantVoiceBtn.style.display = 'none';
                if (remarksPartName) remarksPartName.focus();
            } else {
                remarksToggleBtn.classList.remove('active');
                if (sparklesIcon) sparklesIcon.style.color = '#f59e0b';

                if (searchWebToggle) searchWebToggle.style.display = 'inline-flex';
                if (assistantNewChatBtn) assistantNewChatBtn.style.display = 'flex';
                if (remarksInputsContainer) remarksInputsContainer.style.display = 'none';
                if (assistantInput && assistantInput.parentNode) assistantInput.parentNode.style.display = 'block';
                if (assistantAttachBtn) assistantAttachBtn.style.display = 'flex';
                if (assistantVoiceBtn) assistantVoiceBtn.style.display = 'flex';
                if (assistantInput) assistantInput.focus();
            }
            renderChatHistory();
        });
    }

    const remarksRegenerateBtn = document.getElementById('remarks-regenerate-btn');
    if (remarksRegenerateBtn) {
        remarksRegenerateBtn.addEventListener('click', () => {
            if (!lastRemarksPartName) {
                notify('No previous remarks generated to regenerate.', 'warning');
                return;
            }
            if (remarksPartName) remarksPartName.value = lastRemarksPartName;
            if (remarksNature) remarksNature.value = lastRemarksNature;
            sendAssistantMessage();
        });
    }

    if (remarksPartName) {
        remarksPartName.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                sendAssistantMessage();
            }
        });
    }

    if (remarksNature) {
        remarksNature.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                sendAssistantMessage();
            }
        });
    }

    if (assistantSendBtn) {
        assistantSendBtn.addEventListener('click', () => {
            if (isGenerating) {
                abortGeneration();
            } else {
                sendAssistantMessage();
            }
        });
    }

    if (newChatBtn) {
        newChatBtn.addEventListener('click', () => {
            chatHistory = [];
            currentConversationId = null;
            renderChatHistory();
            if (assistantHistoryPopover) assistantHistoryPopover.classList.add('hidden');
            notify('Started new chat.', 'info');
        });
    }

    if (assistantAttachBtn) {
        assistantAttachBtn.addEventListener('click', () => {
            if (assistantFileInput) assistantFileInput.click();
        });
    }

    if (assistantFileInput) {
        assistantFileInput.addEventListener('change', handleFileInputChange);
    }

    setupSpeechRecognition();
    setupCustomProviderDropdown();

    detectUserLocation();
}

window.addEventListener('DOMContentLoaded', initAssistantUI);

function updateSearchWebToggleUI() {
    if (!searchWebToggle || !searchWebLabel) return;
    searchWebToggle.classList.remove('active-on', 'active-auto');
    if (webSearchState === 'on') {
        searchWebToggle.classList.add('active-on');
        searchWebLabel.textContent = 'Search: On';
    } else if (webSearchState === 'auto') {
        searchWebToggle.classList.add('active-auto');
        searchWebLabel.textContent = 'Search: Auto';
    } else {
        searchWebLabel.textContent = 'Search: Off';
    }
}

function updateProviderUI() {
    if (!assistantProvider || !assistantSettingsPopover) return;
    const isBuiltin = assistantProvider.value === 'builtin';
    const settingsFields = assistantSettingsPopover.querySelectorAll(':scope > div:not(:first-child):not(:last-child)');
    settingsFields.forEach(el => el.style.display = isBuiltin ? 'none' : '');
    // Hide connect row for built-in
    const connectRow = assistantSettingsPopover.querySelector(':scope > div:last-child');
    if (connectRow) connectRow.style.display = isBuiltin ? 'none' : '';
    if (isBuiltin) {
        if (statusDot) statusDot.style.backgroundColor = '#22c55e';
        if (statusText) {
            statusText.textContent = 'Connected';
            statusText.style.color = '#22c55e';
        }
    }
    checkEndpointVisibility();
}

function checkEndpointVisibility() {
    if (!assistantProvider || !assistantEndpointContainer) return;
    const prov = assistantProvider.value;
    if (prov === 'custom') {
        assistantEndpointContainer.classList.remove('hidden');
    } else {
        assistantEndpointContainer.classList.add('hidden');
    }
}

function loadProviderSettings() {
    if (!assistantProvider || !assistantModel || !assistantEndpoint || !assistantApiKey) return;
    const prov = assistantProvider.value;
    let defaultModel = 'gemini-1.5-flash';
    let defaultEndpoint = '';

    if (prov === 'builtin') {
        defaultModel = 'llama-3.3-70b-versatile';
    } else if (prov === 'openrouter') {
        defaultModel = 'google/gemini-2.5-flash:free';
    } else if (prov === 'groq') {
        defaultModel = 'llama-3.3-70b-versatile';
    } else if (prov === 'huggingface') {
        defaultModel = 'Qwen/Qwen2.5-Coder-7B-Instruct';
    }

    assistantModel.value = localStorage.getItem(`assistant-model-${prov}`) || localStorage.getItem('assistant-model') || defaultModel;
    assistantEndpoint.value = localStorage.getItem(`assistant-endpoint-${prov}`) || localStorage.getItem('assistant-endpoint') || defaultEndpoint;
    assistantApiKey.value = localStorage.getItem(`assistant-api-key-${prov}`) || localStorage.getItem('assistant-api-key') || '';

    // Clean legacy model keys
    let modelVal = assistantModel.value;
    if (prov === 'groq' && (modelVal.includes('llama3-8b') || modelVal.includes('llama3-70b') || modelVal === 'llama3-8b-8192' || modelVal === 'llama3-70b-8192')) {
        modelVal = 'llama-3.3-70b-versatile';
        assistantModel.value = modelVal;
        localStorage.setItem(`assistant-model-${prov}`, modelVal);
    }
}

function restoreVisualConnectionState() {
    if (!assistantProvider || !statusDot || !statusText) return;
    if (assistantProvider.value === 'builtin') {
        statusDot.style.backgroundColor = '#22c55e';
        statusText.textContent = 'Connected';
        statusText.style.color = '#22c55e';
    } else {
        const prov = assistantProvider.value;
        const savedState = localStorage.getItem(`assistant-connection-state-${prov}`) || localStorage.getItem('assistant-connection-state') || 'disconnected';
        if (savedState === 'connected') {
            statusDot.style.backgroundColor = '#22c55e';
            statusText.parentElement.style.color = '#22c55e';
            statusText.textContent = 'Connected';
        } else {
            statusDot.style.backgroundColor = '#ef4444';
            statusText.parentElement.style.color = '#ef4444';
            statusText.textContent = 'Disconnected';
        }
    }
}

function setDisconnectedStatus() {
    if (statusDot) statusDot.style.backgroundColor = '#ef4444';
    if (statusText) {
        statusText.parentElement.style.color = '#ef4444';
        statusText.textContent = 'Disconnected';
    }
    if (assistantProvider) {
        const prov = assistantProvider.value;
        localStorage.setItem(`assistant-connection-state-${prov}`, 'disconnected');
    }
    localStorage.setItem('assistant-connection-state', 'disconnected');
}

function saveAssistantSettings() {
    if (!assistantProvider || !assistantModel || !assistantEndpoint || !assistantApiKey) return;
    const prov = assistantProvider.value;
    localStorage.setItem('assistant-provider', prov);

    // Save global values (compatibility)
    localStorage.setItem('assistant-model', assistantModel.value);
    localStorage.setItem('assistant-endpoint', assistantEndpoint.value);
    localStorage.setItem('assistant-api-key', assistantApiKey.value);

    // Save provider-specific values
    localStorage.setItem(`assistant-model-${prov}`, assistantModel.value);
    localStorage.setItem(`assistant-endpoint-${prov}`, assistantEndpoint.value);
    localStorage.setItem(`assistant-api-key-${prov}`, assistantApiKey.value);
}

function updateSendButtonState() {
    if (!assistantSendBtn) return;
    if (isGenerating) {
        assistantSendBtn.innerHTML = '<i data-lucide="square" style="width: 18px; height: 18px; fill: white;"></i>';
        assistantSendBtn.classList.remove('btn-pro-ai');
        assistantSendBtn.style.backgroundColor = '#ef4444';
        assistantSendBtn.title = 'Abort response';
    } else {
        assistantSendBtn.innerHTML = '<i data-lucide="send" style="width: 18px; height: 18px;"></i>';
        assistantSendBtn.classList.add('btn-pro-ai');
        assistantSendBtn.style.backgroundColor = '';
        assistantSendBtn.title = 'Send message';
    }
    lucide.createIcons();
}

function abortGeneration() {
    if (currentAbortController) {
        currentAbortController.abort();
        currentAbortController = null;
    }
    if (activeTesseractWorker) {
        try { activeTesseractWorker.terminate(); } catch (e) { }
        activeTesseractWorker = null;
    }
    isGenerating = false;
    updateSendButtonState();
    const thinking = assistantChatLog.querySelector('.thinking');
    if (thinking) thinking.remove();

    // Convert any pending document processing card states to cancelled
    const pendingStatus = assistantChatLog.querySelectorAll('.system-status');
    pendingStatus.forEach(el => {
        if (el.innerHTML.includes('Loading') || el.innerHTML.includes('Running') || el.innerHTML.includes('Extracting')) {
            el.style.background = 'rgba(239, 68, 68, 0.05)';
            el.style.borderColor = 'rgba(239, 68, 68, 0.2)';
            el.innerHTML = `
                <div style="display:flex; align-items:center; gap:8px; font-weight:700; font-size:0.8rem; color:#ef4444;">
                    <i data-lucide="x-circle" style="width:14px; height:14px;"></i>
                    <span>Cancelled</span>
                </div>
                <p style="font-size:0.8rem; margin:4px 0 0 0; color:var(--text-secondary);">Processing was aborted by user.</p>
            `;
            lucide.createIcons({ root: el });
        }
    });

    notify('Generation cancelled.', 'info');
}

async function performOCR(imageDataUrl, signal) {
    try {
        if (signal?.aborted) throw new Error('Aborted');
        const worker = await Tesseract.createWorker('eng');
        activeTesseractWorker = worker;
        if (signal?.aborted) {
            await worker.terminate();
            activeTesseractWorker = null;
            throw new Error('Aborted');
        }
        const ret = await worker.recognize(imageDataUrl);
        await worker.terminate();
        activeTesseractWorker = null;
        return ret.data.text || '';
    } catch (err) {
        if (activeTesseractWorker) {
            try { await activeTesseractWorker.terminate(); } catch (e) { }
            activeTesseractWorker = null;
        }
        if (err.message === 'Aborted') throw err;
        console.error('OCR failed:', err);
        return 'OCR failed to extract text from this image.';
    }
}

async function describeImageWithVision(imageDataUrl, signal) {
    try {
        if (signal?.aborted) return null;
        const base64Data = imageDataUrl.split(',')[1];
        const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

        // Salesforce BLIP Image Captioning - extremely fast, completely free to call without key on public API.
        const response = await fetch('https://api-inference.huggingface.co/models/Salesforce/blip-image-captioning-large', {
            method: 'POST',
            headers: { 'Content-Type': 'application/octet-stream' },
            body: binaryData,
            signal: signal
        });

        if (response.ok) {
            const data = await response.json();
            if (data && data[0] && data[0].generated_text) {
                return data[0].generated_text;
            }
        }
    } catch (err) {
        if (err.name === 'AbortError') {
            console.log('Vision description fetch aborted.');
        } else {
            console.error('Vision API description failed:', err);
        }
    }
    return null;
}

async function extractPdfTextWithOCR(pdfDocument, signal) {
    let extractedText = '';
    try {
        for (let i = 1; i <= pdfDocument.numPages; i++) {
            if (signal?.aborted) throw new Error('Aborted');
            const page = await pdfDocument.getPage(i);
            const viewport = page.getViewport({ scale: 1.5 });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({ canvasContext: context, viewport: viewport }).promise;
            const imgDataUrl = canvas.toDataURL('image/png');
            if (signal?.aborted) throw new Error('Aborted');
            const pageText = await performOCR(imgDataUrl, signal);
            extractedText += `--- Page ${i} (OCR) ---\n${pageText}\n\n`;
        }
    } catch (err) {
        if (err.message === 'Aborted') throw err;
        console.error('PDF OCR failed:', err);
    }
    return extractedText.trim();
}

async function handleAgentTools(responseText, signal) {
    try {
        if (signal?.aborted) return null;
        const jsonRegex = /\{[\s\S]*?"action"\s*:\s*"[^"]*"[\s\S]*?\}/g;
        const match = responseText.match(jsonRegex);
        if (match) {
            if (signal?.aborted) return null;
            const actionObj = JSON.parse(match[0]);
            if (actionObj && actionObj.action) {
                if (actionObj.action === 'switch_tab') {
                    const tabId = actionObj.tab;
                    if (tabId) {
                        switchTab(tabId);
                        notify(`Switched to tab: ${tabId}`, 'info');
                        return {
                            success: true,
                            action: 'switch_tab',
                            param: tabId,
                            result: `Successfully switched active tab to ${tabId}.`
                        };
                    }
                } else if (actionObj.action === 'web_search') {
                    const query = actionObj.query;
                    if (query) {
                        if (signal?.aborted) return null;
                        notify(`Searching: ${query}`, 'info');
                        const searchRes = await searchWeb(query, signal);
                        return {
                            success: true,
                            action: 'web_search',
                            param: query,
                            result: `Web search results for "${query}":\n` + JSON.stringify(searchRes)
                        };
                    }
                } else if (actionObj.action === 'get_active_files') {
                    let fileDetails = 'Active File States:\n';
                    const activeDropZones = document.querySelectorAll('.drop-zone');
                    activeDropZones.forEach(zone => {
                        const parent = zone.closest('.tab-content');
                        if (parent) {
                            const files = zone.querySelectorAll('.preview-item');
                            if (files.length > 0) {
                                fileDetails += `- Tab ${parent.id}: Has ${files.length} loaded files.\n`;
                            }
                        }
                    });
                    return {
                        success: true,
                        action: 'get_active_files',
                        result: fileDetails === 'Active File States:\n' ? 'No files are currently loaded in any drop zones.' : fileDetails
                    };
                }
            }
        }
    } catch (e) {
        console.error('Error executing agent tool:', e);
    }
    return null;
}

async function searchWeb(query, signal) {
    try {
        const searchBase = window.location.hostname.includes('vercel.app')
            ? '/api/search'
            : 'https://swiftfile.vercel.app/api/search';
        const response = await fetch(`${searchBase}?q=${encodeURIComponent(query)}&location=${encodeURIComponent(detectedUserLocation || '')}`, { signal });
        if (!response.ok) throw new Error('Search request failed');
        const results = await response.json();
        return Array.isArray(results) ? results.slice(0, 5) : [];
    } catch (err) {
        if (err.name === 'AbortError') {
            console.log('Search query aborted.');
        } else {
            console.error('Search error:', err);
        }
        return [];
    }
}

async function testApiConnection() {
    const apiKeyVal = assistantApiKey.value.trim();
    const provider = assistantProvider.value;
    const model = assistantModel.value.trim() || 'gemini-1.5-flash';
    let endpoint = assistantEndpoint.value.trim();

    if (!apiKeyVal) {
        notify('Please enter your API Key first.', 'warning');
        return false;
    }

    if (statusDot && statusText) {
        statusDot.style.backgroundColor = '#eab308'; // yellow
        statusText.parentElement.style.color = '#eab308';
        statusText.textContent = 'Connecting...';
    }
    if (assistantConnectBtn) assistantConnectBtn.disabled = true;

    try {
        if (provider === 'gemini') {
            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKeyVal}`;
            const res = await fetch(geminiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: 'ping' }] }] })
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error?.message || `HTTP ${res.status}`);
            }
            const data = await res.json();
            if (!data.candidates?.[0]?.content?.parts?.[0]?.text) throw new Error('Invalid response');
        } else if (provider === 'openrouter' || provider === 'groq' || provider === 'custom') {
            if (provider === 'openrouter' && !endpoint) {
                endpoint = 'https://openrouter.ai/api/v1/chat/completions';
            } else if (provider === 'groq' && !endpoint) {
                endpoint = 'https://api.groq.com/openai/v1/chat/completions';
            }
            if (!endpoint) throw new Error('API endpoint URL is required.');

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKeyVal}`
                },
                body: JSON.stringify({
                    model: model,
                    messages: [{ role: 'user', content: 'ping' }],
                    max_tokens: 5
                })
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error?.message || `HTTP ${res.status}`);
            }
        } else if (provider === 'huggingface') {
            const hfUrl = `https://api-inference.huggingface.co/models/${model}`;
            const res = await fetch(hfUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKeyVal}`
                },
                body: JSON.stringify({ inputs: 'ping' })
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error?.message || errData.error || `HTTP ${res.status}`);
            }
        }

        if (statusDot && statusText) {
            statusDot.style.backgroundColor = '#22c55e'; // green
            statusText.parentElement.style.color = '#22c55e';
            statusText.textContent = 'Connected';
        }
        localStorage.setItem('assistant-connection-state', 'connected');
        localStorage.setItem(`assistant-connection-state-${provider}`, 'connected');
        notify(`Successfully connected to ${model}!`, 'success');
        return true;
    } catch (err) {
        console.error(err);
        if (statusDot && statusText) {
            statusDot.style.backgroundColor = '#ef4444'; // red
            statusText.parentElement.style.color = '#ef4444';
            statusText.textContent = 'Disconnected';
        }
        localStorage.setItem('assistant-connection-state', 'disconnected');
        localStorage.setItem(`assistant-connection-state-${provider}`, 'disconnected');
        notify(`Connection failed: ${err.message}. Check your key or config.`, 'error');
        return false;
    } finally {
        if (assistantConnectBtn) assistantConnectBtn.disabled = false;
    }
}

function escapeHtml(text) {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

window.copyCodeText = function (button) {
    const container = button.closest('.code-block-container');
    const codeEl = container.querySelector('code');
    const codeText = codeEl.textContent;
    navigator.clipboard.writeText(codeText).then(() => {
        const span = button.querySelector('span');
        const svg = button.querySelector('svg');
        const originalText = span.textContent;
        const originalSvg = svg.innerHTML;

        span.textContent = 'Copied!';
        button.style.borderColor = '#10b981';
        button.style.color = '#10b981';
        svg.innerHTML = '<path d="M20 6 9 17l-5-5"/>';

        setTimeout(() => {
            span.textContent = originalText;
            button.style.borderColor = '';
            button.style.color = '';
            svg.innerHTML = originalSvg;
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy code: ', err);
    });
};

function formatMessage(text) {
    let formatted = escapeHtml(text);

    // Format code blocks: ```code```
    const codeBlockRegex = /```([\s\S]*?)```/g;
    formatted = formatted.replace(codeBlockRegex, (match, code) => {
        return `<div class="code-block-container" style="position: relative; margin: 12px 0; border: 1px solid var(--border-color); border-radius: 8px; background: var(--input-bg); overflow: hidden;">
            <pre style="margin: 0; padding: 10px; border: none; border-radius: 0; background: transparent; overflow-x: auto; font-family: monospace; font-size: 0.85rem; user-select: text;"><code style="background: transparent; padding: 0; border-radius: 0; font-family: inherit; font-size: inherit; user-select: inherit;">${code.trim()}</code></pre>
            <div style="display: flex; justify-content: flex-end; padding: 6px 12px; background: rgba(0,0,0,0.03); border-top: 1px solid var(--border-color);">
                <button class="copy-code-btn" onclick="copyCodeText(this)" style="background: var(--surface-color); border: 1px solid var(--border-color); border-radius: 6px; padding: 4px 10px; color: var(--text-primary); cursor: pointer; display: flex; align-items: center; gap: 6px; font-family: inherit; font-size: 0.75rem; font-weight: 600; transition: var(--transition);">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 12px; height: 12px;"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                    <span>Copy</span>
                </button>
            </div>
        </div>`;
    });

    // Format inline code: `code`
    const inlineCodeRegex = /`([^`]+)`/g;
    formatted = formatted.replace(inlineCodeRegex, '<code>$1</code>');

    // Format paragraphs (newlines to br)
    formatted = formatted.split('\n').join('<br>');

    return formatted;
}

function formatMessageTime(isoString) {
    if (!isoString) return '';
    try {
        const date = new Date(isoString);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch (e) {
        return '';
    }
}

function saveCurrentConversation() {
    if (chatHistory.length === 0) return;

    let list = JSON.parse(localStorage.getItem('assistant-conversations') || '[]');

    if (!currentConversationId) {
        currentConversationId = 'conv_' + Date.now();
        let firstUserMsg = chatHistory.find(msg => msg.role === 'user');
        let title = firstUserMsg ? firstUserMsg.content.substring(0, 30) : 'New Chat';
        if (title.length >= 30) title += '...';

        list.unshift({
            id: currentConversationId,
            title: title,
            timestamp: new Date().toISOString(),
            history: chatHistory
        });
    } else {
        const index = list.findIndex(c => c.id === currentConversationId);
        if (index !== -1) {
            list[index].history = chatHistory;
            list[index].timestamp = new Date().toISOString();
            const item = list.splice(index, 1)[0];
            list.unshift(item);
        } else {
            let firstUserMsg = chatHistory.find(msg => msg.role === 'user');
            let title = firstUserMsg ? firstUserMsg.content.substring(0, 30) : 'Chat';
            if (title.length >= 30) title += '...';
            list.unshift({
                id: currentConversationId,
                title: title,
                timestamp: new Date().toISOString(),
                history: chatHistory
            });
        }
    }

    localStorage.setItem('assistant-conversations', JSON.stringify(list));
}

function renameActiveConversation() {
    if (!currentConversationId) {
        notify('No active conversation to rename.', 'warning');
        return;
    }
    let list = JSON.parse(localStorage.getItem('assistant-conversations') || '[]');
    const conv = list.find(c => c.id === currentConversationId);
    if (!conv) return;

    showCustomPrompt('Enter a new title for this conversation:', 'Rename Chat', conv.title || 'New Chat', (newTitle) => {
        if (!newTitle) return;
        newTitle = newTitle.trim();
        if (newTitle.length === 0) return;

        conv.title = newTitle;
        localStorage.setItem('assistant-conversations', JSON.stringify(list));
        const activeTitleEl = document.getElementById('active-conversation-title');
        if (activeTitleEl) activeTitleEl.textContent = newTitle;
        loadConversationsList();
        notify('Conversation renamed.', 'success');
    });
}

function togglePinConversation(id) {
    let list = JSON.parse(localStorage.getItem('assistant-conversations') || '[]');
    const idx = list.findIndex(c => c.id === id);
    if (idx !== -1) {
        list[idx].pinned = !list[idx].pinned;
        localStorage.setItem('assistant-conversations', JSON.stringify(list));
        const savedScrollTop = assistantHistoryPopover ? assistantHistoryPopover.scrollTop : 0;
        loadConversationsList();
        if (assistantHistoryPopover) {
            assistantHistoryPopover.scrollTop = savedScrollTop;
        }
        notify(list[idx].pinned ? 'Chat pinned.' : 'Chat unpinned.', 'success');
    }
}

function loadConversationsList() {
    if (!conversationsList) return;
    conversationsList.innerHTML = '';
    const list = JSON.parse(localStorage.getItem('assistant-conversations') || '[]');

    if (list.length === 0) {
        conversationsList.innerHTML = '<p style="font-size:0.75rem; text-align:center; color:var(--text-secondary); margin: 10px 0;">No saved chats</p>';
        return;
    }

    // Sort pinned first, then by timestamp descending
    list.sort((a, b) => {
        const aPinned = a.pinned ? 1 : 0;
        const bPinned = b.pinned ? 1 : 0;
        if (aPinned !== bPinned) {
            return bPinned - aPinned;
        }
        return new Date(b.timestamp) - new Date(a.timestamp);
    });

    const getGroupLabel = (timestamp) => {
        const date = new Date(timestamp);
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);

        if (date.toDateString() === today.toDateString()) {
            return 'Today';
        } else if (date.toDateString() === yesterday.toDateString()) {
            return 'Yesterday';
        } else {
            return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        }
    };

    let currentGroup = '';

    list.forEach(conv => {
        const groupLabel = getGroupLabel(conv.timestamp);
        if (groupLabel !== currentGroup) {
            currentGroup = groupLabel;
            const header = document.createElement('div');
            header.style.fontSize = '0.7rem';
            header.style.fontWeight = '700';
            header.style.color = 'var(--text-secondary)';
            header.style.textTransform = 'uppercase';
            header.style.letterSpacing = '0.05em';
            header.style.margin = '14px 0 6px 4px';
            header.style.opacity = '0.7';
            header.textContent = groupLabel;
            conversationsList.appendChild(header);
        }

        const item = document.createElement('div');
        item.style.display = 'flex';
        item.style.justifyContent = 'space-between';
        item.style.alignItems = 'center';
        item.style.padding = '6px 8px';
        item.style.borderRadius = '8px';
        item.style.background = conv.id === currentConversationId ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.02)';
        item.style.border = '1px solid var(--border-color)';
        item.style.cursor = 'pointer';
        item.style.transition = 'var(--transition)';
        item.style.marginBottom = '6px';

        const infoDiv = document.createElement('div');
        infoDiv.style.flex = '1';
        infoDiv.style.minWidth = '0';
        infoDiv.style.display = 'flex';
        infoDiv.style.flexDirection = 'column';

        const titleSpan = document.createElement('span');
        titleSpan.style.fontSize = '0.8rem';
        titleSpan.style.fontWeight = '600';
        titleSpan.style.whiteSpace = 'nowrap';
        titleSpan.style.overflow = 'hidden';
        titleSpan.style.textOverflow = 'ellipsis';
        titleSpan.textContent = conv.title || 'Untitled Chat';

        const timeSpan = document.createElement('span');
        timeSpan.style.fontSize = '0.65rem';
        timeSpan.style.color = 'var(--text-secondary)';
        const date = new Date(conv.timestamp);

        // Formatted date and time in 12-hour AM/PM format
        const formattedTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
        timeSpan.textContent = formattedTime;

        infoDiv.appendChild(titleSpan);
        infoDiv.appendChild(timeSpan);

        infoDiv.addEventListener('click', () => {
            chatHistory = conv.history;
            currentConversationId = conv.id;
            renderChatHistory();
            if (typeof remarksModeActive !== 'undefined' && remarksModeActive) {
                const lastBotMsg = [...chatHistory].reverse().find(msg => msg.role === 'assistant');
                if (lastBotMsg && lastBotMsg.content) {
                    populateRemarksFields(lastBotMsg.content);
                } else {
                    for (let i = 1; i <= 4; i++) {
                        const f = document.getElementById(`remark-field-${i}`);
                        if (f) f.value = '';
                    }
                }
            }
            if (assistantHistoryPopover) assistantHistoryPopover.classList.add('hidden');
        });

        const pinBtn = document.createElement('button');
        pinBtn.style.background = 'none';
        pinBtn.style.border = 'none';
        pinBtn.style.cursor = 'pointer';
        pinBtn.style.color = conv.pinned ? '#eab308' : 'var(--text-secondary)';
        pinBtn.style.padding = '4px';
        pinBtn.style.marginRight = '4px';
        pinBtn.style.display = 'flex';
        pinBtn.style.alignItems = 'center';
        pinBtn.style.justifyContent = 'center';
        pinBtn.title = conv.pinned ? 'Unpin Chat' : 'Pin Chat';
        pinBtn.innerHTML = conv.pinned
            ? '<i data-lucide="pin-off" style="width:12px; height:12px;"></i>'
            : '<i data-lucide="pin" style="width:12px; height:12px;"></i>';

        pinBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            togglePinConversation(conv.id);
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.style.background = 'none';
        deleteBtn.style.border = 'none';
        deleteBtn.style.cursor = 'pointer';
        deleteBtn.style.color = '#ef4444';
        deleteBtn.style.padding = '4px';
        deleteBtn.style.display = 'flex';
        deleteBtn.style.alignItems = 'center';
        deleteBtn.style.justifyContent = 'center';
        deleteBtn.innerHTML = '<i data-lucide="trash-2" style="width:12px; height:12px;"></i>';

        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteConversation(conv.id);
        });

        item.appendChild(infoDiv);
        item.appendChild(pinBtn);
        item.appendChild(deleteBtn);
        conversationsList.appendChild(item);
    });

    lucide.createIcons({ attrs: { class: 'lucide-icon' } });
}

function deleteConversation(id) {
    showCustomConfirm('Are you sure you want to delete this conversation? This action cannot be undone.', 'Delete Chat', () => {
        let list = JSON.parse(localStorage.getItem('assistant-conversations') || '[]');
        list = list.filter(c => c.id !== id);
        localStorage.setItem('assistant-conversations', JSON.stringify(list));

        if (currentConversationId === id) {
            chatHistory = [];
            currentConversationId = null;
            renderChatHistory();
        }

        const savedScrollTop = assistantHistoryPopover ? assistantHistoryPopover.scrollTop : 0;
        loadConversationsList();
        if (assistantHistoryPopover) {
            assistantHistoryPopover.scrollTop = savedScrollTop;
        }
        notify('Conversation deleted.', 'info');
    });
}

function isEmailDraft(text) {
    const lower = text.toLowerCase();
    return lower.includes('subject:') || lower.includes('to:') || lower.includes('dear ') || lower.includes('sincerely,') || lower.includes('best regards,');
}

function parseEmailContent(text) {
    const lines = text.split('\n');
    let subject = '';
    let recipient = '';
    let bodyLines = [];
    let isBody = false;

    for (let line of lines) {
        const trimmed = line.trim();
        if (trimmed.toLowerCase().startsWith('subject:')) {
            subject = trimmed.substring(8).trim();
        } else if (trimmed.toLowerCase().startsWith('to:') || trimmed.toLowerCase().startsWith('recipient:')) {
            recipient = trimmed.substring(3).trim();
        } else if (trimmed.toLowerCase().startsWith('body:')) {
            isBody = true;
            bodyLines.push(trimmed.substring(5).trim());
        } else {
            if (isBody) {
                bodyLines.push(line);
            } else if (trimmed.toLowerCase().startsWith('dear') || trimmed.toLowerCase().startsWith('hi ') || trimmed.toLowerCase().startsWith('hello')) {
                isBody = true;
                bodyLines.push(line);
            } else {
                bodyLines.push(line);
            }
        }
    }

    let body = bodyLines.join('\n').trim();
    if (!body) {
        body = text;
    }

    return {
        recipient: recipient,
        subject: subject,
        body: body
    };
}

function createChatBubble(role, content, index, attachment = null, timestamp = null, searchResults = null, isRemarks = false) {
    const bubble = document.createElement('div');
    bubble.className = `assistant-chat-bubble ${role === 'user' ? 'user' : 'bot'}`;
    bubble.dataset.index = index;

    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.marginBottom = '6px';

    const senderLabel = document.createElement('span');
    senderLabel.style.fontWeight = '700';
    senderLabel.style.fontSize = '0.8rem';
    senderLabel.style.color = role === 'user' ? 'var(--accent-color)' : 'var(--text-secondary)';
    senderLabel.innerHTML = role === 'user'
        ? '<i data-lucide="user" style="width:12px;display:inline-block;vertical-align:middle;margin-right:4px;"></i> You'
        : '<img src="logo.png" style="width:14px;height:14px;object-fit:cover;border-radius:3px;display:inline-block;vertical-align:middle;margin-right:4px;"> Swift Assistant';

    header.appendChild(senderLabel);

    // Action container for top-right buttons
    if (role === 'user') {
        const topActions = document.createElement('div');
        topActions.style.display = 'flex';
        topActions.style.gap = '6px';
        topActions.style.alignItems = 'center';

        const editBtn = document.createElement('button');
        editBtn.className = 'chat-bubble-action-btn';
        editBtn.title = 'Edit Prompt';
        editBtn.innerHTML = '<i data-lucide="edit-3"></i>';
        editBtn.addEventListener('click', () => editUserPrompt(index));
        topActions.appendChild(editBtn);
        header.appendChild(topActions);
    }

    const textContainer = document.createElement('div');
    textContainer.style.fontSize = '0.9rem';
    textContainer.style.width = '100%';

    function parseRemarks(text) {
        return text.split('\n')
            .map(line => line.trim())
            .map(line => line.replace(/^(Remark\s*\d+[:\-]?|Remark\s*[:\-]?|\d+[:\.\-]?\s*)/i, '').trim())
            .filter(line => line.length > 0);
    }

    const isRemarksBubble = isRemarks || (typeof remarksModeActive !== 'undefined' && remarksModeActive && index >= chatHistory.length - 2);
    if (role === 'bot' && isRemarksBubble) {
        const remarksList = parseRemarks(content);
        textContainer.style.display = 'flex';
        textContainer.style.flexDirection = 'column';
        textContainer.style.gap = '10px';
        textContainer.style.width = '100%';

        const labels = [
            'Remark 1 (Defect/Failure Description)',
            'Remark 2 (Customer Complaint/Symptom)',
            'Remark 3 (Inspection Defect Confirmation)',
            'Remark 4 (Corrective Action Taken)'
        ];

        labels.forEach((labelText, i) => {
            const fieldDiv = document.createElement('div');
            fieldDiv.style.display = 'flex';
            fieldDiv.style.flexDirection = 'column';
            fieldDiv.style.gap = '4px';
            fieldDiv.style.width = '100%';

            const labelSpan = document.createElement('span');
            labelSpan.style.fontSize = '0.72rem';
            labelSpan.style.color = 'var(--text-secondary)';
            labelSpan.style.fontWeight = '600';
            labelSpan.textContent = labelText;

            const rowDiv = document.createElement('div');
            rowDiv.style.display = 'flex';
            rowDiv.style.gap = '8px';
            rowDiv.style.alignItems = 'center';
            rowDiv.style.width = '100%';

            const textarea = document.createElement('textarea');
            textarea.readOnly = true;
            textarea.value = remarksList[i] || '';
            textarea.style.flex = '1';
            textarea.style.height = '48px';
            textarea.style.fontSize = '0.82rem';
            textarea.style.background = 'var(--input-bg)';
            textarea.style.border = '1px solid var(--border-color)';
            textarea.style.borderRadius = '8px';
            textarea.style.color = 'var(--text-primary)';
            textarea.style.padding = '6px 10px';
            textarea.style.resize = 'none';
            textarea.style.outline = 'none';
            textarea.style.fontFamily = 'inherit';

            const copyBtn = document.createElement('button');
            copyBtn.className = 'remark-copy-btn';
            copyBtn.title = `Copy Remark ${i + 1}`;
            copyBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;

            copyBtn.addEventListener('click', () => {
                copyBotResponse(remarksList[i] || '');
                copyBtn.style.color = 'var(--accent-color)';
                copyBtn.style.borderColor = 'var(--accent-color)';
                setTimeout(() => {
                    copyBtn.style.color = '';
                    copyBtn.style.borderColor = '';
                }, 1000);
            });

            rowDiv.appendChild(textarea);
            rowDiv.appendChild(copyBtn);
            fieldDiv.appendChild(labelSpan);
            fieldDiv.appendChild(rowDiv);
            textContainer.appendChild(fieldDiv);
        });
    } else {
        textContainer.innerHTML = formatMessage(content);
    }

    bubble.appendChild(header);

    // Search Sources UI Dropdown
    if (role === 'bot' && searchResults && searchResults.length > 0) {
        const sourcesContainer = document.createElement('div');
        sourcesContainer.style.marginBottom = '10px';
        sourcesContainer.style.padding = '8px 12px';
        sourcesContainer.style.background = 'var(--input-bg)';
        sourcesContainer.style.border = '1px solid var(--border-color)';
        sourcesContainer.style.borderRadius = '12px';
        sourcesContainer.style.fontSize = '0.8rem';

        const sourcesHeader = document.createElement('div');
        sourcesHeader.style.display = 'flex';
        sourcesHeader.style.justifyContent = 'space-between';
        sourcesHeader.style.alignItems = 'center';
        sourcesHeader.style.cursor = 'pointer';
        sourcesHeader.innerHTML = `
            <div style="display:flex; align-items:center; gap:6px; font-weight:600; color:var(--text-primary);">
                <i data-lucide="search" style="width:12px; height:12px; color:var(--accent-color);"></i>
                Searched the web (${searchResults.length} sources)
            </div>
            <i data-lucide="chevron-down" class="chevron" style="width:14px; height:14px; transition:transform 0.3s; color:var(--text-secondary);"></i>
        `;

        const sourcesList = document.createElement('div');
        sourcesList.style.display = 'none';
        sourcesList.style.flexDirection = 'column';
        sourcesList.style.gap = '6px';
        sourcesList.style.marginTop = '8px';
        sourcesList.style.paddingTop = '8px';
        sourcesList.style.borderTop = '1px dashed var(--border-color)';

        searchResults.forEach((res, i) => {
            const srcLink = document.createElement('a');
            srcLink.href = res.url.startsWith('http') ? res.url : `https://${res.url}`;
            srcLink.target = '_blank';
            srcLink.style.display = 'flex';
            srcLink.style.flexDirection = 'column';
            srcLink.style.textDecoration = 'none';
            srcLink.style.color = 'var(--text-secondary)';
            srcLink.style.padding = '6px 8px';
            srcLink.style.borderRadius = '8px';
            srcLink.style.transition = 'background 0.2s';
            srcLink.onmouseenter = () => srcLink.style.background = 'var(--accent-alpha)';
            srcLink.onmouseleave = () => srcLink.style.background = '';

            srcLink.innerHTML = `
                <span style="font-weight:600; color:var(--accent-color); font-size:0.75rem; display:flex; align-items:center; gap:4px;">
                    <i data-lucide="link" style="width:10px; height:10px;"></i>
                    [${i + 1}] ${res.title}
                </span>
                <span style="font-size:0.7rem; opacity:0.8; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:2px;">${res.url}</span>
            `;
            sourcesList.appendChild(srcLink);
        });

        sourcesHeader.addEventListener('click', () => {
            const isHidden = sourcesList.style.display === 'none';
            sourcesList.style.display = isHidden ? 'flex' : 'none';
            sourcesHeader.querySelector('.chevron').style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
        });

        sourcesContainer.appendChild(sourcesHeader);
        sourcesContainer.appendChild(sourcesList);
        bubble.appendChild(sourcesContainer);
    }

    bubble.appendChild(textContainer);

    // Add attachment preview inside bubble if any
    if (attachment) {
        const attachDiv = document.createElement('div');
        attachDiv.style.marginTop = '8px';
        attachDiv.style.padding = '8px';
        attachDiv.style.borderRadius = '8px';
        attachDiv.style.background = 'rgba(255,255,255,0.04)';
        attachDiv.style.border = '1px solid var(--border-color)';
        attachDiv.style.display = 'inline-flex';
        attachDiv.style.alignItems = 'center';
        attachDiv.style.gap = '8px';

        if (attachment.type.startsWith('image/')) {
            const img = document.createElement('img');
            img.src = attachment.data;
            img.style.maxHeight = '120px';
            img.style.maxWidth = '100%';
            img.style.borderRadius = '6px';
            img.style.objectFit = 'cover';
            attachDiv.appendChild(img);
        } else {
            attachDiv.innerHTML = `
                <i data-lucide="file" style="width:14px; height:14px;"></i>
                <span style="font-size:0.8rem; font-weight:600; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${attachment.name}</span>
            `;
        }
        bubble.appendChild(attachDiv);
    }

    // Footer container for bottom-right elements (time & copy button)
    const footer = document.createElement('div');
    footer.style.display = 'flex';
    footer.style.justifyContent = 'flex-end';
    footer.style.alignItems = 'center';
    footer.style.gap = '8px';
    footer.style.marginTop = '6px';

    const timeSpan = document.createElement('span');
    timeSpan.style.fontSize = '0.65rem';
    timeSpan.style.color = 'var(--text-secondary)';
    timeSpan.style.opacity = '0.6';
    timeSpan.textContent = formatMessageTime(timestamp || new Date().toISOString());
    footer.appendChild(timeSpan);

    // Mail Compose Button if email draft detected
    if (role !== 'user' && isEmailDraft(content)) {
        const mailBtn = document.createElement('button');
        mailBtn.className = 'chat-bubble-action-btn';
        mailBtn.title = 'Open default Mail app';
        mailBtn.style.color = '#ea4335';
        mailBtn.innerHTML = '<i data-lucide="mail"></i>';
        mailBtn.addEventListener('click', () => {
            const parsed = parseEmailContent(content);
            const mailtoUrl = `mailto:${encodeURIComponent(parsed.recipient)}?subject=${encodeURIComponent(parsed.subject)}&body=${encodeURIComponent(parsed.body)}`;
            window.location.href = mailtoUrl;
        });
        footer.appendChild(mailBtn);
    }

    const bottomCopyBtn = document.createElement('button');
    bottomCopyBtn.className = 'chat-bubble-action-btn';
    bottomCopyBtn.title = 'Copy Content';
    bottomCopyBtn.innerHTML = '<i data-lucide="copy"></i>';
    bottomCopyBtn.addEventListener('click', () => copyBotResponse(content));
    footer.appendChild(bottomCopyBtn);

    bubble.appendChild(footer);

    return bubble;
}

function editUserPrompt(index) {
    const userMsg = chatHistory[index];
    if (!userMsg) return;

    // Set input value
    if (assistantInput) {
        assistantInput.value = userMsg.content;
        assistantInput.focus();
    }

    // Restore attached file if any
    if (userMsg.attachment) {
        attachedFile = { ...userMsg.attachment };
        renderAttachedFile();
    } else {
        attachedFile = null;
        renderAttachedFile();
    }

    // Truncate history and chat log to this point
    chatHistory = chatHistory.slice(0, index);
    saveCurrentConversation();
    renderChatHistory();
    notify('Prompt loaded for editing', 'info');
}

async function copyBotResponse(text) {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
        } else {
            // Fallback for mobile / non-secure contexts
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.left = '-9999px';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.focus();
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
        }
        notify('Copied to clipboard ✓', 'success');
    } catch (err) {
        console.error(err);
        notify('Failed to copy.', 'error');
    }
}

window.populateRemarksFields = function (text) {
    const remarksList = [];
    const rawLines = text.split('\n');
    rawLines.forEach(line => {
        const trimmed = line.trim();
        if (trimmed) {
            const cleaned = trimmed.replace(/^(Remark\s*\d+[:\-]?|Remark\s*[:\-]?|\d+[:\.\-]?\s*)/i, '').trim();
            if (cleaned) {
                remarksList.push(cleaned);
            }
        }
    });

    // Limits
    const limits = [
        { min: 80, max: 90 }, // Remark 1
        { min: 30, max: 40 }, // Remark 2
        { min: 30, max: 40 }, // Remark 3
        { min: 30, max: 40 }  // Remark 4
    ];

    const cleanedRemarks = [];
    for (let i = 0; i < 4; i++) {
        let remark = remarksList[i] || '';
        remark = remark.replace(/\s+/g, ' ').trim();
        cleanedRemarks.push(remark);
    }

    for (let i = 1; i <= 4; i++) {
        const f = document.getElementById(`remark-field-${i}`);
        const countSpan = document.getElementById(`remark-count-${i}`);
        const val = cleanedRemarks[i - 1] || '';
        if (f) {
            f.value = val;
        }
        if (countSpan) {
            const limit = limits[i - 1];
            if (val) {
                countSpan.textContent = `${val.length} / ${limit.min}-${limit.max} chars`;
                if (val.length >= limit.min && val.length <= limit.max) {
                    countSpan.style.color = '#10b981'; // Green if correct
                } else {
                    countSpan.style.color = '#ef4444'; // Red if incorrect
                }
            } else {
                countSpan.textContent = `0 / ${limit.min}-${limit.max} chars`;
                countSpan.style.color = 'var(--text-secondary)';
            }
        }
    }
};

window.copyRemarkField = async function (num) {
    const f = document.getElementById(`remark-field-${num}`);
    if (f && f.value && f.value !== 'Generating...' && f.value !== 'Awaiting generation...') {
        await copyBotResponse(f.value);
        const btn = f.nextElementSibling;
        if (btn) {
            btn.style.color = 'var(--accent-color)';
            btn.style.borderColor = 'var(--accent-color)';
            setTimeout(() => {
                btn.style.color = '';
                btn.style.borderColor = '';
            }, 1000);
        }
    }
};

function validateRemarks(text) {
    const remarksList = [];
    const rawLines = text.split('\n');
    rawLines.forEach(line => {
        const trimmed = line.trim();
        if (trimmed) {
            const cleaned = trimmed.replace(/^(Remark\s*\d+[:\-]?|Remark\s*[:\-]?|\d+[:\.\-]?\s*)/i, '').trim();
            if (cleaned) {
                remarksList.push(cleaned);
            }
        }
    });

    if (remarksList.length < 4) {
        return { valid: false, reason: `Generated ${remarksList.length} remarks instead of 4.` };
    }

    const limits = [
        { min: 80, max: 100 }, // Relaxed to 100 for notification/warning popup trigger only
        { min: 30, max: 40 },
        { min: 30, max: 40 },
        { min: 30, max: 40 }
    ];

    const errors = [];
    for (let i = 0; i < 4; i++) {
        const len = remarksList[i].replace(/\s+/g, ' ').trim().length;
        const { min, max } = limits[i];
        if (len < min || len > max) {
            errors.push(`Remark ${i + 1} length is ${len}`);
        }
    }

    if (errors.length > 0) {
        return { valid: false, reason: errors.join(', ') };
    }
    return { valid: true };
}

function renderChatHistory() {
    if (!assistantChatLog) return;
    // Remove all bubbles except system welcome bubble and remarks workspace
    const systemBubble = assistantChatLog.querySelector('.system');
    const remarksWorkspace = document.getElementById('remarks-generator-workspace');
    assistantChatLog.innerHTML = '';
    if (systemBubble) assistantChatLog.appendChild(systemBubble);
    if (remarksWorkspace) assistantChatLog.appendChild(remarksWorkspace);

    const isRemarksMode = typeof remarksModeActive !== 'undefined' && remarksModeActive;
    if (remarksWorkspace) {
        if (isRemarksMode) {
            remarksWorkspace.style.display = 'flex';
            if (systemBubble) systemBubble.style.display = 'none';
        } else {
            remarksWorkspace.style.display = 'none';
            if (systemBubble) systemBubble.style.display = 'block';
        }
    }

    chatHistory.forEach((msg, idx) => {
        if (isRemarksMode) return; // Skip rendering chat bubbles when in remarks generator mode
        // Skip rendering raw JSON tool prompts/triggers and system execution results
        if (msg.content && (msg.content.includes('[SYSTEM TOOL EXECUTION RESULT]') || msg.content.includes('"action":'))) {
            return;
        }
        const bubble = createChatBubble(msg.role, msg.content, idx, msg.attachment, msg.timestamp, msg.searchResults, msg.isRemarks);
        assistantChatLog.appendChild(bubble);
    });
    lucide.createIcons({ attrs: { class: 'lucide-icon' } });
    scrollChatToBottom();

    // Update title and edit button visibility
    const activeTitleEl = document.getElementById('active-conversation-title');
    const editBtn = document.getElementById('edit-conversation-title-btn');
    if (activeTitleEl) {
        if (currentConversationId) {
            let list = JSON.parse(localStorage.getItem('assistant-conversations') || '[]');
            let conv = list.find(c => c.id === currentConversationId);
            if (conv) {
                activeTitleEl.textContent = conv.title || 'Untitled Chat';
                if (editBtn) editBtn.style.display = 'inline-flex';
            } else {
                activeTitleEl.textContent = 'Swift Assistant';
                if (editBtn) editBtn.style.display = 'none';
            }
        } else {
            activeTitleEl.textContent = 'Swift Assistant';
            if (editBtn) editBtn.style.display = 'none';
        }
    }
}

function scrollChatToBottom() {
    if (assistantChatLog) {
        assistantChatLog.scrollTo({
            top: assistantChatLog.scrollHeight,
            behavior: 'smooth'
        });
    }
}

async function detectUserLocation() {
    try {
        const res = await fetch('https://ipapi.co/json/');
        if (res.ok) {
            const data = await res.json();
            if (data && data.city) {
                detectedUserLocation = `${data.city}, ${data.region}, ${data.country_name}`;
            }
        }
    } catch (e) {
        console.log('Location detection failed:', e);
    }
}

async function handleFileInputChange(e) {
    const file = e.target.files[0];
    if (!file) return;

    isGenerating = true;
    updateSendButtonState();
    currentAbortController = new AbortController();
    const signal = currentAbortController.signal;

    if (attachedFilesContainer) {
        attachedFilesContainer.innerHTML = `
            <div style="display:inline-flex; align-items:center; gap:8px; font-size:0.8rem; color:var(--text-secondary);">
                <i data-lucide="loader-2" class="spin" style="width:14px; height:14px; color:var(--accent-color);"></i>
                <span>Processing ${file.name}...</span>
            </div>
        `;
        lucide.createIcons({ root: attachedFilesContainer });
    }

    // Create a gorgeous Claude-style file processing card inside the chat log!
    const processCard = document.createElement('div');
    processCard.className = 'assistant-chat-bubble bot system-status';
    processCard.style.background = 'rgba(37, 99, 235, 0.05)';
    processCard.style.border = '1px dashed var(--accent-border-alpha)';
    processCard.style.borderRadius = '12px';
    processCard.style.padding = '10px 14px';
    processCard.style.margin = '8px 0';
    processCard.style.width = 'fit-content';
    processCard.style.maxWidth = '85%';
    processCard.style.alignSelf = 'flex-start';
    processCard.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px; font-weight:700; font-size:0.8rem; color:var(--accent-color);">
            <i data-lucide="loader-2" class="spin" style="width:14px; height:14px;"></i>
            <span>Loading Document: ${file.name}</span>
        </div>
        <p style="font-size:0.75rem; margin:4px 0 0 0; color:var(--text-secondary);">Reading binary buffer...</p>
    `;
    if (assistantChatLog) {
        assistantChatLog.appendChild(processCard);
        lucide.createIcons({ root: processCard });
        scrollChatToBottom();
    }

    try {
        if (signal.aborted) throw new Error('Aborted');
        const isText = file.type === 'text/plain' || file.name.endsWith('.txt') || file.name.endsWith('.csv') || file.name.endsWith('.json') || file.name.endsWith('.xml') || file.name.endsWith('.md');
        const isPdf = file.name.endsWith('.pdf') || file.type === 'application/pdf';
        const isDocx = file.name.endsWith('.docx');
        const isImage = file.type.startsWith('image/');

        let extractedText = '';
        let fileData = null;

        if (isText) {
            processCard.querySelector('p').textContent = 'Reading plain text stream...';
            extractedText = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                    if (signal.aborted) reject(new Error('Aborted'));
                    else resolve(reader.result);
                };
                reader.onerror = reject;
                reader.readAsText(file);
            });
            if (signal.aborted) throw new Error('Aborted');
            fileData = extractedText;

            processCard.style.background = 'rgba(34, 197, 94, 0.05)';
            processCard.style.borderColor = 'rgba(34, 197, 94, 0.2)';
            processCard.innerHTML = `
                <div style="display:flex; align-items:center; justify-content:space-between; width:100%; gap:20px;">
                    <div style="display:flex; align-items:center; gap:8px; font-weight:700; font-size:0.8rem; color:#22c55e;">
                            <i data-lucide="check-circle" style="width:14px; height:14px;"></i>
                            <span>Text Loaded</span>
                    </div>
                    <span style="font-size:0.65rem; color:var(--text-secondary); opacity:0.6; font-weight:600; text-transform:uppercase;">Local File</span>
                </div>
                <p style="font-size:0.8rem; margin:4px 0 0 0; color:var(--text-secondary);">Successfully loaded text data from <strong>${file.name}</strong> (${extractedText.length} characters).</p>
            `;
            lucide.createIcons({ root: processCard });
        } else if (isPdf) {
            processCard.querySelector('p').textContent = 'Extracting pages from PDF container...';
            const arrayBuffer = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                    if (signal.aborted) reject(new Error('Aborted'));
                    else resolve(reader.result);
                };
                reader.onerror = reject;
                reader.readAsArrayBuffer(file);
            });
            if (signal.aborted) throw new Error('Aborted');
            try {
                const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                let text = '';
                let textContentEmpty = true;
                for (let i = 1; i <= pdf.numPages; i++) {
                    if (signal.aborted) throw new Error('Aborted');
                    processCard.querySelector('p').textContent = `Reading text contents (Page ${i} of ${pdf.numPages})...`;
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map(item => item.str).join(' ');
                    if (pageText.trim().length > 0) textContentEmpty = false;
                    text += `--- Page ${i} ---\n${pageText}\n\n`;
                }

                if (textContentEmpty || text.trim().length < 50) {
                    if (signal.aborted) throw new Error('Aborted');
                    processCard.querySelector('p').textContent = 'Scanned PDF detected. Preparing local WebAssembly OCR...';
                    if (attachedFilesContainer) {
                        attachedFilesContainer.innerHTML = `
                            <div style="display:inline-flex; align-items:center; gap:8px; font-size:0.8rem; color:var(--text-secondary);">
                                <i data-lucide="loader-2" class="spin" style="width:14px; height:14px; color:var(--accent-color);"></i>
                                <span>Running Local OCR & Vision Parser...</span>
                            </div>
                        `;
                        lucide.createIcons({ root: attachedFilesContainer });
                    }
                    extractedText = await extractPdfTextWithOCR(pdf, signal);
                } else {
                    extractedText = text.trim();
                }

                if (signal.aborted) throw new Error('Aborted');
                processCard.style.background = 'rgba(34, 197, 94, 0.05)';
                processCard.style.borderColor = 'rgba(34, 197, 94, 0.2)';
                processCard.innerHTML = `
                    <div style="display:flex; align-items:center; justify-content:space-between; width:100%; gap:20px;">
                        <div style="display:flex; align-items:center; gap:8px; font-weight:700; font-size:0.8rem; color:#22c55e;">
                            <i data-lucide="check-circle" style="width:14px; height:14px;"></i>
                            <span>PDF Parsed</span>
                        </div>
                        <span style="font-size:0.65rem; color:var(--text-secondary); opacity:0.6; font-weight:600; text-transform:uppercase;">Local Parser</span>
                    </div>
                    <p style="font-size:0.8rem; margin:4px 0 0 0; color:var(--text-secondary);">Extracted text from all <strong>${pdf.numPages}</strong> pages of PDF (${extractedText.length} characters).</p>
                `;
                lucide.createIcons({ root: processCard });
            } catch (pdfErr) {
                if (pdfErr.message === 'Aborted') throw pdfErr;
                console.error('PDF parsing error:', pdfErr);
                extractedText = 'Error parsing PDF file content.';
                processCard.style.background = 'rgba(239, 68, 68, 0.05)';
                processCard.style.borderColor = 'rgba(239, 68, 68, 0.2)';
                processCard.innerHTML = `
                    <div style="display:flex; align-items:center; gap:8px; font-weight:700; font-size:0.8rem; color:#ef4444;">
                        <i data-lucide="alert-circle" style="width:14px; height:14px;"></i>
                        <span>PDF Error</span>
                    </div>
                    <p style="font-size:0.8rem; margin:4px 0 0 0; color:var(--text-secondary);">Failed to extract text from PDF document.</p>
                `;
                lucide.createIcons({ root: processCard });
            }
            if (signal.aborted) throw new Error('Aborted');
            fileData = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                    if (signal.aborted) reject(new Error('Aborted'));
                    else resolve(reader.result);
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        } else if (isDocx) {
            processCard.querySelector('p').textContent = 'Decompressing Word document stream...';
            const arrayBuffer = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                    if (signal.aborted) reject(new Error('Aborted'));
                    else resolve(reader.result);
                };
                reader.onerror = reject;
                reader.readAsArrayBuffer(file);
            });
            if (signal.aborted) throw new Error('Aborted');
            try {
                const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
                extractedText = result.value || 'Empty Word document.';

                processCard.style.background = 'rgba(34, 197, 94, 0.05)';
                processCard.style.borderColor = 'rgba(34, 197, 94, 0.2)';
                processCard.innerHTML = `
                    <div style="display:flex; align-items:center; justify-content:space-between; width:100%; gap:20px;">
                        <div style="display:flex; align-items:center; gap:8px; font-weight:700; font-size:0.8rem; color:#22c55e;">
                            <i data-lucide="check-circle" style="width:14px; height:14px;"></i>
                            <span>DOCX Parsed</span>
                        </div>
                        <span style="font-size:0.65rem; color:var(--text-secondary); opacity:0.6; font-weight:600; text-transform:uppercase;">Local Parser</span>
                    </div>
                    <p style="font-size:0.8rem; margin:4px 0 0 0; color:var(--text-secondary);">Extracted document body text from <strong>${file.name}</strong> (${extractedText.length} characters).</p>
                `;
                lucide.createIcons({ root: processCard });
            } catch (docxErr) {
                if (docxErr.message === 'Aborted') throw docxErr;
                console.error('Word document parsing error:', docxErr);
                extractedText = 'Error parsing Word document.';
                processCard.style.background = 'rgba(239, 68, 68, 0.05)';
                processCard.style.borderColor = 'rgba(239, 68, 68, 0.2)';
                processCard.innerHTML = `
                    <div style="display:flex; align-items:center; gap:8px; font-weight:700; font-size:0.8rem; color:#ef4444;">
                        <i data-lucide="alert-circle" style="width:14px; height:14px;"></i>
                        <span>DOCX Error</span>
                    </div>
                    <p style="font-size:0.8rem; margin:4px 0 0 0; color:var(--text-secondary);">Failed to extract text from Word document.</p>
                `;
                lucide.createIcons({ root: processCard });
            }
            if (signal.aborted) throw new Error('Aborted');
            fileData = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                    if (signal.aborted) reject(new Error('Aborted'));
                    else resolve(reader.result);
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        } else if (isImage) {
            processCard.querySelector('p').textContent = 'Reading pixels & running Tesseract OCR + Vision model...';
            fileData = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                    if (signal.aborted) reject(new Error('Aborted'));
                    else resolve(reader.result);
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
            if (signal.aborted) throw new Error('Aborted');
            if (attachedFilesContainer) {
                attachedFilesContainer.innerHTML = `
                    <div style="display:inline-flex; align-items:center; gap:8px; font-size:0.8rem; color:var(--text-secondary);">
                        <i data-lucide="loader-2" class="spin" style="width:14px; height:14px; color:var(--accent-color);"></i>
                        <span>Running Local OCR & Vision Parser...</span>
                    </div>
                `;
                lucide.createIcons({ root: attachedFilesContainer });
            }
            try {
                const [ocrText, visualDescription] = await Promise.all([
                    performOCR(fileData, signal),
                    describeImageWithVision(fileData, signal)
                ]);
                if (signal.aborted) throw new Error('Aborted');

                extractedText = ocrText;
                let finalStatusText = `Extracted text from image pixels using Tesseract engine (${extractedText.length} characters).`;
                if (visualDescription) {
                    extractedText = `[Visual Description: ${visualDescription}]\n\n[Extracted Text via OCR]:\n` + extractedText;
                    finalStatusText = `Vision model described image as "${visualDescription}". ` + finalStatusText;
                }

                processCard.style.background = 'rgba(34, 197, 94, 0.05)';
                processCard.style.borderColor = 'rgba(34, 197, 94, 0.2)';
                processCard.innerHTML = `
                    <div style="display:flex; align-items:center; justify-content:space-between; width:100%; gap:20px;">
                        <div style="display:flex; align-items:center; gap:8px; font-weight:700; font-size:0.8rem; color:#22c55e;">
                            <i data-lucide="check-circle" style="width:14px; height:14px;"></i>
                            <span>Image Parsed (Vision + OCR)</span>
                        </div>
                        <span style="font-size:0.65rem; color:var(--text-secondary); opacity:0.6; font-weight:600; text-transform:uppercase;">Vision Parser</span>
                    </div>
                    <p style="font-size:0.8rem; margin:4px 0 0 0; color:var(--text-secondary);">${finalStatusText}</p>
                `;
                lucide.createIcons({ root: processCard });
            } catch (ocrErr) {
                if (ocrErr.message === 'Aborted') throw ocrErr;
                console.error('OCR error:', ocrErr);
                extractedText = '';
                processCard.style.background = 'rgba(239, 68, 68, 0.05)';
                processCard.style.borderColor = 'rgba(239, 68, 68, 0.2)';
                processCard.innerHTML = `
                    <div style="display:flex; align-items:center; gap:8px; font-weight:700; font-size:0.8rem; color:#ef4444;">
                        <i data-lucide="alert-circle" style="width:14px; height:14px;"></i>
                        <span>OCR Error</span>
                    </div>
                    <p style="font-size:0.8rem; margin:4px 0 0 0; color:var(--text-secondary);">Failed to perform optical character recognition on image.</p>
                `;
                lucide.createIcons({ root: processCard });
            }
        } else {
            processCard.querySelector('p').textContent = 'Attaching file stream...';
            fileData = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                    if (signal.aborted) reject(new Error('Aborted'));
                    else resolve(reader.result);
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
            if (signal.aborted) throw new Error('Aborted');

            processCard.style.background = 'var(--accent-alpha)';
            processCard.style.borderColor = 'var(--accent-border-alpha)';
            processCard.innerHTML = `
                <div style="display:flex; align-items:center; justify-content:space-between; width:100%; gap:20px;">
                    <div style="display:flex; align-items:center; gap:8px; font-weight:700; font-size:0.8rem; color:var(--accent-color);">
                        <i data-lucide="paperclip" style="width:14px; height:14px;"></i>
                        <span>File Attached</span>
                    </div>
                    <span style="font-size:0.65rem; color:var(--text-secondary); opacity:0.6; font-weight:600; text-transform:uppercase;">Attached</span>
                </div>
                <p style="font-size:0.8rem; margin:4px 0 0 0; color:var(--text-secondary);">Attached <strong>${file.name}</strong> as image/media binary payload.</p>
            `;
            lucide.createIcons({ root: processCard });
        }

        if (signal.aborted) throw new Error('Aborted');

        attachedFile = {
            name: file.name,
            type: file.type,
            data: fileData,
            isText: isText || isPdf || isDocx || isImage,
            extractedText: extractedText
        };
        renderAttachedFile();
    } catch (err) {
        console.error('File reading failed:', err);
        attachedFile = null;
        renderAttachedFile();
        if (processCard) {
            processCard.style.background = 'rgba(239, 68, 68, 0.05)';
            processCard.style.borderColor = 'rgba(239, 68, 68, 0.2)';
            processCard.innerHTML = `
                <div style="display:flex; align-items:center; gap:8px; font-weight:700; font-size:0.8rem; color:#ef4444;">
                    <i data-lucide="alert-circle" style="width:14px; height:14px;"></i>
                    <span>${err.message === 'Aborted' ? 'Cancelled' : 'Failed'}</span>
                </div>
                <p style="font-size:0.8rem; margin:4px 0 0 0; color:var(--text-secondary);">${err.message === 'Aborted' ? 'Processing was aborted by user.' : 'Failed to process document.'}</p>
            `;
            lucide.createIcons({ root: processCard });
        }
        notify(err.message === 'Aborted' ? 'File processing cancelled.' : 'Failed to process file.', 'warning');
    } finally {
        isGenerating = false;
        currentAbortController = null;
        updateSendButtonState();
    }
}

function renderAttachedFile() {
    if (!attachedFilesContainer) return;
    attachedFilesContainer.innerHTML = '';
    if (!attachedFile) return;

    const chip = document.createElement('div');
    chip.style.display = 'inline-flex';
    chip.style.alignItems = 'center';
    chip.style.gap = '6px';
    chip.style.background = 'rgba(255, 255, 255, 0.08)';
    chip.style.border = '1px solid var(--border-color)';
    chip.style.padding = '4px 10px';
    chip.style.borderRadius = '12px';
    chip.style.fontSize = '0.8rem';
    chip.style.color = 'var(--text-primary)';

    let iconHtml = '<i data-lucide="file" style="width:12px; height:12px;"></i>';
    if (attachedFile.type.startsWith('image/')) {
        iconHtml = '<i data-lucide="image" style="width:12px; height:12px;"></i>';
    }

    chip.innerHTML = `
        ${iconHtml}
        <span style="max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${attachedFile.name}</span>
        <button type="button" id="remove-attachment-btn" style="background:none; border:none; color:var(--text-secondary); cursor:pointer; padding:0; display:flex; align-items:center; justify-content:center; margin-left:4px;">
            <i data-lucide="x" style="width:12px; height:12px;"></i>
        </button>
    `;

    attachedFilesContainer.appendChild(chip);
    lucide.createIcons({ attrs: { class: 'lucide-icon' } });

    document.getElementById('remove-attachment-btn').addEventListener('click', () => {
        attachedFile = null;
        if (assistantFileInput) assistantFileInput.value = '';
        renderAttachedFile();
    });
}

function setupSpeechRecognition() {
    if (!assistantVoiceBtn) return;
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
            isListening = true;
            assistantVoiceBtn.style.background = 'rgba(239, 68, 68, 0.2)';
            assistantVoiceBtn.style.color = '#ef4444';
            assistantVoiceBtn.style.borderColor = '#ef4444';
            assistantVoiceBtn.innerHTML = '<i data-lucide="mic-off" style="width: 18px; height: 18px;"></i>';
            lucide.createIcons({ attrs: { class: 'lucide-icon' } });
            notify('Listening... speak now', 'info');
        };

        recognition.onend = () => {
            isListening = false;
            assistantVoiceBtn.style.background = '';
            assistantVoiceBtn.style.color = '';
            assistantVoiceBtn.style.borderColor = '';
            assistantVoiceBtn.innerHTML = '<i data-lucide="mic" style="width: 18px; height: 18px;"></i>';
            lucide.createIcons({ attrs: { class: 'lucide-icon' } });
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            if (event.error !== 'no-speech') {
                notify(`Speech recognition error: ${event.error}`, 'error');
            }
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            if (transcript && assistantInput) {
                const currentVal = assistantInput.value;
                assistantInput.value = currentVal ? currentVal + ' ' + transcript : transcript;
                assistantInput.focus();
            }
        };

        assistantVoiceBtn.addEventListener('click', () => {
            if (isListening) {
                recognition.stop();
            } else {
                recognition.start();
            }
        });
    } else {
        assistantVoiceBtn.style.opacity = '0.5';
        assistantVoiceBtn.style.cursor = 'not-allowed';
        assistantVoiceBtn.title = 'Speech recognition not supported';
        assistantVoiceBtn.addEventListener('click', () => {
            notify('Speech recognition is not supported in this browser.', 'warning');
        });
    }
}

function setupCustomProviderDropdown() {
    const customSelect = document.getElementById('custom-provider-select');
    const nativeSelect = document.getElementById('assistant-provider');
    if (customSelect && nativeSelect) {
        const trigger = customSelect.querySelector('.custom-select-trigger');
        const options = customSelect.querySelectorAll('.custom-select-option');
        const triggerLabel = trigger.querySelector('.trigger-label');

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            customSelect.classList.toggle('open');
        });

        options.forEach(opt => {
            opt.addEventListener('click', (e) => {
                e.stopPropagation();
                const val = opt.getAttribute('data-value');
                const label = opt.querySelector('span').textContent;

                // Sync active classes
                options.forEach(o => o.classList.toggle('active', o === opt));

                // Update label
                triggerLabel.textContent = label;

                // Set native select and trigger event
                nativeSelect.value = val;
                nativeSelect.dispatchEvent(new Event('change'));

                // Close dropdown
                customSelect.classList.remove('open');
            });
        });

        // Close when clicking outside
        document.addEventListener('click', () => {
            customSelect.classList.remove('open');
        });

        // Sync initial state if native select is modified externally
        const syncCustomSelect = () => {
            const val = nativeSelect.value;
            const activeOpt = Array.from(options).find(o => o.getAttribute('data-value') === val);
            if (activeOpt) {
                options.forEach(o => o.classList.toggle('active', o === activeOpt));
                triggerLabel.textContent = activeOpt.querySelector('span').textContent;
            }
        };
        nativeSelect.addEventListener('change', syncCustomSelect);
        syncCustomSelect();
    }
}

async function sendAssistantMessage() {
    let prompt = '';
    let isRemarksMode = typeof remarksModeActive !== 'undefined' && remarksModeActive;
    if (isRemarksMode) {
        const partVal = remarksPartName ? remarksPartName.value.trim() : '';
        const natureVal = remarksNature ? remarksNature.value.trim() : '';
        if (!partVal) {
            notify('Please enter a Part Name.', 'warning');
            return;
        }
        lastRemarksPartName = partVal;
        lastRemarksNature = natureVal;
        prompt = `Part Name: ${partVal}\nNature of problem: ${natureVal}`;
    } else {
        prompt = assistantInput.value.trim();
        if (!prompt && !attachedFile) return;
    }

    const isBuiltinProvider = assistantProvider.value === 'builtin';
    const apiKeyVal = assistantApiKey.value.trim();
    if (!isBuiltinProvider && !apiKeyVal) {
        notify('Please enter your API Key in settings first.', 'warning');
        if (assistantSettingsPopover) assistantSettingsPopover.classList.remove('hidden');
        return;
    }

    isGenerating = true;
    if (isRemarksMode) {
        for (let i = 1; i <= 4; i++) {
            const f = document.getElementById(`remark-field-${i}`);
            if (f) f.value = 'Generating...';
            const countSpan = document.getElementById(`remark-count-${i}`);
            if (countSpan) {
                countSpan.textContent = '...';
                countSpan.style.color = 'var(--text-secondary)';
            }
        }
    }
    updateSendButtonState();
    currentAbortController = new AbortController();
    const signal = currentAbortController.signal;

    // Check if search should be performed
    let shouldSearch = false;
    if (!isRemarksMode) {
        if (webSearchState === 'on') {
            shouldSearch = true;
        } else if (webSearchState === 'auto') {
            const searchKeywords = ['weather', 'stock', 'news', 'current', 'latest', 'today', 'who is', 'price of', 'recent', 'google', 'search', 'time in'];
            const promptLower = prompt.toLowerCase();
            shouldSearch = searchKeywords.some(keyword => promptLower.includes(keyword));
        }
    }

    let searchResults = [];
    if (shouldSearch && prompt) {
        if (searchStatusLabel) searchStatusLabel.style.display = 'inline-flex';
        try {
            searchResults = await searchWeb(prompt, signal);
        } catch (se) {
            console.error('Web search error:', se);
        }
        if (searchStatusLabel) searchStatusLabel.style.display = 'none';
    }

    if (signal.aborted || !isGenerating) return;

    // Append user prompt with attachment to history and render
    const currentAttachment = attachedFile ? { ...attachedFile } : null;

    // Reset attachment inputs
    attachedFile = null;
    if (assistantFileInput) assistantFileInput.value = '';
    renderAttachedFile();

    chatHistory.push({
        role: 'user',
        content: prompt,
        attachment: currentAttachment,
        isRemarks: isRemarksMode,
        timestamp: new Date().toISOString()
    });
    saveCurrentConversation();
    renderChatHistory();

    // Clear input box
    if (isRemarksMode) {
        if (remarksPartName) remarksPartName.value = '';
        if (remarksNature) remarksNature.value = '';
    } else {
        if (assistantInput) {
            assistantInput.value = '';
            assistantInput.style.height = 'auto'; // Reset height
        }
    }

    // Add bot thinking state bubble
    const thinkingBubble = document.createElement('div');
    thinkingBubble.className = 'assistant-chat-bubble bot thinking';
    thinkingBubble.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px;">
            <i data-lucide="loader-2" class="spin" style="width:16px; color:var(--accent-color);"></i>
            <span style="font-size:0.85rem; font-weight:600; color:var(--text-secondary);">Thinking...</span>
        </div>
    `;
    if (assistantChatLog) {
        assistantChatLog.appendChild(thinkingBubble);
        lucide.createIcons();
        scrollChatToBottom();
    }

    const provider = assistantProvider.value;
    const model = assistantModel.value.trim() || 'gemini-1.5-flash';
    let endpoint = assistantEndpoint.value.trim();

    let userContextInfo = `Current Local Time: ${new Date().toLocaleString()}\nTimezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`;
    if (detectedUserLocation) {
        userContextInfo += `\nLocation Context: ${detectedUserLocation}`;
    }

    let systemPromptContent = '';
    if (isRemarksMode) {
        systemPromptContent = `You are an automotive warranty claim remark generator for Hyundai dealership.

When I provide only a Part Name, generate 4 warranty claim remarks.

Character Limit Rules (Mandatory):
* Remark 1: 80 to 90 characters
* Remark 2: 30 to 40 characters
* Remark 3: 30 to 40 characters
* Remark 4: 30 to 40 characters

Few-Shot Examples (Follow these exact lengths, spaces count as characters):

Example 1:
Part Name: Front Brake Pads
Nature of problem: Squealing noise when braking
Remark 1: Front brake pads worn down to 2mm metal indicators causing scoring on brake rotors. (83 characters)
Remark 2: Customer reports squealing noise. (33 characters)
Remark 3: Front brake pads found defective. (33 characters)
Remark 4: Replaced front brake pads assembly. (35 characters)

Example 2:
Part Name: Alternator
Nature of problem: Battery warning light on dash
Remark 1: Alternator internal regulator failed resulting in low charging voltage to car battery. (86 characters)
Remark 2: Battery indicator light is on. (30 characters)
Remark 3: The alternator was found defective. (35 characters)
Remark 4: Replaced defective alternator. (30 characters)

Important Rules:
* Very Strictly follow the minimum and maximum character limits.
* Count spaces as characters.
* Generate realistic automotive warranty remarks.
* Use professional workshop and warranty claim language.
* Do not use generic statements.
* Remarks must be logically connected:
  1. Defect in the part.
  2. Customer complaint.
  3. Defective part confirmed during inspection.
  4. Corrective action performed.
* Assume the part is defective and warranty replacement is justified.
* Output only the 4 remarks.
* Do not show character counts.
* Do not add explanations or headings.
* Return the remarks separated by newlines, with each remark on its own line. Do not prefix them with "Remark 1:" or "1." or any indicators. Just return the raw remarks, one per line.`;
    } else {
        systemPromptContent = `You are Swift Assistant, the smart AI companion for Swift File Tools. You help users manage, convert, and edit their PDF and image files.
You have access to some client-side helper tools if navigation or info is needed, but minimize tool use unless directly requested by the user.

- If search results are already provided in the prompt context, use them directly; do NOT invoke the web_search tool block.
- Only invoke the Web Search tool block if you need to query new, dynamic search terms not covered by the current results:
{"action": "web_search", "query": "search query"}

- Optional tools:
{"action": "switch_tab", "tab": "tab-name"} (to switch active tabs when user asks to open or navigate to a tool)
{"action": "get_active_files"} (to count active files when asked about loaded files)

User Environment Context:
${userContextInfo}

CRITICAL RULES:
- Never state "I cannot access real-time information" or "I do not have internet access".`;
    }

    function getAPIPayloadContent(msg) {
        if (msg.isRemarks && msg.role === 'user') {
            let partName = '';
            let natureOfProblem = '';
            const lines = msg.content.split('\n');
            lines.forEach(line => {
                if (line.startsWith('Part Name:')) {
                    partName = line.replace('Part Name:', '').trim();
                } else if (line.startsWith('Nature of problem:')) {
                    natureOfProblem = line.replace('Nature of problem:', '').trim();
                }
            });
            return `You are an automotive warranty claim remark generator for Hyundai dealership.

When I provide only a Part Name, generate 4 warranty claim remarks.

Character Limit Rules (Mandatory):
* Remark 1: 80 to 90 characters
* Remark 2: 30 to 40 characters
* Remark 3: 30 to 40 characters
* Remark 4: 30 to 40 characters

Few-Shot Examples (Follow these exact lengths, spaces count as characters):

Example 1:
Part Name: Front Brake Pads
Nature of problem: Squealing noise when braking
Remark 1: Front brake pads worn down to 2mm metal indicators causing scoring on brake rotors. (83 characters)
Remark 2: Customer reports squealing noise. (33 characters)
Remark 3: Front brake pads found defective. (33 characters)
Remark 4: Replaced front brake pads assembly. (35 characters)

Example 2:
Part Name: Alternator
Nature of problem: Battery warning light on dash
Remark 1: Alternator internal regulator failed resulting in low charging voltage to car battery. (86 characters)
Remark 2: Battery indicator light is on. (30 characters)
Remark 3: The alternator was found defective. (35 characters)
Remark 4: Replaced defective alternator. (30 characters)

Important Rules:
* Strictly follow the minimum and maximum character limits.
* Count spaces as characters.
* Generate realistic automotive warranty remarks.
* Use professional workshop and warranty claim language.
* Do not use generic statements.
* Remarks must be logically connected:
  1. Defect in the part.
  2. Customer complaint.
  3. Defective part confirmed during inspection.
  4. Corrective action performed.
* Assume the part is defective and warranty replacement is justified.
* Output only the 4 remarks.
* Do not show character counts.
* Do not add explanations or headings.

Output Format aLL REMARKS RESPECTIVELY:



Part Name: ${partName}
Nature of problem: ${natureOfProblem}`;
        }
        return msg.content;
    }

    let loopCount = 0;
    const maxLoops = 2;

    try {
        while (loopCount < maxLoops) {
            if (signal.aborted || !isGenerating) break;
            let responseText = '';

            if (provider === 'builtin') {
                const messagesPayload = [
                    { role: 'system', content: systemPromptContent },
                    ...chatHistory.map((msg, idx) => {
                        let content = getAPIPayloadContent(msg);
                        if (idx === chatHistory.length - 1 && msg.role === 'user' && searchResults && searchResults.length > 0) {
                            const contextStr = searchResults.map((r, i) => `[Source ${i + 1}] Title: ${r.title}\nURL: ${r.url}\nSnippet: ${r.snippet}`).join('\n\n');
                            content = `You have access to web search results to answer the user query.
Search Results:
${contextStr}

Instructions:
1. Synthesize the provided search results to summarize a clear, well-mannered, and accurate response.
2. Cite your sources using inline numeric footnotes matching the sources above (e.g. [1](URL) or [2](URL)) right after the statement.
3. Keep the tone helpful, modern, and direct. Do not mention that you did a search or reference these instructions.

User Query: ${content}`;
                        }
                        if (msg.attachment) {
                            if (msg.attachment.extractedText) {
                                return { role: msg.role, content: (content || '') + `\n\n[Content of attached file: ${msg.attachment.name}]\n\n${msg.attachment.extractedText}` };
                            } else if (msg.attachment.isText) {
                                return { role: msg.role, content: (content || '') + `\n\n[Content of attached file: ${msg.attachment.name}]\n\n${msg.attachment.data}` };
                            }
                            return { role: msg.role, content: (content || '') + `\n\n[Attached File: ${msg.attachment.name}]` };
                        }
                        return { role: msg.role, content: content };
                    })
                ];

                const res = await fetch(VERCEL_PROXY_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ messages: messagesPayload }),
                    signal: signal
                });

                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    throw new Error(errData.error || `HTTP ${res.status}`);
                }
                const data = await res.json();
                responseText = data.choices?.[0]?.message?.content || data.response || 'No response generated.';

            } else if (provider === 'gemini') {
                const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKeyVal}`;

                const contentsPayload = chatHistory.map((msg, idx) => {
                    let msgContent = getAPIPayloadContent(msg);
                    if (idx === chatHistory.length - 1 && msg.role === 'user' && searchResults && searchResults.length > 0) {
                        const contextStr = searchResults.map((r, i) => `[Source ${i + 1}] Title: ${r.title}\nURL: ${r.url}\nSnippet: ${r.snippet}`).join('\n\n');
                        msgContent = `You have access to web search results to answer the user query.
Search Results:
${contextStr}

Instructions:
1. Synthesize the provided search results to summarize a clear, well-mannered, and accurate response.
2. Cite your sources using inline numeric footnotes matching the sources above (e.g. [1](URL) or [2](URL)) right after the statement.
3. Keep the tone helpful, modern, and direct. Do not mention that you did a search or reference these instructions.

User Query: ${msgContent}`;
                    }
                    const parts = [{ text: msgContent || 'Attached file details below:' }];
                    if (msg.attachment) {
                        if (msg.attachment.type.startsWith('image/')) {
                            try {
                                const base64Data = msg.attachment.data.split(',')[1];
                                parts.push({
                                    inlineData: {
                                        mimeType: msg.attachment.type,
                                        data: base64Data
                                    }
                                });
                            } catch (e) {
                                console.error('Error parsing attachment base64', e);
                            }
                        } else if (msg.attachment.extractedText) {
                            parts.push({ text: `\n\n[Content of attached file: ${msg.attachment.name}]\n\n${msg.attachment.extractedText}` });
                        } else if (msg.attachment.isText) {
                            parts.push({ text: `\n\n[Content of attached file: ${msg.attachment.name}]\n\n${msg.attachment.data}` });
                        } else {
                            parts.push({ text: `\n\n[Attached File Link: ${msg.attachment.name} (${msg.attachment.type})]` });
                        }
                    }
                    return {
                        role: msg.role === 'user' ? 'user' : 'model',
                        parts: parts
                    };
                });

                const res = await fetch(geminiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: contentsPayload,
                        systemInstruction: { parts: [{ text: systemPromptContent }] }
                    }),
                    signal: signal
                });

                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    throw new Error(errData.error?.message || `HTTP ${res.status}`);
                }
                const data = await res.json();
                responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated.';

            } else if (provider === 'openrouter' || provider === 'groq' || provider === 'custom') {
                if (provider === 'openrouter' && !endpoint) {
                    endpoint = 'https://openrouter.ai/api/v1/chat/completions';
                } else if (provider === 'groq' && !endpoint) {
                    endpoint = 'https://api.groq.com/openai/v1/chat/completions';
                }

                if (!endpoint) throw new Error('API endpoint URL is required.');

                const messagesPayload = [
                    { role: 'system', content: systemPromptContent },
                    ...chatHistory.map((msg, idx) => {
                        let content = getAPIPayloadContent(msg);
                        if (idx === chatHistory.length - 1 && msg.role === 'user' && searchResults && searchResults.length > 0) {
                            const contextStr = searchResults.map((r, i) => `[Source ${i + 1}] Title: ${r.title}\nURL: ${r.url}\nSnippet: ${r.snippet}`).join('\n\n');
                            content = `You have access to web search results to answer the user query.
Search Results:
${contextStr}

Instructions:
1. Synthesize the provided search results to summarize a clear, well-mannered, and accurate response.
2. Cite your sources using inline numeric footnotes matching the sources above (e.g. [1](URL) or [2](URL)) right after the statement.
3. Keep the tone helpful, modern, and direct. Do not mention that you did a search or reference these instructions.

User Query: ${content}`;
                        }
                        if (msg.attachment) {
                            if (msg.attachment.type.startsWith('image/')) {
                                const contentArray = [
                                    { type: 'text', text: content || 'Image attached below:' },
                                    { type: 'image_url', image_url: { url: msg.attachment.data } }
                                ];
                                return {
                                    role: msg.role,
                                    content: contentArray
                                };
                            } else if (msg.attachment.extractedText) {
                                return {
                                    role: msg.role,
                                    content: (content || '') + `\n\n[Content of attached file: ${msg.attachment.name}]\n\n${msg.attachment.extractedText}`
                                };
                            } else if (msg.attachment.isText) {
                                return {
                                    role: msg.role,
                                    content: (content || '') + `\n\n[Content of attached file: ${msg.attachment.name}]\n\n${msg.attachment.data}`
                                };
                            } else {
                                return {
                                    role: msg.role,
                                    content: (content || '') + `\n\n[Attached File Link: ${msg.attachment.name}]`
                                };
                            }
                        }
                        return {
                            role: msg.role,
                            content: content
                        };
                    })
                ];

                const res = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKeyVal}`
                    },
                    body: JSON.stringify({
                        model: model,
                        messages: messagesPayload
                    }),
                    signal: signal
                });

                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    throw new Error(errData.error?.message || `HTTP ${res.status}`);
                }
                const data = await res.json();
                responseText = data.choices?.[0]?.message?.content || 'No response generated.';

            } else if (provider === 'huggingface') {
                const hfUrl = `https://api-inference.huggingface.co/models/${model}`;
                let hfPrompt = `System instructions:\n${systemPromptContent}\n\n`;
                if (searchResults && searchResults.length > 0) {
                    const contextStr = searchResults.map((r, i) => `[Source ${i + 1}] Title: ${r.title}\nURL: ${r.url}\nSnippet: ${r.snippet}`).join('\n\n');
                    const lastMsg = chatHistory[chatHistory.length - 1];
                    const lastMsgContent = lastMsg ? getAPIPayloadContent(lastMsg) : prompt;
                    hfPrompt += `You have access to web search results to answer the user query.
Search Results:
${contextStr}

Instructions:
1. Synthesize the provided search results to summarize a clear, well-mannered, and accurate response.
2. Cite your sources using inline numeric footnotes matching the sources above (e.g. [1](URL) or [2](URL)) right after the statement.
3. Keep the tone helpful, modern, and direct. Do not mention that you did a search or reference these instructions.

User Query: ${lastMsgContent}`;
                } else {
                    const lastMsg = chatHistory[chatHistory.length - 1];
                    const lastMsgContent = lastMsg ? getAPIPayloadContent(lastMsg) : prompt;
                    hfPrompt += `User Query: ${lastMsgContent}`;
                }

                const res = await fetch(hfUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKeyVal}`
                    },
                    body: JSON.stringify({ inputs: hfPrompt }),
                    signal: signal
                });

                if (!res.ok) {
                    throw new Error(`Inference call failed: HTTP ${res.status}`);
                }
                const data = await res.json();
                responseText = Array.isArray(data) ? (data[0]?.generated_text || JSON.stringify(data)) : (data.generated_text || JSON.stringify(data));
            }

            if (signal.aborted || !isGenerating) break;

            // Check for agent tool execution
            let toolRun = await handleAgentTools(responseText, signal);
            if (toolRun && toolRun.success) {
                if (signal.aborted || !isGenerating) break;
                loopCount++;
                // Remove thinking bubble
                thinkingBubble.remove();

                // Create a gorgeous inline tool card to display execution in the chat window (Claude-style)
                const toolCard = document.createElement('div');
                toolCard.className = 'assistant-chat-bubble bot system-status';
                toolCard.style.background = 'rgba(37, 99, 235, 0.03)';
                toolCard.style.border = '1px solid var(--border-color)';
                toolCard.style.borderRadius = '12px';
                toolCard.style.padding = '10px 14px';
                toolCard.style.margin = '8px 0';
                toolCard.style.width = 'fit-content';
                toolCard.style.maxWidth = '85%';
                toolCard.style.alignSelf = 'flex-start';

                let iconName = 'play';
                let actionLabel = 'Executing Action';
                let toolStatusText = 'Completed execution successfully.';

                if (toolRun.action === 'switch_tab') {
                    iconName = 'layout';
                    actionLabel = 'Switched UI Workspace';
                    toolStatusText = `Navigated user layout to <strong>${toolRun.param}</strong> tab.`;
                } else if (toolRun.action === 'web_search') {
                    iconName = 'globe';
                    actionLabel = 'Searched Online Knowledge';
                    toolStatusText = `Queried external web index for: <em>"${toolRun.param}"</em>`;
                } else if (toolRun.action === 'get_active_files') {
                    iconName = 'files';
                    actionLabel = 'Scanned Active Workspaces';
                    toolStatusText = `Audited loaded document counts across tool panels.`;
                }

                toolCard.innerHTML = `
                    <div style="display:flex; align-items:center; justify-content:space-between; width:100%; gap:20px;">
                        <div style="display:flex; align-items:center; gap:8px; font-weight:700; font-size:0.8rem; color:var(--accent-color);">
                            <i data-lucide="${iconName}" style="width:14px; height:14px;"></i>
                            <span>${actionLabel}</span>
                        </div>
                        <span style="font-size:0.65rem; color:#22c55e; font-weight:600; text-transform:uppercase; display:flex; align-items:center; gap:3px;">
                            <i data-lucide="check" style="width:10px; height:10px;"></i> success
                        </span>
                    </div>
                    <p style="font-size:0.8rem; margin:4px 0 0 0; color:var(--text-secondary); line-height: 1.4;">${toolStatusText}</p>
                `;

                if (assistantChatLog) {
                    assistantChatLog.appendChild(toolCard);
                    lucide.createIcons({ root: toolCard });
                }

                // Append assistant tool invocation response
                chatHistory.push({
                    role: 'assistant',
                    content: responseText
                });
                chatHistory.push({
                    role: 'user',
                    content: `[SYSTEM TOOL EXECUTION RESULT]: ${toolRun.result}\nPlease respond to the user based on this result.`
                });

                // Re-add thinking bubble for next iteration
                thinkingBubble.innerHTML = `
                    <div style="display:flex; align-items:center; gap:8px;">
                        <i data-lucide="loader-2" class="spin" style="width:16px; color:var(--accent-color);"></i>
                        <span style="font-size:0.85rem; font-weight:600; color:var(--text-secondary);">Executing tool & thinking...</span>
                    </div>
                `;
                if (assistantChatLog) {
                    assistantChatLog.appendChild(thinkingBubble);
                    lucide.createIcons();
                    scrollChatToBottom();
                }

                // Loop back to fetch new response from model
                continue;
            }

            if (isRemarksMode) {
                const validation = validateRemarks(responseText);
                if (!validation.valid && loopCount < maxLoops - 1) {
                    const approve = await showCustomRegenConfirm(
                        "Character Limit Check Failed",
                        `The generated remarks do not meet the character limits.\n\nIssues:\n${validation.reason.replace(/Remark \d+ length is \d+/g, (m) => m + ' (target: 30-40, except Remark 1 which is 80-90)')}\n\nWould you like the AI to make a second attempt to correct them?`
                    );
                    if (approve) {
                        loopCount++;
                        chatHistory.push({
                            role: 'assistant',
                            content: responseText,
                            isRemarks: true,
                            timestamp: new Date().toISOString()
                        });
                        chatHistory.push({
                            role: 'user',
                            content: `The remarks you generated do not follow the strict character limits. Reason: ${validation.reason}
Please rewrite all 4 remarks to strictly follow the character limit rules:
Remark 1: 80-90 characters
Remark 2: 30-40 characters
Remark 3: 30-40 characters
Remark 4: 30-40 characters
Do not include headings, numbering, or explanation. Output only the 4 raw remarks on separate lines.`,
                            isRemarks: true,
                            timestamp: new Date().toISOString()
                        });

                        // Re-add thinking bubble for next iteration
                        thinkingBubble.innerHTML = `
                            <div style="display:flex; align-items:center; gap:8px;">
                                <i data-lucide="loader-2" class="spin" style="width:16px; color:var(--accent-color);"></i>
                                <span style="font-size:0.85rem; font-weight:600; color:var(--text-secondary);">Correcting character limits (Attempt ${loopCount + 1})...</span>
                            </div>
                        `;
                        lucide.createIcons();
                        scrollChatToBottom();
                        continue;
                    }
                }

                // Clean up correction exchanges from chatHistory to keep history pristine
                let firstUserIndex = -1;
                for (let i = chatHistory.length - 1; i >= 0; i--) {
                    if (chatHistory[i].role === 'user' && chatHistory[i].isRemarks && !chatHistory[i].content.includes('do not follow the strict character limits')) {
                        firstUserIndex = i;
                        break;
                    }
                }
                if (firstUserIndex !== -1) {
                    chatHistory = chatHistory.slice(0, firstUserIndex + 1);
                }
            }

            // Remove thinking bubble
            thinkingBubble.remove();

            // Append assistant final response to history
            chatHistory.push({
                role: 'assistant',
                content: responseText,
                searchResults: searchResults,
                isRemarks: isRemarksMode,
                timestamp: new Date().toISOString()
            });
            saveCurrentConversation();
            renderChatHistory();
            if (isRemarksMode) {
                populateRemarksFields(responseText);
            }
            break;
        }

    } catch (err) {
        if (err.name === 'AbortError') {
            console.log('Generation aborted.');
            return;
        }
        console.error(err);
        thinkingBubble.remove();

        const errorBubble = document.createElement('div');
        errorBubble.className = 'assistant-chat-bubble bot';
        errorBubble.style.borderColor = 'rgba(239, 68, 68, 0.3)';
        errorBubble.style.background = 'rgba(239, 68, 68, 0.05)';
        errorBubble.innerHTML = `
            <p style="color:#ef4444; font-weight:700; font-size:0.85rem; margin-bottom:4px;">API Request Failed</p>
            <p style="font-size:0.85rem; margin-bottom:8px;">Error: ${err.message}. Please check your API key, selected provider, model config, or network connection.</p>
            <button onclick="retryLastAssistantMessage(this)" class="secondary-btn" style="padding:4px 10px; font-size:0.75rem; border-color:#ef4444; color:#ef4444; display:inline-flex; align-items:center; gap:4px; margin-bottom:0; background:transparent; font-weight:600; cursor:pointer;">
                <i data-lucide="rotate-ccw" style="width:12px; height:12px;"></i> Retry Request & Attachment
            </button>
        `;
        if (assistantChatLog) {
            assistantChatLog.appendChild(errorBubble);
            lucide.createIcons({ root: errorBubble });
            scrollChatToBottom();
        }
    } finally {
        isGenerating = false;
        currentAbortController = null;
        updateSendButtonState();
    }
}

window.retryLastAssistantMessage = async function (buttonEl) {
    if (buttonEl) {
        const bubble = buttonEl.closest('.assistant-chat-bubble');
        if (bubble) bubble.remove();
    }

    if (chatHistory.length > 0) {
        const lastMsg = chatHistory[chatHistory.length - 1];
        if (lastMsg.role === 'user') {
            // Pop from history to avoid duplicates
            chatHistory.pop();
            saveCurrentConversation();
            renderChatHistory();

            // Restore text prompt
            if (assistantInput) assistantInput.value = lastMsg.content || '';

            // Restore attachment to run the parser again
            if (lastMsg.attachment) {
                attachedFile = lastMsg.attachment;
                renderAttachedFile();
            }

            // Resend to AI
            await sendAssistantMessage();
        }
    }
};

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// ==========================================
// PWA SERVICE WORKER REGISTRATION
// ==========================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('SW Registered', reg))
            .catch(err => console.error('SW Registration failed', err));
    });
}
