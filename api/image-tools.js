// =========================================================================
// BACKGROUND REMOVER LOGIC
// =========================================================================
const bgGradients = [
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #6B73FF 0%, #000DFF 100%)',
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'linear-gradient(135deg, #5ee7df 0%, #b490ca 100%)',
    'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)',
    'linear-gradient(135deg, #fdfcfb 0%, #e2d1c3 100%)',
    'linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%)',
    'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
    'linear-gradient(135deg, #232526 0%, #414345 100%)',
    'linear-gradient(135deg, #f83600 0%, #f9d423 100%)',
    'linear-gradient(135deg, #2b5876 0%, #4e4376 100%)',
    'linear-gradient(135deg, #a8e063 0%, #56ab2f 100%)',
    'linear-gradient(135deg, #ed4264 0%, #ffedbc 100%)',
    'linear-gradient(135deg, #141e30 0%, #243b55 100%)',
    'linear-gradient(135deg, #00c6ff 0%, #0072ff 100%)',
    'linear-gradient(135deg, #ee9ca7 0%, #ffdde1 100%)',
    'linear-gradient(135deg, #2193b0 0%, #6dd5ed 100%)',
    'linear-gradient(135deg, #bf953f 0%, #fcf6ba 100%)',
    'linear-gradient(135deg, #ff00cc 0%, #3333ff 100%)',
    'linear-gradient(135deg, #159957 0%, #155799 100%)',
    'linear-gradient(135deg, #000000 0%, #434343 100%)',
    'linear-gradient(135deg, #833ab4 0%, #fd1d1d 50%, #fcb045 100%)',
    'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)'
];

async function handleBgSelect() {
    const bgInput = document.getElementById('bg-input');
    const bgDropZone = document.getElementById('bg-drop-zone');
    const bgPreviewContainer = document.getElementById('bg-preview-container');
    const bgPreviewImg = document.getElementById('bg-preview-img');
    const bgDownloadBtn = document.getElementById('bg-download-btn');
    const bgProcessBtn = document.getElementById('bg-process-btn');
    const bgRemBGBtn = document.getElementById('bg-rembg-btn');
    const bgCropBtn = document.getElementById('bg-crop-btn');
    const bgCancelCrop = document.getElementById('bg-cancel-crop');

    const file = bgInput.files[0];
    if (!file) return;
    window.bgOriginalBlob = file;
    window.bgProcessedBlob = null;
    bgCurrentRotation = 0;
    bgCurrentView = 'original';

    if (bgPreviewImg) bgPreviewImg.src = URL.createObjectURL(file);
    if (bgDropZone) bgDropZone.classList.add('hidden');
    if (bgPreviewContainer) bgPreviewContainer.classList.remove('hidden');
    if (bgDownloadBtn) bgDownloadBtn.classList.add('hidden');
    if (bgProcessBtn) bgProcessBtn.classList.remove('hidden');
    if (bgRemBGBtn) bgRemBGBtn.classList.remove('hidden');

    window.updateBgView('original');
    if (bgCropper) {
        bgCropper.destroy();
        bgCropper = null;
        if (bgCropBtn) bgCropBtn.innerHTML = '<i data-lucide="crop"></i> Crop';
        if (bgCancelCrop) bgCancelCrop.classList.add('hidden');
        lucide.createIcons();
    }
}

window.updateBgView = function (view) {
    const bgPreviewImg = document.getElementById('bg-preview-img');
    const bgPreviewTabs = document.querySelectorAll('.preview-tab-btn');

    bgCurrentView = view;
    bgPreviewTabs.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });

    if (view === 'original') {
        if (bgPreviewImg && window.bgOriginalBlob) bgPreviewImg.src = URL.createObjectURL(window.bgOriginalBlob);
    } else if (window.bgProcessedBlob) {
        applyBgStyling();
    }
};

async function applyBgStyling() {
    if (!window.bgProcessedBlob) return;

    const bgPreviewImg = document.getElementById('bg-preview-img');
    const bgColorPicker = document.getElementById('bg-color-picker');

    const img = new Image();
    img.src = URL.createObjectURL(window.bgProcessedBlob);
    await new Promise(r => img.onload = r);

    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');

    if (bgCurrentType === 'color' && bgColorPicker) {
        ctx.fillStyle = bgColorPicker.value;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (bgCurrentType === 'gradient' && bgSelectedGradient) {
        const parts = bgSelectedGradient.match(/#([a-fA-F0-9]{6})/g);
        if (parts && parts.length >= 2) {
            const grd = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
            grd.addColorStop(0, parts[0]);
            grd.addColorStop(1, parts[1]);
            ctx.fillStyle = grd;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
    } else if (bgCurrentType === 'image' && bgCustomImg) {
        const ratio = Math.max(canvas.width / bgCustomImg.width, canvas.height / bgCustomImg.height);
        const w = bgCustomImg.width * ratio;
        const h = bgCustomImg.height * ratio;
        ctx.drawImage(bgCustomImg, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
    }

    ctx.drawImage(img, 0, 0);
    if (bgPreviewImg) bgPreviewImg.src = canvas.toDataURL('image/png');
}

async function rotateBg(deg) {
    const bgPreviewImg = document.getElementById('bg-preview-img');
    if (!bgPreviewImg) return;

    const img = new Image();
    img.src = bgPreviewImg.src;
    await new Promise(r => img.onload = r);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const isPortrait = Math.abs(deg) % 180 !== 0;
    if (isPortrait) { canvas.width = img.height; canvas.height = img.width; }
    else { canvas.width = img.width; canvas.height = img.height; }
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((deg * Math.PI) / 180);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    const result = canvas.toDataURL('image/png');
    bgPreviewImg.src = result;
    const blob = await (await fetch(result)).blob();
    if (bgCurrentView === 'original') window.bgOriginalBlob = blob;
    else window.bgProcessedBlob = blob;
}

async function getRemBG() {
    if (rembgEngine) return rembgEngine;
    const module = await import('https://cdn.jsdelivr.net/npm/@imgly/background-removal/+esm');
    rembgEngine = module.removeBackground;
    return rembgEngine;
}

window.doRemoveBG = async function (mode = 'api') {
    const bgLoader = document.getElementById('bg-loader');
    const bgScanner = document.getElementById('bg-scanner');
    const bgPreviewImg = document.getElementById('bg-preview-img');
    const bgProcessBtn = document.getElementById('bg-process-btn');
    const bgRemBGBtn = document.getElementById('bg-rembg-btn');
    const bgDownloadBtn = document.getElementById('bg-download-btn');
    const loaderTitle = bgLoader ? bgLoader.querySelector('h4') : null;
    const loaderSubtitle = bgLoader ? bgLoader.querySelector('p') : null;

    if (!bgPreviewImg) return;

    try {
        if (bgLoader) bgLoader.classList.remove('hidden');
        if (bgScanner) bgScanner.style.display = 'block';
        bgPreviewImg.style.opacity = '0.5';

        if (loaderTitle && loaderSubtitle) {
            if (mode === 'rembg') {
                loaderTitle.textContent = 'Swift Engine Scanning...';
                loaderSubtitle.textContent = 'Give us a moment...';
            } else {
                loaderTitle.textContent = 'AI Engine Scanning...';
                loaderSubtitle.textContent = 'Give us a moment...';
            }
        }

        // Give UI time to update before heavy WASM task
        await new Promise(r => setTimeout(r, 100));

        let blob;
        const currentImgSrc = bgPreviewImg.src;

        if (mode === 'api') {
            const img = new Image();
            img.src = currentImgSrc;
            await new Promise(r => img.onload = r);
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const dataUrl = canvas.toDataURL('image/png');
            blob = await (await fetch(dataUrl)).blob();

            const formData = new FormData();
            formData.append('image_file', blob);
            formData.append('size', 'auto');

            const apiResponse = await fetch('https://api.remove.bg/v1.0/removebg', {
                method: 'POST',
                headers: { 'X-Api-Key': apiKey },
                body: formData
            });

            if (!apiResponse.ok) {
                const error = await apiResponse.json();
                throw new Error(error.errors[0].title || 'API Error');
            }
            blob = await apiResponse.blob();
        } else {
            const removeBG = await getRemBG();
            const isMobile = window.innerWidth <= 768;
            blob = await removeBG(currentImgSrc, {
                model: isMobile ? 'small' : 'medium'
            });
        }

        window.bgProcessedBlob = blob;
        await window.updateBgView('processed');

        if (bgProcessBtn) bgProcessBtn.classList.add('hidden');
        if (bgRemBGBtn) bgRemBGBtn.classList.add('hidden');
        if (bgDownloadBtn) bgDownloadBtn.classList.remove('hidden');

        setTimeout(() => {
            notify('Background removed successfully!', 'success');
        }, 500);
    } catch (error) {
        console.error(error);
        notify('Error: ' + error.message, 'error');
    } finally {
        if (bgLoader) bgLoader.classList.add('hidden');
        if (bgScanner) bgScanner.style.display = 'none';
        bgPreviewImg.style.opacity = '1';
        if (loaderTitle) loaderTitle.textContent = 'AI is Scanning Subject...';
    }
};

async function startExtend() {
    const bgPreviewImg = document.getElementById('bg-preview-img');
    const bgExtendBtn = document.getElementById('bg-extend-btn');
    const bgCancelExtend = document.getElementById('bg-cancel-extend');
    const bgMainBox = document.getElementById('bg-main-box');
    const bgColorPicker = document.getElementById('bg-color-picker');

    if (!window.bgOriginalBlob || !bgPreviewImg || !bgMainBox) return;
    isExtending = true;
    if (bgExtendBtn) bgExtendBtn.innerHTML = '<i data-lucide="check"></i> Apply';
    if (bgCancelExtend) bgCancelExtend.classList.remove('hidden');
    lucide.createIcons();

    const img = new Image();
    img.src = bgPreviewImg.src;
    await new Promise(r => img.onload = r);

    const aspectRatio = bgMainBox.clientWidth / bgMainBox.clientHeight;
    const canvas = document.createElement('canvas');

    if (img.width / img.height > aspectRatio) {
        canvas.width = img.width;
        canvas.height = img.width / aspectRatio;
    } else {
        canvas.height = img.height;
        canvas.width = img.height * aspectRatio;
    }

    const ctx = canvas.getContext('2d');

    if (bgCurrentView === 'processed' && window.bgProcessedBlob) {
        if (bgCurrentType === 'color' && bgColorPicker) {
            ctx.fillStyle = bgColorPicker.value;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        } else if (bgCurrentType === 'gradient' && bgSelectedGradient) {
            const parts = bgSelectedGradient.match(/#([a-fA-F0-9]{6})/g);
            if (parts && parts.length >= 2) {
                const grd = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
                grd.addColorStop(0, parts[0]);
                grd.addColorStop(1, parts[1]);
                ctx.fillStyle = grd;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
        } else if (bgCurrentType === 'image' && bgCustomImg) {
            const ratio = Math.max(canvas.width / bgCustomImg.width, canvas.height / bgCustomImg.height);
            const w = bgCustomImg.width * ratio;
            const h = bgCustomImg.height * ratio;
            ctx.drawImage(bgCustomImg, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
        }
    }

    ctx.drawImage(img, (canvas.width - img.width) / 2, (canvas.height - img.height) / 2);

    extendPreviewData = canvas.toDataURL('image/png');
    bgPreviewImg.src = extendPreviewData;
}

function finishExtend() {
    const bgExtendBtn = document.getElementById('bg-extend-btn');
    const bgCancelExtend = document.getElementById('bg-cancel-extend');

    isExtending = false;
    if (bgExtendBtn) bgExtendBtn.innerHTML = '<i data-lucide="maximize"></i> Extend to Preview';
    if (bgCancelExtend) bgCancelExtend.classList.add('hidden');
    extendPreviewData = null;
    lucide.createIcons();
}


// =========================================================================
// COMPRESS IMAGE LOGIC
// =========================================================================
function updateCompressImgStats() {
    const compressImgOriginalSizeText = document.getElementById('compress-img-original-size');
    const compressImgEstimatedSizeText = document.getElementById('compress-img-estimated-size');
    const compressImgSlider = document.getElementById('compress-img-slider');

    if (!compressImgSlider) return;

    if (compressImgFiles.length === 0) {
        if (compressImgOriginalSizeText) compressImgOriginalSizeText.textContent = '0 KB';
        if (compressImgEstimatedSizeText) compressImgEstimatedSizeText.textContent = '0 KB';
        return;
    }
    let totalSize = 0;
    compressImgFiles.forEach(item => {
        totalSize += item.file.size;
    });
    if (compressImgOriginalSizeText) compressImgOriginalSizeText.textContent = formatBytes(totalSize);

    clearTimeout(estimateImgTimeout);
    estimateImgTimeout = setTimeout(async () => {
        if (isEstimatingImages) return;
        isEstimatingImages = true;

        try {
            const quality = parseInt(compressImgSlider.value) / 100;
            let totalEstSize = 0;

            const promises = compressImgFiles.map(async (item) => {
                if (!item.imgElement) {
                    const img = new Image();
                    const dataUrl = await new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onload = (e) => resolve(e.target.result);
                        reader.readAsDataURL(item.file);
                    });
                    await new Promise((resolve) => {
                        img.onload = resolve;
                        img.src = dataUrl;
                    });
                    item.imgElement = img;
                }

                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const rotation = item.rotation || 0;
                const isPortrait = rotation % 180 === 0;
                canvas.width = isPortrait ? item.imgElement.width : item.imgElement.height;
                canvas.height = isPortrait ? item.imgElement.height : item.imgElement.width;

                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                ctx.translate(canvas.width / 2, canvas.height / 2);
                ctx.rotate((rotation * Math.PI) / 180);
                ctx.drawImage(item.imgElement, -item.imgElement.width / 2, -item.imgElement.height / 2);
                ctx.setTransform(1, 0, 0, 1, 0, 0);

                return new Promise((resolve) => {
                    canvas.toBlob((blob) => {
                        resolve(blob ? blob.size : 0);
                    }, 'image/jpeg', quality);
                });
            });

            const sizes = await Promise.all(promises);
            totalEstSize = sizes.reduce((a, b) => a + b, 0);
            if (compressImgEstimatedSizeText) compressImgEstimatedSizeText.textContent = formatBytes(totalEstSize);
        } catch (err) {
            console.error("Image estimation failed", err);
            const quality = parseInt(compressImgSlider.value) / 100;
            if (compressImgEstimatedSizeText) compressImgEstimatedSizeText.textContent = formatBytes(totalSize * (quality * 0.9));
        } finally {
            isEstimatingImages = false;
        }
    }, 250);
}

function handleCompressImgSelect() {
    const compressImgInput = document.getElementById('compress-img-input');
    if (!compressImgInput) return;

    const files = Array.from(compressImgInput.files);
    files.forEach(file => {
        if (file.type.startsWith('image/')) {
            const id = Math.random().toString(36).substr(2, 9);
            compressImgFiles.push({ id, file, rotation: 0 });
        }
    });
    updateCompressImgPreviews();
    updateCompressImgStats();
}

function updateCompressImgPreviews() {
    const compressImgPreviews = document.getElementById('compress-img-previews');
    const compressImgCount = document.getElementById('compress-img-count');
    const compressImgDropZone = document.getElementById('compress-img-drop-zone');
    const compressImgPreviewContainer = document.getElementById('compress-img-preview-container');

    if (!compressImgPreviews) return;

    compressImgPreviews.innerHTML = '';
    if (compressImgCount) compressImgCount.textContent = `${compressImgFiles.length} images selected`;

    if (compressImgFiles.length > 0) {
        if (compressImgDropZone) compressImgDropZone.classList.add('hidden');
        if (compressImgPreviewContainer) compressImgPreviewContainer.classList.remove('hidden');
    } else {
        if (compressImgDropZone) compressImgDropZone.classList.remove('hidden');
        if (compressImgPreviewContainer) compressImgPreviewContainer.classList.add('hidden');
    }

    compressImgFiles.forEach((item) => {
        const div = createPreviewItem(item.id, '', 'compress-img');
        compressImgPreviews.appendChild(div);

        const reader = new FileReader();
        reader.onload = (e) => {
            div.innerHTML = `<img src="${e.target.result}" style="width:100%; height:100%; object-fit:cover; border-radius:12px;">`;
            addRemoveBtn(div, item.id, 'compress-img');
            addRotateBtn(div, item.id, 'compress-img');
            addBadge(div, '');
        };
        reader.readAsDataURL(item.file);
    });
}


// =========================================================================
// COLLAGE MAKER LOGIC
// =========================================================================
async function handleCollageSelect() {
    const collageInput = document.getElementById('collage-input');
    const collagePreviews = document.getElementById('collage-previews');
    const collageDropZone = document.getElementById('collage-drop-zone');
    const collagePreviewContainer = document.getElementById('collage-preview-container');
    const collageCountText = document.getElementById('collage-count');

    if (!collageInput || !collagePreviews) return;

    const files = Array.from(collageInput.files);
    for (const file of files) {
        const id = Math.random().toString(36).substr(2, 9);
        const url = URL.createObjectURL(file);
        const imgObj = await loadImage(url);
        collageItems.push({ id, file, url, scale: 1.0, offsetX: 0, offsetY: 0, img: imgObj });

        const div = createPreviewItem(id, collageItems.length, 'image');
        collagePreviews.appendChild(div);
        div.innerHTML = '';

        const thumbImg = document.createElement('img');
        thumbImg.src = url;
        thumbImg.style.height = '100px';
        thumbImg.style.objectFit = 'cover';
        div.appendChild(thumbImg);

        addRemoveBtn(div, id, 'collage');
        addBadge(div, collageItems.length);
        lucide.createIcons();
    }
    if (collageDropZone) collageDropZone.classList.add('hidden');
    if (collagePreviewContainer) collagePreviewContainer.classList.remove('hidden');
    if (collageCountText) collageCountText.textContent = `${collageItems.length} images selected`;
    updateCollagePageNumbers();
    drawCollage(true);
}

function updateCollagePageNumbers() {
    const collagePreviews = document.getElementById('collage-previews');
    if (!collagePreviews) return;
    const items = collagePreviews.querySelectorAll('.preview-item');
    items.forEach((item, index) => {
        const badge = item.querySelector('.page-badge');
        if (badge) badge.textContent = index + 1;
    });
}

function resetCollage() {
    const collageInput = document.getElementById('collage-input');
    const collagePreviews = document.getElementById('collage-previews');
    const collageDropZone = document.getElementById('collage-drop-zone');
    const collagePreviewContainer = document.getElementById('collage-preview-container');

    collageItems.forEach(item => URL.revokeObjectURL(item.url));
    collageItems = [];
    if (collageInput) collageInput.value = '';
    if (collagePreviews) collagePreviews.innerHTML = '';
    if (collageDropZone) collageDropZone.classList.remove('hidden');
    if (collagePreviewContainer) collagePreviewContainer.classList.add('hidden');
}

async function drawCollage(updateOverlay = true) {
    if (collageItems.length === 0) return;

    const collageCanvas = document.getElementById('collage-canvas');
    const collageSpacingInput = document.getElementById('collage-spacing');
    const collageRadiusInput = document.getElementById('collage-radius');
    const collageBgColor = document.getElementById('collage-bg-color');

    if (!collageCanvas || !collageSpacingInput || !collageRadiusInput || !collageBgColor) return;

    const ctx = collageCanvas.getContext('2d');
    const spacing = parseInt(collageSpacingInput.value);
    const radius = parseInt(collageRadiusInput.value);
    const bgColor = collageBgColor.value;

    let baseWidth = 2000;
    let baseHeight = 2000;
    if (collageRatio === '4:5') baseHeight = 2500;
    if (collageRatio === '16:9') baseHeight = 1125;
    if (collageRatio === '9:16') { baseWidth = 1406; baseHeight = 2500; }

    collageCanvas.width = baseWidth;
    collageCanvas.height = baseHeight;

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, baseWidth, baseHeight);

    const n = collageItems.length;
    let boxes = [];

    if (collageLayout === 'grid') {
        const cols = Math.ceil(Math.sqrt(n));
        const rows = Math.ceil(n / cols);
        const w = (baseWidth - (cols + 1) * spacing) / cols;
        const h = (baseHeight - (rows + 1) * spacing) / rows;
        for (let i = 0; i < n; i++) {
            const r = Math.floor(i / cols);
            const c = i % cols;
            boxes.push({ x: spacing + c * (w + spacing), y: spacing + r * (h + spacing), w: w, h: h });
        }
    } else if (collageLayout === 'hero-l') {
        const mainW = (baseWidth - 3 * spacing) * 0.65;
        const sideW = baseWidth - mainW - 3 * spacing;
        const sideH = (baseHeight - (n) * spacing) / (n - 1);
        boxes.push({ x: spacing, y: spacing, w: mainW, h: baseHeight - 2 * spacing });
        for (let i = 1; i < n; i++) {
            boxes.push({ x: mainW + 2 * spacing, y: spacing + (i - 1) * (sideH + spacing), w: sideW, h: sideH });
        }
    } else if (collageLayout === 'hero-t') {
        const mainH = (baseHeight - 3 * spacing) * 0.6;
        const bottomH = baseHeight - mainH - 3 * spacing;
        const sideW = (baseWidth - (n) * spacing) / (n - 1);
        boxes.push({ x: spacing, y: spacing, w: baseWidth - 2 * spacing, h: mainH });
        for (let i = 1; i < n; i++) {
            boxes.push({ x: spacing + (i - 1) * (sideW + spacing), y: mainH + 2 * spacing, w: sideW, h: bottomH });
        }
    } else if (collageLayout === 'triptych') {
        const w = (baseWidth - (n + 1) * spacing) / n;
        const h = baseHeight - 2 * spacing;
        for (let i = 0; i < n; i++) {
            boxes.push({ x: spacing + i * (w + spacing), y: spacing, w: w, h: h });
        }
    } else if (collageLayout === 'cinema') {
        const w = baseWidth - 2 * spacing;
        const h = (baseHeight - (n + 1) * spacing) / n;
        for (let i = 0; i < n; i++) {
            boxes.push({ x: spacing, y: spacing + i * (h + spacing), w: w, h: h });
        }
    } else if (collageLayout === 'mosaic') {
        const unitH = (baseHeight - 3 * spacing) / 2;
        const unitW = (baseWidth - 3 * spacing) / 2;
        for (let i = 0; i < n; i++) {
            if (i === 0) boxes.push({ x: spacing, y: spacing, w: unitW, h: baseHeight - 2 * spacing });
            else if (i === 1) boxes.push({ x: unitW + 2 * spacing, y: spacing, w: unitW, h: unitH });
            else {
                const restH = unitH - (n - 2 - 1) * spacing;
                const smallH = (unitH - (n - 3) * spacing) / (n - 2);
                boxes.push({ x: unitW + 2 * spacing, y: unitH + 2 * spacing + (i - 2) * (smallH + spacing), w: unitW, h: smallH });
            }
        }
    } else if (collageLayout === 'magazine') {
        const mainW = (baseWidth - 3 * spacing) * 0.75;
        const sideW = baseWidth - mainW - 3 * spacing;
        boxes.push({ x: spacing, y: spacing, w: mainW, h: baseHeight - 2 * spacing });
        const sideH = (baseHeight - (n) * spacing) / (n - 1);
        for (let i = 1; i < n; i++) {
            boxes.push({ x: mainW + 2 * spacing, y: spacing + (i - 1) * (sideH + spacing), w: sideW, h: sideH });
        }
    } else if (collageLayout === 'stack') {
        for (let i = 0; i < n; i++) {
            const offset = i * (baseWidth * 0.05);
            boxes.push({ x: spacing + offset, y: spacing + offset, w: baseWidth - 2 * spacing - offset * 2, h: baseHeight - 2 * spacing - offset * 2 });
        }
    } else if (collageLayout === 'split') {
        const mid = Math.ceil(n / 2);
        const w = (baseWidth - 3 * spacing) / 2;
        const h1 = (baseHeight - (mid + 1) * spacing) / mid;
        const h2 = (baseHeight - (n - mid + 1) * spacing) / (n - mid);
        for (let i = 0; i < n; i++) {
            if (i < mid) boxes.push({ x: spacing, y: spacing + i * (h1 + spacing), w: w, h: h1 });
            else boxes.push({ x: w + 2 * spacing, y: spacing + (i - mid) * (h2 + spacing), w: w, h: h2 });
        }
    } else if (collageLayout === 'feature') {
        const mainSize = (baseWidth - 3 * spacing) * 0.7;
        boxes.push({ x: (baseWidth - mainSize) / 2, y: (baseHeight - mainSize) / 2, w: mainSize, h: mainSize });
        const smallSize = (baseWidth - mainSize - 4 * spacing) / 2;
        for (let i = 1; i < n; i++) {
            const pos = [
                { x: spacing, y: spacing },
                { x: baseWidth - spacing - smallSize, y: spacing },
                { x: spacing, y: baseHeight - spacing - smallSize },
                { x: baseWidth - spacing - smallSize, y: baseHeight - spacing - smallSize }
            ];
            const p = pos[(i - 1) % 4];
            boxes.push({ x: p.x, y: p.y, w: smallSize, h: smallSize });
        }
    }

    for (let i = 0; i < n; i++) {
        try {
            const item = collageItems[i];
            const box = boxes[i];
            const img = item.img || await loadImage(item.url);

            ctx.save();
            if (radius > 0) {
                ctx.beginPath();
                ctx.moveTo(box.x + radius, box.y);
                ctx.lineTo(box.x + box.w - radius, box.y);
                ctx.quadraticCurveTo(box.x + box.w, box.y, box.x + box.w, box.y + radius);
                ctx.lineTo(box.x + box.w, box.y + box.h - radius);
                ctx.quadraticCurveTo(box.x + box.w, box.y + box.h, box.x + box.w - radius, box.y + box.h);
                ctx.lineTo(box.x + radius, box.y + box.h);
                ctx.quadraticCurveTo(box.x, box.y + box.h, box.x, box.y + box.h - radius);
                ctx.lineTo(box.x, box.y + radius);
                ctx.quadraticCurveTo(box.x, box.y, box.x + radius, box.y);
                ctx.closePath();
                ctx.clip();
            }

            const imgRatio = img.width / img.height;
            const boxRatio = box.w / box.h;
            let sw, sh, sx, sy;

            if (imgRatio > boxRatio) {
                sh = img.height;
                sw = sh * boxRatio;
            } else {
                sw = img.width;
                sh = sw / boxRatio;
            }

            const userScale = item.scale || 1.0;
            sw /= userScale;
            sh /= userScale;

            const offX = (item.offsetX || 0) * (img.width / 100);
            const offY = (item.offsetY || 0) * (img.height / 100);

            sx = (img.width - sw) / 2 + offX;
            sy = (img.height - sh) / 2 + offY;

            const minSX = 0;
            const maxSX = img.width - sw;
            const minSY = 0;
            const maxSY = img.height - sh;

            if (sx < minSX) { sx = minSX; item.offsetX = (sx - (img.width - sw) / 2) / (img.width / 100); }
            if (sx > maxSX) { sx = maxSX; item.offsetX = (sx - (img.width - sw) / 2) / (img.width / 100); }
            if (sy < minSY) { sy = minSY; item.offsetY = (sy - (img.height - sh) / 2) / (img.height / 100); }
            if (sy > maxSY) { sy = maxSY; item.offsetY = (sy - (img.height - sh) / 2) / (img.height / 100); }

            ctx.drawImage(img, sx, sy, sw, sh, box.x, box.y, box.w, box.h);
            ctx.restore();
        } catch (e) { console.error(e); }
    }

    if (updateOverlay) updateCollageOverlay(boxes);
}

function updateCollageOverlay(boxes) {
    const overlay = document.getElementById('collage-overlay');
    const collageCanvas = document.getElementById('collage-canvas');

    if (!overlay || !collageCanvas) return;

    overlay.innerHTML = '';

    const scaleX = collageCanvas.clientWidth / collageCanvas.width;
    const scaleY = collageCanvas.clientHeight / collageCanvas.height;

    boxes.forEach((box, i) => {
        const item = collageItems[i];
        if (!item) return;

        const zone = document.createElement('div');
        zone.style.position = 'absolute';
        zone.style.left = (box.x * scaleX) + 'px';
        zone.style.top = (box.y * scaleY) + 'px';
        zone.style.width = (box.w * scaleX) + 'px';
        zone.style.height = (box.h * scaleY) + 'px';
        zone.style.pointerEvents = 'auto';
        zone.style.display = 'flex';
        zone.style.flexDirection = 'column';
        zone.style.alignItems = 'center';
        zone.style.justifyContent = 'center';
        zone.style.gap = '8px';
        zone.style.padding = '8px';
        zone.style.opacity = '0';
        zone.style.transition = 'opacity 0.2s';
        zone.style.cursor = 'default';
        zone.style.background = 'rgba(255,255,255,0.05)';

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = '1';
        slider.max = '3';
        slider.step = '0.05';
        slider.value = item.scale || 1;
        slider.style.width = '70%';
        slider.style.height = '4px';
        slider.style.accentColor = 'var(--accent-color)';
        slider.style.pointerEvents = 'auto';

        slider.oninput = (e) => {
            item.scale = parseFloat(e.target.value);
            drawCollage(false);
        };

        zone.onmouseenter = () => { if (!window.isCollageDragging) zone.style.opacity = '1'; };
        zone.onmouseleave = () => { if (!window.isCollageDragging) zone.style.opacity = '0'; };

        let startX, startY;
        let isLocalDragging = false;

        const startDrag = (clientX, clientY) => {
            isLocalDragging = true;
            window.isCollageDragging = true;
            startX = clientX;
            startY = clientY;
            zone.style.cursor = 'grabbing';
            zone.style.opacity = '1';
        };

        const moveDrag = (clientX, clientY) => {
            if (!isLocalDragging) return;

            const dxDisp = clientX - startX;
            const dyDisp = clientY - startY;

            const dxCanvas = dxDisp / scaleX;
            const dyCanvas = dyDisp / scaleY;

            const imgRatio = item.img.width / item.img.height;
            const boxRatio = box.w / box.h;
            let sw;
            if (imgRatio > boxRatio) sw = item.img.height * boxRatio;
            else sw = item.img.width;
            sw /= (item.scale || 1.0);

            const sPerC = sw / box.w;

            const dxSrc = dxCanvas * sPerC;
            const dySrc = dyCanvas * sPerC;

            item.offsetX = (item.offsetX || 0) - (dxSrc / (item.img.width / 100));
            item.offsetY = (item.offsetY || 0) - (dySrc / (item.img.height / 100));

            startX = clientX;
            startY = clientY;
            drawCollage(false);
        };

        const endDrag = () => {
            isLocalDragging = false;
            window.isCollageDragging = false;
            zone.style.cursor = 'default';
        };

        zone.onmousedown = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.closest('button')) return;
            startDrag(e.clientX, e.clientY);
        };

        window.addEventListener('mousemove', (e) => moveDrag(e.clientX, e.clientY));
        window.addEventListener('mouseup', endDrag);

        zone.ontouchstart = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.closest('button')) return;
            startDrag(e.touches[0].clientX, e.touches[0].clientY);
        };
        window.addEventListener('touchmove', (e) => {
            if (isLocalDragging) {
                e.preventDefault();
                moveDrag(e.touches[0].clientX, e.touches[0].clientY);
            }
        }, { passive: false });
        window.addEventListener('touchend', endDrag);

        zone.appendChild(slider);
        overlay.appendChild(zone);
        lucide.createIcons({ root: zone });
    });
}

function loadImage(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
    });
}


// =========================================================================
// EVENT BINDINGS AND INIT
// =========================================================================
function initImageToolsUI() {
    // 1. Background Remover Events
    const bgInput = document.getElementById('bg-input');
    const bgDropZone = document.getElementById('bg-drop-zone');
    const bgProcessBtn = document.getElementById('bg-process-btn');
    const bgRemBGBtn = document.getElementById('bg-rembg-btn');
    const bgDownloadBtn = document.getElementById('bg-download-btn');
    const bgColorPicker = document.getElementById('bg-color-picker');
    const bgCropBtn = document.getElementById('bg-crop-btn');
    const bgCancelCrop = document.getElementById('bg-cancel-crop');
    const bgRotateL = document.getElementById('bg-rotate-l');
    const bgRotateR = document.getElementById('bg-rotate-r');
    const clearBgBtn = document.getElementById('clear-bg');
    const bgOptionBtns = document.querySelectorAll('.bg-option-btn');
    const bgUploadBtn = document.getElementById('bg-upload-btn');
    const bgImgInput = document.getElementById('bg-img-input');
    const gradientList = document.getElementById('gradient-list');
    const bgExtendBtn = document.getElementById('bg-extend-btn');
    const bgCancelExtend = document.getElementById('bg-cancel-extend');

    // Fill swatches if not already filled
    if (gradientList && gradientList.children.length === 0) {
        bgGradients.forEach(g => {
            const div = document.createElement('div');
            div.className = 'gradient-swatch';
            div.style.background = g;
            div.addEventListener('click', () => {
                document.querySelectorAll('.gradient-swatch').forEach(s => s.classList.remove('active'));
                div.classList.add('active');
                bgSelectedGradient = g;
                if (window.bgProcessedBlob) applyBgStyling();
            });
            gradientList.appendChild(div);
        });
    }

    if (bgOptionBtns) {
        bgOptionBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                bgOptionBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                bgCurrentType = btn.dataset.bgType;

                document.querySelectorAll('.bg-ctrl-panel').forEach(p => p.classList.add('hidden'));
                if (bgCurrentType === 'color') {
                    const el = document.getElementById('bg-color-ctrl');
                    if (el) el.classList.remove('hidden');
                } else if (bgCurrentType === 'gradient') {
                    const el = document.getElementById('bg-gradient-ctrl');
                    if (el) el.classList.remove('hidden');
                } else if (bgCurrentType === 'image') {
                    const el = document.getElementById('bg-image-ctrl');
                    if (el) el.classList.remove('hidden');
                }

                if (window.bgProcessedBlob) applyBgStyling();
            });
        });
    }

    if (bgUploadBtn && bgImgInput) {
        bgUploadBtn.addEventListener('click', () => bgImgInput.click());
        bgImgInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                const img = new Image();
                img.src = URL.createObjectURL(file);
                await new Promise(r => img.onload = r);
                bgCustomImg = img;
                if (window.bgProcessedBlob) applyBgStyling();
            }
        });
    }

    if (bgInput) {
        if (bgDropZone) bgDropZone.addEventListener('click', () => bgInput.click());
        bgInput.addEventListener('change', handleBgSelect);
    }
    if (bgDropZone) {
        bgDropZone.addEventListener('dragover', (e) => { e.preventDefault(); bgDropZone.classList.add('drag-over'); });
        bgDropZone.addEventListener('dragleave', () => bgDropZone.classList.remove('drag-over'));
        bgDropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            bgDropZone.classList.remove('drag-over');
            if (e.dataTransfer.files.length > 0 && bgInput) { bgInput.files = e.dataTransfer.files; handleBgSelect(); }
        });
    }

    if (bgColorPicker) bgColorPicker.addEventListener('input', () => { if (window.bgProcessedBlob) applyBgStyling(); });
    if (bgRotateL) bgRotateL.addEventListener('click', () => rotateBg(-90));
    if (bgRotateR) bgRotateR.addEventListener('click', () => rotateBg(90));

    if (bgCropBtn) {
        bgCropBtn.addEventListener('click', () => {
            const bgPreviewImg = document.getElementById('bg-preview-img');
            if (!bgPreviewImg) return;

            if (bgCropper) {
                const canvas = bgCropper.getCroppedCanvas();
                const result = canvas.toDataURL('image/png');
                bgPreviewImg.src = result;
                fetch(result).then(r => r.blob()).then(b => {
                    if (bgCurrentView === 'original') window.bgOriginalBlob = b;
                    else window.bgProcessedBlob = b;
                });
                bgCropper.destroy(); bgCropper = null;
                bgCropBtn.innerHTML = '<i data-lucide="crop"></i> Crop';
                if (bgCancelCrop) bgCancelCrop.classList.add('hidden');
            } else {
                bgCropper = new Cropper(bgPreviewImg, { aspectRatio: NaN, viewMode: 1, background: false });
                bgCropBtn.innerHTML = '<i data-lucide="check"></i> Apply';
                if (bgCancelCrop) bgCancelCrop.classList.remove('hidden');
            }
            lucide.createIcons();
        });
    }

    if (bgCancelCrop) {
        bgCancelCrop.addEventListener('click', () => {
            if (bgCropper) {
                bgCropper.destroy(); bgCropper = null;
                if (bgCropBtn) bgCropBtn.innerHTML = '<i data-lucide="crop"></i> Crop';
                bgCancelCrop.classList.add('hidden');
                lucide.createIcons();
                window.updateBgView(bgCurrentView);
            }
        });
    }

    if (bgExtendBtn) {
        bgExtendBtn.addEventListener('click', async () => {
            const bgPreviewImg = document.getElementById('bg-preview-img');
            if (isExtending) {
                if (extendPreviewData) {
                    const blob = await (await fetch(extendPreviewData)).blob();
                    if (bgCurrentView === 'original') window.bgOriginalBlob = blob;
                    else window.bgProcessedBlob = blob;
                    if (bgPreviewImg) bgPreviewImg.src = extendPreviewData;
                    notify('Background extended to preview limits.', 'success');
                }
                finishExtend();
            } else {
                startExtend();
            }
        });
    }

    if (bgCancelExtend) {
        bgCancelExtend.addEventListener('click', () => {
            finishExtend();
            window.updateBgView(bgCurrentView);
        });
    }

    if (clearBgBtn) {
        clearBgBtn.addEventListener('click', () => {
            const bgPreviewContainer = document.getElementById('bg-preview-container');
            window.bgOriginalBlob = null; window.bgProcessedBlob = null; bgCustomImg = null;
            if (bgInput) bgInput.value = '';
            if (bgDropZone) bgDropZone.classList.remove('hidden');
            if (bgPreviewContainer) bgPreviewContainer.classList.add('hidden');
            if (bgCropper) { bgCropper.destroy(); bgCropper = null; }
        });
    }

    if (bgDownloadBtn) {
        bgDownloadBtn.addEventListener('click', () => {
            const bgPreviewImg = document.getElementById('bg-preview-img');
            if (!bgPreviewImg) return;
            const link = document.createElement('a');
            link.download = 'swift_bg_removed.png'; link.href = bgPreviewImg.src; link.click();
        });
    }

    if (bgProcessBtn) {
        bgProcessBtn.addEventListener('click', () => {
            if (typeof window.doRemoveBG === 'function') window.doRemoveBG('api');
        });
    }

    if (bgRemBGBtn) {
        bgRemBGBtn.addEventListener('click', () => {
            if (typeof window.doRemoveBG === 'function') window.doRemoveBG('rembg');
        });
    }

    // 2. Compress Image Events
    const compressImgInput = document.getElementById('compress-img-input');
    const compressImgDropZone = document.getElementById('compress-img-drop-zone');
    const addMoreCompressImgBtn = document.getElementById('add-more-compress-img');
    const compressImgSlider = document.getElementById('compress-img-slider');
    const compressImgQualityValue = document.getElementById('compress-img-quality-value');
    const clearCompressImgBtn = document.getElementById('clear-compress-img');
    const compressImgBtn = document.getElementById('compress-img-btn');

    if (compressImgInput) {
        if (compressImgDropZone) compressImgDropZone.addEventListener('click', () => compressImgInput.click());
        if (addMoreCompressImgBtn) addMoreCompressImgBtn.addEventListener('click', () => compressImgInput.click());
        compressImgInput.addEventListener('change', handleCompressImgSelect);
    }
    if (compressImgDropZone) {
        compressImgDropZone.addEventListener('dragover', (e) => { e.preventDefault(); compressImgDropZone.classList.add('drag-over'); });
        compressImgDropZone.addEventListener('dragleave', () => compressImgDropZone.classList.remove('drag-over'));
        compressImgDropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            compressImgDropZone.classList.remove('drag-over');
            if (e.dataTransfer.files.length > 0 && compressImgInput) {
                const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
                if (files.length > 0) {
                    const dt = new DataTransfer();
                    files.forEach(f => dt.items.add(f));
                    compressImgInput.files = dt.files;
                    handleCompressImgSelect();
                }
            }
        });
    }

    if (compressImgSlider) {
        compressImgSlider.addEventListener('input', (e) => {
            if (compressImgQualityValue) compressImgQualityValue.textContent = e.target.value + '%';
            updateCompressImgStats();
        });
    }

    if (clearCompressImgBtn) {
        clearCompressImgBtn.addEventListener('click', () => {
            compressImgFiles = [];
            if (compressImgInput) compressImgInput.value = '';
            updateCompressImgPreviews();
            updateCompressImgStats();
        });
    }

    if (compressImgBtn) {
        compressImgBtn.addEventListener('click', async () => {
            if (compressImgFiles.length === 0) return;

            showStatus('Compressing Images...');
            const quality = parseInt(compressImgSlider ? compressImgSlider.value : 80) / 100;

            try {
                for (let i = 0; i < compressImgFiles.length; i++) {
                    const item = compressImgFiles[i];
                    const img = new Image();
                    const dataUrl = await new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onload = (e) => resolve(e.target.result);
                        reader.readAsDataURL(item.file);
                    });

                    await new Promise((resolve) => {
                        img.onload = resolve;
                        img.src = dataUrl;
                    });

                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');

                    const rotation = item.rotation || 0;
                    const isPortrait = rotation % 180 === 0;
                    canvas.width = isPortrait ? img.width : img.height;
                    canvas.height = isPortrait ? img.height : img.width;

                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);

                    ctx.translate(canvas.width / 2, canvas.height / 2);
                    ctx.rotate((rotation * Math.PI) / 180);
                    ctx.drawImage(img, -img.width / 2, -img.height / 2);
                    ctx.setTransform(1, 0, 0, 1, 0, 0);

                    const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);

                    const link = document.createElement('a');
                    link.download = item.file.name.replace(/\.[^/.]+$/, "") + '_Compressed.jpg';
                    link.href = compressedDataUrl;
                    link.click();

                    if (i < compressImgFiles.length - 1) {
                        await new Promise(r => setTimeout(r, 300));
                    }
                }
                showStatus('Success!', 2000);
                notify('Images compressed successfully.', 'success');
            } catch (error) {
                console.error(error);
                notify('Error compressing images.', 'error');
                hideStatus();
            }
        });
    }

    // 3. Collage Maker Events
    const collageInput = document.getElementById('collage-input');
    const collageDropZone = document.getElementById('collage-drop-zone');
    const addMoreCollageBtn = document.getElementById('add-more-collage');
    const clearCollageBtn = document.getElementById('clear-collage');
    const collageSpacingInput = document.getElementById('collage-spacing');
    const collageSpacingVal = document.getElementById('collage-spacing-val');
    const collageRadiusInput = document.getElementById('collage-radius');
    const collageRadiusVal = document.getElementById('collage-radius-val');
    const collageBgColor = document.getElementById('collage-bg-color');
    const collageDownloadBtn = document.getElementById('collage-download-btn');

    if (collageInput) {
        if (collageDropZone) collageDropZone.addEventListener('click', () => collageInput.click());
        if (addMoreCollageBtn) addMoreCollageBtn.addEventListener('click', () => collageInput.click());
        collageInput.addEventListener('change', handleCollageSelect);
    }

    if (collageDropZone) {
        collageDropZone.addEventListener('dragover', (e) => { e.preventDefault(); collageDropZone.classList.add('drag-over'); });
        collageDropZone.addEventListener('dragleave', () => collageDropZone.classList.remove('drag-over'));
        collageDropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            collageDropZone.classList.remove('drag-over');
            if (e.dataTransfer.files.length > 0 && collageInput) { collageInput.files = e.dataTransfer.files; handleCollageSelect(); }
        });
    }

    if (clearCollageBtn) clearCollageBtn.addEventListener('click', resetCollage);

    document.querySelectorAll('[data-layout]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-layout]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            collageLayout = btn.dataset.layout;
            drawCollage(true);
        });
    });

    document.querySelectorAll('[data-ratio]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-ratio]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            collageRatio = btn.dataset.ratio;
            drawCollage(true);
        });
    });

    if (collageSpacingInput) {
        collageSpacingInput.addEventListener('input', () => {
            if (collageSpacingVal) collageSpacingVal.textContent = collageSpacingInput.value + 'px';
            drawCollage(true);
        });
    }

    if (collageRadiusInput) {
        collageRadiusInput.addEventListener('input', () => {
            if (collageRadiusVal) collageRadiusVal.textContent = collageRadiusInput.value + 'px';
            drawCollage(true);
        });
    }

    if (collageBgColor) {
        collageBgColor.addEventListener('input', () => drawCollage(false));
    }

    if (collageDownloadBtn) {
        collageDownloadBtn.addEventListener('click', () => {
            const collageCanvas = document.getElementById('collage-canvas');
            if (!collageCanvas) return;
            const link = document.createElement('a');
            link.download = `collage_${Date.now()}.png`;
            link.href = collageCanvas.toDataURL('image/png');
            link.click();
        });
    }

    // Override original handleDrop for collage reordering
    const originalHandleDrop = window.handleDrop;
    window.handleDrop = function (e) {
        const target = e.target.closest('.preview-item');
        if (!target || target.dataset.id === draggedId) return;

        const tabContent = target.closest('.tab-content');
        if (tabContent && tabContent.id === 'collage-maker') {
            target.classList.remove('drag-over');
            const container = target.parentElement;
            const items = Array.from(container.children);
            const draggedElement = container.querySelector(`[data-id="${draggedId}"]`);
            const fromIndex = items.indexOf(draggedElement);
            const toIndex = items.indexOf(target);

            if (fromIndex < toIndex) target.after(draggedElement);
            else target.before(draggedElement);

            const [moved] = collageItems.splice(fromIndex, 1);
            collageItems.splice(toIndex, 0, moved);
            updateCollagePageNumbers();
            drawCollage();
        } else if (typeof originalHandleDrop === 'function') {
            originalHandleDrop(e);
        }
    };
}

window.addEventListener('DOMContentLoaded', initImageToolsUI);
