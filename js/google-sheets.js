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
            puzzleLevel: currentPuzzle?.level,
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
            console.log('[Sheets] Skipping — no valid team set');
            return;
        }

        // Send immediately in real-time; buffer ONLY if the send fails so the
        // 10s flush / unload retry never duplicates events that already reached the sheet.
        const sent = await sendToGoogleSheets(payload);
        if (!sent) {
            addToSessionBuffer(payload);
            console.log(`[Sheets] Buffered ${action} for retry`);
        }

    } catch (error) {
        console.error('CRITICAL: Error submitting telemetry:', error);
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
        return false;
    }
    try {
        await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            cache: 'no-cache',
            keepalive: true,
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ ...payload, token: GOOGLE_SCRIPT_TOKEN })
        });
        console.log(`[Sheets] Sent: ${payload.action}`);
        return true;
    } catch (e) {
        console.warn(`[Sheets] Send failed for ${payload.action}:`, e);
        return false;
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
            body: JSON.stringify({ action: 'SESSION_BATCH', events: buffer, sessionId: sessionId, token: GOOGLE_SCRIPT_TOKEN })
        });
        console.log(`[Sheets] Flushed ${buffer.length} buffered events`);
        clearSessionBuffer();
    } catch (e) {
        console.warn('[Sheets] Flush failed, will retry later:', e);
    }
}

// Auto-flush buffer every 10 seconds for extra reliability
setInterval(() => {
    if (isValidTeam()) {
        flushSessionBuffer();
    }
}, 10000);

// Auto-flush on page unload (sends whatever is buffered)
window.addEventListener('beforeunload', () => {
    if (isValidTeam()) {
        const buffer = getSessionBuffer();
        if (buffer.length > 0) {
            fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors',
                cache: 'no-cache',
                keepalive: true,
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: 'SESSION_BATCH', events: buffer, sessionId: sessionId, token: GOOGLE_SCRIPT_TOKEN })
            }).catch(() => { });
            clearSessionBuffer();
        }
    }
});