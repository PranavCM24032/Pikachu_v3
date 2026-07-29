// ==============================
// GOOGLE SHEETS INTEGRATION
// ==============================
const SESSION_BUFFER_KEY = 'pykachuSessionBuffer';

function getSessionBuffer() {
    try {
        return JSON.parse(localStorage.getItem(SESSION_BUFFER_KEY) || '[]');
    } catch (e) {
        return [];
    }
}

function addToSessionBuffer(payload) {
    const buffer = getSessionBuffer();
    buffer.push(payload);
    try {
        localStorage.setItem(SESSION_BUFFER_KEY, JSON.stringify(buffer));
    } catch (e) {
        console.warn('[Buffer] Could not save to localStorage:', e);
    }
}

function clearSessionBuffer() {
    try {
        localStorage.removeItem(SESSION_BUFFER_KEY);
    } catch (e) { }
}

function isValidTeam() {
    const name = (typeof currentTeam !== 'undefined' ? currentTeam : '').trim();
    return name && name !== 'Unknown' && name !== 'NO TEAM' && name !== '';
}

async function submitToGoogleSheets(action, data = {}) {
    try {
        const payload = {
            action: action,
            sessionId: sessionId,
            teamName: currentTeam || 'Unknown',
            tid: currentTeamTid || '',
            mission: typeof currentMissionLevel !== 'undefined' ? currentMissionLevel : '',
            puzzleId: currentPuzzle?.id || 0,
            timestamp: new Date().toISOString(),
            ...data
        };
        if (action === 'REGISTRATION') {
            payload.language = currentLanguage || 'PYTHON';
        }

        if (action.includes('HINT')) {
            payload.hintType = 'DECRYPTION_BASED';
            payload.hintPenaltyTime = currentPuzzle?.hintPenalty || 60;
            payload.hintDisplayed = typeof hintDisplayed !== 'undefined' ? hintDisplayed : false;
        }

        // Skip entirely if no valid team (anonymous sessions)
        if (!isValidTeam()) {
            console.log('[Sheets] Skipping — no valid team');
            return;
        }

        // REGISTRATION: send immediately (critical first step)
        if (action === 'REGISTRATION') {
            sendToGoogleSheets(payload);
            return;
        }

        // Everything else: buffer in localStorage, send later in batch
        addToSessionBuffer(payload);

    } catch (error) {
        console.error('CRITICAL: Error queuing submission:', error);
    }
}

async function sendToGoogleSheets(payload) {
    const team = (payload.teamName || '').trim();
    if (!team || team === 'Unknown' || team === 'NO TEAM') {
        console.log('[Sheets] Blocked — invalid team:', team);
        return;
    }
    if (!GOOGLE_SCRIPT_URL || GOOGLE_SCRIPT_URL.includes("SCRIPT_URL_HERE")) {
        console.warn("[Sheets] URL missing. Cannot send.");
        return;
    }
    try {
        await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            cache: 'no-cache',
            keepalive: true,
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        });
        console.log(`[Sheets] Sent: ${payload.action}`);
    } catch (e) {
        console.warn(`[Sheets] Send failed for ${payload.action}:`, e);
    }
}

async function flushSessionBuffer() {
    const buffer = getSessionBuffer();
    if (buffer.length === 0) return;
    if (!isValidTeam()) {
        clearSessionBuffer();
        return;
    }
    if (!GOOGLE_SCRIPT_URL || GOOGLE_SCRIPT_URL.includes("SCRIPT_URL_HERE")) {
        console.warn("[Sheets] URL missing. Keeping buffer for later.");
        return;
    }

    try {
        await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            cache: 'no-cache',
            keepalive: true,
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'SESSION_BATCH', events: buffer, sessionId: sessionId })
        });
        console.log(`[Sheets] Flushed ${buffer.length} events`);
        clearSessionBuffer();
    } catch (e) {
        console.warn('[Sheets] Flush failed, will retry later:', e);
    }
}

// Auto-flush on page unload (sends whatever is buffered)
window.addEventListener('beforeunload', () => {
    if (isValidTeam()) {
        const buffer = getSessionBuffer();
        if (buffer.length > 0) {
            sendToGoogleSheets({ action: 'SESSION_BATCH', events: buffer, sessionId: sessionId });
            clearSessionBuffer();
        }
    }
});