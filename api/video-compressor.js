// =========================================================================
// VIDEO COMPRESSOR STATE VARIABLES
// =========================================================================
let videoFile = null;
let isCompressing = false;
let isDraggingSlider = false;
let splitRatio = 0.5;
let compressionRecorder = null;
let compressionAudioCtx = null;
let compressionAudioSource = null;
let compressionGainNode = null;
let compressionDestNode = null;
let renderLoopId = null;

// Offscreen canvas for rendering compressed preview side
const offscreenCanvas = document.createElement('canvas');
const offCtx = offscreenCanvas.getContext('2d');

async function ensureAudioRoute() {
    const videoSource = document.getElementById('video-source');
    if (!videoSource) return;

    try {
        if (!compressionAudioCtx) {
            compressionAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (compressionAudioCtx.state === 'suspended') {
            await compressionAudioCtx.resume();
        }
        if (!compressionAudioSource) {
            compressionAudioSource = compressionAudioCtx.createMediaElementSource(videoSource);
            compressionGainNode = compressionAudioCtx.createGain();
            compressionAudioSource.connect(compressionGainNode);
            compressionGainNode.connect(compressionAudioCtx.destination);
        }
        if (compressionGainNode) {
            compressionGainNode.gain.value = videoSource.muted ? 0 : 1;
        }
    } catch (err) {
        console.warn('Audio routing error:', err);
    }
}

// Reusable custom dropdown initializer
function initCustomDropdown(dropdownId, onChangeCallback) {
    const dropdown = document.getElementById(dropdownId);
    if (!dropdown) return;
    const trigger = dropdown.querySelector('.custom-dropdown-trigger');
    const optionsContainer = dropdown.querySelector('.custom-dropdown-options');
    const valueSpan = dropdown.querySelector('.custom-dropdown-value');
    const hiddenInput = dropdown.querySelector('input[type="hidden"]');
    const options = dropdown.querySelectorAll('.custom-dropdown-option');

    if (trigger && optionsContainer) {
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            document.querySelectorAll('.custom-dropdown-options').forEach(el => {
                if (el !== optionsContainer) el.classList.add('hidden');
            });
            optionsContainer.classList.toggle('hidden');
        });
    }

    options.forEach(opt => {
        opt.addEventListener('click', (e) => {
            e.stopPropagation();
            const val = opt.getAttribute('data-value');
            const text = opt.textContent;

            if (hiddenInput) hiddenInput.value = val;
            if (valueSpan) valueSpan.textContent = text;

            options.forEach(o => o.classList.toggle('selected', o === opt));
            if (optionsContainer) optionsContainer.classList.add('hidden');

            if (onChangeCallback) onChangeCallback(val);

            if (hiddenInput) hiddenInput.dispatchEvent(new Event('change'));
        });
    });
}

function formatDuration(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
}

// Target Resolution Calculations
function getTargetDimensions() {
    const videoSource = document.getElementById('video-source');
    const videoCompressResolution = document.getElementById('video-compress-resolution');

    if (!videoSource || !videoSource.videoWidth) return { w: 640, h: 360 };
    const origW = videoSource.videoWidth;
    const origH = videoSource.videoHeight;
    const preset = videoCompressResolution ? videoCompressResolution.value : 'original';

    if (preset === 'original') return { w: origW, h: origH };

    const targetHeight = parseInt(preset);
    const aspectRatio = origW / origH;
    let targetWidth = Math.round(targetHeight * aspectRatio);
    targetWidth = targetWidth + (targetWidth % 2); 
    return { w: targetWidth, h: targetHeight };
}

// Estimator
function updateVideoEstimations() {
    const videoSource = document.getElementById('video-source');
    const videoCompressQualitySlider = document.getElementById('video-compress-quality-slider');
    const videoCompressQualityBadge = document.getElementById('video-compress-quality-badge');
    const videoCompressEstSizeText = document.getElementById('video-compress-est-size');

    if (!videoFile || !videoSource || !videoCompressQualitySlider) return;
    const duration = videoSource.duration || 0;
    const compressionPercent = parseInt(videoCompressQualitySlider.value);
    
    const origBitrateKbps = duration ? Math.floor((videoFile.size * 8) / (duration * 1000)) : 2500;
    const targetBitrateKbps = Math.max(150, Math.round(origBitrateKbps * (1 - compressionPercent / 100)));
    
    let qLabel = "Original / No Compression";
    if (compressionPercent > 0) {
        if (compressionPercent < 30) qLabel = "Low Compression";
        else if (compressionPercent < 60) qLabel = "Medium Compression";
        else qLabel = "High Compression";
    }
    
    if (videoCompressQualityBadge) {
        videoCompressQualityBadge.textContent = compressionPercent === 0 
            ? `${qLabel}` 
            : `${compressionPercent}% (${qLabel} - ${targetBitrateKbps} kbps)`;
    }

    const audioBitrateKbps = videoSource.muted ? 0 : 128;
    const totalBitrateKbps = targetBitrateKbps + audioBitrateKbps;
    
    let estimatedBytes;
    if (compressionPercent === 0) {
        estimatedBytes = videoFile.size;
    } else {
        const sizeInBytes = (totalBitrateKbps * 1024 * duration) / 8;
        estimatedBytes = Math.min(videoFile.size, sizeInBytes * 1.05); // cap at original size
    }
    
    if (videoCompressEstSizeText) videoCompressEstSizeText.textContent = formatBytes(estimatedBytes);
}

function loadVideoFile(file) {
    const videoCompressFilename = document.getElementById('video-compress-filename');
    const videoCompressOrigSizeText = document.getElementById('video-compress-orig-size');
    const videoSource = document.getElementById('video-source');
    const videoCompressDropZone = document.getElementById('video-compress-drop-zone');
    const videoCompressPreviewContainer = document.getElementById('video-compress-preview-container');

    videoFile = file;
    if (videoCompressFilename) videoCompressFilename.textContent = file.name;
    if (videoCompressOrigSizeText) videoCompressOrigSizeText.textContent = formatBytes(file.size);
    
    const fileUrl = URL.createObjectURL(file);
    if (videoSource) {
        videoSource.src = fileUrl;
        videoSource.load();
    }
    
    if (videoCompressDropZone) videoCompressDropZone.classList.add('hidden');
    if (videoCompressPreviewContainer) videoCompressPreviewContainer.classList.remove('hidden');
    notify('Video loaded successfully.', 'success');
}

function updateSliderPosition(clientX) {
    const videoPreviewBox = document.getElementById('video-preview-box');
    const videoComparisonSlider = document.getElementById('video-comparison-slider');

    if (!videoPreviewBox || !videoComparisonSlider) return;

    const rect = videoPreviewBox.getBoundingClientRect();
    let pos = (clientX - rect.left) / rect.width;
    pos = Math.max(0, Math.min(1, pos));
    splitRatio = pos;
    videoComparisonSlider.style.left = `${pos * 100}%`;
    renderComparisonFrame();
}

function renderComparisonFrame() {
    const videoSource = document.getElementById('video-source');
    const videoPreviewCanvas = document.getElementById('video-preview-canvas');

    if (!videoSource || !videoPreviewCanvas || !videoSource.videoWidth || !videoSource.readyState) return;

    const w = videoSource.videoWidth;
    const h = videoSource.videoHeight;
    
    if (videoPreviewCanvas.width !== w || videoPreviewCanvas.height !== h) {
        videoPreviewCanvas.width = w;
        videoPreviewCanvas.height = h;
    }

    const ctx = videoPreviewCanvas.getContext('2d');
    const splitX = splitRatio * w;
    const targetDim = getTargetDimensions();

    ctx.clearRect(0, 0, w, h);

    // Draw Original Video
    ctx.drawImage(videoSource, 0, 0, w, h);

    // Draw compressed side on the right
    ctx.save();
    ctx.beginPath();
    ctx.rect(splitX, 0, w - splitX, h);
    ctx.clip();

    offscreenCanvas.width = targetDim.w;
    offscreenCanvas.height = targetDim.h;
    
    offCtx.drawImage(videoSource, 0, 0, targetDim.w, targetDim.h);
    
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(offscreenCanvas, 0, 0, w, h);
    ctx.restore();

    // Draw Divider Line
    ctx.beginPath();
    ctx.moveTo(splitX, 0);
    ctx.lineTo(splitX, h);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(3, w / 400);
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;
}

function startPlaybackRenderLoop() {
    const videoSource = document.getElementById('video-source');
    if (!videoSource) return;

    if (renderLoopId) cancelAnimationFrame(renderLoopId);
    
    const loop = () => {
        if (!videoSource.paused && !videoSource.ended) {
            renderComparisonFrame();
            renderLoopId = requestAnimationFrame(loop);
        }
    };
    renderLoopId = requestAnimationFrame(loop);
}

function stopVideoPlayback() {
    const videoSource = document.getElementById('video-source');
    const videoBtnPlay = document.getElementById('video-btn-play');

    if (!videoSource) return;

    videoSource.pause();
    if (renderLoopId) {
        cancelAnimationFrame(renderLoopId);
        renderLoopId = null;
    }
    if (videoBtnPlay) {
        videoBtnPlay.innerHTML = '<i data-lucide="play" style="width: 18px; height: 18px;"></i>';
        lucide.createIcons({ root: videoBtnPlay });
    }
}

// =========================================================================
// INIT VIDEO COMPRESSOR EVENT LISTENERS
// =========================================================================
function initVideoCompressorUI() {
    const videoCompressInput = document.getElementById('video-compress-input');
    const videoCompressDropZone = document.getElementById('video-compress-drop-zone');
    const clearVideoCompressBtn = document.getElementById('clear-video-compress');
    const videoSource = document.getElementById('video-source');
    const videoComparisonSlider = document.getElementById('video-comparison-slider');
    const videoPreviewBox = document.getElementById('video-preview-box');
    
    const videoCurrentTimeText = document.getElementById('video-current-time');
    const videoDurationText = document.getElementById('video-duration');
    const videoTimeline = document.getElementById('video-timeline');
    
    const videoBtnPlay = document.getElementById('video-btn-play');
    const videoBtnStepBack = document.getElementById('video-btn-step-back');
    const videoBtnStepPrevFrame = document.getElementById('video-btn-step-prev-frame');
    const videoBtnStepNextFrame = document.getElementById('video-btn-step-next-frame');
    const videoBtnStepForward = document.getElementById('video-btn-step-forward');
    
    const videoBtnMute = document.getElementById('video-btn-mute');
    const videoSpeed = document.getElementById('video-speed');
    const videoCompressResolution = document.getElementById('video-compress-resolution');
    const videoCompressQualitySlider = document.getElementById('video-compress-quality-slider');
    const videoCompressFormat = document.getElementById('video-compress-format');
    const videoCompressBtn = document.getElementById('video-compress-btn');

    const videoCompressProgressContainer = document.getElementById('video-compress-progress-container');
    const videoCompressProgressBar = document.getElementById('video-compress-progress-bar');
    const videoCompressPct = document.getElementById('video-compress-pct');
    const videoCompressEta = document.getElementById('video-compress-eta');

    // Close dropdowns on window click
    window.addEventListener('click', () => {
        document.querySelectorAll('.custom-dropdown-options').forEach(el => el.classList.add('hidden'));
    });

    // Initialize our custom dropdowns
    initCustomDropdown('dropdown-resolution');
    initCustomDropdown('dropdown-format');
    initCustomDropdown('dropdown-speed');

    if (videoCompressInput) {
        if (videoCompressDropZone) videoCompressDropZone.addEventListener('click', () => videoCompressInput.click());
        videoCompressInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                loadVideoFile(e.target.files[0]);
            }
        });
    }

    if (videoCompressDropZone) {
        videoCompressDropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            videoCompressDropZone.classList.add('drag-over');
        });
        videoCompressDropZone.addEventListener('dragleave', () => {
            videoCompressDropZone.classList.remove('drag-over');
        });
        videoCompressDropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            videoCompressDropZone.classList.remove('drag-over');
            if (e.dataTransfer.files.length > 0) {
                const file = e.dataTransfer.files[0];
                if (file.type.startsWith('video/')) {
                    loadVideoFile(file);
                } else {
                    notify('Please select a valid video file.', 'warning');
                }
            }
        });
    }

    if (clearVideoCompressBtn) {
        clearVideoCompressBtn.addEventListener('click', () => {
            const videoCompressPreviewContainer = document.getElementById('video-compress-preview-container');
            stopVideoPlayback();
            videoFile = null;
            if (videoSource) videoSource.src = '';
            if (videoPreviewBox) videoPreviewBox.style.aspectRatio = '';
            if (videoCompressDropZone) videoCompressDropZone.classList.remove('hidden');
            if (videoCompressPreviewContainer) videoCompressPreviewContainer.classList.add('hidden');
            if (videoCompressProgressContainer) videoCompressProgressContainer.classList.add('hidden');
            if (videoCompressProgressBar) videoCompressProgressBar.style.width = '0%';
            if (videoCompressPct) videoCompressPct.textContent = '0%';
            isCompressing = false;
        });
    }

    if (videoComparisonSlider) {
        videoComparisonSlider.addEventListener('mousedown', () => { isDraggingSlider = true; });
        window.addEventListener('mouseup', () => { isDraggingSlider = false; });
        window.addEventListener('mousemove', (e) => {
            if (isDraggingSlider) {
                updateSliderPosition(e.clientX);
            }
        });

        // Touch support
        videoComparisonSlider.addEventListener('touchstart', () => { isDraggingSlider = true; });
        window.addEventListener('touchend', () => { isDraggingSlider = false; });
        window.addEventListener('touchmove', (e) => {
            if (isDraggingSlider && e.touches.length > 0) {
                updateSliderPosition(e.touches[0].clientX);
            }
        });
    }

    if (videoSource) {
        videoSource.addEventListener('loadedmetadata', () => {
            if (videoDurationText) videoDurationText.textContent = formatDuration(videoSource.duration);
            if (videoTimeline) {
                videoTimeline.max = videoSource.duration;
                videoTimeline.value = 0;
            }
            if (videoPreviewBox && videoSource.videoWidth && videoSource.videoHeight) {
                const aspect = videoSource.videoWidth / videoSource.videoHeight;
                videoPreviewBox.style.aspectRatio = aspect;
            }
            if (videoCompressQualitySlider) {
                videoCompressQualitySlider.min = 0;
                videoCompressQualitySlider.max = 90;
                videoCompressQualitySlider.value = 30;
            }
            updateVideoEstimations();
            setTimeout(renderComparisonFrame, 150);
        });

        videoSource.addEventListener('timeupdate', () => {
            if (!isCompressing) {
                if (videoTimeline) videoTimeline.value = videoSource.currentTime;
                if (videoCurrentTimeText) videoCurrentTimeText.textContent = formatDuration(videoSource.currentTime);
                renderComparisonFrame();
            }
        });
    }

    if (videoTimeline) {
        videoTimeline.addEventListener('input', () => {
            if (videoSource) videoSource.currentTime = videoTimeline.value;
            if (videoCurrentTimeText) videoCurrentTimeText.textContent = formatDuration(videoTimeline.value);
            renderComparisonFrame();
        });
    }

    if (videoBtnPlay) {
        videoBtnPlay.addEventListener('click', async () => {
            await ensureAudioRoute();
            if (videoSource.paused || videoSource.ended) {
                videoSource.play();
                videoBtnPlay.innerHTML = '<i data-lucide="pause" style="width: 18px; height: 18px;"></i>';
                startPlaybackRenderLoop();
            } else {
                stopVideoPlayback();
            }
            lucide.createIcons({ root: videoBtnPlay });
        });
    }

    if (videoBtnMute) {
        videoBtnMute.addEventListener('click', async () => {
            if (!videoSource) return;
            videoSource.muted = !videoSource.muted;
            await ensureAudioRoute();
            videoBtnMute.innerHTML = videoSource.muted 
                ? '<i data-lucide="volume-x" style="width: 18px; height: 18px;"></i>' 
                : '<i data-lucide="volume-2" style="width: 18px; height: 18px;"></i>';
            lucide.createIcons({ root: videoBtnMute });
            updateVideoEstimations();
        });
    }

    if (videoSpeed) {
        videoSpeed.addEventListener('change', () => {
            if (videoSource) videoSource.playbackRate = parseFloat(videoSpeed.value);
        });
    }

    if (videoBtnStepBack) {
        videoBtnStepBack.addEventListener('click', () => {
            if (videoSource) videoSource.currentTime = Math.max(0, videoSource.currentTime - 5);
        });
    }
    if (videoBtnStepForward) {
        videoBtnStepForward.addEventListener('click', () => {
            if (videoSource) videoSource.currentTime = Math.min(videoSource.duration, videoSource.currentTime + 5);
        });
    }
    if (videoBtnStepPrevFrame) {
        videoBtnStepPrevFrame.addEventListener('click', () => {
            if (videoSource) videoSource.currentTime = Math.max(0, videoSource.currentTime - 0.04);
        });
    }
    if (videoBtnStepNextFrame) {
        videoBtnStepNextFrame.addEventListener('click', () => {
            if (videoSource) videoSource.currentTime = Math.min(videoSource.duration, videoSource.currentTime + 0.04);
        });
    }

    if (videoCompressResolution) {
        videoCompressResolution.addEventListener('change', () => {
            updateVideoEstimations();
            renderComparisonFrame();
        });
    }

    if (videoCompressQualitySlider) {
        videoCompressQualitySlider.addEventListener('input', () => {
            updateVideoEstimations();
            renderComparisonFrame();
        });
    }

    if (videoCompressBtn) {
        videoCompressBtn.addEventListener('click', async () => {
            if (isCompressing) {
                isCompressing = false;
                if (compressionRecorder) compressionRecorder.stop();
                return;
            }

            if (!videoFile || !videoSource) return;

            isCompressing = true;
            stopVideoPlayback();
            videoCompressBtn.innerHTML = '<i data-lucide="square" style="width: 16px; height: 16px; margin-right: 6px;"></i> Abort Compression';
            lucide.createIcons({ root: videoCompressBtn });
            if (videoCompressProgressContainer) videoCompressProgressContainer.classList.remove('hidden');

            const targetDim = getTargetDimensions();
            const compressionPercent = videoCompressQualitySlider ? parseInt(videoCompressQualitySlider.value) : 30;
            const targetFormat = videoCompressFormat ? videoCompressFormat.value : 'webm';

            const origBitrateKbps = videoSource.duration ? Math.floor((videoFile.size * 8) / (videoSource.duration * 1000)) : 2500;
            const targetBitrateKbps = Math.max(150, Math.round(origBitrateKbps * (1 - compressionPercent / 100)));

            const compCanvas = document.createElement('canvas');
            compCanvas.width = targetDim.w;
            compCanvas.height = targetDim.h;
            const compCtx = compCanvas.getContext('2d');

            const stream = compCanvas.captureStream(30);
            let combinedStream = new MediaStream();
            stream.getVideoTracks().forEach(track => combinedStream.addTrack(track));

            try {
                await ensureAudioRoute();
                if (!compressionDestNode && compressionAudioCtx) {
                    compressionDestNode = compressionAudioCtx.createMediaStreamAudioDestination();
                    if (compressionAudioSource) compressionAudioSource.connect(compressionDestNode);
                }
                if (compressionDestNode) {
                    compressionDestNode.stream.getAudioTracks().forEach(track => combinedStream.addTrack(track));
                }
            } catch (err) {
                console.warn('Audio capture could not be initialized (might be silent or no audio tracks):', err);
            }

            let mimeType = 'video/webm;codecs=vp8';
            if (targetFormat === 'mp4' && MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')) {
                mimeType = 'video/mp4;codecs=avc1';
            } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
                mimeType = 'video/webm;codecs=vp9';
            }

            const recorderOptions = {
                mimeType: mimeType,
                videoBitsPerSecond: targetBitrateKbps * 1024
            };

            const chunks = [];
            
            try {
                compressionRecorder = new MediaRecorder(combinedStream, recorderOptions);
            } catch (e) {
                console.warn('Custom recorder parameters failed, falling back to browser defaults.', e);
                compressionRecorder = new MediaRecorder(combinedStream);
            }

            compressionRecorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) chunks.push(e.data);
            };

            compressionRecorder.onstop = () => {
                isCompressing = false;
                videoCompressBtn.innerHTML = '<i data-lucide="zap" style="width: 16px; height: 16px; margin-right: 6px;"></i> Compress & Download';
                lucide.createIcons({ root: videoCompressBtn });

                if (chunks.length === 0) {
                    notify('Compression aborted or failed.', 'error');
                    return;
                }

                const blob = new Blob(chunks, { type: mimeType });
                const blobUrl = URL.createObjectURL(blob);
                
                const a = document.createElement('a');
                const ext = targetFormat === 'mp4' ? 'mp4' : 'webm';
                a.href = blobUrl;
                a.download = `compressed_${videoFile.name.substring(0, videoFile.name.lastIndexOf('.'))}.${ext}`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                
                notify(`Video compressed to ${formatBytes(blob.size)} successfully!`, 'success');
                if (videoCompressProgressContainer) videoCompressProgressContainer.classList.add('hidden');
                if (videoSource) videoSource.playbackRate = 1.0;
                if (videoSpeed) videoSpeed.value = "1.0";
            };

            videoSource.currentTime = 0;
            videoSource.playbackRate = 2.5; 

            videoSource.play();
            compressionRecorder.start();

            const startTime = Date.now();

            const recordFrame = () => {
                if (!isCompressing) return;

                compCtx.drawImage(videoSource, 0, 0, targetDim.w, targetDim.h);
                
                const progress = videoSource.currentTime / videoSource.duration;
                const pct = Math.min(100, Math.max(0, Math.round(progress * 100)));
                
                if (videoCompressProgressBar) videoCompressProgressBar.style.width = `${pct}%`;
                if (videoCompressPct) videoCompressPct.textContent = `${pct}%`;

                const elapsed = (Date.now() - startTime) / 1000;
                if (pct > 5) {
                    const totalTime = elapsed / (pct / 100);
                    const remaining = Math.max(0, Math.round(totalTime - elapsed));
                    if (videoCompressEta) videoCompressEta.textContent = `Remaining: ~${remaining}s`;
                } else {
                    if (videoCompressEta) videoCompressEta.textContent = `Remaining: Calculating...`;
                }

                if (videoSource.ended || videoSource.currentTime >= videoSource.duration - 0.05) {
                    compressionRecorder.stop();
                    stopVideoPlayback();
                } else {
                    requestAnimationFrame(recordFrame);
                }
            };

            requestAnimationFrame(recordFrame);
        });
    }

    // Toggle visibility and redraw layout when switching tabs (monkeypatched window.switchTab)
    const originalSwitchTab = window.switchTab;
    window.switchTab = function(tabId) {
        if (originalSwitchTab) originalSwitchTab(tabId);
        if (tabId === 'video-compressor') {
            setTimeout(() => {
                lucide.createIcons();
                renderComparisonFrame();
            }, 100);
        } else {
            stopVideoPlayback();
        }
    };

    // Sync desktop sidebar toggle to trigger redraws
    const desktopHistoryBtn = document.getElementById('desktop-history-btn');
    if (desktopHistoryBtn) {
        desktopHistoryBtn.addEventListener('click', () => {
            if (videoFile) setTimeout(renderComparisonFrame, 200);
        });
    }
}

window.addEventListener('DOMContentLoaded', initVideoCompressorUI);
