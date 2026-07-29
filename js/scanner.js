// ==============================
// STEP 2: QR SCANNER
// ==============================
async function startQRScanner() {
    try {
        videoStream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'environment',
                width: { ideal: 1920 },
                height: { ideal: 1080 },
                frameRate: { ideal: 30 }
            }
        });

        playSound('scanStart');

        document.getElementById('qrScannerContainer').classList.remove('hidden');
        const video = document.getElementById('qrVideo');
        video.srcObject = videoStream;

        // Wait for video to be ready to check capabilities
        video.onloadedmetadata = () => {
            video.play();
            setupZoomControl(videoStream.getVideoTracks()[0]);
        };

        qrScannerActive = true;
        startQRCodeDetection();

    } catch (error) {
        console.error('Camera error:', error);
        showToast('Camera access denied. Using manual override.', 'error');
        showManualEntry();
    }
}

let initialPinchDistance = null;
let initialPinchZoom = null;

function setupZoomControl(track) {
    const zoomContainer = document.getElementById('zoomControlContainer');
    const zoomSlider = document.getElementById('qrZoomSlider');
    const scannerOverlay = document.getElementById('qrScannerContainer');

    if (!zoomContainer || !zoomSlider || !track || !scannerOverlay) return;

    // Check if the track supports zoom
    const capabilities = track.getCapabilities();

    if (capabilities.zoom) {
        zoomContainer.classList.remove('hidden');

        // Set slider range based on hardware capabilities
        zoomSlider.min = capabilities.zoom.min;
        zoomSlider.max = capabilities.zoom.max;
        zoomSlider.step = capabilities.zoom.step || 0.1;

        // Get current zoom value
        const settings = track.getSettings();
        zoomSlider.value = settings.zoom || capabilities.zoom.min;

        // Function to apply zoom
        const applyZoom = async (value) => {
            try {
                const zoomValue = Math.min(Math.max(value, capabilities.zoom.min), capabilities.zoom.max);
                await track.applyConstraints({
                    advanced: [{ zoom: zoomValue }]
                });
                zoomSlider.value = zoomValue;
            } catch (err) {
                console.error('Error applying zoom:', err);
            }
        };

        // Slider listener
        zoomSlider.oninput = (e) => applyZoom(parseFloat(e.target.value));

        // PINCH TO ZOOM LOGIC
        scannerOverlay.ontouchstart = (e) => {
            if (e.touches.length === 2) {
                e.preventDefault();
                initialPinchDistance = Math.hypot(
                    e.touches[0].pageX - e.touches[1].pageX,
                    e.touches[0].pageY - e.touches[1].pageY
                );
                const currentSettings = track.getSettings();
                initialPinchZoom = currentSettings.zoom || 1;
            }
        };

        scannerOverlay.ontouchmove = (e) => {
            if (e.touches.length === 2 && initialPinchDistance !== null) {
                e.preventDefault();
                const currentDistance = Math.hypot(
                    e.touches[0].pageX - e.touches[1].pageX,
                    e.touches[0].pageY - e.touches[1].pageY
                );

                // Sensitivity factor: how much the zoom changes per pixel of pinch
                // We map the distance ratio to the zoom range
                const zoomDelta = (currentDistance - initialPinchDistance) / 100;
                applyZoom(initialPinchZoom + zoomDelta);
            }
        };

        scannerOverlay.ontouchend = () => {
            initialPinchDistance = null;
            initialPinchZoom = null;
        };

    } else {
        zoomContainer.classList.add('hidden');
        console.log('Zoom not supported by this camera');
    }
}

function stopQRScanner() {
    qrScannerActive = false;

    if (qrScanInterval) {
        clearInterval(qrScanInterval);
        qrScanInterval = null;
    }

    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        videoStream = null;
    }

    const scannerOverlay = document.getElementById('qrScannerContainer');
    if (scannerOverlay) {
        scannerOverlay.ontouchstart = null;
        scannerOverlay.ontouchmove = null;
        scannerOverlay.ontouchend = null;
    }

    // Cleanup OCR worker
    if (window.cleanupOCR) {
        window.cleanupOCR();
    }

    document.getElementById('qrScannerContainer')?.classList.add('hidden');
    document.getElementById('zoomControlContainer')?.classList.add('hidden');
}

function startQRCodeDetection() {
    const video = document.getElementById('qrVideo');
    const canvas = document.getElementById('qrCanvas');
    const context = canvas.getContext('2d', { alpha: false, willReadFrequently: true });

    let ocrWorker = null;
    let lastOCRTime = 0;
    const OCR_INTERVAL = 2000;

    // Fixed internal resolution for consistent performance
    const SCAN_WIDTH = 640;
    const SCAN_HEIGHT = 480;
    canvas.width = SCAN_WIDTH;
    canvas.height = SCAN_HEIGHT;

    Tesseract.createWorker().then(worker => {
        worker.loadLanguage('eng').then(() => {
            worker.initialize('eng').then(() => {
                ocrWorker = worker;
                console.log('[Scanner] AI OCR online');
            });
        });
    });

    qrScanInterval = setInterval(() => {
        if (!qrScannerActive || video.readyState !== video.HAVE_ENOUGH_DATA) return;

        try {
            // Re-sync aspect ratio only if video stream changes significantly
            if (video.videoWidth > 0 && Math.abs(canvas.width - SCAN_WIDTH) > 10) {
                // Optimization: stay at fixed scan resolution for speed
            }

            context.drawImage(video, 0, 0, SCAN_WIDTH, SCAN_HEIGHT);
            const imageData = context.getImageData(0, 0, SCAN_WIDTH, SCAN_HEIGHT);

            // 1. QR Code Look-up
            const code = jsQR(imageData.data, SCAN_WIDTH, SCAN_HEIGHT);
            if (code && code.data) {
                handleQRScanResult(code.data);
                return;
            }

            // 2. Throttled AI OCR (Google Lens style fallback)
            const now = Date.now();
            if (ocrWorker && (now - lastOCRTime) > OCR_INTERVAL) {
                lastOCRTime = now;
                canvas.toBlob(blob => {
                    if (!blob || !qrScannerActive) return;
                    ocrWorker.recognize(blob).then(({ data: { text } }) => {
                        if (!qrScannerActive) return;
                        const detectedText = text.toUpperCase().replace(/\s+/g, '');
                        const matchedPuzzle = PUZZLES.find(p => {
                            const linkId = p.linkid.toUpperCase().replace(/\s+/g, '');
                            return detectedText.includes(linkId);
                        });
                        if (matchedPuzzle) handleQRScanResult(matchedPuzzle.linkid);
                    }).catch(err => console.warn('[Scanner] OCR skip:', err));
                }, 'image/jpeg', 0.8);
            }
        } catch (error) {
            console.error('[Scanner] Critical Error:', error);
        }
    }, 250);

    window.cleanupOCR = () => {
        if (ocrWorker) ocrWorker.terminate();
        ocrWorker = null;
    };
}

// QR Processing State
let processingQR = false;

function handleQRScanResult(qrData) {
    if (processingQR) return;
    processingQR = true;

    console.log('QR Code detected:', qrData);

    let linkId = qrData;
    try {
        if (qrData.includes('linkid=')) {
            try {
                const url = new URL(qrData);
                linkId = url.searchParams.get('linkid');
            } catch (e) {
                const match = qrData.match(/linkid=([^&]*)/i);
                if (match && match[1]) {
                    linkId = match[1];
                }
            }
        }
    } catch (e) {
        console.warn('QR parse error:', e);
    }

    urlLockedPuzzle = PUZZLES.find(p => standardizeString(p.linkid) === standardizeString(linkId));

    if (urlLockedPuzzle) {
        submitToGoogleSheets('QR_SCANNED', {
            linkId: linkId,
            puzzleId: urlLockedPuzzle.id,
            location: urlLockedPuzzle.locationClue // Informative
        });

        showToast('✓ Signal Acquired - Redirecting...', 'success');
        // Brief pause to let user see success status
        setTimeout(() => {
            stopQRScanner();
            showStep(3);
            processingQR = false;
        }, 1500);
    } else {
        console.warn('QR code not recognized:', qrData);
        showToast('❌ Invalid Signal - Access Denied', 'error');

        // Longer pause for error so they can read it before re-scanning
        setTimeout(() => {
            processingQR = false;
        }, 2500);
    }
}
