async function handleWatermarkSelect() {
    const watermarkInput = document.getElementById('watermark-input');
    const watermarkFilename = document.getElementById('watermark-filename');
    const watermarkDropZone = document.getElementById('watermark-drop-zone');
    const watermarkPreviewContainer = document.getElementById('watermark-preview-container');

    if (!watermarkInput) return;

    const file = watermarkInput.files[0];
    if (!file) return;
    showStatus('Reading document...');
    watermarkFile = file;
    if (watermarkFilename) watermarkFilename.textContent = file.name;

    if (file.type === 'application/pdf') {
        watermarkFileType = 'pdf';
        try {
            const arrayBuffer = await file.arrayBuffer();
            watermarkPdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            const page = await watermarkPdfDoc.getPage(1);
            const viewport = page.getViewport({ scale: 1.0 });
            watermarkPdfFirstPageCanvas = document.createElement('canvas');
            watermarkPdfFirstPageCanvas.width = viewport.width;
            watermarkPdfFirstPageCanvas.height = viewport.height;
            const ctx = watermarkPdfFirstPageCanvas.getContext('2d');
            await page.render({ canvasContext: ctx, viewport: viewport }).promise;
        } catch (e) {
            console.error(e);
            notify('Could not parse PDF file.', 'error');
            hideStatus();
            return;
        }
    } else if (file.type.startsWith('image/')) {
        watermarkFileType = 'image';
        const url = URL.createObjectURL(file);
        watermarkImageObject = await loadImage(url);
    } else {
        notify('Unsupported file type. Please upload a PDF or an Image.', 'error');
        hideStatus();
        return;
    }

    if (watermarkDropZone) watermarkDropZone.classList.add('hidden');
    if (watermarkPreviewContainer) watermarkPreviewContainer.classList.remove('hidden');
    drawWatermarkPreview();
    hideStatus();
}

async function handleWatermarkLogoSelect() {
    const wmImgFileInput = document.getElementById('wm-img-file-input');
    if (!wmImgFileInput) return;

    const file = wmImgFileInput.files[0];
    if (!file) return;
    watermarkLogoFile = file;
    const url = URL.createObjectURL(file);
    watermarkLogoImg = await loadImage(url);
    drawWatermarkPreview();
    notify('Watermark logo uploaded successfully.', 'success');
}

function drawWatermarkPreview() {
    if (!watermarkFile) return;

    const watermarkPreviewCanvas = document.getElementById('watermark-preview-canvas');
    const wmOpacitySlider = document.getElementById('wm-opacity-slider');
    const wmSizeSlider = document.getElementById('wm-size-slider');
    const wmRotationSlider = document.getElementById('wm-rotation-slider');
    const wmTextFont = document.getElementById('wm-text-font');
    const wmTextColor = document.getElementById('wm-text-color');
    const wmTextInput = document.getElementById('wm-text-input');

    if (!watermarkPreviewCanvas || !wmOpacitySlider || !wmSizeSlider || !wmRotationSlider) return;

    const ctx = watermarkPreviewCanvas.getContext('2d');
    let w = 500, h = 500;

    if (watermarkFileType === 'pdf' && watermarkPdfFirstPageCanvas) {
        w = watermarkPdfFirstPageCanvas.width;
        h = watermarkPdfFirstPageCanvas.height;
    } else if (watermarkFileType === 'image' && watermarkImageObject) {
        w = watermarkImageObject.width;
        h = watermarkImageObject.height;
    }

    watermarkPreviewCanvas.width = w;
    watermarkPreviewCanvas.height = h;

    // Draw base content
    if (watermarkFileType === 'pdf' && watermarkPdfFirstPageCanvas) {
        ctx.drawImage(watermarkPdfFirstPageCanvas, 0, 0);
    } else if (watermarkFileType === 'image' && watermarkImageObject) {
        ctx.drawImage(watermarkImageObject, 0, 0);
    }

    // Draw overlay watermark
    ctx.save();
    const opacity = parseInt(wmOpacitySlider.value) / 100;
    ctx.globalAlpha = opacity;

    const sizeMultiplier = parseInt(wmSizeSlider.value) / 100;
    const rot = parseInt(wmRotationSlider.value) * Math.PI / 180;

    if (watermarkActiveType === 'text') {
        const fontName = wmTextFont ? wmTextFont.value : 'Helvetica';
        const baseFontSize = Math.round(w * 0.05);
        const fontSize = Math.round(baseFontSize * sizeMultiplier);
        ctx.font = `bold ${fontSize}px ${fontName === 'Times-Roman' ? 'Times New Roman' : fontName}, sans-serif`;
        ctx.fillStyle = wmTextColor ? wmTextColor.value : '#ff0000';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const text = (wmTextInput ? wmTextInput.value : '') || 'CONFIDENTIAL';

        if (watermarkSelectedPos === 'center') {
            ctx.translate(w / 2, h / 2);
            ctx.rotate(rot);
            ctx.fillText(text, 0, 0);
        } else if (watermarkSelectedPos === 'bottom-right') {
            ctx.translate(w * 0.85, h * 0.9);
            ctx.rotate(rot);
            ctx.fillText(text, 0, 0);
        } else if (watermarkSelectedPos === 'top-left') {
            ctx.translate(w * 0.15, h * 0.1);
            ctx.rotate(rot);
            ctx.fillText(text, 0, 0);
        } else if (watermarkSelectedPos === 'tiled') {
            const stepX = Math.max(120, w / 4) * sizeMultiplier;
            const stepY = Math.max(120, h / 4) * sizeMultiplier;
            for (let x = stepX / 2; x < w; x += stepX) {
                for (let y = stepY / 2; y < h; y += stepY) {
                    ctx.save();
                    ctx.translate(x, y);
                    ctx.rotate(rot);
                    ctx.fillText(text, 0, 0);
                    ctx.restore();
                }
            }
        }
    } else if (watermarkActiveType === 'image' && watermarkLogoImg) {
        const logoW = watermarkLogoImg.width;
        const logoH = watermarkLogoImg.height;
        const baseLogoSize = w * 0.25;
        const targetW = baseLogoSize * sizeMultiplier;
        const targetH = (logoH * targetW) / logoW;

        if (watermarkSelectedPos === 'center') {
            ctx.translate(w / 2, h / 2);
            ctx.rotate(rot);
            ctx.drawImage(watermarkLogoImg, -targetW / 2, -targetH / 2, targetW, targetH);
        } else if (watermarkSelectedPos === 'bottom-right') {
            ctx.translate(w - targetW / 2 - 20, h - targetH / 2 - 20);
            ctx.rotate(rot);
            ctx.drawImage(watermarkLogoImg, -targetW / 2, -targetH / 2, targetW, targetH);
        } else if (watermarkSelectedPos === 'top-left') {
            ctx.translate(targetW / 2 + 20, targetH / 2 + 20);
            ctx.rotate(rot);
            ctx.drawImage(watermarkLogoImg, -targetW / 2, -targetH / 2, targetW, targetH);
        } else if (watermarkSelectedPos === 'tiled') {
            const stepX = Math.max(180, w / 3) * sizeMultiplier;
            const stepY = Math.max(180, h / 3) * sizeMultiplier;
            for (let x = stepX / 2; x < w; x += stepX) {
                for (let y = stepY / 2; y < h; y += stepY) {
                    ctx.save();
                    ctx.translate(x, y);
                    ctx.rotate(rot);
                    ctx.drawImage(watermarkLogoImg, -targetW / 2, -targetH / 2, targetW, targetH);
                    ctx.restore();
                }
            }
        }
    } else if (watermarkActiveType === 'image') {
        ctx.font = `14px Outfit, sans-serif`;
        ctx.fillStyle = '#ef4444';
        ctx.fillText('Please upload a logo image', w / 2, h / 2);
    }
    ctx.restore();
}

function resetWatermark() {
    const watermarkInput = document.getElementById('watermark-input');
    const wmImgFileInput = document.getElementById('wm-img-file-input');
    const watermarkPreviewCanvas = document.getElementById('watermark-preview-canvas');
    const watermarkDropZone = document.getElementById('watermark-drop-zone');
    const watermarkPreviewContainer = document.getElementById('watermark-preview-container');

    watermarkFile = null;
    watermarkFileType = '';
    watermarkLogoFile = null;
    watermarkLogoImg = null;
    watermarkImageObject = null;
    watermarkPdfDoc = null;
    watermarkPdfFirstPageCanvas = null;
    if (watermarkInput) watermarkInput.value = '';
    if (wmImgFileInput) wmImgFileInput.value = '';
    if (watermarkPreviewCanvas) {
        watermarkPreviewCanvas.width = 100;
        watermarkPreviewCanvas.height = 100;
    }
    if (watermarkDropZone) watermarkDropZone.classList.remove('hidden');
    if (watermarkPreviewContainer) watermarkPreviewContainer.classList.add('hidden');
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

function initWatermarkUI() {
    const watermarkDropZone = document.getElementById('watermark-drop-zone');
    const watermarkInput = document.getElementById('watermark-input');
    const clearWatermarkBtn = document.getElementById('clear-watermark');
    const wmTypeTextBtn = document.getElementById('wm-type-text-btn');
    const wmTypeImageBtn = document.getElementById('wm-type-image-btn');
    const wmTextOptions = document.getElementById('wm-text-options');
    const wmImageOptions = document.getElementById('wm-image-options');
    const wmUploadBtn = document.getElementById('wm-upload-btn');
    const wmImgFileInput = document.getElementById('wm-img-file-input');

    const wmTextInput = document.getElementById('wm-text-input');
    const wmTextColor = document.getElementById('wm-text-color');
    const wmTextFont = document.getElementById('wm-text-font');
    const wmOpacitySlider = document.getElementById('wm-opacity-slider');
    const wmOpacityVal = document.getElementById('wm-opacity-val');
    const wmSizeSlider = document.getElementById('wm-size-slider');
    const wmSizeVal = document.getElementById('wm-size-val');
    const wmRotationSlider = document.getElementById('wm-rotation-slider');
    const wmRotationVal = document.getElementById('wm-rotation-val');
    const wmApplyBtn = document.getElementById('wm-apply-btn');

    if (watermarkInput) {
        if (watermarkDropZone) watermarkDropZone.addEventListener('click', () => watermarkInput.click());
        watermarkInput.addEventListener('change', handleWatermarkSelect);
    }

    if (watermarkDropZone) {
        watermarkDropZone.addEventListener('dragover', (e) => { e.preventDefault(); watermarkDropZone.classList.add('drag-over'); });
        watermarkDropZone.addEventListener('dragleave', () => watermarkDropZone.classList.remove('drag-over'));
        watermarkDropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            watermarkDropZone.classList.remove('drag-over');
            if (e.dataTransfer.files.length > 0 && watermarkInput) { watermarkInput.files = e.dataTransfer.files; handleWatermarkSelect(); }
        });
    }

    if (wmUploadBtn && wmImgFileInput) {
        wmUploadBtn.addEventListener('click', () => wmImgFileInput.click());
        wmImgFileInput.addEventListener('change', handleWatermarkLogoSelect);
    }

    if (wmTypeTextBtn) {
        wmTypeTextBtn.addEventListener('click', () => {
            wmTypeTextBtn.classList.add('active');
            if (wmTypeImageBtn) wmTypeImageBtn.classList.remove('active');
            if (wmTextOptions) wmTextOptions.classList.remove('hidden');
            if (wmImageOptions) wmImageOptions.classList.add('hidden');
            watermarkActiveType = 'text';
            drawWatermarkPreview();
        });
    }

    if (wmTypeImageBtn) {
        wmTypeImageBtn.addEventListener('click', () => {
            wmTypeImageBtn.classList.add('active');
            if (wmTypeTextBtn) wmTypeTextBtn.classList.remove('active');
            if (wmImageOptions) wmImageOptions.classList.remove('hidden');
            if (wmTextOptions) wmTextOptions.classList.add('hidden');
            watermarkActiveType = 'image';
            drawWatermarkPreview();
        });
    }

    document.querySelectorAll('[data-wm-pos]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-wm-pos]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            watermarkSelectedPos = btn.dataset.wmPos;
            drawWatermarkPreview();
        });
    });

    if (wmTextInput) wmTextInput.addEventListener('input', drawWatermarkPreview);
    if (wmTextColor) wmTextColor.addEventListener('input', drawWatermarkPreview);
    if (wmTextFont) wmTextFont.addEventListener('change', drawWatermarkPreview);

    if (wmOpacitySlider) {
        wmOpacitySlider.addEventListener('input', () => {
            if (wmOpacityVal) wmOpacityVal.textContent = wmOpacitySlider.value + '%';
            drawWatermarkPreview();
        });
    }
    if (wmSizeSlider) {
        wmSizeSlider.addEventListener('input', () => {
            if (wmSizeVal) wmSizeVal.textContent = wmSizeSlider.value + '%';
            drawWatermarkPreview();
        });
    }
    if (wmRotationSlider) {
        wmRotationSlider.addEventListener('input', () => {
            if (wmRotationVal) wmRotationVal.textContent = wmRotationSlider.value + '°';
            drawWatermarkPreview();
        });
    }

    if (clearWatermarkBtn) clearWatermarkBtn.addEventListener('click', resetWatermark);

    if (wmApplyBtn) {
        wmApplyBtn.addEventListener('click', async () => {
            if (!watermarkFile) return;

            if (watermarkActiveType === 'image' && !watermarkLogoImg) {
                notify('Please upload a watermark logo image first.', 'info');
                return;
            }

            showStatus('Adding watermark...');
            try {
                if (watermarkFileType === 'image') {
                    const outCanvas = document.createElement('canvas');
                    const w = watermarkImageObject.width;
                    const h = watermarkImageObject.height;
                    outCanvas.width = w;
                    outCanvas.height = h;

                    const ctx = outCanvas.getContext('2d');
                    ctx.drawImage(watermarkImageObject, 0, 0);

                    ctx.save();
                    const opacity = parseInt(wmOpacitySlider.value) / 100;
                    ctx.globalAlpha = opacity;

                    const sizeMultiplier = parseInt(wmSizeSlider.value) / 100;
                    const rot = parseInt(wmRotationSlider.value) * Math.PI / 180;

                    if (watermarkActiveType === 'text') {
                        const fontName = wmTextFont ? wmTextFont.value : 'Helvetica';
                        const baseFontSize = Math.round(w * 0.05);
                        const fontSize = Math.round(baseFontSize * sizeMultiplier);
                        ctx.font = `bold ${fontSize}px ${fontName === 'Times-Roman' ? 'Times New Roman' : fontName}, sans-serif`;
                        ctx.fillStyle = wmTextColor ? wmTextColor.value : '#ff0000';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';

                        const text = (wmTextInput ? wmTextInput.value : '') || 'CONFIDENTIAL';

                        if (watermarkSelectedPos === 'center') {
                            ctx.translate(w / 2, h / 2);
                            ctx.rotate(rot);
                            ctx.fillText(text, 0, 0);
                        } else if (watermarkSelectedPos === 'bottom-right') {
                            ctx.translate(w * 0.85, h * 0.9);
                            ctx.rotate(rot);
                            ctx.fillText(text, 0, 0);
                        } else if (watermarkSelectedPos === 'top-left') {
                            ctx.translate(w * 0.15, h * 0.1);
                            ctx.rotate(rot);
                            ctx.fillText(text, 0, 0);
                        } else if (watermarkSelectedPos === 'tiled') {
                            const stepX = Math.max(120, w / 4) * sizeMultiplier;
                            const stepY = Math.max(120, h / 4) * sizeMultiplier;
                            for (let x = stepX / 2; x < w; x += stepX) {
                                for (let y = stepY / 2; y < h; y += stepY) {
                                    ctx.save();
                                    ctx.translate(x, y);
                                    ctx.rotate(rot);
                                    ctx.fillText(text, 0, 0);
                                    ctx.restore();
                                }
                            }
                        }
                    } else if (watermarkActiveType === 'image' && watermarkLogoImg) {
                        const logoW = watermarkLogoImg.width;
                        const logoH = watermarkLogoImg.height;
                        const baseLogoSize = w * 0.25;
                        const targetW = baseLogoSize * sizeMultiplier;
                        const targetH = (logoH * targetW) / logoW;

                        if (watermarkSelectedPos === 'center') {
                            ctx.translate(w / 2, h / 2);
                            ctx.rotate(rot);
                            ctx.drawImage(watermarkLogoImg, -targetW / 2, -targetH / 2, targetW, targetH);
                        } else if (watermarkSelectedPos === 'bottom-right') {
                            ctx.translate(w - targetW / 2 - 20, h - targetH / 2 - 20);
                            ctx.rotate(rot);
                            ctx.drawImage(watermarkLogoImg, -targetW / 2, -targetH / 2, targetW, targetH);
                        } else if (watermarkSelectedPos === 'top-left') {
                            ctx.translate(targetW / 2 + 20, targetH / 2 + 20);
                            ctx.rotate(rot);
                            ctx.drawImage(watermarkLogoImg, -targetW / 2, -targetH / 2, targetW, targetH);
                        } else if (watermarkSelectedPos === 'tiled') {
                            const stepX = Math.max(180, w / 3) * sizeMultiplier;
                            const stepY = Math.max(180, h / 3) * sizeMultiplier;
                            for (let x = stepX / 2; x < w; x += stepX) {
                                for (let y = stepY / 2; y < h; y += stepY) {
                                    ctx.save();
                                    ctx.translate(x, y);
                                    ctx.rotate(rot);
                                    ctx.drawImage(watermarkLogoImg, -targetW / 2, -targetH / 2, targetW, targetH);
                                    ctx.restore();
                                }
                            }
                        }
                    }
                    ctx.restore();

                    const link = document.createElement('a');
                    link.download = watermarkFile.name.replace(/\.[^/.]+$/, "") + '_Watermarked.png';
                    link.href = outCanvas.toDataURL('image/png');
                    link.click();
                    showStatus('Success!', 2000);
                    notify('Image watermarked successfully.', 'success');
                } else if (watermarkFileType === 'pdf') {
                    const { PDFDocument, rgb, degrees, StandardFonts } = PDFLib;
                    const arrayBuffer = await watermarkFile.arrayBuffer();
                    const pdfDoc = await PDFDocument.load(arrayBuffer);
                    const pages = pdfDoc.getPages();

                    const opacity = parseInt(wmOpacitySlider.value) / 100;
                    const sizeMultiplier = parseInt(wmSizeSlider.value) / 100;
                    const rotationAngle = parseInt(wmRotationSlider.value);

                    let embeddedLogo = null;
                    if (watermarkActiveType === 'image' && watermarkLogoFile) {
                        const logoBuffer = await watermarkLogoFile.arrayBuffer();
                        const extension = watermarkLogoFile.name.split('.').pop().toLowerCase();
                        if (extension === 'png') {
                            embeddedLogo = await pdfDoc.embedPng(logoBuffer);
                        } else {
                            embeddedLogo = await pdfDoc.embedJpg(logoBuffer);
                        }
                    }

                    function hexToRgb(hex) {
                        const r = parseInt(hex.slice(1, 3), 16) / 255;
                        const g = parseInt(hex.slice(3, 5), 16) / 255;
                        const b = parseInt(hex.slice(5, 7), 16) / 255;
                        return { r, g, b };
                    }

                    const cRgb = hexToRgb(wmTextColor.value);

                    for (const page of pages) {
                        const w = page.getWidth();
                        const h = page.getHeight();

                        if (watermarkActiveType === 'text') {
                            const fontName = wmTextFont.value;
                            let activeFont;
                            if (fontName === 'Courier') {
                                activeFont = await pdfDoc.embedFont(StandardFonts.CourierBold);
                            } else if (fontName === 'Times-Roman') {
                                activeFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
                            } else {
                                activeFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
                            }

                            const text = wmTextInput.value || 'CONFIDENTIAL';
                            const baseFontSize = Math.round(w * 0.05);
                            const fontSize = Math.round(baseFontSize * sizeMultiplier);

                            const textWidth = activeFont.widthOfTextAtSize(text, fontSize);
                            const textHeight = fontSize;

                            const drawTextAt = (x, y) => {
                                page.drawText(text, {
                                    x: x,
                                    y: y,
                                    size: fontSize,
                                    font: activeFont,
                                    color: rgb(cRgb.r, cRgb.g, cRgb.b),
                                    rotate: degrees(rotationAngle),
                                    opacity: opacity
                                });
                            };

                            if (watermarkSelectedPos === 'center') {
                                drawTextAt((w - textWidth) / 2, (h - textHeight) / 2);
                            } else if (watermarkSelectedPos === 'bottom-right') {
                                drawTextAt(w - textWidth - 40, 40);
                            } else if (watermarkSelectedPos === 'top-left') {
                                drawTextAt(40, h - textHeight - 40);
                            } else if (watermarkSelectedPos === 'tiled') {
                                const stepX = Math.max(150, w / 3) * sizeMultiplier;
                                const stepY = Math.max(150, h / 3) * sizeMultiplier;
                                for (let x = stepX / 2; x < w; x += stepX) {
                                    for (let y = stepY / 2; y < h; y += stepY) {
                                        drawTextAt(x - textWidth / 2, y - textHeight / 2);
                                    }
                                }
                            }
                        } else if (watermarkActiveType === 'image' && embeddedLogo) {
                            const logoW = embeddedLogo.width;
                            const logoH = embeddedLogo.height;
                            const baseLogoSize = w * 0.25;
                            const targetW = baseLogoSize * sizeMultiplier;
                            const targetH = (logoH * targetW) / logoW;

                            const drawImageAt = (x, y) => {
                                page.drawImage(embeddedLogo, {
                                    x: x,
                                    y: y,
                                    width: targetW,
                                    height: targetH,
                                    rotate: degrees(rotationAngle),
                                    opacity: opacity
                                });
                            };

                            if (watermarkSelectedPos === 'center') {
                                drawImageAt((w - targetW) / 2, (h - targetH) / 2);
                            } else if (watermarkSelectedPos === 'bottom-right') {
                                drawImageAt(w - targetW - 40, 40);
                            } else if (watermarkSelectedPos === 'top-left') {
                                drawImageAt(40, h - targetH - 40);
                            } else if (watermarkSelectedPos === 'tiled') {
                                const stepX = Math.max(180, w / 3) * sizeMultiplier;
                                const stepY = Math.max(180, h / 3) * sizeMultiplier;
                                for (let x = stepX / 2; x < w; x += stepX) {
                                    for (let y = stepY / 2; y < h; y += stepY) {
                                        drawImageAt(x - targetW / 2, y - targetH / 2);
                                    }
                                }
                            }
                        }
                    }

                    const pdfBytes = await pdfDoc.save();
                    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = watermarkFile.name.replace(/\.[^/.]+$/, "") + '_Watermarked.pdf';
                    link.click();
                    showStatus('Success!', 2000);
                    notify('PDF watermarked successfully.', 'success');
                }
            } catch (err) {
                console.error(err);
                notify('Watermark failed.', 'error');
                hideStatus();
            }
        });
    }
}

window.addEventListener('DOMContentLoaded', initWatermarkUI);
