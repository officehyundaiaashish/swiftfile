// ==========================================
// INDEXEDDB WRAPPERS FOR HISTORY
// ==========================================
function initHistoryDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open('SwiftFileHistoryDB', 1);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('conversions')) {
                db.createObjectStore('conversions', { keyPath: 'id', autoIncrement: true });
            }
        };
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = (e) => reject(e.target.error);
    });
}

async function addHistoryItem(item) {
    const db = await initHistoryDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('conversions', 'readwrite');
        const store = tx.objectStore('conversions');
        const addReq = store.add(item);
        addReq.onsuccess = () => {
            db.close();
            resolve();
        };
        addReq.onerror = () => {
            db.close();
            reject(addReq.error);
        };
    });
}

async function getHistoryItems() {
    const db = await initHistoryDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('conversions', 'readonly');
        const store = tx.objectStore('conversions');
        const getReq = store.getAll();
        getReq.onsuccess = () => {
            db.close();
            resolve(getReq.result || []);
        };
        getReq.onerror = () => {
            db.close();
            reject(getReq.error);
        };
    });
}

async function deleteHistoryItem(id) {
    const db = await initHistoryDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('conversions', 'readwrite');
        const store = tx.objectStore('conversions');
        const delReq = store.delete(id);
        delReq.onsuccess = () => {
            db.close();
            resolve();
        };
        delReq.onerror = () => {
            db.close();
            reject(delReq.error);
        };
    });
}

async function clearHistory() {
    const db = await initHistoryDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('conversions', 'readwrite');
        const store = tx.objectStore('conversions');
        const clearReq = store.clear();
        clearReq.onsuccess = () => {
            db.close();
            resolve();
        };
        clearReq.onerror = () => {
            db.close();
            reject(clearReq.error);
        };
    });
}

// ==========================================
// THUMBNAIL GENERATOR HELPERS
// ==========================================
async function getPdfThumbnail(blob) {
    try {
        const arrayBuffer = await blob.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 0.15 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: context, viewport: viewport }).promise;
        return canvas.toDataURL('image/jpeg', 0.7);
    } catch (e) {
        console.error("PDF thumbnail generation failed:", e);
        return null;
    }
}

function getImageThumbnail(blob) {
    return new Promise((resolve) => {
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const maxDim = 80;
            let w = img.width;
            let h = img.height;
            if (w > h) {
                if (w > maxDim) {
                    h = h * (maxDim / w);
                    w = maxDim;
                }
            } else {
                if (h > maxDim) {
                    w = w * (maxDim / h);
                    h = maxDim;
                }
            }
            canvas.width = w;
            canvas.height = h;
            ctx.drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            resolve(null);
        };
        img.src = url;
    });
}

// ==========================================
// CONVERSION TRACKER
// ==========================================
async function recordConversion(filename, blob) {
    try {
        let thumbnail = null;
        if (blob.type.startsWith('image/')) {
            thumbnail = await getImageThumbnail(blob);
        } else if (blob.type === 'application/pdf') {
            thumbnail = await getPdfThumbnail(blob);
        }

        const item = {
            name: filename,
            type: blob.type || 'application/octet-stream',
            size: blob.size,
            timestamp: new Date().toISOString(),
            thumbnail: thumbnail,
            blob: blob
        };

        await addHistoryItem(item);
        if (document.getElementById('history-drawer').classList.contains('open')) {
            renderHistoryList();
        }
    } catch (err) {
        console.error('Failed to record conversion:', err);
    }
}

// ==========================================
// DOWNLOAD INTERCEPTOR (MONKEYPATCH)
// ==========================================
const originalClick = HTMLAnchorElement.prototype.click;
HTMLAnchorElement.prototype.click = function () {
    if (this.download && this.href) {
        const filename = this.download;
        const href = this.href;
        if (href.startsWith('blob:') || href.startsWith('data:')) {
            fetch(href)
                .then(res => res.blob())
                .then(blob => {
                    recordConversion(filename, blob);
                })
                .catch(err => console.error("Interception error:", err));
        }
    }
    return originalClick.apply(this, arguments);
};

// ==========================================
// HISTORY UI DRAWER & EVENT HANDLERS
// ==========================================
let historyBtn, historyDrawer, historyOverlay, closeHistoryBtn, clearAllHistoryBtn, historyDrawerContent, historyCount;
let itemToDeleteId = null;

function openDeleteItemDialog(id, name) {
    itemToDeleteId = id;
    const deleteDialog = document.getElementById('history-delete-dialog');
    const desc = document.getElementById('delete-dialog-desc');
    if (desc) {
        desc.textContent = `Are you sure you want to delete "${name}"? This action cannot be undone.`;
    }
    if (deleteDialog) {
        deleteDialog.classList.add('open');
    }
}

function initHistoryUI() {
    historyBtn = document.getElementById('history-btn');
    const desktopHistoryBtn = document.getElementById('desktop-history-btn');
    historyDrawer = document.getElementById('history-drawer');
    historyOverlay = document.getElementById('history-overlay');
    closeHistoryBtn = document.getElementById('close-history-btn');
    clearAllHistoryBtn = document.getElementById('clear-all-history-btn');
    historyDrawerContent = document.getElementById('history-drawer-content');
    historyCount = document.getElementById('history-count');

    if (historyBtn) {
        historyBtn.addEventListener('click', openHistoryDrawer);
    }
    if (desktopHistoryBtn) {
        desktopHistoryBtn.addEventListener('click', openHistoryDrawer);
    }
    if (closeHistoryBtn) closeHistoryBtn.addEventListener('click', closeHistoryDrawer);
    if (historyOverlay) historyOverlay.addEventListener('click', closeHistoryDrawer);

    if (clearAllHistoryBtn) {
        clearAllHistoryBtn.addEventListener('click', () => {
            const clearDialog = document.getElementById('history-clear-dialog');
            if (clearDialog) clearDialog.classList.add('open');
        });
    }

    const confirmClearBtn = document.getElementById('confirm-clear-btn');
    const cancelClearBtn = document.getElementById('cancel-clear-btn');
    if (confirmClearBtn) {
        confirmClearBtn.addEventListener('click', async () => {
            await clearHistory();
            renderHistoryList();
            const clearDialog = document.getElementById('history-clear-dialog');
            if (clearDialog) clearDialog.classList.remove('open');
            notify("History cleared successfully.", "success");
        });
    }
    if (cancelClearBtn) {
        cancelClearBtn.addEventListener('click', () => {
            const clearDialog = document.getElementById('history-clear-dialog');
            if (clearDialog) clearDialog.classList.remove('open');
        });
    }

    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', async () => {
            if (itemToDeleteId !== null) {
                await deleteHistoryItem(itemToDeleteId);
                renderHistoryList();
                const deleteDialog = document.getElementById('history-delete-dialog');
                if (deleteDialog) deleteDialog.classList.remove('open');
                itemToDeleteId = null;
                notify("File deleted from history.", "success");
            }
        });
    }
    if (cancelDeleteBtn) {
        cancelDeleteBtn.addEventListener('click', () => {
            const deleteDialog = document.getElementById('history-delete-dialog');
            if (deleteDialog) deleteDialog.classList.remove('open');
            itemToDeleteId = null;
        });
    }
}

window.addEventListener('DOMContentLoaded', initHistoryUI);

function openHistoryDrawer() {
    if (historyDrawer && historyOverlay) {
        historyDrawer.classList.add('open');
        historyOverlay.classList.add('open');
        document.body.style.overflow = 'hidden'; // Lock background scrolling
        if (window.history.state?.panel !== 'history') {
            window.history.pushState({ panel: 'history' }, '');
        }
        renderHistoryList();
    }
}

function closeHistoryDrawer() {
    if (historyDrawer && historyOverlay) {
        historyDrawer.classList.remove('open');
        historyOverlay.classList.remove('open');
        const clearDialog = document.getElementById('history-clear-dialog');
        if (clearDialog) clearDialog.classList.remove('open');
        const deleteDialog = document.getElementById('history-delete-dialog');
        if (deleteDialog) deleteDialog.classList.remove('open');
        document.body.style.overflow = ''; // Unlock background scrolling
        if (window.history.state?.panel === 'history') {
            window.history.back();
        }
    }
}

function formatHistoryBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

async function renderHistoryList() {
    historyDrawerContent.innerHTML = '';
    const items = await getHistoryItems();

    // Sort descending by timestamp
    items.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    historyCount.textContent = `${items.length} item${items.length === 1 ? '' : 's'}`;

    if (items.length === 0) {
        historyDrawerContent.innerHTML = `
            <div class="history-empty-state">
                <i data-lucide="history"></i>
                <h3 style="font-weight: 700;">No history yet</h3>
                <p style="font-size: 0.85rem; max-width: 250px;">Conversions you make on this device will appear here with previews and easy access.</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    items.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'history-item';

        // Setup preview thumbnail
        let thumbnailHtml = '';
        let typeLabel = 'File';

        if (item.thumbnail) {
            thumbnailHtml = `<img src="${item.thumbnail}" alt="${item.name}">`;
        }

        if (item.type === 'application/pdf') {
            if (!thumbnailHtml) thumbnailHtml = `<i data-lucide="file-text"></i>`;
            typeLabel = 'PDF';
        } else if (item.type.startsWith('image/')) {
            if (!thumbnailHtml) thumbnailHtml = `<i data-lucide="image"></i>`;
            typeLabel = 'Image';
        } else if (item.name.endsWith('.docx') || item.name.endsWith('.doc')) {
            if (!thumbnailHtml) thumbnailHtml = `<i data-lucide="file-text"></i>`;
            typeLabel = 'Word';
        } else {
            if (!thumbnailHtml) thumbnailHtml = `<i data-lucide="file"></i>`;
        }

        const formattedTime = new Date(item.timestamp).toLocaleString();
        const sizeStr = formatHistoryBytes(item.size);

        itemDiv.innerHTML = `
            <div class="history-item-top">
                <div class="history-thumbnail">
                    ${thumbnailHtml}
                </div>
                <div class="history-details">
                    <div class="history-filename" title="${item.name}">${item.name}</div>
                    <div class="history-meta">
                        <span style="background: var(--accent-alpha); color: var(--accent-color); padding: 1px 6px; border-radius: 4px; font-weight: 600; font-size: 0.7rem;">${typeLabel}</span>
                        <span>${sizeStr}</span>
                        <span>•</span>
                        <span>${formattedTime}</span>
                    </div>
                </div>
            </div>
            <div class="history-item-actions">
                <button class="history-action-btn open-file-btn" data-id="${item.id}">
                    <i data-lucide="external-link" style="width:12px; height:12px;"></i> Open
                </button>
                <button class="history-action-btn share-file-btn" data-id="${item.id}">
                    <i data-lucide="share-2" style="width:12px; height:12px;"></i> Share
                </button>
                <button class="history-action-btn danger delete-file-btn" data-id="${item.id}">
                    <i data-lucide="trash-2" style="width:12px; height:12px;"></i> Delete
                </button>
            </div>
        `;

        // Bind Action buttons
        itemDiv.querySelector('.open-file-btn').addEventListener('click', async () => {
            const db = await initHistoryDB();
            const tx = db.transaction('conversions', 'readonly');
            const getReq = tx.objectStore('conversions').get(item.id);
            getReq.onsuccess = () => {
                db.close();
                const record = getReq.result;
                if (record && record.blob) {
                    const url = URL.createObjectURL(record.blob);
                    window.open(url, '_blank');
                } else {
                    notify("File not found or corrupted.", "error");
                }
            };
            getReq.onerror = () => { db.close(); notify("Failed to open file.", "error"); };
        });

        itemDiv.querySelector('.share-file-btn').addEventListener('click', async () => {
            const db = await initHistoryDB();
            const tx = db.transaction('conversions', 'readonly');
            const getReq = tx.objectStore('conversions').get(item.id);
            getReq.onsuccess = () => {
                db.close();
                const record = getReq.result;
                if (record && record.blob) {
                    const shareFile = new File([record.blob], record.name, { type: record.blob.type });
                    if (navigator.canShare && navigator.canShare({ files: [shareFile] })) {
                        navigator.share({
                            files: [shareFile],
                            title: record.name,
                            text: 'Shared from Swift File'
                        }).catch(err => console.log('Error sharing:', err));
                    } else {
                        // Fallback download
                        const url = URL.createObjectURL(record.blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = record.name;
                        a.click();
                    }
                } else {
                    notify("File not found.", "error");
                }
            };
            getReq.onerror = () => { db.close(); notify("Failed to share file.", "error"); };
        });

        itemDiv.querySelector('.delete-file-btn').addEventListener('click', () => {
            openDeleteItemDialog(item.id, item.name);
        });

        historyDrawerContent.appendChild(itemDiv);
    });

    lucide.createIcons();
}
