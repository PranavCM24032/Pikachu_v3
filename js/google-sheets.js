// ==============================
// GOOGLE SHEETS INTEGRATION
// ==============================
let submissionQueue = [];
let isSubmitting = false;

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

async function submitToGoogleSheets(action, data = {}) {
    try {
        const payload = {
            action: action,
            sessionId: sessionId,
            teamName: currentTeam || 'Unknown',
            mission: typeof currentMissionLevel !== 'undefined' ? currentMissionLevel : '',
            language: currentLanguage || 'PYTHON',
            puzzleId: currentPuzzle?.id || 0,
            timestamp: new Date().toISOString(),
            ...data
        };

        // Add hint-specific data detail
        if (action.includes('HINT')) {
            payload.hintType = 'DECRYPTION_BASED';
            payload.hintPenaltyTime = currentPuzzle?.hintPenalty || 60;
            payload.hintDisplayed = typeof hintDisplayed !== 'undefined' ? hintDisplayed : false;
        }

        // Add to queue with retry count
        submissionQueue.push({ payload, retries: 0 });

        processSubmissionQueue();

    } catch (error) {
        console.error('CRITICAL: Error queuing submission:', error);
    }
}

async function processSubmissionQueue() {
    if (isSubmitting || submissionQueue.length === 0) return;

    isSubmitting = true;

    try {
        while (submissionQueue.length > 0) {
            // Peek at the first item
            const currentItem = submissionQueue[0];

            // Check for valid URL before attempting
            if (!GOOGLE_SCRIPT_URL || GOOGLE_SCRIPT_URL.includes("SCRIPT_URL_HERE")) {
                console.warn("Google Script URL is missing or invalid. Data cannot be synced.");
                // Remove to prevent infinite loop
                submissionQueue.shift();
                continue;
            }

            try {
                // Attempt to send
                await fetch(GOOGLE_SCRIPT_URL, {
                    method: 'POST',
                    mode: 'no-cors', // standard for Google Sheets Logging
                    cache: 'no-cache',
                    keepalive: true, // Crucial for data on unload
                    headers: {
                        'Content-Type': 'text/plain;charset=utf-8', // GAS prefers text/plain for no-cors
                    },
                    body: JSON.stringify(currentItem.payload)
                });

                // Assume success if no network error (no-cors is opaque)
                console.log(`[Sync] Data submitted: ${currentItem.payload.action}`);
                submissionQueue.shift(); // Remove on success

            } catch (networkError) {
                console.error('[Sync] Network error:', networkError);

                currentItem.retries++;
                if (currentItem.retries >= MAX_RETRIES) {
                    console.error(`[Sync] Max retries reached for ${currentItem.payload.action}. Dropping.`);
                    submissionQueue.shift(); // Give up
                } else {
                    console.log(`[Sync] Retrying... (${currentItem.retries}/${MAX_RETRIES})`);
                    // Wait before retry
                    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * currentItem.retries));
                    break; // Break the while loop to retry in next cycle or after delay
                }
            }

            // Small buffer between requests
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    } catch (uncaughtError) {
        console.error('[Sync] Queue processing error:', uncaughtError);
    } finally {
        isSubmitting = false;
        // If queue not empty (e.g. paused due to error), try again slowly
        if (submissionQueue.length > 0) {
            setTimeout(processSubmissionQueue, 2000);
        }
    }
}
