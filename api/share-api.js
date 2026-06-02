// --- Web Share Target API ---

async function getSharedFiles() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open('SwiftFileShareDB', 1);
        req.onsuccess = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('shared-files')) {
                resolve([]);
                return;
            }
            const tx = db.transaction('shared-files', 'readonly');
            const store = tx.objectStore('shared-files');
            const getReq = store.getAll();
            getReq.onsuccess = () => {
                db.close();
                resolve(getReq.result || []);
            };
            getReq.onerror = () => {
                db.close();
                reject(getReq.error);
            };
        };
        req.onerror = (e) => reject(e.target.error);
    });
}

async function clearSharedFiles() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open('SwiftFileShareDB', 1);
        req.onsuccess = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('shared-files')) {
                resolve();
                return;
            }
            const tx = db.transaction('shared-files', 'readwrite');
            const store = tx.objectStore('shared-files');
            const clearReq = store.clear();
            clearReq.onsuccess = () => {
                db.close();
                resolve();
            };
            clearReq.onerror = () => {
                db.close();
                reject(clearReq.error);
            };
        };
        req.onerror = (e) => reject(e.target.error);
    });
}

async function handleReceivedShare() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('shared') === '1') {
        try {
            const sharedItems = await getSharedFiles();
            if (sharedItems && sharedItems.length > 0) {
                // Clear the database immediately so we don't process again on refresh
                await clearSharedFiles();

                // Route files based on types
                for (const item of sharedItems) {
                    const blob = new Blob([item.data], { type: item.type });
                    const file = new File([blob], item.name, { type: item.type });

                    if (file.type === 'application/pdf') {
                        switchTab('pdf-to-img');
                        const dt = new DataTransfer();
                        dt.items.add(file);
                        document.getElementById('pdf-input').files = dt.files;
                        handlePdfSelect();
                        notify(`Loaded ${file.name} for PDF to Image conversion.`, 'success');
                    } else if (file.type.startsWith('image/')) {
                        switchTab('img-to-pdf');
                        const dt = new DataTransfer();
                        dt.items.add(file);
                        document.getElementById('img-input').files = dt.files;
                        handleImgSelect();
                        notify(`Loaded ${file.name} for Image to PDF conversion.`, 'success');
                    } else if (file.name.endsWith('.docx')) {
                        switchTab('word-to-pdf');
                        const dt = new DataTransfer();
                        dt.items.add(file);
                        document.getElementById('word-to-pdf-input').files = dt.files;
                        handleWordSelect();
                        notify(`Loaded ${file.name} for Word to PDF conversion.`, 'success');
                    } else {
                        // Default to assistant attachment
                        switchTab('swift-assistant');
                        const isText = file.type === 'text/plain' || file.name.endsWith('.txt') || file.name.endsWith('.csv') || file.name.endsWith('.json') || file.name.endsWith('.xml') || file.name.endsWith('.md');
                        const reader = new FileReader();
                        reader.onload = () => {
                            attachedFile = {
                                name: file.name,
                                type: file.type,
                                data: reader.result,
                                isText: isText
                            };
                            renderAttachedFile();
                            notify(`Attached ${file.name} to Swift Assistant.`, 'success');
                        };
                        if (isText) {
                            reader.readAsText(file);
                        } else {
                            reader.readAsDataURL(file);
                        }
                    }
                }
            }
        } catch (e) {
            console.error("Error reading shared data:", e);
        } finally {
            // Clean up URL parameters
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }
}
