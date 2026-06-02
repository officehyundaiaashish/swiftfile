// --- Global State Variables Initialization ---
let pdfFiles = []; // [File objects]
let pdfPages = []; // [{ id, fileIndex, originalIndex, rendered, canvas, rotation }]
let imageItems = []; // [{ id, file, url, rotation }]
let mergeItems = []; // [{ id, file, rendered, canvas, rotation }]
let splitFiles = [];
let splitPages = []; // [{ id, fileIndex, originalIndex, rendered, rotation }]
let compressFiles = [];
let unlockFile = null;
let protectFile = null;
let compressPages = []; // Global storage for compression pages rotation/state
let compressSettings = { quality: 0.5 }; // Shared settings
let pdfDocCache = {};
let isEstimatingPdf = false;
let estimatePdfTimeout = null;
let wordFile = null;

// Webpage to PDF State
let webpageHtmlContent = '';

// Redact PDF State
let redactFile = null;
let redactDoc = null;
let redactPages = []; // [{ id, pageNum, canvas, rects: [] }]
let redactActiveColor = '#000000';
let isRedactingDrawing = false;
let redactStartPoint = null;
let redactCurrentRect = null;

// Watermark State
let watermarkFile = null;
let watermarkFileType = ''; // 'pdf' or 'image'
let watermarkImgLogo = null; // Image object if image watermark uploaded
let watermarkSelectedPos = 'center';
let watermarkLogoFile = null;
let watermarkLogoImg = null;
let watermarkActiveType = 'text'; // text, image
let watermarkImageObject = null; // Original image element if user uploaded base image
let watermarkPdfDoc = null; // Original PDF document loaded by pdfjsLib
let watermarkPdfFirstPageCanvas = null; // Rendered canvas cache of PDF page 1

// Background Remover State
window.bgOriginalBlob = null;
window.bgProcessedBlob = null;
let bgCustomImg = null;
let bgCropper = null;
let bgCurrentRotation = 0;
let bgCurrentView = 'original'; // 'original' or 'processed'
let bgCurrentType = 'transparent'; // transparent, color, gradient, image
let bgSelectedGradient = null;
let isExtending = false;
let extendPreviewData = null;
let rembgEngine = null;
const apiKey = 'G7T3sbFLnY8q78MsycdKaeJC';

// Compress Image State
let compressImgFiles = [];
let isEstimatingImages = false;
let estimateImgTimeout = null;

// Collage Maker State
let collageItems = [];
let collageLayout = 'grid';
let collageRatio = '1:1';

// Document Scanner State
let openCvReady = false;
let scannerStream = null;
let scannerActive = false;
let scannerCapturedImage = null; // Original full-res canvas
let scannerCroppedImage = null; // Warped canvas
let scannerAnimationId = null;
let isAdjustScreenInit = false;
let currentCropPoints = [
    { x: 0.15, y: 0.15 },
    { x: 0.85, y: 0.15 },
    { x: 0.85, y: 0.85 },
    { x: 0.15, y: 0.85 }
];
let scannerDevices = [];
let currentDeviceIndex = 0;
let currentScannerFilter = 'original'; // original, magic, bw, gray, boost

// Shared Context Menu State
let activeInputTarget = null;


// --- Global Helpers ---
function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = 2;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Theme Management
const themeToggle = document.getElementById('theme-toggle');
const desktopThemeToggle = document.getElementById('desktop-theme-toggle');
const sunIcon = document.getElementById('sun-icon');
const moonIcon = document.getElementById('moon-icon');
const desktopSunIcon = document.getElementById('desktop-sun-icon');
const desktopMoonIcon = document.getElementById('desktop-moon-icon');
const body = document.body;

function updateThemeColorMeta() {
    const isDark = body.classList.contains('dark-theme');
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'theme-color');
        document.head.appendChild(meta);
    }
    meta.setAttribute('content', isDark ? '#1e293b' : '#ffffff');
}

// Load saved theme immediately
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'dark') {
    body.classList.remove('light-theme');
    body.classList.add('dark-theme');
    if (sunIcon) sunIcon.classList.remove('hidden');
    if (moonIcon) moonIcon.classList.add('hidden');
    if (desktopSunIcon) desktopSunIcon.classList.remove('hidden');
    if (desktopMoonIcon) desktopMoonIcon.classList.add('hidden');
}
updateThemeColorMeta();

function toggleTheme() {
    body.classList.toggle('light-theme');
    body.classList.toggle('dark-theme');

    const isDark = body.classList.contains('dark-theme');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');

    if (sunIcon) sunIcon.classList.toggle('hidden');
    if (moonIcon) moonIcon.classList.toggle('hidden');
    if (desktopSunIcon) desktopSunIcon.classList.toggle('hidden');
    if (desktopMoonIcon) desktopMoonIcon.classList.toggle('hidden');

    updateThemeColorMeta();
}

if (themeToggle) themeToggle.addEventListener('click', toggleTheme);
if (desktopThemeToggle) desktopThemeToggle.addEventListener('click', toggleTheme);

// Status Display Toasts
const statusToast = document.getElementById('status-toast');
const statusMessage = document.getElementById('status-message');

function showStatus(message, duration = 0) {
    if (statusMessage && statusToast) {
        statusMessage.textContent = message;
        statusToast.classList.remove('hidden');
        if (duration > 0) setTimeout(hideStatus, duration);
    }
}

function hideStatus() {
    if (statusToast) {
        statusToast.classList.add('hidden');
    }
}

// Custom Notification System
function notify(message, type = 'info', duration = 4000) {
    const container = document.getElementById('notification-container');
    if (!container) return;
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;

    const icons = {
        success: 'check-circle',
        error: 'alert-circle',
        info: 'info'
    };

    notification.innerHTML = `
        <div class="notification-icon">
            <i data-lucide="${icons[type] || 'info'}"></i>
        </div>
        <div class="notification-message">${message}</div>
    `;

    container.appendChild(notification);
    lucide.createIcons({ props: { width: 18, height: 18 }, nameAttr: 'data-lucide', root: notification });

    // Animate in
    setTimeout(() => notification.classList.add('show'), 10);

    // Remove
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 500);
    }, duration);
}

// Base64 helper
function getBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

// Custom Modal Dialogs
function showCustomConfirm(message, title, onConfirm) {
    const existing = document.getElementById('custom-confirm-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'custom-confirm-modal';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100vw';
    modal.style.height = '100vh';
    modal.style.height = '100dvh';
    modal.style.background = 'rgba(0, 0, 0, 0.6)';
    modal.style.backdropFilter = 'blur(8px)';
    modal.style.display = 'flex';
    modal.style.justifyContent = 'center';
    modal.style.alignItems = 'center';
    modal.style.zIndex = '999999';
    modal.style.opacity = '0';
    modal.style.transition = 'opacity 0.2s ease-out';

    const card = document.createElement('div');
    card.style.background = 'var(--surface-color)';
    card.style.border = '1px solid var(--border-color)';
    card.style.borderRadius = '16px';
    card.style.padding = '1.5rem';
    card.style.width = '320px';
    card.style.maxWidth = '90vw';
    card.style.boxShadow = 'var(--shadow)';
    card.style.transform = 'scale(0.9)';
    card.style.transition = 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.gap = '16px';

    card.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
            <div style="background: rgba(239, 68, 68, 0.1); color: #ef4444; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                <i data-lucide="alert-triangle" style="width: 20px; height: 20px;"></i>
            </div>
            <span style="font-weight: 700; font-size: 1.1rem; color: var(--text-primary);">${title || 'Confirm Action'}</span>
        </div>
        <p style="font-size: 0.9rem; color: var(--text-secondary); margin: 0; line-height: 1.5;">${message}</p>
        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 4px;">
            <button id="confirm-cancel-btn" class="secondary-btn" style="margin-bottom:0; padding: 6px 12px; font-size: 0.85rem; border-radius: 8px; cursor: pointer;">Cancel</button>
            <button id="confirm-ok-btn" class="primary-btn" style="margin-bottom:0; padding: 6px 12px; font-size: 0.85rem; border-radius: 8px; background: #ef4444; color: white; border: none; cursor: pointer;">Delete</button>
        </div>
    `;

    modal.appendChild(card);
    document.body.appendChild(modal);
    lucide.createIcons({ root: modal });

    setTimeout(() => {
        modal.style.opacity = '1';
        card.style.transform = 'scale(1)';
    }, 10);

    const closeModal = () => {
        modal.style.opacity = '0';
        card.style.transform = 'scale(0.9)';
        setTimeout(() => {
            modal.remove();
        }, 200);
    };

    modal.querySelector('#confirm-cancel-btn').addEventListener('click', closeModal);
    modal.querySelector('#confirm-ok-btn').addEventListener('click', () => {
        onConfirm();
        closeModal();
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
}

function showCustomPrompt(message, title, defaultValue, onConfirm) {
    const existing = document.getElementById('custom-prompt-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'custom-prompt-modal';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100vw';
    modal.style.height = '100vh';
    modal.style.height = '100dvh';
    modal.style.background = 'rgba(0, 0, 0, 0.6)';
    modal.style.backdropFilter = 'blur(8px)';
    modal.style.display = 'flex';
    modal.style.justifyContent = 'center';
    modal.style.alignItems = 'center';
    modal.style.zIndex = '999999';
    modal.style.opacity = '0';
    modal.style.transition = 'opacity 0.2s ease-out';

    const card = document.createElement('div');
    card.style.background = 'var(--surface-color)';
    card.style.border = '1px solid var(--border-color)';
    card.style.borderRadius = '16px';
    card.style.padding = '1.5rem';
    card.style.width = '320px';
    card.style.maxWidth = '90vw';
    card.style.boxShadow = 'var(--shadow)';
    card.style.transform = 'scale(0.9)';
    card.style.transition = 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.gap = '14px';

    card.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
            <div style="background: var(--accent-alpha); color: var(--accent-color); width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                <i data-lucide="edit" style="width: 20px; height: 20px;"></i>
            </div>
            <span style="font-weight: 700; font-size: 1.1rem; color: var(--text-primary);">${title || 'Enter Value'}</span>
        </div>
        <p style="font-size: 0.9rem; color: var(--text-secondary); margin: 0; line-height: 1.5;">${message}</p>
        <input id="prompt-input" type="text" value="${defaultValue || ''}" style="width: 100%; padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--input-bg); color: var(--text-primary); outline: none; font-family: inherit; font-size: 0.9rem;" />
        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 4px;">
            <button id="prompt-cancel-btn" class="secondary-btn" style="margin-bottom:0; padding: 6px 12px; font-size: 0.85rem; border-radius: 8px; cursor: pointer;">Cancel</button>
            <button id="prompt-ok-btn" class="primary-btn" style="margin-bottom:0; padding: 6px 12px; font-size: 0.85rem; border-radius: 8px; cursor: pointer;">Rename</button>
        </div>
    `;

    modal.appendChild(card);
    document.body.appendChild(modal);
    lucide.createIcons({ root: modal });

    const promptInput = card.querySelector('#prompt-input');
    promptInput.focus();
    promptInput.select();

    setTimeout(() => {
        modal.style.opacity = '1';
        card.style.transform = 'scale(1)';
    }, 10);

    const closeModal = () => {
        modal.style.opacity = '0';
        card.style.transform = 'scale(0.9)';
        setTimeout(() => {
            modal.remove();
        }, 200);
    };

    modal.querySelector('#prompt-cancel-btn').addEventListener('click', closeModal);
    modal.querySelector('#prompt-ok-btn').addEventListener('click', () => {
        onConfirm(promptInput.value);
        closeModal();
    });

    promptInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            onConfirm(promptInput.value);
            closeModal();
        }
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
}

function showCustomRegenConfirm(title, message) {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.id = 'custom-confirm-modal';
        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100vw';
        modal.style.height = '100vh';
        modal.style.background = 'rgba(0, 0, 0, 0.4)';
        modal.style.backdropFilter = 'blur(4px)';
        modal.style.display = 'flex';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        modal.style.zIndex = '999999';
        modal.style.transition = 'opacity 0.2s ease';

        const card = document.createElement('div');
        card.style.background = 'var(--surface-color)';
        card.style.border = '1px solid var(--border-color)';
        card.style.borderRadius = '16px';
        card.style.padding = '20px';
        card.style.width = '90%';
        card.style.maxWidth = '380px';
        card.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)';
        card.style.display = 'flex';
        card.style.flexDirection = 'column';
        card.style.gap = '14px';

        const titleRow = document.createElement('div');
        titleRow.style.display = 'flex';
        titleRow.style.alignItems = 'center';
        titleRow.style.gap = '8px';
        titleRow.style.color = '#ef4444';
        titleRow.style.fontWeight = '700';
        titleRow.style.fontSize = '1.05rem';
        
        titleRow.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <span>${title}</span>
        `;

        const msgBody = document.createElement('div');
        msgBody.style.color = 'var(--text-primary)';
        msgBody.style.fontSize = '0.85rem';
        msgBody.style.lineHeight = '1.45';
        msgBody.style.whiteSpace = 'pre-wrap';
        msgBody.textContent = message;

        const btnRow = document.createElement('div');
        btnRow.style.display = 'flex';
        btnRow.style.justifyContent = 'flex-end';
        btnRow.style.gap = '8px';
        btnRow.style.marginTop = '4px';

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.className = 'secondary-btn';
        cancelBtn.style.padding = '6px 12px';
        cancelBtn.style.fontSize = '0.8rem';
        cancelBtn.style.borderRadius = '6px';
        cancelBtn.style.margin = '0';
        cancelBtn.style.height = '32px';

        const okBtn = document.createElement('button');
        okBtn.textContent = 'Re-generate';
        okBtn.style.padding = '6px 12px';
        okBtn.style.fontSize = '0.8rem';
        okBtn.style.fontWeight = '600';
        okBtn.style.background = '#ef4444';
        okBtn.style.border = 'none';
        okBtn.style.color = '#ffffff';
        okBtn.style.borderRadius = '6px';
        okBtn.style.cursor = 'pointer';
        okBtn.style.height = '32px';
        okBtn.style.display = 'inline-flex';
        okBtn.style.alignItems = 'center';
        okBtn.style.justifyContent = 'center';

        cancelBtn.onclick = () => {
            document.body.removeChild(modal);
            resolve(false);
        };
        okBtn.onclick = () => {
            document.body.removeChild(modal);
            resolve(true);
        };

        btnRow.appendChild(cancelBtn);
        btnRow.appendChild(okBtn);
        card.appendChild(titleRow);
        card.appendChild(msgBody);
        card.appendChild(btnRow);
        modal.appendChild(card);
        document.body.appendChild(modal);
    });
}
