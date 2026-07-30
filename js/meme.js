// ==============================
// MEME QR PLAYER
// ==============================
let memePlayer = null;
let memeLoopCounter = 0;
const MEME_MAX_LOOPS = 3;

function extractVideoId(url) {
    if (!url) return null;
    let match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/);
    if (match) return match[1];
    match = url.match(/[?&]v=([a-zA-Z0-9_-]+)/);
    if (match) return match[1];
    return url;
}

function loadYouTubeAPI() {
    return new Promise((resolve) => {
        if (window.YT && typeof YT.Player === 'function') {
            resolve();
            return;
        }
        const existing = document.querySelector('script[src*="iframe_api"]');
        if (existing) {
            const check = setInterval(() => {
                if (window.YT && typeof YT.Player === 'function') {
                    clearInterval(check);
                    resolve();
                }
            }, 100);
            return;
        }
        window.onYouTubeIframeAPIReady = resolve;
        const script = document.createElement('script');
        script.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(script);
    });
}

function showMemePlayer(meme) {
    const videoId = extractVideoId(meme.ytlink);
    if (!videoId) {
        showToast('Invalid meme link', 'error');
        processingQR = false;
        return;
    }

    const container = document.getElementById('memePlayerContainer');
    const statusOverlay = document.getElementById('memeStatusOverlay');
    if (!container) return;

    memeLoopCounter = 0;
    container.dataset.videoId = videoId;
    container.dataset.startTime = meme.starttime || 0;
    container.dataset.endTime = meme.endtime || 0;
    container.classList.remove('hidden');
    if (statusOverlay) statusOverlay.classList.add('hidden');

    loadYouTubeAPI().then(() => {
        createMemePlayer(videoId, meme.starttime || 0, meme.endtime || 0);
    });
}

function createMemePlayer(videoId, startTime, endTime) {
    if (memePlayer) {
        try {
            memePlayer.destroy();
        } catch (e) {
            console.warn('Error destroying existing player:', e);
        }
        memePlayer = null;
    }

    let playerElement = document.getElementById('memePlayer');
    if (!playerElement) {
        const playerWrapper = document.querySelector('#memePlayerContainer .flex-1');
        if (playerWrapper) {
            playerElement = document.createElement('div');
            playerElement.id = 'memePlayer';
            playerElement.className = 'w-full h-full';
            playerWrapper.insertBefore(playerElement, playerWrapper.firstChild);
        } else {
            console.error('Meme player container wrapper not found');
            return;
        }
    }

    const playerVars = {
        controls: 0,
        modestbranding: 1,
        rel: 0,
        showinfo: 0,
        iv_load_policy: 3,
        disablekb: 1,
        fs: 0,
        playsinline: 1,
        autoplay: 1,
        start: startTime || 0
    };

    if (endTime && Number(endTime) > 0) {
        playerVars.end = Number(endTime);
    }

    memePlayer = new YT.Player('memePlayer', {
        height: '100%',
        width: '100%',
        videoId: videoId,
        playerVars: playerVars,
        events: {
            onReady: (event) => {
                event.target.setVolume(100);
                event.target.playVideo();
            },
            onStateChange: (event) => {
                if (event.data === YT.PlayerState.ENDED) {
                    memeLoopCounter++;
                    if (memeLoopCounter < MEME_MAX_LOOPS) {
                        event.target.seekTo(startTime || 0, true);
                        event.target.playVideo();
                    } else {
                        const statusOverlay = document.getElementById('memeStatusOverlay');
                        if (statusOverlay) statusOverlay.classList.remove('hidden');
                    }
                }
            },
            onError: (event) => {
                console.error('YouTube Player Error:', event.data);
                showToast('Meme playback error', 'error');
            }
        }
    });
}

function destroyMemePlayer() {
    if (memePlayer) {
        try {
            memePlayer.stopVideo();
            memePlayer.destroy();
        } catch (e) {
            console.warn('Error destroying player:', e);
        }
        memePlayer = null;
    }
    memeLoopCounter = 0;
}

function backToScanner() {
    destroyMemePlayer();
    const container = document.getElementById('memePlayerContainer');
    if (container) container.classList.add('hidden');
    startQRScanner();
}

window.showMemePlayer = showMemePlayer;
window.backToScanner = backToScanner;
