// ==============================
// MEME QR PLAYER — YouTube IFrame API (Infinite Loop)
// ==============================
let memePlayer = null;
let ytApiReadyPromise = null;

// ── Load YouTube IFrame API lazily, with a shared promise ─────────────────────
function ensureYTApiLoaded() {
    if (ytApiReadyPromise) return ytApiReadyPromise;
    ytApiReadyPromise = new Promise((resolve) => {
        if (window.YT && window.YT.Player) { resolve(); return; }
        const tag = document.createElement('script');
        tag.id = 'yt-iframe-api-script';
        tag.src = 'https://www.youtube.com/iframe_api';
        tag.async = true;
        const prevReady = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
            if (typeof prevReady === 'function') prevReady();
            if (window.YT && window.YT.Player) resolve();
        };
        tag.onload = () => {
            if (window.YT && window.YT.Player) resolve();
        };
        document.head.appendChild(tag);
    });
    return ytApiReadyPromise;
}

// Warm the API up during idle so memes open instantly (no network wait)
if ('requestIdleCallback' in window) {
    window.requestIdleCallback(() => ensureYTApiLoaded(), { timeout: 4000 });
} else {
    setTimeout(ensureYTApiLoaded, 3000);
}

// ── URL helpers ───────────────────────────────────────────────────────────────
function extractVideoId(url) {
    const text = String(url || '').trim();
    if (!text) return '';

    const rawIdMatch = text.match(/^[A-Za-z0-9_-]{11}$/);
    if (rawIdMatch) return rawIdMatch[0];

    try {
        const parsed = new URL(text);
        const hostname = parsed.hostname.toLowerCase();

        if (hostname.includes('youtu.be')) {
            return parsed.pathname.slice(1).split(/[/?#]/)[0] || '';
        }

        if (hostname.includes('youtube.com') || hostname.includes('m.youtube.com')) {
            const searchId = parsed.searchParams.get('v');
            if (searchId) return searchId;
            const pathMatch = parsed.pathname.match(/(?:\/embed\/|\/shorts\/|\/watch\/|\/v\/|\/u\/\w\/)([^/?#]+)/);
            if (pathMatch) return pathMatch[1];
        }
    } catch (e) {
        // not a full URL, fall back to regex parsing below
    }

    const regExp = /^.*(?:youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/;
    const match = text.match(regExp);
    return (match && match[1] && match[1].length >= 11) ? match[1].split('/')[0] : '';
}

function normalizeMemeEndTime(start, end) {
    const startTime = Number(start) || 0;
    const endTime = Number(end) || 0;
    return endTime > startTime ? endTime : undefined;
}

// ── Fit a 9:16 player so it COVERS the Pokedex screen ────────────────────────
// Guaranteed crop: 40px top (YT title bar) and 56px bottom (play/pause/skip
// control bar), so no YT chrome is ever visible. The video still fills the
// whole screen edge-to-edge.
const MEME_TOP_CROP    = 40;
const MEME_BOTTOM_CROP = 56;

function fitMemePlayer() {
    const clip = document.getElementById('memeVideoClip');
    const player = document.getElementById('memePlayerDiv');
    if (!clip || !player || clip.clientWidth === 0) return;
    const cw = clip.clientWidth;
    const ch = clip.clientHeight;
    const w = Math.max(cw, (ch + MEME_TOP_CROP + MEME_BOTTOM_CROP) * 9 / 16);
    const h = w * 16 / 9;
    player.style.width  = Math.round(w) + 'px';
    player.style.height = Math.round(h) + 'px';
    player.style.left   = Math.round((cw - w) / 2) + 'px';
    player.style.top    = (-MEME_TOP_CROP) + 'px';
}

// Re-fit whenever the screen area resizes (rotation / orientation change)
(function initFitObserver() {
    const clip = document.getElementById('memeVideoClip');
    if (clip && 'ResizeObserver' in window) {
        new ResizeObserver(() => fitMemePlayer()).observe(clip);
    }
    window.addEventListener('resize', fitMemePlayer);
})();

// ── Player lifecycle ──────────────────────────────────────────────────────────
function destroyMemePlayer() {
    if (memePlayer) {
        try { memePlayer.destroy(); } catch (e) { }
        memePlayer = null;
    }
}

function showMemePlayer(meme) {
    const videoId = extractVideoId(meme?.ytlink || meme?.link || meme?.memeid || '');
    if (!videoId) {
        showToast('Invalid meme link', 'error');
        processingQR = false;
        return;
    }

    const container = document.getElementById('memePlayerContainer');
    const playerDiv = document.getElementById('memePlayerDiv');
    if (!container || !playerDiv) return;

    destroyMemePlayer();
    container.classList.remove('hidden');

    const start = Number(meme?.starttime) || 0;
    const end   = normalizeMemeEndTime(start, meme?.endtime);

    function buildPlayer() {
        memePlayer = new YT.Player('memePlayerDiv', {
            height: '100%',
            width: '100%',
            videoId: videoId,
            playerVars: {
                autoplay:        1,
                controls:        0,
                modestbranding:  1,
                rel:             0,
                showinfo:        0,
                iv_load_policy:  3,
                disablekb:       1,
                playsinline:     1,
                enablejsapi:     1,
                mute:            1,       // mute=1 helps autoplay on modern browsers
                loop:            1,       // native infinite loop
                playlist:        videoId, // required for loop to work in IFrame API
                start:           start,
                end:             end,
                origin:          window.location.origin
            },
            events: {
                onReady: function (e) {
                    e.target.playVideo();
                    setTimeout(() => {
                        try { e.target.unMute(); e.target.setVolume(100); } catch (_) { }
                    }, 150);
                },
                onStateChange: function (e) {
                    if (e.data === YT.PlayerState.ENDED) {
                        try { memePlayer.seekTo(start); memePlayer.playVideo(); } catch (_) { }
                    }
                },
                onError: function (e) {
                    console.warn('YouTube player error:', e.data);
                    showToast('Unable to play meme clip. Please try again later.', 'error');
                    processingQR = false;
                    backToScanner();
                }
            }
        });
    }

    // Size the player to cover the screen first (needs the container laid out),
    // which also crops the YT title/logo bars, then build the player.
    requestAnimationFrame(() => {
        fitMemePlayer();
        ensureYTApiLoaded().then(buildPlayer);
    });
}

function backToScanner() {
    processingQR = false;
    destroyMemePlayer();
    const container = document.getElementById('memePlayerContainer');
    if (container) container.classList.add('hidden');
    const hasTeam = typeof currentTeam !== 'undefined' && currentTeam.trim() !== '';
    const target = hasTeam ? 2 : 0;
    if (typeof showStep === 'function') {
        showStep(target);
    } else if (typeof startQRScanner === 'function') {
        startQRScanner();
    }
}

// First tap on video = unmute
function memeAreaTapped() {
    if (memePlayer && memePlayer.unMute) {
        try { memePlayer.unMute(); memePlayer.setVolume(100); } catch (_) { }
    }
}

window.showMemePlayer  = showMemePlayer;
window.backToScanner   = backToScanner;
window.memeAreaTapped  = memeAreaTapped;
