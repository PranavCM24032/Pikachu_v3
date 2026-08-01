// ==============================
// MEME QR PLAYER — YouTube IFrame API (Infinite Loop)
// ==============================
let memePlayer = null;

// ── Load YouTube IFrame API once ──────────────────────────────────────────────
(function loadYTApi() {
    if (window.YT || document.getElementById('yt-iframe-api-script')) return;
    const tag = document.createElement('script');
    tag.id = 'yt-iframe-api-script';
    tag.src = 'https://www.youtube.com/iframe_api';
    tag.async = true;
    document.head.appendChild(tag);
})();

window.onYouTubeIframeAPIReady = function () { };

// ── URL helpers ───────────────────────────────────────────────────────────────
function extractVideoId(url) {
    const text = String(url || '').trim();
    if (!text) return '';
    const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/;
    const match = text.match(regExp);
    return (match && match[2] && match[2].length >= 11) ? match[2].split('/')[0] : '';
}

// ── Player lifecycle ──────────────────────────────────────────────────────────
function destroyMemePlayer() {
    if (memePlayer) {
        try { memePlayer.destroy(); } catch (e) { }
        memePlayer = null;
    }
}

function showMemePlayer(meme) {
    const videoId = extractVideoId(meme.ytlink);
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

    const start = Number(meme.starttime) || 0;
    const end   = Number(meme.endtime)   || 0;

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
                mute:            1,       // mute=1 guarantees autoplay on all browsers
                loop:            1,       // native infinite loop
                playlist:        videoId, // required for loop to work in IFrame API
                start:           start,
                end:             end > 0 ? end : undefined,
                origin:          window.location.origin
            },
            events: {
                onReady: function (e) {
                    e.target.playVideo();
                    // Try to unmute right after play starts
                    setTimeout(() => {
                        try { e.target.unMute(); e.target.setVolume(100); } catch (_) { }
                    }, 150);
                },
                onStateChange: function (e) {
                    // Backup: if video ends (shouldn't with loop=1), restart manually
                    if (e.data === YT.PlayerState.ENDED) {
                        try { memePlayer.seekTo(start); memePlayer.playVideo(); } catch (_) { }
                    }
                }
            }
        });
    }

    if (window.YT && window.YT.Player) {
        buildPlayer();
    } else {
        const poll = setInterval(() => {
            if (window.YT && window.YT.Player) {
                clearInterval(poll);
                buildPlayer();
            }
        }, 100);
    }
}

function backToScanner() {
    destroyMemePlayer();
    const container = document.getElementById('memePlayerContainer');
    if (container) container.classList.add('hidden');
    if (typeof showStep === 'function') {
        showStep(2);
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
