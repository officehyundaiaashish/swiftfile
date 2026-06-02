// =========================================================================
// SHARED PREVIEW & DRAG-AND-DROP HELPERS
// =========================================================================
let draggedId = null;
let draggedType = null;

function createPreviewItem(id, number, type) {
    const div = document.createElement('div');
    div.className = `preview-item ${type === 'image' ? 'image-type' : ''}`;
    div.dataset.id = id;
    div.draggable = true;
    div.innerHTML = `<div class="placeholder-loader"><i data-lucide="loader-2"></i><span>Loading...</span></div>`;
    div.addEventListener('dragstart', handleDragStart);
    div.addEventListener('dragover', handleDragOver);
    div.addEventListener('dragleave', handleDragLeave);
    div.addEventListener('dragend', handleDragEnd);
    div.addEventListener('drop', handleDrop);
    lucide.createIcons({ props: { class: 'spin' }, nameAttr: 'data-lucide', root: div });
    return div;
}

function addRemoveBtn(parent, id, type) {
    const btn = document.createElement('button');
    btn.className = 'remove-btn';
    btn.innerHTML = '&times;';
    btn.onclick = (e) => {
        e.stopPropagation();
        if (type === 'pdf') pdfPages = pdfPages.filter(p => p.id !== id);
        else if (type === 'image') imageItems = imageItems.filter(p => p.id !== id);
        else if (type === 'split') splitPages = splitPages.filter(p => p.id !== id);
        else if (type === 'compress') compressPages = compressPages.filter(p => p.id !== id);
        else if (type === 'compress-img') compressImgFiles = compressImgFiles.filter(p => p.id !== id);
        else if (type === 'collage') collageItems = collageItems.filter(p => p.id !== id);
        else if (type === 'unlock') unlockItem = null;
        else if (type === 'protect') protectItem = null;
        else mergeItems = mergeItems.filter(p => p.id !== id);

        parent.remove();
        updatePageNumbers(type);
        if (type === 'collage') {
            if (typeof updateCollagePageNumbers === 'function') updateCollagePageNumbers();
            if (typeof drawCollage === 'function') drawCollage();
        }
        if (type === 'compress') updateEstimatedSize();
        if (type === 'compress-img' && typeof updateCompressImgStats === 'function') updateCompressImgStats();
        if (type === 'merge') {
            const mergeCountText = document.getElementById('merge-count');
            if (mergeCountText) mergeCountText.textContent = `${mergeItems.length} pages selected`;
        }

        if (parent.parentElement && parent.parentElement.children.length === 0) {
            if (type === 'pdf') resetPdf();
            else if (type === 'image') resetImg();
            else if (type === 'split') resetSplit();
            else if (type === 'compress-img') {
                compressImgFiles = [];
                const compressImgDropZone = document.getElementById('compress-img-drop-zone');
                const compressImgPreviewContainer = document.getElementById('compress-img-preview-container');
                if (compressImgDropZone) compressImgDropZone.classList.remove('hidden');
                if (compressImgPreviewContainer) compressImgPreviewContainer.classList.add('hidden');
            }
            else if (type === 'compress') resetCompress();
            else if (type === 'collage' && typeof resetCollage === 'function') resetCollage();
            else if (type === 'unlock') resetUnlock();
            else if (type === 'protect') resetProtect();
            else resetMerge();
        }
    };
    parent.appendChild(btn);
}

function addRotateBtn(parent, id, type) {
    const btn = document.createElement('button');
    btn.className = 'rotate-btn';
    btn.title = 'Rotate 90°';
    btn.innerHTML = '<i data-lucide="rotate-cw"></i>';
    btn.onclick = (e) => {
        e.stopPropagation();
        let item;
        if (type === 'pdf') item = pdfPages.find(p => p.id === id);
        else if (type === 'image') item = imageItems.find(p => p.id === id);
        else if (type === 'split') item = splitPages.find(p => p.id === id);
        else if (type === 'compress') item = compressPages.find(p => p.id === id);
        else if (type === 'compress-img') item = compressImgFiles.find(p => p.id === id);
        else if (type === 'unlock') item = unlockItem;
        else if (type === 'protect') item = protectItem;
        else item = mergeItems.find(p => p.id === id);

        if (item) {
            item.rotation = (item.rotation || 0) + 90;
            if (item.rotation >= 360) item.rotation = 0;
            const el = parent.querySelector('canvas, img');
            if (el) {
                el.style.transform = `rotate(${item.rotation}deg)`;
                el.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
            }
            if (type === 'compress') updateEstimatedSize();
            if (type === 'compress-img' && typeof updateCompressImgStats === 'function') updateCompressImgStats();
        }
    };
    parent.appendChild(btn);
    lucide.createIcons({ props: { width: 14, height: 14 }, nameAttr: 'data-lucide', root: btn });
}

function addBadge(parent, text, isCount = false) {
    const badge = document.createElement('span');
    badge.className = isCount ? 'page-count-badge' : 'page-badge';
    badge.textContent = text;
    parent.appendChild(badge);
}

function updatePageNumbers(type) {
    const pdfPreviews = document.getElementById('pdf-previews');
    const imgPreviews = document.getElementById('img-previews');
    const mergePreviews = document.getElementById('merge-previews');
    const splitPreviews = document.getElementById('split-previews');
    const compressPreviews = document.getElementById('compress-previews');

    const containerMap = {
        'pdf': pdfPreviews,
        'image': imgPreviews,
        'merge': mergePreviews,
        'split': splitPreviews,
        'compress': compressPreviews
    };
    const container = containerMap[type];
    if (!container) return;
    const items = container.querySelectorAll('.preview-item');
    items.forEach((item, index) => {
        const badge = item.querySelector('.page-badge');
        if (badge) badge.textContent = index + 1;
    });
}

function handleDragStart(e) {
    draggedId = this.dataset.id;
    const tabContent = this.closest('.tab-content');
    if (tabContent.id === 'pdf-to-img') draggedType = 'pdf';
    else if (tabContent.id === 'img-to-pdf') draggedType = 'image';
    else if (tabContent.id === 'split-pdf') draggedType = 'split';
    else if (tabContent.id === 'compress-pdf') draggedType = 'compress';
    else draggedType = 'merge';
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', draggedId);
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const target = e.target.closest('.preview-item');
    if (target && target.dataset.id !== draggedId) target.classList.add('drag-over');
}

function handleDragLeave(e) {
    const target = e.target.closest('.preview-item');
    if (target) target.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    const target = e.target.closest('.preview-item');
    if (!target || target.dataset.id === draggedId) return;
    target.classList.remove('drag-over');
    const container = target.parentElement;
    const items = Array.from(container.children);
    const draggedElement = container.querySelector(`[data-id="${draggedId}"]`);
    const fromIndex = items.indexOf(draggedElement);
    const toIndex = items.indexOf(target);
    if (fromIndex < toIndex) target.after(draggedElement);
    else target.before(draggedElement);

    if (draggedType === 'pdf') {
        const [moved] = pdfPages.splice(fromIndex, 1);
        pdfPages.splice(toIndex, 0, moved);
        updatePageNumbers('pdf');
    } else if (draggedType === 'image') {
        const [moved] = imageItems.splice(fromIndex, 1);
        imageItems.splice(toIndex, 0, moved);
        updatePageNumbers('image');
    } else if (draggedType === 'split') {
        const [moved] = splitPages.splice(fromIndex, 1);
        splitPages.splice(toIndex, 0, moved);
        updatePageNumbers('split');
    } else if (draggedType === 'compress') {
        const [moved] = compressPages.splice(fromIndex, 1);
        compressPages.splice(toIndex, 0, moved);
        updatePageNumbers('compress');
    } else {
        const [moved] = mergeItems.splice(fromIndex, 1);
        mergeItems.splice(toIndex, 0, moved);
        updatePageNumbers('merge');
    }
}

function handleDragEnd(e) {
    this.classList.remove('dragging');
    document.querySelectorAll('.preview-item').forEach(item => item.classList.remove('drag-over'));
}


// =========================================================================
// 1. PDF TO IMAGE TOOL
// =========================================================================
async function handlePdfSelect() {
    const pdfInput = document.getElementById('pdf-input');
    const pdfDropZone = document.getElementById('pdf-drop-zone');
    const pdfPreviewContainer = document.getElementById('pdf-preview-container');
    const pdfPreviews = document.getElementById('pdf-previews');

    const files = Array.from(pdfInput.files).filter(f => f.type === 'application/pdf');
    if (files.length === 0) return;

    pdfDropZone.classList.add('hidden');
    pdfPreviewContainer.classList.remove('hidden');

    for (const file of files) {
        if (file.size > 100 * 1024 * 1024) {
            notify(`"${file.name}" exceeds the 100MB limit.`, 'error');
            continue;
        }
        const fileIndex = pdfFiles.length;
        pdfFiles.push(file);
        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

            const newPages = [];
            for (let i = 1; i <= pdf.numPages; i++) {
                const id = Math.random().toString(36).substr(2, 9);
                const pageObj = { id, fileIndex, originalIndex: i, rendered: false, rotation: 0 };
                pdfPages.push(pageObj);
                newPages.push(pageObj);
                const div = createPreviewItem(id, pdfPages.length, 'pdf');
                pdfPreviews.appendChild(div);
            }
            renderPdfPagesBackground(pdf, newPages);
        } catch (error) {
            console.error(error);
            if (error.name === 'PasswordException') {
                notify(`"${file.name}" is password protected. Please unlock it first.`, 'error');
            } else {
                notify(`Failed to load "${file.name}".`, 'error');
            }
        }
    }
    updatePageNumbers('pdf');
}

async function renderPdfPagesBackground(pdf, pagesToRender) {
    for (let i = 0; i < pagesToRender.length; i++) {
        const item = pagesToRender[i];
        const div = document.querySelector(`[data-id="${item.id}"]`);
        if (!div) continue;

        const page = await pdf.getPage(item.originalIndex);
        const viewport = page.getViewport({ scale: 0.4 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d', { alpha: false });
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        await page.render({ canvasContext: context, viewport: viewport }).promise;
        div.innerHTML = '';
        div.appendChild(canvas);

        item.rendered = true;
        addRemoveBtn(div, item.id, 'pdf');
        addRotateBtn(div, item.id, 'pdf');
        addBadge(div, '');
    }
    lucide.createIcons();
    updatePageNumbers('pdf');
}

function resetPdf() {
    const pdfInput = document.getElementById('pdf-input');
    const pdfDropZone = document.getElementById('pdf-drop-zone');
    const pdfPreviewContainer = document.getElementById('pdf-preview-container');
    const pdfPreviews = document.getElementById('pdf-previews');

    pdfFiles = [];
    pdfPages = [];
    if (pdfInput) pdfInput.value = '';
    if (pdfPreviews) pdfPreviews.innerHTML = '';
    if (pdfDropZone) pdfDropZone.classList.remove('hidden');
    if (pdfPreviewContainer) pdfPreviewContainer.classList.add('hidden');
}


// =========================================================================
// 2. IMAGE TO PDF TOOL
// =========================================================================
function handleImgSelect() {
    const imgInput = document.getElementById('img-input');
    const imgDropZone = document.getElementById('img-drop-zone');
    const imgPreviewContainer = document.getElementById('img-preview-container');
    const imgPreviews = document.getElementById('img-previews');
    const imgCountText = document.getElementById('img-count');

    const files = Array.from(imgInput.files);
    files.forEach(file => {
        const id = Math.random().toString(36).substr(2, 9);
        const url = URL.createObjectURL(file);
        imageItems.push({ id, file, url, rotation: 0 });
        const div = createPreviewItem(id, imageItems.length, 'image');
        imgPreviews.appendChild(div);
        div.innerHTML = '';
        const img = document.createElement('img');
        img.src = url;
        div.appendChild(img);
        addRemoveBtn(div, id, 'image');
        addRotateBtn(div, id, 'image');
        addBadge(div, imageItems.length);
    });
    imgDropZone.classList.add('hidden');
    imgPreviewContainer.classList.remove('hidden');
    if (imgCountText) imgCountText.textContent = `${imageItems.length} images selected`;
    updatePageNumbers('image');
}

function resetImg() {
    const imgInput = document.getElementById('img-input');
    const imgDropZone = document.getElementById('img-drop-zone');
    const imgPreviewContainer = document.getElementById('img-preview-container');
    const imgPreviews = document.getElementById('img-previews');

    imageItems.forEach(item => URL.revokeObjectURL(item.url));
    imageItems = [];
    if (imgInput) imgInput.value = '';
    if (imgPreviews) imgPreviews.innerHTML = '';
    if (imgDropZone) imgDropZone.classList.remove('hidden');
    if (imgPreviewContainer) imgPreviewContainer.classList.add('hidden');
}


// =========================================================================
// 3. MERGE PDF TOOL
// =========================================================================
async function handleMergePdfSelect() {
    const mergeInput = document.getElementById('merge-input');
    const mergeDropZone = document.getElementById('merge-drop-zone');
    const mergePreviewContainer = document.getElementById('merge-preview-container');
    const mergePreviews = document.getElementById('merge-previews');
    const mergeCountText = document.getElementById('merge-count');

    const files = Array.from(mergeInput.files).filter(f => f.type === 'application/pdf');
    if (files.length === 0 && mergeItems.length === 0) return;

    mergeDropZone.classList.add('hidden');
    mergePreviewContainer.classList.remove('hidden');

    for (const file of files) {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

            for (let i = 1; i <= pdf.numPages; i++) {
                const id = Math.random().toString(36).substr(2, 9);
                const pageObj = { id, file, originalIndex: i, rotation: 0, rendered: false };
                mergeItems.push(pageObj);

                const div = createPreviewItem(id, i, 'merge');
                mergePreviews.appendChild(div);
            }

            renderMergePagesBackground(pdf, file);
        } catch (error) {
            console.error(error);
            if (error.name === 'PasswordException') {
                notify(`"${file.name}" is password protected. Please unlock it first.`, 'error');
            } else {
                notify(`Failed to load "${file.name}".`, 'error');
            }
        }
    }

    if (mergeCountText) mergeCountText.textContent = `${mergeItems.length} pages selected`;
    updatePageNumbers('merge');
}

async function renderMergePagesBackground(pdf, file) {
    const mergePreviews = document.getElementById('merge-previews');
    const pagesToRender = mergeItems.filter(item => item.file === file && !item.rendered);
    for (const item of pagesToRender) {
        const div = document.querySelector(`[data-id="${item.id}"]`);
        if (!div) continue;

        try {
            const page = await pdf.getPage(item.originalIndex);
            const viewport = page.getViewport({ scale: 0.3 });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d', { alpha: false });
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            await page.render({ canvasContext: context, viewport: viewport }).promise;

            div.innerHTML = '';
            div.appendChild(canvas);
            addRemoveBtn(div, item.id, 'merge');
            addRotateBtn(div, item.id, 'merge');
            addBadge(div, ''); // Left badge (updated by updatePageNumbers)
            addBadge(div, `P. ${item.originalIndex}`, true); // Right badge (Original page number)

            item.rendered = true;
        } catch (err) {
            console.error("Failed to render page preview", err);
        }
    }
    updatePageNumbers('merge');
}

function resetMerge() {
    const mergeInput = document.getElementById('merge-input');
    const mergeDropZone = document.getElementById('merge-drop-zone');
    const mergePreviewContainer = document.getElementById('merge-preview-container');
    const mergePreviews = document.getElementById('merge-previews');

    mergeItems = [];
    if (mergeInput) mergeInput.value = '';
    if (mergePreviews) mergePreviews.innerHTML = '';
    if (mergeDropZone) mergeDropZone.classList.remove('hidden');
    if (mergePreviewContainer) mergePreviewContainer.classList.add('hidden');
}


// =========================================================================
// 4. SPLIT PDF TOOL
// =========================================================================
async function handleSplitPdfSelect() {
    const splitInput = document.getElementById('split-input');
    const splitDropZone = document.getElementById('split-drop-zone');
    const splitPreviewContainer = document.getElementById('split-preview-container');
    const splitPreviews = document.getElementById('split-previews');

    const files = Array.from(splitInput.files).filter(f => f.type === 'application/pdf');
    if (files.length === 0) return;

    splitDropZone.classList.add('hidden');
    splitPreviewContainer.classList.remove('hidden');

    for (const file of files) {
        const fileIndex = splitFiles.length;
        splitFiles.push(file);
        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

            const newPages = [];
            for (let i = 1; i <= pdf.numPages; i++) {
                const id = Math.random().toString(36).substr(2, 9);
                const pageObj = { id, fileIndex, originalIndex: i, rendered: false, rotation: 0 };
                splitPages.push(pageObj);
                newPages.push(pageObj);
                const div = createPreviewItem(id, splitPages.length, 'split');
                splitPreviews.appendChild(div);
            }
            renderSplitPagesBackground(pdf, newPages);
        } catch (error) {
            console.error(error);
            if (error.name === 'PasswordException') {
                notify(`"${file.name}" is password protected. Please unlock it first.`, 'error');
            } else {
                notify(`Failed to load "${file.name}".`, 'error');
            }
        }
    }
    updatePageNumbers('split');
}

async function renderSplitPagesBackground(pdf, pages) {
    for (let i = 0; i < pages.length; i++) {
        const item = pages[i];
        const div = document.querySelector(`[data-id="${item.id}"]`);
        if (!div) continue;

        const page = await pdf.getPage(item.originalIndex);
        const viewport = page.getViewport({ scale: 0.3 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d', { alpha: false });
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        await page.render({ canvasContext: context, viewport: viewport }).promise;

        div.innerHTML = '';
        div.appendChild(canvas);

        item.rendered = true;
        addRemoveBtn(div, item.id, 'split');
        addRotateBtn(div, item.id, 'split');
        addBadge(div, `Page ${item.originalIndex}`);
    }
    lucide.createIcons();
}

function resetSplit() {
    const splitInput = document.getElementById('split-input');
    const splitDropZone = document.getElementById('split-drop-zone');
    const splitPreviewContainer = document.getElementById('split-preview-container');
    const splitPreviews = document.getElementById('split-previews');

    splitFiles = [];
    splitPages = [];
    if (splitInput) splitInput.value = '';
    if (splitPreviews) splitPreviews.innerHTML = '';
    if (splitDropZone) splitDropZone.classList.remove('hidden');
    if (splitPreviewContainer) splitPreviewContainer.classList.add('hidden');
}


// =========================================================================
// 5. COMPRESS PDF TOOL
// =========================================================================
async function handleCompressSelect() {
    const compressInput = document.getElementById('compress-input');
    const compressDropZone = document.getElementById('compress-drop-zone');
    const compressPreviewContainer = document.getElementById('compress-preview-container');
    const compressPreviews = document.getElementById('compress-previews');
    const compressFilenameText = document.getElementById('compress-filename');

    const files = Array.from(compressInput.files).filter(f => f.type === 'application/pdf');
    if (files.length === 0 && compressFiles.length === 0) return;

    compressDropZone.classList.add('hidden');
    compressPreviewContainer.classList.remove('hidden');

    for (const file of files) {
        const fileIndex = compressFiles.length;
        compressFiles.push(file);
        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

            for (let i = 1; i <= pdf.numPages; i++) {
                const id = Math.random().toString(36).substr(2, 9);
                const pageObj = { id, fileIndex, originalIndex: i, rotation: 0 };
                compressPages.push(pageObj);
                const div = createPreviewItem(id, i, 'compress');
                compressPreviews.appendChild(div);
            }
            renderCompressPagesBackground(pdf, compressPages.filter(p => p.fileIndex === fileIndex));
        } catch (error) {
            console.error(error);
            if (error.name === 'PasswordException') {
                notify(`"${file.name}" is password protected. Please unlock it first.`, 'error');
            } else {
                notify(`Failed to load "${file.name}".`, 'error');
            }
        }
    }

    if (compressFilenameText) compressFilenameText.textContent = compressFiles.length === 1 ? compressFiles[0].name : `${compressFiles.length} PDFs Selected`;
    updateEstimatedSize();
    updatePageNumbers('compress');
}

async function renderCompressPagesBackground(pdf, pages) {
    for (const item of pages) {
        const div = document.querySelector(`[data-id="${item.id}"]`);
        if (!div) continue;

        const page = await pdf.getPage(item.originalIndex);
        const viewport = page.getViewport({ scale: 0.3 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d', { alpha: false });
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        await page.render({ canvasContext: context, viewport: viewport }).promise;

        div.innerHTML = '';
        div.appendChild(canvas);
        addRemoveBtn(div, item.id, 'compress');
        addRotateBtn(div, item.id, 'compress');
        addBadge(div, `Page ${item.originalIndex}`);
    }
}

function getCompressScale(sliderValue) {
    if (sliderValue < 30) return 2.0;
    if (sliderValue <= 60) return 1.5;
    if (sliderValue <= 80) return 1.0;
    return 0.75;
}

function updateEstimatedSize() {
    const originalSizeText = document.getElementById('original-size-text');
    const estimatedSizeText = document.getElementById('estimated-size-text');
    const compressionSlider = document.getElementById('compression-slider');

    if (!compressionSlider) return;

    if (compressFiles.length === 0) {
        if (originalSizeText) originalSizeText.textContent = '0 KB';
        if (estimatedSizeText) estimatedSizeText.textContent = '0 KB';
        return;
    }
    const totalSize = compressFiles.reduce((acc, f) => acc + f.size, 0);
    if (originalSizeText) originalSizeText.textContent = formatBytes(totalSize);

    // Debounce actual estimation to prevent lag on slider drag
    clearTimeout(estimatePdfTimeout);
    estimatePdfTimeout = setTimeout(async () => {
        if (isEstimatingPdf) return;
        isEstimatingPdf = true;

        try {
            const quality = (100 - compressionSlider.value) / 100;
            const scale = getCompressScale(compressionSlider.value);
            let totalEstSize = 0;

            for (let f = 0; f < compressFiles.length; f++) {
                const file = compressFiles[f];
                const filePages = compressPages.filter(p => p.fileIndex === f);
                if (filePages.length === 0) continue;

                const firstRemainingPageItem = filePages[0];

                if (!pdfDocCache[f]) {
                    const arrayBuffer = await file.arrayBuffer();
                    pdfDocCache[f] = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                }
                const pdfDoc = pdfDocCache[f];

                const page = await pdfDoc.getPage(firstRemainingPageItem.originalIndex);
                const viewport = page.getViewport({ scale: scale });
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                await page.render({ canvasContext: context, viewport: viewport }).promise;

                const imgData = canvas.toDataURL('image/jpeg', quality);
                const singlePageCompressedSize = imgData.length * 0.75;

                totalEstSize += (singlePageCompressedSize * filePages.length) + (filePages.length * 1024);
            }

            if (estimatedSizeText) estimatedSizeText.textContent = formatBytes(totalEstSize);
        } catch (err) {
            console.error("PDF estimation failed", err);
            const factor = 1 - (compressionSlider.value / 100) * 0.8;
            if (estimatedSizeText) estimatedSizeText.textContent = formatBytes(totalSize * factor);
        } finally {
            isEstimatingPdf = false;
        }
    }, 250);
}

function resetCompress() {
    const compressInput = document.getElementById('compress-input');
    const compressDropZone = document.getElementById('compress-drop-zone');
    const compressPreviewContainer = document.getElementById('compress-preview-container');
    const compressPreviews = document.getElementById('compress-previews');

    compressFiles = [];
    compressPages = [];
    if (compressInput) compressInput.value = '';
    if (compressPreviews) compressPreviews.innerHTML = '';
    pdfDocCache = {};
    if (compressDropZone) compressDropZone.classList.remove('hidden');
    if (compressPreviewContainer) compressPreviewContainer.classList.add('hidden');
}


// =========================================================================
// 6. UNLOCK PDF TOOL
// =========================================================================
async function renderGenericPreview(file, grid, type) {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer, password: '' }).promise.catch(e => {
            // If password protected, we can still try to get the first page if it's not fully encrypted
            // or just show a lock icon. But pdf.js needs the password to render.
            return null;
        });

        const id = Math.random().toString(36).substr(2, 9);
        const item = { id, file, rendered: false, rotation: 0 };
        if (type === 'unlock') unlockItem = item;
        else protectItem = item;

        const div = createPreviewItem(id, 1, type);
        grid.innerHTML = '';
        grid.appendChild(div);

        if (!pdf) {
            div.innerHTML = '<div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:var(--text-secondary);"><i data-lucide="lock" style="width:40px; height:40px; margin-bottom:10px;"></i><span>Locked Preview</span></div>';
            addRemoveBtn(div, id, type);
            addRotateBtn(div, id, type);
            lucide.createIcons({ root: div });
            return;
        }

        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 0.3 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d', { alpha: false });
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        await page.render({ canvasContext: context, viewport: viewport }).promise;

        div.innerHTML = '';
        div.appendChild(canvas);
        addRemoveBtn(div, id, type);
        addRotateBtn(div, id, type);
        addBadge(div, '1 Page');
    } catch (e) { console.error(e); }
}

async function handleUnlockSelect() {
    const unlockInput = document.getElementById('unlock-input');
    const unlockDropZone = document.getElementById('unlock-drop-zone');
    const unlockPreviewContainer = document.getElementById('unlock-preview-container');
    const lockedFileName = document.getElementById('locked-file-name');
    const pdfPasswordInput = document.getElementById('pdf-password');
    const unlockFilenameText = document.getElementById('unlock-filename');
    const unlockPreviewGrid = document.getElementById('unlock-preview-grid');

    const file = unlockInput.files[0];
    if (!file || file.type !== 'application/pdf') return;

    showStatus('Analyzing PDF...');
    try {
        const { PDFDocument } = PDFLib;
        const arrayBuffer = await file.arrayBuffer();

        try {
            // Try to load WITHOUT password first
            await PDFDocument.load(arrayBuffer);
            // If successful, it's not locked
            notify('This PDF is already unlocked. No further action is needed.', 'info');
            resetUnlock();
            hideStatus();
            return;
        } catch (e) {
            // If it fails here, it's most likely encrypted and needs a password
            console.log("PDF is likely encrypted:", e.message);
        }

        unlockFile = file;
        if (lockedFileName) lockedFileName.textContent = file.name;
        if (unlockFilenameText) unlockFilenameText.textContent = file.name;
        unlockDropZone.classList.add('hidden');
        unlockPreviewContainer.classList.remove('hidden');
        renderGenericPreview(file, unlockPreviewGrid, 'unlock');
        if (pdfPasswordInput) {
            pdfPasswordInput.value = '';
            setTimeout(() => pdfPasswordInput.focus(), 100);
        }
        hideStatus();
    } catch (error) {
        console.error(error);
        notify('Failed to process this PDF.', 'error');
        hideStatus();
    }
}

function resetUnlock() {
    const unlockInput = document.getElementById('unlock-input');
    const unlockDropZone = document.getElementById('unlock-drop-zone');
    const unlockPreviewContainer = document.getElementById('unlock-preview-container');
    const pdfPasswordInput = document.getElementById('pdf-password');
    const unlockPreviewGrid = document.getElementById('unlock-preview-grid');

    unlockFile = null;
    unlockItem = null;
    if (unlockPreviewGrid) unlockPreviewGrid.innerHTML = '';
    if (unlockInput) unlockInput.value = '';
    if (pdfPasswordInput) pdfPasswordInput.value = '';
    if (unlockDropZone) unlockDropZone.classList.remove('hidden');
    if (unlockPreviewContainer) unlockPreviewContainer.classList.add('hidden');
}


// =========================================================================
// 7. PROTECT PDF TOOL
// =========================================================================
let isFileAlreadyProtected = false;

async function handleProtectSelect() {
    const protectInput = document.getElementById('protect-input');
    const protectDropZone = document.getElementById('protect-drop-zone');
    const protectPreviewContainer = document.getElementById('protect-preview-container');
    const protectFileNameDisplay = document.getElementById('protect-file-name-display');
    const protectPasswordInput = document.getElementById('protect-password');
    const protectConfirmPasswordInput = document.getElementById('protect-confirm-password');
    const currentProtectPasswordInput = document.getElementById('current-protect-password');
    const currentPasswordGroup = document.getElementById('current-password-group');
    const alreadyProtectedMsg = document.getElementById('already-protected-msg');
    const protectFilenameText = document.getElementById('protect-filename');
    const protectPreviewGrid = document.getElementById('protect-preview-grid');

    const file = protectInput.files[0];
    if (!file || file.type !== 'application/pdf') return;

    showStatus('Analyzing PDF...');
    try {
        const { PDFDocument } = PDFLib;
        const arrayBuffer = await file.arrayBuffer();

        isFileAlreadyProtected = false;
        try {
            await PDFDocument.load(arrayBuffer);
        } catch (e) {
            isFileAlreadyProtected = true;
        }

        protectFile = file;
        if (protectFileNameDisplay) protectFileNameDisplay.textContent = file.name;
        if (protectFilenameText) protectFilenameText.textContent = file.name;
        protectDropZone.classList.add('hidden');
        protectPreviewContainer.classList.remove('hidden');
        renderGenericPreview(file, protectPreviewGrid, 'protect');

        if (protectPasswordInput) protectPasswordInput.value = '';
        if (protectConfirmPasswordInput) protectConfirmPasswordInput.value = '';
        if (currentProtectPasswordInput) currentProtectPasswordInput.value = '';

        if (isFileAlreadyProtected) {
            if (currentPasswordGroup) currentPasswordGroup.classList.remove('hidden');
            if (alreadyProtectedMsg) alreadyProtectedMsg.classList.remove('hidden');
            if (currentProtectPasswordInput) setTimeout(() => currentProtectPasswordInput.focus(), 100);
        } else {
            if (currentPasswordGroup) currentPasswordGroup.classList.add('hidden');
            if (alreadyProtectedMsg) alreadyProtectedMsg.classList.add('hidden');
            if (protectPasswordInput) setTimeout(() => protectPasswordInput.focus(), 100);
        }
        hideStatus();
    } catch (error) {
        console.error(error);
        notify('Failed to process PDF.', 'error');
        hideStatus();
    }
}

function resetProtect() {
    const protectInput = document.getElementById('protect-input');
    const protectDropZone = document.getElementById('protect-drop-zone');
    const protectPreviewContainer = document.getElementById('protect-preview-container');
    const protectPasswordInput = document.getElementById('protect-password');
    const protectConfirmPasswordInput = document.getElementById('protect-confirm-password');
    const currentProtectPasswordInput = document.getElementById('current-protect-password');
    const currentPasswordGroup = document.getElementById('current-password-group');
    const alreadyProtectedMsg = document.getElementById('already-protected-msg');
    const protectPreviewGrid = document.getElementById('protect-preview-grid');

    protectFile = null;
    protectItem = null;
    if (protectPreviewGrid) protectPreviewGrid.innerHTML = '';
    if (protectInput) protectInput.value = '';
    if (protectPasswordInput) protectPasswordInput.value = '';
    if (protectConfirmPasswordInput) protectConfirmPasswordInput.value = '';
    if (currentProtectPasswordInput) currentProtectPasswordInput.value = '';
    if (protectDropZone) protectDropZone.classList.remove('hidden');
    if (protectPreviewContainer) protectPreviewContainer.classList.add('hidden');
    if (currentPasswordGroup) currentPasswordGroup.classList.add('hidden');
    if (alreadyProtectedMsg) alreadyProtectedMsg.classList.add('hidden');
}


// =========================================================================
// 8. REDACT PDF TOOL
// =========================================================================
async function handleRedactSelect() {
    const redactInput = document.getElementById('redact-input');
    const redactDropZone = document.getElementById('redact-drop-zone');
    const redactPreviewContainer = document.getElementById('redact-preview-container');
    const redactFilename = document.getElementById('redact-filename');
    const redactPagesContainer = document.getElementById('redact-pages-container');

    const file = redactInput.files[0];
    if (!file || file.type !== 'application/pdf') return;

    showStatus('Loading PDF pages...');
    redactFile = file;
    if (redactFilename) redactFilename.textContent = file.name;
    if (redactPagesContainer) redactPagesContainer.innerHTML = '';
    redactPages = [];

    try {
        const arrayBuffer = await file.arrayBuffer();
        redactDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        for (let i = 1; i <= redactDoc.numPages; i++) {
            const page = await redactDoc.getPage(i);
            const id = Math.random().toString(36).substr(2, 9);

            // Create page element wrapper
            const wrapper = document.createElement('div');
            wrapper.style.position = 'relative';
            wrapper.style.display = 'inline-block';
            wrapper.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
            wrapper.style.borderRadius = '4px';
            wrapper.style.background = '#ffffff';

            const viewport = page.getViewport({ scale: 1.0 });
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d');
            await page.render({ canvasContext: ctx, viewport: viewport }).promise;

            // Create overlay canvas for drawing redaction boxes
            const overlay = document.createElement('canvas');
            overlay.width = viewport.width;
            overlay.height = viewport.height;
            overlay.style.position = 'absolute';
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.cursor = 'crosshair';

            wrapper.appendChild(canvas);
            wrapper.appendChild(overlay);

            const pageBadge = document.createElement('span');
            pageBadge.className = 'page-badge';
            pageBadge.textContent = `Page ${i}`;
            pageBadge.style.bottom = '-24px';
            pageBadge.style.left = '0';
            wrapper.appendChild(pageBadge);

            const containerWrapper = document.createElement('div');
            containerWrapper.style.paddingBottom = '32px';
            containerWrapper.appendChild(wrapper);
            if (redactPagesContainer) redactPagesContainer.appendChild(containerWrapper);

            const pageState = { id, pageNum: i, canvas, overlay, rects: [] };
            redactPages.push(pageState);

            setupRedactionDrawing(pageState);
        }

        if (redactDropZone) redactDropZone.classList.add('hidden');
        if (redactPreviewContainer) redactPreviewContainer.classList.remove('hidden');
        showStatus('PDF loaded successfully!', 2000);
    } catch (err) {
        console.error(err);
        notify('Failed to load PDF for redaction.', 'error');
        hideStatus();
    }
}

function setupRedactionDrawing(pageState) {
    const overlay = pageState.overlay;
    const ctx = overlay.getContext('2d');
    const redactColorPicker = document.getElementById('redact-color-picker');

    function getMousePos(e) {
        const rect = overlay.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const displayX = clientX - rect.left;
        const displayY = clientY - rect.top;
        return {
            x: rect.width ? (displayX / rect.width) * overlay.width : displayX,
            y: rect.height ? (displayY / rect.height) * overlay.height : displayY
        };
    }

    function drawAllRects() {
        ctx.clearRect(0, 0, overlay.width, overlay.height);
        pageState.rects.forEach(r => {
            ctx.fillStyle = r.color;
            ctx.fillRect(r.x, r.y, r.w, r.h);
        });
    }

    const startHandler = (e) => {
        isRedactingDrawing = true;
        redactStartPoint = getMousePos(e);
        redactCurrentRect = { x: redactStartPoint.x, y: redactStartPoint.y, w: 0, h: 0 };
    };

    const moveHandler = (e) => {
        if (!isRedactingDrawing) return;
        e.preventDefault();
        const currentPos = getMousePos(e);

        const x = Math.min(redactStartPoint.x, currentPos.x);
        const y = Math.min(redactStartPoint.y, currentPos.y);
        const w = Math.abs(redactStartPoint.x - currentPos.x);
        const h = Math.abs(redactStartPoint.y - currentPos.y);

        redactCurrentRect = { x, y, w, h };

        drawAllRects();

        // Draw current active rectangle (translucent red guide)
        ctx.fillStyle = 'rgba(239, 68, 68, 0.4)';
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1.5;
        ctx.fillRect(x, y, w, h);
        ctx.strokeRect(x, y, w, h);
    };

    const endHandler = () => {
        if (!isRedactingDrawing) return;
        isRedactingDrawing = false;
        if (redactCurrentRect && redactCurrentRect.w > 3 && redactCurrentRect.h > 3) {
            redactCurrentRect.color = redactColorPicker ? redactColorPicker.value : '#000000';
            pageState.rects.push(redactCurrentRect);
        }
        redactCurrentRect = null;
        drawAllRects();
    };

    overlay.addEventListener('mousedown', startHandler);
    overlay.addEventListener('mousemove', moveHandler);
    overlay.addEventListener('mouseup', endHandler);
    overlay.addEventListener('mouseleave', endHandler);

    overlay.addEventListener('touchstart', startHandler);
    overlay.addEventListener('touchmove', moveHandler, { passive: false });
    overlay.addEventListener('touchend', endHandler);
}

function resetRedact() {
    const redactInput = document.getElementById('redact-input');
    const redactDropZone = document.getElementById('redact-drop-zone');
    const redactPreviewContainer = document.getElementById('redact-preview-container');
    const redactPagesContainer = document.getElementById('redact-pages-container');

    redactFile = null;
    redactDoc = null;
    redactPages = [];
    if (redactInput) redactInput.value = '';
    if (redactPagesContainer) redactPagesContainer.innerHTML = '';
    if (redactDropZone) redactDropZone.classList.remove('hidden');
    if (redactPreviewContainer) redactPreviewContainer.classList.add('hidden');
}


// =========================================================================
// EVENT BINDINGS FOR ALL PDF TOOLS
// =========================================================================
function initPdfToolsUI() {
    // 1. PDF to Image Events
    const pdfInput = document.getElementById('pdf-input');
    const pdfDropZone = document.getElementById('pdf-drop-zone');
    const addMorePdfBtn = document.getElementById('add-more-pdf');
    const convertPdfBtn = document.getElementById('convert-pdf-btn');
    const clearPdfBtn = document.getElementById('clear-pdf');

    if (pdfInput) {
        if (pdfDropZone) pdfDropZone.addEventListener('click', () => pdfInput.click());
        if (addMorePdfBtn) addMorePdfBtn.addEventListener('click', () => pdfInput.click());
        pdfInput.addEventListener('change', handlePdfSelect);
    }
    if (pdfDropZone) {
        pdfDropZone.addEventListener('dragover', (e) => { e.preventDefault(); pdfDropZone.classList.add('drag-over'); });
        pdfDropZone.addEventListener('dragleave', () => pdfDropZone.classList.remove('drag-over'));
        pdfDropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            pdfDropZone.classList.remove('drag-over');
            if (e.dataTransfer.files.length > 0 && pdfInput) { pdfInput.files = e.dataTransfer.files; handlePdfSelect(); }
        });
    }
    if (clearPdfBtn) clearPdfBtn.addEventListener('click', resetPdf);

    if (convertPdfBtn) {
        convertPdfBtn.addEventListener('click', async () => {
            if (pdfPages.length === 0) return;
            showStatus('Converting in order...');
            try {
                const pdfInstances = {};
                for (let i = 0; i < pdfPages.length; i++) {
                    const item = pdfPages[i];
                    if (!pdfInstances[item.fileIndex]) {
                        const arrayBuffer = await pdfFiles[item.fileIndex].arrayBuffer();
                        pdfInstances[item.fileIndex] = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                    }
                    const pdf = pdfInstances[item.fileIndex];
                    const page = await pdf.getPage(item.originalIndex);
                    const userRotation = item.rotation || 0;
                    const viewport = page.getViewport({ scale: 2.0, rotation: userRotation });
                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d');
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;
                    await page.render({ canvasContext: context, viewport: viewport }).promise;

                    const sourceName = pdfFiles[item.fileIndex].name.replace(/\.[^/.]+$/, "");
                    const link = document.createElement('a');
                    link.download = `${sourceName}_Page_${item.originalIndex}.png`;
                    link.href = canvas.toDataURL('image/png');
                    link.click();
                    await new Promise(r => setTimeout(r, 200));
                }
                showStatus('Finished!', 2000);
            } catch (error) { console.error(error); notify('Error during conversion.', 'error'); hideStatus(); }
        });
    }

    // 2. Image to PDF Events
    const imgInput = document.getElementById('img-input');
    const imgDropZone = document.getElementById('img-drop-zone');
    const addMoreImgBtn = document.getElementById('add-more-img');
    const convertImgBtn = document.getElementById('convert-img-btn');
    const clearImgBtn = document.getElementById('clear-img');

    if (imgInput) {
        if (imgDropZone) imgDropZone.addEventListener('click', () => imgInput.click());
        if (addMoreImgBtn) addMoreImgBtn.addEventListener('click', () => imgInput.click());
        imgInput.addEventListener('change', handleImgSelect);
    }
    if (imgDropZone) {
        imgDropZone.addEventListener('dragover', (e) => { e.preventDefault(); imgDropZone.classList.add('drag-over'); });
        imgDropZone.addEventListener('dragleave', () => imgDropZone.classList.remove('drag-over'));
        imgDropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            imgDropZone.classList.remove('drag-over');
            if (e.dataTransfer.files.length > 0 && imgInput) { imgInput.files = e.dataTransfer.files; handleImgSelect(); }
        });
    }
    if (clearImgBtn) clearImgBtn.addEventListener('click', resetImg);

    if (convertImgBtn) {
        convertImgBtn.addEventListener('click', async () => {
            if (imageItems.length === 0) return;
            showStatus('Generating PDF...');
            try {
                const { jsPDF } = window.jspdf;
                const pdf = new jsPDF();
                for (let i = 0; i < imageItems.length; i++) {
                    const item = imageItems[i];
                    const imgData = await getBase64(item.file);
                    const img = new Image();
                    img.src = imgData;
                    await new Promise(r => img.onload = r);

                    const pageWidth = pdf.internal.pageSize.getWidth();
                    const pageHeight = pdf.internal.pageSize.getHeight();
                    const rotation = item.rotation || 0;
                    const isPortrait = rotation % 180 === 0;
                    const displayWidth = isPortrait ? img.width : img.height;
                    const displayHeight = isPortrait ? img.height : img.width;

                    const ratio = Math.min(pageWidth / displayWidth, pageHeight / displayHeight);
                    const imgWidth = displayWidth * ratio;
                    const imgHeight = displayHeight * ratio;

                    if (i > 0) pdf.addPage();

                    let finalImgData = imgData;
                    let finalFormat = item.file.type.split('/')[1].toUpperCase();
                    if (finalFormat === 'SVG+XML') finalFormat = 'PNG';
                    if (finalFormat === 'X-ICON') finalFormat = 'PNG';

                    const supportedFormats = ['JPEG', 'JPG', 'PNG', 'WEBP'];
                    if (rotation !== 0 || !supportedFormats.includes(finalFormat)) {
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');
                        canvas.width = displayWidth;
                        canvas.height = displayHeight;

                        ctx.fillStyle = '#FFFFFF';
                        ctx.fillRect(0, 0, canvas.width, canvas.height);

                        ctx.translate(canvas.width / 2, canvas.height / 2);
                        ctx.rotate((rotation * Math.PI) / 180);
                        ctx.drawImage(img, -img.width / 2, -img.height / 2);
                        ctx.setTransform(1, 0, 0, 1, 0, 0);

                        finalImgData = canvas.toDataURL('image/png');
                        finalFormat = 'PNG';
                    }

                    pdf.addImage(
                        finalImgData,
                        finalFormat,
                        (pageWidth - imgWidth) / 2,
                        (pageHeight - imgHeight) / 2,
                        imgWidth,
                        imgHeight,
                        undefined,
                        'NONE',
                        0
                    );
                    await new Promise(r => setTimeout(r, 50));
                }
                const firstImgName = imageItems[0].file.name.replace(/\.[^/.]+$/, "");
                const _imgPdfBlob = pdf.output('blob');
                const _imgPdfUrl = URL.createObjectURL(_imgPdfBlob);
                const _imgPdfLink = document.createElement('a');
                _imgPdfLink.href = _imgPdfUrl;
                _imgPdfLink.download = `${firstImgName}_ToPDF.pdf`;
                _imgPdfLink.click();
                URL.revokeObjectURL(_imgPdfUrl);
                showStatus('Success!', 2000);
            } catch (error) { console.error(error); notify('Error generating PDF.', 'error'); hideStatus(); }
        });
    }

    // 3. Merge PDF Events
    const mergeInput = document.getElementById('merge-input');
    const mergeDropZone = document.getElementById('merge-drop-zone');
    const addMoreMergeBtn = document.getElementById('add-more-merge');
    const convertMergeBtn = document.getElementById('convert-merge-btn');
    const clearMergeBtn = document.getElementById('clear-merge');

    if (mergeInput) {
        if (mergeDropZone) mergeDropZone.addEventListener('click', () => mergeInput.click());
        if (addMoreMergeBtn) addMoreMergeBtn.addEventListener('click', () => mergeInput.click());
        mergeInput.addEventListener('change', handleMergePdfSelect);
    }
    if (mergeDropZone) {
        mergeDropZone.addEventListener('dragover', (e) => { e.preventDefault(); mergeDropZone.classList.add('drag-over'); });
        mergeDropZone.addEventListener('dragleave', () => mergeDropZone.classList.remove('drag-over'));
        mergeDropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            mergeDropZone.classList.remove('drag-over');
            if (e.dataTransfer.files.length > 0 && mergeInput) { mergeInput.files = e.dataTransfer.files; handleMergePdfSelect(); }
        });
    }
    if (clearMergeBtn) clearMergeBtn.addEventListener('click', resetMerge);

    if (convertMergeBtn) {
        convertMergeBtn.addEventListener('click', async () => {
            if (mergeItems.length === 0) return;
            showStatus('Merging PDF files...');
            try {
                const { PDFDocument, degrees } = PDFLib;
                const mergedPdf = await PDFDocument.create();
                const loadedPdfs = new Map();

                for (const item of mergeItems) {
                    let donorPdf = loadedPdfs.get(item.file);
                    if (!donorPdf) {
                        const donorBuffer = await item.file.arrayBuffer();
                        donorPdf = await PDFDocument.load(donorBuffer);
                        loadedPdfs.set(item.file, donorPdf);
                    }

                    const [copiedPage] = await mergedPdf.copyPages(donorPdf, [item.originalIndex - 1]);
                    const currentRotation = copiedPage.getRotation().angle;
                    copiedPage.setRotation(degrees(currentRotation + (item.rotation || 0)));
                    mergedPdf.addPage(copiedPage);
                }

                const pdfBytes = await mergedPdf.save();
                const blob = new Blob([pdfBytes], { type: 'application/pdf' });
                const url = URL.createObjectURL(blob);
                const firstFileName = mergeItems[0].file.name.replace(/\.[^/.]+$/, "");
                const link = document.createElement('a');
                link.href = url;
                link.download = `${firstFileName}_Merged.pdf`;
                link.click();
                showStatus('Success!', 2000);
            } catch (error) { console.error(error); notify('Merge failed.', 'error'); hideStatus(); }
        });
    }

    // 4. Split PDF Events
    const splitInput = document.getElementById('split-input');
    const splitDropZone = document.getElementById('split-drop-zone');
    const addMoreSplitBtn = document.getElementById('add-more-split');
    const convertSplitBtn = document.getElementById('convert-split-btn');
    const clearSplitBtn = document.getElementById('clear-split');

    if (splitInput) {
        if (splitDropZone) splitDropZone.addEventListener('click', () => splitInput.click());
        if (addMoreSplitBtn) addMoreSplitBtn.addEventListener('click', () => splitInput.click());
        splitInput.addEventListener('change', handleSplitPdfSelect);
    }
    if (splitDropZone) {
        splitDropZone.addEventListener('dragover', (e) => { e.preventDefault(); splitDropZone.classList.add('drag-over'); });
        splitDropZone.addEventListener('dragleave', () => splitDropZone.classList.remove('drag-over'));
        splitDropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            splitDropZone.classList.remove('drag-over');
            if (e.dataTransfer.files.length > 0 && splitInput) { splitInput.files = e.dataTransfer.files; handleSplitPdfSelect(); }
        });
    }
    if (clearSplitBtn) clearSplitBtn.addEventListener('click', resetSplit);

    if (convertSplitBtn) {
        convertSplitBtn.addEventListener('click', async () => {
            if (splitPages.length === 0) return;
            showStatus('Splitting PDF into pages...');
            try {
                const { PDFDocument, degrees } = PDFLib;
                const pdfInstances = {};

                for (let i = 0; i < splitPages.length; i++) {
                    const item = splitPages[i];
                    if (!pdfInstances[item.fileIndex]) {
                        const sourceBuffer = await splitFiles[item.fileIndex].arrayBuffer();
                        pdfInstances[item.fileIndex] = await PDFDocument.load(sourceBuffer);
                    }

                    const sourcePdf = pdfInstances[item.fileIndex];
                    const newPdf = await PDFDocument.create();
                    const [copiedPage] = await newPdf.copyPages(sourcePdf, [item.originalIndex - 1]);

                    const currentRotation = copiedPage.getRotation().angle;
                    copiedPage.setRotation(degrees(currentRotation + (item.rotation || 0)));
                    newPdf.addPage(copiedPage);

                    const pdfBytes = await newPdf.save();
                    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
                    const url = URL.createObjectURL(blob);
                    const sourceName = splitFiles[item.fileIndex].name.replace(/\.[^/.]+$/, "");
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `${sourceName}_Page_${item.originalIndex}.pdf`;
                    link.click();

                    await new Promise(r => setTimeout(r, 300));
                }
                showStatus('Finished!', 2000);
            } catch (error) { console.error(error); notify('Split failed.', 'error'); hideStatus(); }
        });
    }

    // 5. Compress PDF Events
    const compressInput = document.getElementById('compress-input');
    const compressDropZone = document.getElementById('compress-drop-zone');
    const addMoreCompressBtn = document.getElementById('add-more-compress');
    const convertCompressBtn = document.getElementById('convert-compress-btn');
    const clearCompressBtn = document.getElementById('clear-compress');
    const compressionSlider = document.getElementById('compression-slider');
    const compressionValueText = document.getElementById('compression-value');

    if (compressInput) {
        if (compressDropZone) compressDropZone.addEventListener('click', () => compressInput.click());
        if (addMoreCompressBtn) addMoreCompressBtn.addEventListener('click', () => compressInput.click());
        compressInput.addEventListener('change', handleCompressSelect);
    }
    if (compressDropZone) {
        compressDropZone.addEventListener('dragover', (e) => { e.preventDefault(); compressDropZone.classList.add('drag-over'); });
        compressDropZone.addEventListener('dragleave', () => compressDropZone.classList.remove('drag-over'));
        compressDropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            compressDropZone.classList.remove('drag-over');
            if (e.dataTransfer.files.length > 0 && compressInput) { compressInput.files = e.dataTransfer.files; handleCompressSelect(); }
        });
    }
    if (clearCompressBtn) clearCompressBtn.addEventListener('click', resetCompress);
    if (compressionSlider) {
        compressionSlider.addEventListener('input', () => {
            if (compressionValueText) compressionValueText.textContent = compressionSlider.value + '%';
            updateEstimatedSize();
        });
    }

    if (convertCompressBtn) {
        convertCompressBtn.addEventListener('click', async () => {
            if (compressFiles.length === 0) return;
            showStatus(`Compressing ${compressFiles.length} PDF(s)...`);
            try {
                const { jsPDF } = window.jspdf;
                const quality = (100 - (compressionSlider ? compressionSlider.value : 50)) / 100;
                const scale = getCompressScale(compressionSlider ? compressionSlider.value : 50);

                for (let f = 0; f < compressFiles.length; f++) {
                    const file = compressFiles[f];
                    const filePages = compressPages.filter(p => p.fileIndex === f);
                    if (filePages.length === 0) continue;

                    showStatus(`Compressing File ${f + 1} of ${compressFiles.length}...`);

                    const arrayBuffer = await file.arrayBuffer();
                    const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                    let outPdf = null;

                    for (let i = 0; i < filePages.length; i++) {
                        const pageItem = filePages[i];
                        const page = await pdfDoc.getPage(pageItem.originalIndex);
                        const userRotation = pageItem.rotation || 0;

                        const viewport = page.getViewport({ scale: scale, rotation: userRotation });
                        const canvas = document.createElement('canvas');
                        const context = canvas.getContext('2d');
                        canvas.height = viewport.height;
                        canvas.width = viewport.width;
                        await page.render({ canvasContext: context, viewport: viewport }).promise;

                        const imgData = canvas.toDataURL('image/jpeg', quality);
                        const orientation = canvas.width > canvas.height ? 'l' : 'p';

                        if (i === 0) {
                            outPdf = new jsPDF({
                                orientation: orientation,
                                unit: 'pt',
                                format: [canvas.width, canvas.height]
                            });
                        } else {
                            outPdf.addPage([canvas.width, canvas.height], orientation);
                        }

                        outPdf.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height);

                        if (i % 5 === 0) await new Promise(r => setTimeout(r, 50));
                    }

                    if (outPdf) {
                        const _compPdfBlob = outPdf.output('blob');
                        const _compPdfUrl = URL.createObjectURL(_compPdfBlob);
                        const _compPdfLink = document.createElement('a');
                        _compPdfLink.href = _compPdfUrl;
                        _compPdfLink.download = file.name.replace(/\.[^/.]+$/, "") + '_Compressed.pdf';
                        _compPdfLink.click();
                        URL.revokeObjectURL(_compPdfUrl);
                    }
                    await new Promise(r => setTimeout(r, 500));
                }

                showStatus('Batch Compression Success!', 2000);
            } catch (error) { console.error(error); notify('Compression failed.', 'error'); hideStatus(); }
        });
    }

    // 6. Unlock PDF Events
    const unlockInput = document.getElementById('unlock-input');
    const unlockDropZone = document.getElementById('unlock-drop-zone');
    const pdfPasswordInput = document.getElementById('pdf-password');
    const unlockBtn = document.getElementById('unlock-btn');
    const clearUnlockBtn = document.getElementById('clear-unlock');

    if (unlockInput) {
        if (unlockDropZone) unlockDropZone.addEventListener('click', () => unlockInput.click());
        unlockInput.addEventListener('change', handleUnlockSelect);
    }
    if (unlockDropZone) {
        unlockDropZone.addEventListener('dragover', (e) => { e.preventDefault(); unlockDropZone.classList.add('drag-over'); });
        unlockDropZone.addEventListener('dragleave', () => unlockDropZone.classList.remove('drag-over'));
        unlockDropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            unlockDropZone.classList.remove('drag-over');
            if (e.dataTransfer.files.length > 0 && unlockInput) { unlockInput.files = e.dataTransfer.files; handleUnlockSelect(); }
        });
    }
    if (clearUnlockBtn) clearUnlockBtn.addEventListener('click', resetUnlock);

    if (unlockBtn) {
        unlockBtn.addEventListener('click', async () => {
            if (!unlockFile) return;
            const password = pdfPasswordInput ? pdfPasswordInput.value : '';
            if (!password) { notify('Please enter the password.', 'info'); return; }

            showStatus('Unlocking PDF...');
            try {
                const arrayBuffer = await unlockFile.arrayBuffer();
                let pdfBytes = await PDFEncryption.decrypt(arrayBuffer, password);

                if (unlockItem && unlockItem.rotation) {
                    const { PDFDocument } = PDFLib;
                    const pdfDoc = await PDFDocument.load(pdfBytes);
                    const pages = pdfDoc.getPages();
                    pages.forEach(p => p.setRotation(PDFLib.degrees(p.getRotation() + (unlockItem.rotation || 0))));
                    pdfBytes = await pdfDoc.save();
                }

                const blob = new Blob([pdfBytes], { type: 'application/pdf' });
                const url = URL.createObjectURL(blob);
                const sourceName = unlockFile.name.replace(/\.[^/.]+$/, "");
                const link = document.createElement('a');
                link.href = url;
                link.download = `${sourceName}_Unlocked.pdf`;
                link.click();

                showStatus('Unlock Success!', 2000);
                notify('PDF successfully unlocked.', 'success');
            } catch (error) {
                console.error(error);
                notify(error.message || 'Failed to unlock PDF. Please check the password.', 'error');
                hideStatus();
            }
        });
    }

    // 7. Protect PDF Events
    const protectInput = document.getElementById('protect-input');
    const protectDropZone = document.getElementById('protect-drop-zone');
    const protectPasswordInput = document.getElementById('protect-password');
    const protectConfirmPasswordInput = document.getElementById('protect-confirm-password');
    const currentProtectPasswordInput = document.getElementById('current-protect-password');
    const protectBtn = document.getElementById('protect-btn');
    const clearProtectBtn = document.getElementById('clear-protect');

    if (protectInput) {
        if (protectDropZone) protectDropZone.addEventListener('click', () => protectInput.click());
        protectInput.addEventListener('change', handleProtectSelect);
    }
    if (protectDropZone) {
        protectDropZone.addEventListener('dragover', (e) => { e.preventDefault(); protectDropZone.classList.add('drag-over'); });
        protectDropZone.addEventListener('dragleave', () => protectDropZone.classList.remove('drag-over'));
        protectDropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            protectDropZone.classList.remove('drag-over');
            if (e.dataTransfer.files.length > 0 && protectInput) { protectInput.files = e.dataTransfer.files; handleProtectSelect(); }
        });
    }
    if (clearProtectBtn) clearProtectBtn.addEventListener('click', resetProtect);

    if (protectBtn) {
        protectBtn.addEventListener('click', async () => {
            if (!protectFile) return;
            const currentPassword = currentProtectPasswordInput ? currentProtectPasswordInput.value : '';
            const newPassword = protectPasswordInput ? protectPasswordInput.value : '';
            const confirmPassword = protectConfirmPasswordInput ? protectConfirmPasswordInput.value : '';

            if (isFileAlreadyProtected && !currentPassword) { notify('Please enter the current password.', 'info'); return; }
            if (!newPassword) { notify('Please set a new password.', 'info'); return; }
            if (newPassword !== confirmPassword) { notify('New passwords do not match.', 'error'); return; }

            showStatus('Protecting PDF...');
            try {
                const arrayBuffer = await protectFile.arrayBuffer();
                const pdfBytes = await PDFEncryption.encrypt(arrayBuffer, newPassword, newPassword);

                const blob = new Blob([pdfBytes], { type: 'application/pdf' });
                const url = URL.createObjectURL(blob);
                const sourceName = protectFile.name.replace(/\.[^/.]+$/, "");
                const link = document.createElement('a');
                link.href = url;
                link.download = `${sourceName}_Protected.pdf`;
                link.click();

                showStatus('Protection Applied!', 2000);
                notify('PDF password updated successfully.', 'success');
            } catch (error) {
                console.error(error);
                notify('Failed to protect PDF. ' + error.message, 'error');
                hideStatus();
            }
        });
    }

    // 8. Redact PDF Events
    const redactInput = document.getElementById('redact-input');
    const redactDropZone = document.getElementById('redact-drop-zone');
    const redactColorPicker = document.getElementById('redact-color-picker');
    const redactClearShapesBtn = document.getElementById('redact-clear-shapes-btn');
    const redactApplyBtn = document.getElementById('redact-apply-btn');
    const clearRedactBtn = document.getElementById('clear-redact');

    if (redactInput) {
        if (redactDropZone) redactDropZone.addEventListener('click', () => redactInput.click());
        redactInput.addEventListener('change', handleRedactSelect);
    }
    if (redactDropZone) {
        redactDropZone.addEventListener('dragover', (e) => { e.preventDefault(); redactDropZone.classList.add('drag-over'); });
        redactDropZone.addEventListener('dragleave', () => redactDropZone.classList.remove('drag-over'));
        redactDropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            redactDropZone.classList.remove('drag-over');
            if (e.dataTransfer.files.length > 0 && redactInput) { redactInput.files = e.dataTransfer.files; handleRedactSelect(); }
        });
    }
    if (clearRedactBtn) clearRedactBtn.addEventListener('click', resetRedact);

    if (redactColorPicker) {
        redactColorPicker.addEventListener('input', () => {
            redactActiveColor = redactColorPicker.value;
        });
    }

    if (redactClearShapesBtn) {
        redactClearShapesBtn.addEventListener('click', () => {
            redactPages.forEach(p => {
                p.rects = [];
                const ctx = p.overlay.getContext('2d');
                ctx.clearRect(0, 0, p.overlay.width, p.overlay.height);
            });
            notify('Redaction boxes cleared.', 'info');
        });
    }

    if (redactApplyBtn) {
        redactApplyBtn.addEventListener('click', async () => {
            if (!redactFile) return;
            const hasBoxes = redactPages.some(p => p.rects.length > 0);
            if (!hasBoxes) {
                notify('Please draw at least one redaction box on the document.', 'info');
                return;
            }

            showStatus('Applying redaction masks...');
            try {
                const { PDFDocument, rgb } = PDFLib;
                const arrayBuffer = await redactFile.arrayBuffer();
                const pdfDoc = await PDFDocument.load(arrayBuffer);
                const pages = pdfDoc.getPages();

                function hexToRgb(hex) {
                    const r = parseInt(hex.slice(1, 3), 16) / 255;
                    const g = parseInt(hex.slice(3, 5), 16) / 255;
                    const b = parseInt(hex.slice(5, 7), 16) / 255;
                    return { r, g, b };
                }

                redactPages.forEach(pState => {
                    if (pState.rects.length === 0) return;
                    const page = pages[pState.pageNum - 1];
                    const pdfWidth = page.getWidth();
                    const pdfHeight = page.getHeight();

                    const canvasWidth = pState.canvas.width;
                    const canvasHeight = pState.canvas.height;

                    const scaleX = pdfWidth / canvasWidth;
                    const scaleY = pdfHeight / canvasHeight;

                    pState.rects.forEach(r => {
                        const pdfX = r.x * scaleX;
                        const pdfY = (canvasHeight - (r.y + r.h)) * scaleY;
                        const pdfW = r.w * scaleX;
                        const pdfH = r.h * scaleY;

                        const c = hexToRgb(r.color);
                        page.drawRectangle({
                            x: pdfX,
                            y: pdfY,
                            width: pdfW,
                            height: pdfH,
                            color: rgb(c.r, c.g, c.b)
                        });
                    });
                });

                const pdfBytes = await pdfDoc.save();
                const blob = new Blob([pdfBytes], { type: 'application/pdf' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = redactFile.name.replace(/\.[^/.]+$/, "") + '_Redacted.pdf';
                link.click();
                showStatus('Success!', 2000);
                notify('Document redacted successfully.', 'success');
            } catch (err) {
                console.error(err);
                notify('Redaction failed.', 'error');
                hideStatus();
            }
        });
    }
}

window.addEventListener('DOMContentLoaded', initPdfToolsUI);
