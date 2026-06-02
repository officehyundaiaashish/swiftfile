function updateIframeContent(html) {
    const webpagePreviewIframe = document.getElementById('webpage-preview-iframe');
    if (!webpagePreviewIframe) return;
    const doc = webpagePreviewIframe.contentDocument || webpagePreviewIframe.contentWindow.document;
    doc.open();

    const baseTemplate = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <style>
                /* Standard A4 Paper constraints */
                html, body {
                    margin: 0;
                    padding: 0;
                    background: #ffffff;
                    color: #333333;
                    font-family: system-ui, -apple-system, sans-serif;
                    font-size: 14px;
                    line-height: 1.5;
                }
                body {
                    width: 794px; /* Force A4 print pixel width */
                    min-height: 1123px;
                    padding: 3.5rem;
                    box-sizing: border-box;
                    word-wrap: break-word;
                    overflow-wrap: break-word;
                    overflow: hidden;
                }
                /* Prevent images, videos, tables, frames, blocks from breaking boundaries */
                img, video, canvas, svg, table, iframe, pre, code {
                    max-width: 100% !important;
                    height: auto !important;
                    box-sizing: border-box;
                }
                table {
                    width: 100% !important;
                    border-collapse: collapse;
                }
                th, td {
                    word-break: break-word;
                }
            </style>
        </head>
        <body>
            ${html}
        </body>
        </html>
    `;
    doc.write(baseTemplate);
    doc.close();
}

async function handleWebpageFetch() {
    const webpageUrlInput = document.getElementById('webpage-url-input');
    const webpageHtmlInput = document.getElementById('webpage-html-input');
    const webpagePreviewContainer = document.getElementById('webpage-preview-container');

    if (!webpageUrlInput || !webpageHtmlInput) return;

    const url = webpageUrlInput.value.trim();
    if (!url) {
        notify('Please enter a valid URL.', 'info');
        return;
    }
    showStatus('Fetching webpage content...');
    try {
        // Use AllOrigins CORS Proxy to fetch raw HTML
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error('Network response was not ok');
        let html = await response.text();

        // Simple sanitization to resolve relative paths
        try {
            const parsedUrl = new URL(url);
            const baseUrl = parsedUrl.origin + parsedUrl.pathname;
            // Replace relative links/images
            html = html.replace(/src=["'](?!\/\/|http)([^"']+)["']/gi, `src="${parsedUrl.origin}/$1"`);
            html = html.replace(/href=["'](?!\/\/|http)([^"']+)["']/gi, `href="${parsedUrl.origin}/$1"`);
        } catch (e) {
            console.warn('URL parsing for asset base replacement failed:', e);
        }

        webpageHtmlInput.value = html;
        updateIframeContent(html);
        if (webpagePreviewContainer) webpagePreviewContainer.classList.remove('hidden');
        showStatus('Page fetched successfully!', 2000);
        notify('Webpage loaded into preview.', 'success');
    } catch (err) {
        console.error(err);
        notify('CORS restrictions blocked loading this page. Pasting HTML code directly is recommended.', 'error');
        hideStatus();
    }
}

// Live preview sync for Page Setup Controls
function syncIframeDimensions() {
    const webpagePreviewIframe = document.getElementById('webpage-preview-iframe');
    const webpagePdfSize = document.getElementById('webpage-pdf-size');
    const webpagePdfOrient = document.getElementById('webpage-pdf-orient');

    if (!webpagePreviewIframe || !webpagePdfSize || !webpagePdfOrient) return;
    const size = webpagePdfSize.value;
    const orient = webpagePdfOrient.value;

    let isLandscape = false;
    if (orient === 'l') {
        isLandscape = true;
    } else if (orient === 'p') {
        isLandscape = false;
    } else {
        isLandscape = false;
    }

    let width = 794;
    let height = 1123;

    if (size === 'letter') {
        width = isLandscape ? 1056 : 816;
        height = isLandscape ? 816 : 1056;
    } else if (size === 'a3') {
        width = isLandscape ? 1587 : 1123;
        height = isLandscape ? 1123 : 1587;
    } else { // a4
        width = isLandscape ? 1123 : 794;
        height = isLandscape ? 794 : 1123;
    }

    webpagePreviewIframe.style.width = `${width}px`;
    webpagePreviewIframe.style.height = `${height}px`;
}

// --- Context Menu functions ---
function showContextMenu(e, target) {
    const contextMenu = document.getElementById('custom-context-menu');
    const menuCut = document.getElementById('menu-cut');
    const menuCopy = document.getElementById('menu-copy');

    if (!contextMenu || !menuCut || !menuCopy) return;

    e.preventDefault();
    activeInputTarget = target;

    const hasSelection = (target.selectionStart !== target.selectionEnd);
    menuCut.disabled = !hasSelection;
    menuCopy.disabled = !hasSelection;

    contextMenu.style.left = `${e.clientX}px`;
    contextMenu.style.top = `${e.clientY}px`;
    contextMenu.classList.remove('hidden');

    setTimeout(() => {
        contextMenu.classList.add('show');
    }, 10);
}

function hideContextMenu() {
    const contextMenu = document.getElementById('custom-context-menu');
    if (!contextMenu) return;
    contextMenu.classList.remove('show');
    setTimeout(() => {
        contextMenu.classList.add('hidden');
    }, 150);
}

// --- Init Event Listeners ---
function initWebpageToolsUI() {
    const webpageUrlInput = document.getElementById('webpage-url-input');
    const webpageFetchBtn = document.getElementById('webpage-fetch-btn');
    const webpageHtmlInput = document.getElementById('webpage-html-input');
    const webpageConvertBtn = document.getElementById('webpage-convert-btn');
    const webpagePdfSize = document.getElementById('webpage-pdf-size');
    const webpagePdfOrient = document.getElementById('webpage-pdf-orient');
    const webpagePreviewContainer = document.getElementById('webpage-preview-container');
    const webpagePreviewIframe = document.getElementById('webpage-preview-iframe');

    const contextMenu = document.getElementById('custom-context-menu');
    const menuCut = document.getElementById('menu-cut');
    const menuCopy = document.getElementById('menu-copy');
    const menuPaste = document.getElementById('menu-paste');

    if (webpageFetchBtn) webpageFetchBtn.addEventListener('click', handleWebpageFetch);

    if (webpageHtmlInput) {
        webpageHtmlInput.addEventListener('input', () => {
            const val = webpageHtmlInput.value;
            updateIframeContent(val);
            if (webpagePreviewContainer) {
                if (val.trim()) {
                    webpagePreviewContainer.classList.remove('hidden');
                } else {
                    webpagePreviewContainer.classList.add('hidden');
                }
            }
        });
    }

    if (webpageConvertBtn) {
        webpageConvertBtn.addEventListener('click', async () => {
            if (!webpageHtmlInput || !webpagePreviewIframe) return;
            const html = webpageHtmlInput.value.trim();
            if (!html) return;
            showStatus('Converting HTML to PDF...');
            try {
                let name = 'Webpage_Export.pdf';
                if (webpageUrlInput && webpageUrlInput.value.trim()) {
                    try {
                        const host = new URL(webpageUrlInput.value.trim()).hostname;
                        name = `${host.replace(/www\./g, '')}_Webpage.pdf`;
                    } catch (e) { }
                }
                const docBody = webpagePreviewIframe.contentWindow.document.body;
                const pageSizeVal = webpagePdfSize ? webpagePdfSize.value : 'a4';
                const orientVal = webpagePdfOrient ? webpagePdfOrient.value : 'auto';
                if (typeof convertHtmlToPdf === 'function') {
                    await convertHtmlToPdf(docBody, name, { pageSize: pageSizeVal, orientation: orientVal });
                    showStatus('Success!', 2000);
                    notify('Webpage successfully converted to PDF.', 'success');
                } else {
                    throw new Error("convertHtmlToPdf function not found.");
                }
            } catch (error) {
                console.error(error);
                notify('Failed to generate PDF.', 'error');
                hideStatus();
            }
        });
    }

    if (webpagePdfSize) {
        webpagePdfSize.addEventListener('change', () => {
            syncIframeDimensions();
            if (webpageHtmlInput) updateIframeContent(webpageHtmlInput.value);
        });
    }

    if (webpagePdfOrient) {
        webpagePdfOrient.addEventListener('change', () => {
            syncIframeDimensions();
            if (webpageHtmlInput) updateIframeContent(webpageHtmlInput.value);
        });
    }

    // Context menu right-clicks
    if (webpageUrlInput) {
        webpageUrlInput.addEventListener('contextmenu', (e) => showContextMenu(e, webpageUrlInput));
    }
    if (webpageHtmlInput) {
        webpageHtmlInput.addEventListener('contextmenu', (e) => showContextMenu(e, webpageHtmlInput));
    }

    document.addEventListener('click', (e) => {
        if (contextMenu && !contextMenu.contains(e.target)) {
            hideContextMenu();
        }
    });

    if (menuCut) {
        menuCut.addEventListener('click', async () => {
            if (!activeInputTarget) return;
            const start = activeInputTarget.selectionStart;
            const end = activeInputTarget.selectionEnd;
            const text = activeInputTarget.value.substring(start, end);
            try {
                await navigator.clipboard.writeText(text);
                activeInputTarget.value = activeInputTarget.value.substring(0, start) + activeInputTarget.value.substring(end);
                activeInputTarget.setSelectionRange(start, start);
                activeInputTarget.focus();
                activeInputTarget.dispatchEvent(new Event('input'));
                notify('Text cut to clipboard', 'success');
            } catch (err) {
                console.error(err);
                notify('Could not cut text.', 'error');
            }
            hideContextMenu();
        });
    }

    if (menuCopy) {
        menuCopy.addEventListener('click', async () => {
            if (!activeInputTarget) return;
            const start = activeInputTarget.selectionStart;
            const end = activeInputTarget.selectionEnd;
            const text = activeInputTarget.value.substring(start, end);
            try {
                await navigator.clipboard.writeText(text);
                notify('Text copied to clipboard', 'success');
            } catch (err) {
                console.error(err);
                notify('Could not copy text.', 'error');
            }
            hideContextMenu();
        });
    }

    if (menuPaste) {
        menuPaste.addEventListener('click', async () => {
            if (!activeInputTarget) return;
            try {
                const text = await navigator.clipboard.readText();
                const start = activeInputTarget.selectionStart;
                const end = activeInputTarget.selectionEnd;
                activeInputTarget.value = activeInputTarget.value.substring(0, start) + text + activeInputTarget.value.substring(end);
                const newPos = start + text.length;
                activeInputTarget.setSelectionRange(newPos, newPos);
                activeInputTarget.focus();
                activeInputTarget.dispatchEvent(new Event('input'));
                notify('Pasted from clipboard', 'success');
            } catch (err) {
                console.error(err);
                notify('Clipboard blocked. Click the lock/padlock icon next to the URL, set Clipboard to "Allow", and reload for permanent permission.', 'warning', 8000);
            }
            hideContextMenu();
        });
    }
}

window.addEventListener('DOMContentLoaded', initWebpageToolsUI);
