function onOpenCvReady() {
    openCvReady = true;
    const statusText = document.getElementById('scanner-status-text');
    if (statusText) statusText.textContent = 'Scanner engine loaded. Ready to scan!';
    console.log('OpenCV.js loaded successfully.');
}
window.onOpenCvReady = onOpenCvReady;

// Initialize camera devices list
async function initCameraList() {
    const scannerSwitchCameraBtn = document.getElementById('scanner-switch-camera-btn');
    try {
        await navigator.mediaDevices.getUserMedia({ video: true }); // Request permission first
        const devices = await navigator.mediaDevices.enumerateDevices();
        scannerDevices = devices.filter(d => d.kind === 'videoinput');
        
        if (scannerDevices.length > 1) {
            if (scannerSwitchCameraBtn) scannerSwitchCameraBtn.classList.remove('hidden');
            
            const backCamIdx = scannerDevices.findIndex(d => 
                d.label.toLowerCase().includes('back') || 
                d.label.toLowerCase().includes('environment') || 
                d.label.toLowerCase().includes('rear')
            );
            if (backCamIdx !== -1) {
                currentDeviceIndex = backCamIdx;
            } else {
                currentDeviceIndex = 0;
            }
        } else {
            if (scannerSwitchCameraBtn) scannerSwitchCameraBtn.classList.add('hidden');
            currentDeviceIndex = 0;
        }
    } catch (err) {
        console.error('Error getting cameras:', err);
    }
}

async function loadScannerImage(file) {
    showStatus('Loading Image...');
    try {
        const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });

        const img = new Image();
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = dataUrl;
        });

        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        scannerCapturedImage = canvas;
        hideStatus();
        openScannerAdjustScreen(dataUrl);
    } catch (err) {
        console.error('Image load failed', err);
        notify('Failed to load image.', 'error');
        hideStatus();
    }
}

async function loadScannerPdf(file) {
    showStatus('Loading PDF...');
    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        if (pdf.numPages === 0) {
            notify('The PDF has no pages.', 'error');
            hideStatus();
            return;
        }
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 2.0 }); // High DPI
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        await page.render({ canvasContext: context, viewport: viewport }).promise;

        scannerCapturedImage = canvas;
        hideStatus();
        openScannerAdjustScreen(canvas.toDataURL('image/png'));
    } catch (err) {
        console.error('PDF load failed', err);
        notify('Failed to load PDF.', 'error');
        hideStatus();
    }
}

function openScannerAdjustScreen(imgSrc, preservePoints = false) {
    stopScannerCamera();

    const scannerStartScreen = document.getElementById('scanner-start-screen');
    const scannerActiveScreen = document.getElementById('scanner-active-screen');
    const scannerAdjustScreen = document.getElementById('scanner-adjust-screen');
    const scannerPreviewScreen = document.getElementById('scanner-preview-screen');
    const cropImg = document.getElementById('scanner-crop-img');

    if (scannerStartScreen) scannerStartScreen.classList.add('hidden');
    if (scannerActiveScreen) scannerActiveScreen.classList.add('hidden');
    if (scannerPreviewScreen) scannerPreviewScreen.classList.add('hidden');
    if (scannerAdjustScreen) scannerAdjustScreen.classList.remove('hidden');

    isAdjustScreenInit = !preservePoints;
    if (cropImg) {
        cropImg.src = imgSrc;
        cropImg.onload = () => {
            if (isAdjustScreenInit) {
                isAdjustScreenInit = false;
                let corners = null;
                if (openCvReady && scannerCapturedImage) {
                    try {
                        corners = detectDocumentCornersFromCanvas(scannerCapturedImage);
                    } catch (e) {
                        console.error('Auto detection failed, falling back to default:', e);
                    }
                }

                if (corners) {
                    currentCropPoints = corners.map(pt => ({
                        x: pt.x / scannerCapturedImage.width,
                        y: pt.y / scannerCapturedImage.height
                    }));
                } else {
                    currentCropPoints = [
                        { x: 0.15, y: 0.15 },
                        { x: 0.85, y: 0.15 },
                        { x: 0.85, y: 0.85 },
                        { x: 0.15, y: 0.85 }
                    ];
                }
            }
            updateCropUI();
        };
    }
}

function resetScanner() {
    stopScannerCamera();
    scannerCapturedImage = null;
    scannerCroppedImage = null;

    const scannerStartScreen = document.getElementById('scanner-start-screen');
    const scannerActiveScreen = document.getElementById('scanner-active-screen');
    const scannerAdjustScreen = document.getElementById('scanner-adjust-screen');
    const scannerPreviewScreen = document.getElementById('scanner-preview-screen');
    const scannerFileInput = document.getElementById('scanner-file-input');

    if (scannerStartScreen) scannerStartScreen.classList.remove('hidden');
    if (scannerActiveScreen) scannerActiveScreen.classList.add('hidden');
    if (scannerAdjustScreen) scannerAdjustScreen.classList.add('hidden');
    if (scannerPreviewScreen) scannerPreviewScreen.classList.add('hidden');
    if (scannerFileInput) scannerFileInput.value = '';
}

async function startScannerCamera() {
    if (scannerStream) stopScannerCamera();

    const scannerVideo = document.getElementById('scanner-video');
    const scannerStartScreen = document.getElementById('scanner-start-screen');
    const scannerActiveScreen = document.getElementById('scanner-active-screen');
    const scannerPreviewScreen = document.getElementById('scanner-preview-screen');
    const scannerAdjustScreen = document.getElementById('scanner-adjust-screen');
    const scannerStatusText = document.getElementById('scanner-status-text');

    const device = scannerDevices[currentDeviceIndex];
    const deviceId = device ? device.deviceId : null;
    const constraints = {
        video: {
            deviceId: deviceId ? { exact: deviceId } : undefined,
            facingMode: deviceId ? undefined : 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1080 }
        }
    };

    try {
        scannerStream = await navigator.mediaDevices.getUserMedia(constraints);
        if (scannerVideo) {
            scannerVideo.srcObject = scannerStream;
            scannerVideo.onloadedmetadata = () => {
                scannerVideo.play();
                scannerActive = true;
                if (scannerStartScreen) scannerStartScreen.classList.add('hidden');
                if (scannerActiveScreen) scannerActiveScreen.classList.remove('hidden');
                if (scannerPreviewScreen) scannerPreviewScreen.classList.add('hidden');
                if (scannerAdjustScreen) scannerAdjustScreen.classList.add('hidden');
                if (scannerStatusText) scannerStatusText.textContent = 'Align your document inside the guides and capture';
                scannerAnimationId = requestAnimationFrame(processVideoFrame);
            };
        }
    } catch (err) {
        console.error('Camera access failed:', err);
        notify('Could not access camera stream.', 'error');
    }
}

function stopScannerCamera() {
    scannerActive = false;
    if (scannerAnimationId) {
        cancelAnimationFrame(scannerAnimationId);
        scannerAnimationId = null;
    }
    if (scannerStream) {
        scannerStream.getTracks().forEach(track => track.stop());
        scannerStream = null;
    }
    const scannerVideo = document.getElementById('scanner-video');
    const scannerStartScreen = document.getElementById('scanner-start-screen');
    const scannerActiveScreen = document.getElementById('scanner-active-screen');

    if (scannerVideo) scannerVideo.srcObject = null;
    if (scannerStartScreen) scannerStartScreen.classList.remove('hidden');
    if (scannerActiveScreen) scannerActiveScreen.classList.add('hidden');
}

function sortCorners(pts) {
    const sums = pts.map(p => p.x + p.y);
    const diffs = pts.map(p => p.y - p.x);
    const tl = pts[sums.indexOf(Math.min(...sums))];
    const br = pts[sums.indexOf(Math.max(...sums))];
    const tr = pts[diffs.indexOf(Math.min(...diffs))];
    const bl = pts[diffs.indexOf(Math.max(...diffs))];
    return [tl, tr, br, bl];
}

function detectDocumentCornersFromCanvas(canvas) {
    const vw = canvas.width;
    const vh = canvas.height;
    if (vw === 0 || vh === 0) return null;

    let detected = null;
    if (openCvReady) {
        try {
            const src = cv.imread(canvas);
            const dst = new cv.Mat();
            const scale = Math.min(1.0, 600 / Math.max(vw, vh));
            const dsize = new cv.Size(vw * scale, vh * scale);
            cv.resize(src, dst, dsize, 0, 0, cv.INTER_AREA);

            const gray = new cv.Mat();
            const blurred = new cv.Mat();
            const edged = new cv.Mat();
            cv.cvtColor(dst, gray, cv.COLOR_RGBA2GRAY);
            cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
            cv.Canny(blurred, edged, 30, 120);

            let kernel = cv.Mat.ones(3, 3, cv.CV_8U);
            cv.dilate(edged, edged, kernel);
            kernel.delete();

            const contours = new cv.MatVector();
            const hierarchy = new cv.Mat();
            cv.findContours(edged, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

            let maxArea = 0;
            let bestContour = null;

            for (let i = 0; i < contours.size(); ++i) {
                const contour = contours.get(i);
                const area = cv.contourArea(contour);
                if (area > (vw * vh * scale * scale * 0.02)) {
                    const perimeter = cv.arcLength(contour, true);
                    const tempApprox = new cv.Mat();

                    let foundQuad = false;
                    for (let epsilonFactor = 0.01; epsilonFactor <= 0.05; epsilonFactor += 0.01) {
                        cv.approxPolyDP(contour, tempApprox, epsilonFactor * perimeter, true);
                        if (tempApprox.rows === 4) {
                            foundQuad = true;
                            break;
                        }
                    }

                    if (foundQuad && area > maxArea) {
                        maxArea = area;
                        if (bestContour) bestContour.delete();
                        bestContour = tempApprox.clone();
                    }
                    tempApprox.delete();
                }
            }

            if (bestContour) {
                const pts = [];
                for (let i = 0; i < 4; i++) {
                    pts.push({
                        x: bestContour.data32S[i * 2] / scale,
                        y: bestContour.data32S[i * 2 + 1] / scale
                    });
                }
                detected = sortCorners(pts);
                bestContour.delete();
            }

            src.delete();
            dst.delete();
            gray.delete();
            blurred.delete();
            edged.delete();
            contours.delete();
            hierarchy.delete();
        } catch (e) {
            console.error('Error in OpenCV corner detection:', e);
        }
    }
    return detected;
}

function performWarpCropVanilla(srcCanvas, corners, targetWidth, targetHeight) {
    scannerCroppedImage = document.createElement('canvas');
    scannerCroppedImage.width = targetWidth;
    scannerCroppedImage.height = targetHeight;

    const srcCtx = srcCanvas.getContext('2d');
    const srcWidth = srcCanvas.width;
    const srcHeight = srcCanvas.height;
    const srcData = srcCtx.getImageData(0, 0, srcWidth, srcHeight).data;

    const dstCtx = scannerCroppedImage.getContext('2d');
    const dstImgData = dstCtx.createImageData(targetWidth, targetHeight);
    const dstData = dstImgData.data;

    const tl = corners[0];
    const tr = corners[1];
    const br = corners[2];
    const bl = corners[3];

    for (let y = 0; y < targetHeight; y++) {
        const v = y / targetHeight;
        for (let x = 0; x < targetWidth; x++) {
            const u = x / targetWidth;

            const targetX = (1 - u) * (1 - v) * tl.x + u * (1 - v) * tr.x + u * v * br.x + (1 - u) * v * bl.x;
            const targetY = (1 - u) * (1 - v) * tl.y + u * (1 - v) * tr.y + u * v * br.y + (1 - u) * v * bl.y;

            const srcX = Math.round(targetX);
            const srcY = Math.round(targetY);

            if (srcX >= 0 && srcX < srcWidth && srcY >= 0 && srcY < srcHeight) {
                const srcIdx = (srcY * srcWidth + srcX) * 4;
                const dstIdx = (y * targetWidth + x) * 4;

                dstData[dstIdx] = srcData[srcIdx];
                dstData[dstIdx + 1] = srcData[srcIdx + 1];
                dstData[dstIdx + 2] = srcData[srcIdx + 2];
                dstData[dstIdx + 3] = srcData[srcIdx + 3];
            }
        }
    }
    dstCtx.putImageData(dstImgData, 0, 0);
}

function processVideoFrame() {
    if (!scannerActive) return;
    const scannerVideo = document.getElementById('scanner-video');
    const scannerOverlayCanvas = document.getElementById('scanner-overlay-canvas');

    if (!scannerVideo || !scannerOverlayCanvas || scannerVideo.paused || scannerVideo.ended) return;

    const vw = scannerVideo.videoWidth;
    const vh = scannerVideo.videoHeight;
    if (vw === 0 || vh === 0) {
        scannerAnimationId = requestAnimationFrame(processVideoFrame);
        return;
    }

    const rect = scannerVideo.getBoundingClientRect();
    scannerOverlayCanvas.width = rect.width;
    scannerOverlayCanvas.height = rect.height;

    const ctx = scannerOverlayCanvas.getContext('2d');
    ctx.clearRect(0, 0, rect.width, rect.height);

    const marginX = rect.width * 0.1;
    const marginY = rect.height * 0.1;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.clearRect(marginX, marginY, rect.width - 2 * marginX, rect.height - 2 * marginY);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 3;
    ctx.strokeRect(marginX, marginY, rect.width - 2 * marginX, rect.height - 2 * marginY);

    const length = 20;
    ctx.strokeStyle = 'var(--accent-color)';
    ctx.lineWidth = 5;

    ctx.beginPath();
    ctx.moveTo(marginX + length, marginY);
    ctx.lineTo(marginX, marginY);
    ctx.lineTo(marginX, marginY + length);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(rect.width - marginX - length, marginY);
    ctx.lineTo(rect.width - marginX, marginY);
    ctx.lineTo(rect.width - marginX, marginY + length);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(marginX + length, rect.height - marginY);
    ctx.lineTo(marginX, rect.height - marginY);
    ctx.lineTo(marginX, rect.height - marginY - length);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(rect.width - marginX - length, rect.height - marginY);
    ctx.lineTo(rect.width - marginX, rect.height - marginY);
    ctx.lineTo(rect.width - marginX, rect.height - marginY - length);
    ctx.stroke();

    scannerAnimationId = requestAnimationFrame(processVideoFrame);
}

async function captureDocument() {
    const scannerVideo = document.getElementById('scanner-video');
    if (!scannerVideo || !scannerStream) return;

    showStatus('Capturing image...');

    const vw = scannerVideo.videoWidth;
    const vh = scannerVideo.videoHeight;
    const captureCanvas = document.createElement('canvas');
    captureCanvas.width = vw;
    captureCanvas.height = vh;
    const captureCtx = captureCanvas.getContext('2d');
    captureCtx.drawImage(scannerVideo, 0, 0, vw, vh);

    scannerCapturedImage = captureCanvas;
    stopScannerCamera();
    hideStatus();

    openScannerAdjustScreen(captureCanvas.toDataURL('image/png'));
}

function performWarpCrop(srcCanvas, corners, targetWidth, targetHeight) {
    const scannerAdjustScreen = document.getElementById('scanner-adjust-screen');
    const scannerPreviewScreen = document.getElementById('scanner-preview-screen');

    scannerCroppedImage = document.createElement('canvas');
    scannerCroppedImage.width = targetWidth;
    scannerCroppedImage.height = targetHeight;

    if (openCvReady) {
        try {
            const srcMat = cv.imread(srcCanvas);
            const dstMat = new cv.Mat();

            const srcCoords = cv.matFromArray(4, 1, cv.CV_32FC2, [
                corners[0].x, corners[0].y,
                corners[1].x, corners[1].y,
                corners[2].x, corners[2].y,
                corners[3].x, corners[3].y
            ]);
            const dstCoords = cv.matFromArray(4, 1, cv.CV_32FC2, [
                0, 0,
                targetWidth, 0,
                targetWidth, targetHeight,
                0, targetHeight
            ]);

            const M = cv.getPerspectiveTransform(srcCoords, dstCoords);
            cv.warpPerspective(srcMat, dstMat, M, new cv.Size(targetWidth, targetHeight), cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());

            cv.imshow(scannerCroppedImage, dstMat);

            srcMat.delete();
            dstMat.delete();
            srcCoords.delete();
            dstCoords.delete();
            M.delete();
        } catch (e) {
            console.error('Warp perspective failed with OpenCV, using canvas crop fallback:', e);
            performWarpCropVanilla(srcCanvas, corners, targetWidth, targetHeight);
        }
    } else {
        performWarpCropVanilla(srcCanvas, corners, targetWidth, targetHeight);
    }

    applyScannerFilter();

    if (scannerAdjustScreen) scannerAdjustScreen.classList.add('hidden');
    if (scannerPreviewScreen) scannerPreviewScreen.classList.remove('hidden');
    hideStatus();
}

function updateCropUI() {
    const img = document.getElementById('scanner-crop-img');
    const polygon = document.getElementById('scanner-crop-polygon');

    if (!img || !polygon) return;

    const w = img.clientWidth;
    const h = img.clientHeight;
    if (w === 0 || h === 0) return;

    let pointsStr = '';
    currentCropPoints.forEach((pt, i) => {
        const px = pt.x * w;
        const py = pt.y * h;

        const handle = document.getElementById(`scanner-handle-${i}`);
        if (handle) {
            handle.style.left = `${pt.x * 100}%`;
            handle.style.top = `${pt.y * 100}%`;
        }

        pointsStr += `${px},${py} `;
    });
    polygon.setAttribute('points', pointsStr.trim());
}

function updateMagnifier(handleIdx) {
    const magnifier = document.getElementById('scanner-magnifier');
    const mCanvas = document.getElementById('scanner-magnifier-canvas');
    if (!magnifier || !mCanvas || !scannerCapturedImage) return;

    magnifier.classList.remove('hidden');

    const mCtx = mCanvas.getContext('2d');
    const pt = currentCropPoints[handleIdx];
    const imgX = pt.x * scannerCapturedImage.width;
    const imgY = pt.y * scannerCapturedImage.height;

    const zoomSize = 80; 

    mCtx.clearRect(0, 0, 130, 130);
    
    const srcX = Math.max(0, Math.min(scannerCapturedImage.width - zoomSize, imgX - zoomSize / 2));
    const srcY = Math.max(0, Math.min(scannerCapturedImage.height - zoomSize, imgY - zoomSize / 2));
    
    mCtx.drawImage(
        scannerCapturedImage,
        srcX, srcY, zoomSize, zoomSize,
        0, 0, 130, 130
    );
}

function hideMagnifier() {
    const magnifier = document.getElementById('scanner-magnifier');
    if (magnifier) magnifier.classList.add('hidden');
}

function applyScannerFilter() {
    if (!scannerCroppedImage) return;

    const scannerResultImg = document.getElementById('scanner-result-img');
    const watermarkToggle = document.getElementById('scanner-watermark-toggle');
    const watermarkText = document.getElementById('scanner-watermark-text');

    const filteredCanvas = document.createElement('canvas');
    filteredCanvas.width = scannerCroppedImage.width;
    filteredCanvas.height = scannerCroppedImage.height;
    const ctx = filteredCanvas.getContext('2d');
    ctx.drawImage(scannerCroppedImage, 0, 0);

    const imgData = ctx.getImageData(0, 0, filteredCanvas.width, filteredCanvas.height);
    const data = imgData.data;

    if (currentScannerFilter === 'magic') {
        for (let i = 0; i < data.length; i += 4) {
            let r = data[i];
            let g = data[i + 1];
            let b = data[i + 2];

            let gray = 0.299 * r + 0.587 * g + 0.114 * b;

            if (gray > 115) {
                let factor = (gray - 115) / (255 - 115);
                r = r + (255 - r) * (0.6 + factor * 0.4);
                g = g + (255 - g) * (0.6 + factor * 0.4);
                b = b + (255 - b) * (0.6 + factor * 0.4);
            } else {
                let factor = gray / 115;
                r = r * factor;
                g = g * factor;
                b = b * factor;
            }

            let maxVal = Math.max(r, g, b);
            let minVal = Math.min(r, g, b);
            let l = (maxVal + minVal) / 2;
            let d = maxVal - minVal;
            if (d > 8) {
                let s = l > 127 ? d / (510 - maxVal - minVal) : d / (maxVal + minVal);
                let targetS = Math.min(1.0, s * 1.6);
                let ratio = targetS / (s || 1);
                r = l + (r - l) * ratio;
                g = l + (g - l) * ratio;
                b = l + (b - l) * ratio;
            }

            r = ((r - 128) * 1.15) + 128;
            g = ((g - 128) * 1.15) + 128;
            b = ((b - 128) * 1.15) + 128;

            data[i] = Math.min(255, Math.max(0, r));
            data[i + 1] = Math.min(255, Math.max(0, g));
            data[i + 2] = Math.min(255, Math.max(0, b));
        }
        ctx.putImageData(imgData, 0, 0);
    } else if (currentScannerFilter === 'bw') {
        for (let i = 0; i < data.length; i += 4) {
            const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            let newG = ((gray - 128) * 1.6) + 128;
            const val = newG > 135 ? 255 : 0;
            data[i] = val;
            data[i + 1] = val;
            data[i + 2] = val;
        }
        ctx.putImageData(imgData, 0, 0);
    } else if (currentScannerFilter === 'gray') {
        for (let i = 0; i < data.length; i += 4) {
            const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            data[i] = gray;
            data[i + 1] = gray;
            data[i + 2] = gray;
        }
        ctx.putImageData(imgData, 0, 0);
    } else if (currentScannerFilter === 'boost') {
        for (let i = 0; i < data.length; i += 4) {
            let r = data[i];
            let g = data[i + 1];
            let b = data[i + 2];
            r = (r - 128) * 1.3 + 128 + 20;
            g = (g - 128) * 1.3 + 128 + 20;
            b = (b - 128) * 1.3 + 128 + 20;
            data[i] = Math.min(255, Math.max(0, r));
            data[i + 1] = Math.min(255, Math.max(0, g));
            data[i + 2] = Math.min(255, Math.max(0, b));
        }
        ctx.putImageData(imgData, 0, 0);
    }

    if (watermarkToggle && watermarkToggle.checked) {
        const text = (watermarkText ? watermarkText.value : '') || 'Scanned with Swift File';
        const fontSize = Math.max(16, Math.round(filteredCanvas.width * 0.024));
        ctx.font = `bold ${fontSize}px Outfit, sans-serif`;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
        ctx.lineWidth = Math.max(2, Math.round(fontSize * 0.15));

        const margin = Math.max(12, Math.round(filteredCanvas.width * 0.02));
        const x = filteredCanvas.width - margin;
        const y = filteredCanvas.height - margin;

        ctx.strokeText(text, x, y);
        ctx.fillText(text, x, y);
    }

    if (scannerResultImg) scannerResultImg.src = filteredCanvas.toDataURL('image/jpeg', 0.95);
}


// =========================================================================
// INIT DOCUMENT SCANNER EVENT LISTENERS
// =========================================================================
function initScannerUI() {
    const scannerStartBtn = document.getElementById('scanner-start-btn');
    const scannerSwitchCameraBtn = document.getElementById('scanner-switch-camera-btn');
    const scannerStopBtn = document.getElementById('scanner-stop-btn');
    const scannerCaptureBtn = document.getElementById('scanner-capture-btn');
    const scannerRetakeBtn = document.getElementById('scanner-retake-btn');
    const scannerAdjustBackBtn = document.getElementById('scanner-adjust-back-btn');
    const scannerUploadBtn = document.getElementById('scanner-upload-btn');
    const scannerFileInput = document.getElementById('scanner-file-input');
    const scannerApplyCropBtn = document.getElementById('scanner-apply-crop-btn');
    const scannerRecropBtn = document.getElementById('scanner-recrop-btn');
    const scannerAdjustRotateBtn = document.getElementById('scanner-adjust-rotate-btn');
    const scannerSaveJpgBtn = document.getElementById('scanner-save-jpg-btn');
    const scannerSavePdfBtn = document.getElementById('scanner-save-pdf-btn');
    const scannerResultImg = document.getElementById('scanner-result-img');

    const filterOrig = document.getElementById('filter-orig');
    const filterMagic = document.getElementById('filter-magic');
    const filterBw = document.getElementById('filter-bw');
    const filterGray = document.getElementById('filter-gray');
    const filterBoost = document.getElementById('filter-boost');

    const watermarkToggle = document.getElementById('scanner-watermark-toggle');
    const watermarkText = document.getElementById('scanner-watermark-text');

    // Tab Switch Listener to turn off camera
    const navItems = document.querySelectorAll('.sidebar-nav-item, .mobile-nav-item');
    navItems.forEach(tab => {
        tab.addEventListener('click', () => {
            if (tab.dataset.tab !== 'scanner') {
                stopScannerCamera();
            }
        });
    });

    if (scannerStartBtn) scannerStartBtn.addEventListener('click', startScannerCamera);
    if (scannerSwitchCameraBtn) {
        scannerSwitchCameraBtn.addEventListener('click', () => {
            if (scannerDevices.length <= 1) return;
            currentDeviceIndex = (currentDeviceIndex + 1) % scannerDevices.length;
            startScannerCamera();
        });
    }
    if (scannerStopBtn) scannerStopBtn.addEventListener('click', stopScannerCamera);
    if (scannerCaptureBtn) scannerCaptureBtn.addEventListener('click', captureDocument);
    if (scannerRetakeBtn) scannerRetakeBtn.addEventListener('click', resetScanner);
    if (scannerAdjustBackBtn) scannerAdjustBackBtn.addEventListener('click', resetScanner);

    if (scannerUploadBtn && scannerFileInput) {
        scannerUploadBtn.addEventListener('click', () => {
            scannerFileInput.click();
        });
        scannerFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            if (file.type.startsWith('image/')) {
                loadScannerImage(file);
            } else if (file.type === 'application/pdf') {
                loadScannerPdf(file);
            } else {
                notify('Invalid file format. Please select an image or PDF.', 'error');
            }
        });
    }

    // Handles Resize
    window.addEventListener('resize', () => {
        const scannerAdjustScreen = document.getElementById('scanner-adjust-screen');
        if (scannerAdjustScreen && !scannerAdjustScreen.classList.contains('hidden')) {
            updateCropUI();
        }
    });

    // Pointer Drag Handlers for Handles
    let activeHandleIdx = null;
    for (let i = 0; i < 4; i++) {
        const handle = document.getElementById(`scanner-handle-${i}`);
        if (handle) {
            handle.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                activeHandleIdx = i;
                handle.setPointerCapture(e.pointerId);
                updateMagnifier(i);
            });
            handle.addEventListener('pointermove', (e) => {
                if (activeHandleIdx === i) {
                    const container = document.getElementById('scanner-crop-container');
                    if (container) {
                        const rect = container.getBoundingClientRect();
                        let x = (e.clientX - rect.left) / rect.width;
                        let y = (e.clientY - rect.top) / rect.height;

                        x = Math.max(0, Math.min(1, x));
                        y = Math.max(0, Math.min(1, y));

                        currentCropPoints[i] = { x, y };
                        updateCropUI();
                        updateMagnifier(i);
                    }
                }
            });
            handle.addEventListener('pointerup', (e) => {
                if (activeHandleIdx === i) {
                    handle.releasePointerCapture(e.pointerId);
                    activeHandleIdx = null;
                    hideMagnifier();
                }
            });
            handle.addEventListener('pointercancel', (e) => {
                if (activeHandleIdx === i) {
                    handle.releasePointerCapture(e.pointerId);
                    activeHandleIdx = null;
                    hideMagnifier();
                }
            });
        }
    }

    if (scannerApplyCropBtn) {
        scannerApplyCropBtn.addEventListener('click', () => {
            if (!scannerCapturedImage) return;

            showStatus('Processing document...');
            setTimeout(() => {
                const corners = currentCropPoints.map(pt => ({
                    x: pt.x * scannerCapturedImage.width,
                    y: pt.y * scannerCapturedImage.height
                }));

                const tl = corners[0];
                const tr = corners[1];
                const br = corners[2];
                const bl = corners[3];

                const widthBottom = Math.hypot(br.x - bl.x, br.y - bl.y);
                const widthTop = Math.hypot(tr.x - tl.x, tr.y - tl.y);
                const heightRight = Math.hypot(br.x - tr.x, br.y - tr.y);
                const heightLeft = Math.hypot(bl.x - tl.x, bl.y - tl.y);

                const targetWidth = Math.round(Math.max(widthBottom, widthTop));
                const targetHeight = Math.round(Math.max(heightRight, heightLeft));

                performWarpCrop(scannerCapturedImage, corners, targetWidth, targetHeight);
            }, 50);
        });
    }

    if (watermarkToggle) {
        watermarkToggle.addEventListener('change', function () {
            if (watermarkText) {
                if (this.checked) {
                    watermarkText.style.display = 'block';
                    watermarkText.focus();
                } else {
                    watermarkText.style.display = 'none';
                }
            }
            applyScannerFilter();
        });
    }

    if (watermarkText) {
        watermarkText.addEventListener('input', applyScannerFilter);
    }

    const filterBtns = [filterOrig, filterMagic, filterBw, filterGray, filterBoost];
    filterBtns.forEach(btn => {
        if (btn) {
            btn.addEventListener('click', () => {
                filterBtns.forEach(b => { if (b) b.classList.remove('active'); });
                btn.classList.add('active');
                if (btn === filterOrig) currentScannerFilter = 'original';
                if (btn === filterMagic) currentScannerFilter = 'magic';
                if (btn === filterBw) currentScannerFilter = 'bw';
                if (btn === filterGray) currentScannerFilter = 'gray';
                if (btn === filterBoost) currentScannerFilter = 'boost';
                applyScannerFilter();
            });
        }
    });

    if (scannerRecropBtn) {
        scannerRecropBtn.addEventListener('click', () => {
            if (!scannerCapturedImage) return;
            openScannerAdjustScreen(scannerCapturedImage.toDataURL('image/png'), true);
        });
    }

    if (scannerAdjustRotateBtn) {
        scannerAdjustRotateBtn.addEventListener('click', () => {
            if (!scannerCapturedImage) return;
            
            const container = document.getElementById('scanner-crop-container');
            if (!container) return;

            container.style.pointerEvents = 'none';
            container.style.transform = 'rotate(90deg) scale(0.8)';

            setTimeout(() => {
                const canvas = document.createElement('canvas');
                canvas.width = scannerCapturedImage.height;
                canvas.height = scannerCapturedImage.width;
                const ctx = canvas.getContext('2d');
                ctx.translate(canvas.width / 2, canvas.height / 2);
                ctx.rotate((90 * Math.PI) / 180);
                ctx.drawImage(scannerCapturedImage, -scannerCapturedImage.width / 2, -scannerCapturedImage.height / 2);
                scannerCapturedImage = canvas;

                const p0 = { x: 1 - currentCropPoints[3].y, y: currentCropPoints[3].x };
                const p1 = { x: 1 - currentCropPoints[0].y, y: currentCropPoints[0].x };
                const p2 = { x: 1 - currentCropPoints[1].y, y: currentCropPoints[1].x };
                const p3 = { x: 1 - currentCropPoints[2].y, y: currentCropPoints[2].x };
                currentCropPoints = [p0, p1, p2, p3];

                const cropImg = document.getElementById('scanner-crop-img');
                if (cropImg) cropImg.src = scannerCapturedImage.toDataURL('image/png');

                container.style.transition = 'none';
                container.style.transform = 'none';
                container.offsetHeight; 
                container.style.transition = 'transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)';
                container.style.pointerEvents = 'auto';
            }, 450);
        });
    }

    if (scannerSaveJpgBtn) {
        scannerSaveJpgBtn.addEventListener('click', () => {
            if (!scannerResultImg) return;
            const link = document.createElement('a');
            link.download = `SwiftScan_${Date.now()}.jpg`;
            link.href = scannerResultImg.src;
            link.click();
            notify('Document saved as JPG.', 'success');
        });
    }

    if (scannerSavePdfBtn) {
        scannerSavePdfBtn.addEventListener('click', () => {
            if (!scannerResultImg) return;
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('p', 'pt', 'a4');
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const scanW = scannerCroppedImage ? scannerCroppedImage.width : 1000;
            const scanH = scannerCroppedImage ? scannerCroppedImage.height : 1414;
            const scale = Math.min(pageWidth / scanW, pageHeight / scanH);
            const w = scanW * scale;
            const h = scanH * scale;
            pdf.addImage(scannerResultImg.src, 'JPEG', (pageWidth - w) / 2, (pageHeight - h) / 2, w, h);
            const _scanPdfBlob = pdf.output('blob');
            const _scanPdfUrl = URL.createObjectURL(_scanPdfBlob);
            const _scanPdfLink = document.createElement('a');
            _scanPdfLink.href = _scanPdfUrl;
            _scanPdfLink.download = `SwiftScan_${Date.now()}.pdf`;
            _scanPdfLink.click();
            URL.revokeObjectURL(_scanPdfUrl);
            notify('Document saved as PDF.', 'success');
        });
    }

    // Call camera initialization
    initCameraList();
}

window.addEventListener('DOMContentLoaded', initScannerUI);
