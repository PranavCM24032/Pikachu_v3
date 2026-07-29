// ==============================
// HINT SYSTEM FUNCTIONS
// ==============================
function setupHintSystem() {
    console.log('Setting up hint system...');
    if (!currentPuzzle || !CONFIG.FEATURES.hintSystem) return;

    const hintContainer = document.getElementById('hintContainer');
    const hintRequestBtn = document.getElementById('hintRequestBtn');

    // Attempt to match hint button anywhere in step container if ID is duplicate
    const activeHintBtn = hintRequestBtn || document.querySelector(`#step${currentStep} #hintRequestBtn`);

    if (!hintContainer) return;

    currentPuzzleHint = currentPuzzle.hint;

    // VALIDATION: Handle boolean false specifically
    let isValidHint = false;

    if (typeof currentPuzzleHint === 'boolean') {
        isValidHint = currentPuzzleHint === true; // If strictly true, valid. If false, invalid.
    } else if (typeof currentPuzzleHint === 'string') {
        const lowerHint = currentPuzzleHint.toLowerCase().trim();
        isValidHint = lowerHint !== "none" && lowerHint !== "false" && lowerHint !== "" && lowerHint !== "null";
    }

    // FINAL PROTECTION: If hint is explicitly null or undefined in JSON
    if (currentPuzzleHint === null || currentPuzzleHint === undefined) {
        isValidHint = false;
    }

    if (isValidHint) {
        console.log('Hint detected. Activating UI.');
        hintContainer.classList.remove('hidden');

        // Reset UI Components
        document.getElementById('hintDisplay').classList.add('hidden');
        if (document.getElementById('hintRequestOverlay'))
            document.getElementById('hintRequestOverlay').classList.add('hidden');
        if (document.getElementById('hintPenaltyOverlay'))
            document.getElementById('hintPenaltyOverlay').classList.add('hidden');

        // Show Request Button
        if (activeHintBtn) {
            activeHintBtn.classList.remove('hidden');
            activeHintBtn.style.display = ''; // Clear inline styles
        } else if (hintRequestBtn) {
            hintRequestBtn.classList.remove('hidden');
        }

        // Setup Penalty Display
        const penaltyTime = currentPuzzle.hintPenalty || 60;
        const penaltyTimeEl = document.getElementById('hintPenaltyTime');
        if (penaltyTimeEl) penaltyTimeEl.textContent = `${penaltyTime}`;

        // Load State (Check if already unlocked)
        loadHintState();
    } else {
        console.log('No valid hint available (false/none). Hiding UI.');
        hintContainer.classList.add('hidden');
        if (activeHintBtn) activeHintBtn.classList.add('hidden');
        else if (hintRequestBtn) hintRequestBtn.classList.add('hidden');
    }
}

function loadHintState() {
    const hintState = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.hintState) || '{}');
    const teamKey = `${currentTeam}_${currentPuzzle?.id}`;

    if (currentPuzzle && currentTeam && hintState[teamKey]) {
        currentPuzzle.hintUsed = hintState[teamKey].used || false;
        // Do not auto-show hint on load, user must request it again (no penalty will be charged)
    } else {
        // Reset hint used status for new team
        currentPuzzle.hintUsed = false;
        hintDisplayed = false;
    }
}

function saveHintState() {
    const hintState = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.hintState) || '{}');
    if (currentPuzzle && currentTeam) {
        const teamKey = `${currentTeam}_${currentPuzzle.id}`;
        hintState[teamKey] = {
            used: currentPuzzle.hintUsed || false,
            usedAt: new Date().toISOString(),
            team: currentTeam,
            puzzleId: currentPuzzle.id
        };
        localStorage.setItem(CONFIG.STORAGE_KEYS.hintState, JSON.stringify(hintState));
    }
}

function requestHint() {
    console.log('Hint requested.');
    if (!currentPuzzle) return;

    // Always require confirmation and timer for every request
    const overlay = document.getElementById('hintRequestOverlay');
    const container = document.getElementById('hintContainer');
    if (container) container.classList.remove('hidden'); // Ensure visible
    if (overlay) overlay.classList.remove('hidden');

    // Auto-cancel if ignored
    if (hintRequestTimeout) clearTimeout(hintRequestTimeout);
    hintRequestTimeout = setTimeout(() => {
        cancelHintRequest();
        showToast('Hint request timed out', 'error');
    }, 30000); // 30s timeout
}

function confirmHintRequest() {
    clearTimeout(hintRequestTimeout);

    // Hide confirmation overlay
    document.getElementById('hintRequestOverlay').classList.add('hidden');

    // Start hint penalty
    startHintPenalty();
}

function cancelHintRequest() {
    clearTimeout(hintRequestTimeout);
    document.getElementById('hintRequestOverlay').classList.add('hidden');
    playSound('error');
}

function startHintPenalty() {
    if (hintPenaltyActive) return;

    hintPenaltyActive = true;
    hintTabSwitchDuringPenalty = false;

    // Visibility Check
    const hintContainer = document.getElementById('hintContainer');
    if (hintContainer) hintContainer.classList.remove('hidden');

    // Initialize Timer
    hintPenaltySeconds = (currentPuzzle.hintPenalty && currentPuzzle.hintPenalty > 0) ? currentPuzzle.hintPenalty : 60;

    // Show Overlay
    const penaltyOverlay = document.getElementById('hintPenaltyOverlay');
    const timerDisplay = document.getElementById('hintTimerDisplay');
    const timerRing = document.querySelector('.hint-penalty-timer-ring');
    const warningMsg = document.getElementById('hintWarningMessage');

    if (penaltyOverlay) penaltyOverlay.classList.remove('hidden');
    if (timerDisplay) timerDisplay.textContent = hintPenaltySeconds;
    if (warningMsg) warningMsg.classList.add('hidden');

    // Reset Ring Animation
    if (timerRing) {
        timerRing.style.animation = 'none';
        void timerRing.offsetWidth;
        timerRing.style.animation = `hint-countdown ${hintPenaltySeconds}s linear forwards`;
    }

    // Start Ticking
    if (hintPenaltyTimer) clearInterval(hintPenaltyTimer);
    hintPenaltyTimer = setInterval(updateHintPenaltyTimer, 1000);

    // Start Monitoring
    startHintTabMonitoring();

    submitToGoogleSheets('HINT_REQUESTED', {
        puzzleId: currentPuzzle.id,
        penaltyTime: hintPenaltySeconds
    });

    playSound('hintStart');
}

function updateHintPenaltyTimer() {
    if (!hintPenaltyActive) return;

    hintPenaltySeconds--;

    // Update display
    const timerDisplay = document.getElementById('hintTimerDisplay');
    if (timerDisplay) {
        timerDisplay.textContent = hintPenaltySeconds;
    }

    if (hintPenaltySeconds <= 0) {
        completeHintPenalty();
    }
}

function completeHintPenalty() {
    clearInterval(hintPenaltyTimer);
    hintPenaltyTimer = null;
    hintPenaltyActive = false;

    // Hide penalty overlay
    document.getElementById('hintPenaltyOverlay').classList.add('hidden');

    // Stop tab monitoring
    stopHintTabMonitoring();

    // Show the hint
    showHint();

    // Log hint usage
    submitToGoogleSheets('HINT_USED', {
        puzzleId: currentPuzzle.id,
        hintText: currentPuzzleHint,
        penaltyServed: true,
        tabSwitchesDuringPenalty: hintTabSwitchDuringPenalty
    });

    playSound('hintReveal');
    showToast('Hint unlocked!', 'success');
}

// ==============================
// VISIBILITY MONITORING for HINT
// ==============================
function startHintTabMonitoring() {
    document.addEventListener('visibilitychange', handleHintVisibilityChange);
    window.addEventListener('blur', handleHintWindowBlur);
}

function stopHintTabMonitoring() {
    document.removeEventListener('visibilitychange', handleHintVisibilityChange);
    window.removeEventListener('blur', handleHintWindowBlur);
}

function handleHintVisibilityChange() {
    if (document.hidden && hintPenaltyActive) {
        resetHintPenaltyTimer();
    }
}

function handleHintWindowBlur() {
    if (hintPenaltyActive) {
        // Immediate check or small delay
        setTimeout(() => {
            if (document.hidden || !document.hasFocus()) {
                resetHintPenaltyTimer();
            }
        }, 100);
    }
}

function resetHintPenaltyTimer() {
    if (!hintPenaltyActive) return;

    hintTabSwitchDuringPenalty = true;

    // RESET TIMER to full duration
    hintPenaltySeconds = (currentPuzzle.hintPenalty && currentPuzzle.hintPenalty > 0) ? currentPuzzle.hintPenalty : 60;

    const timerDisplay = document.getElementById('hintTimerDisplay');
    if (timerDisplay) timerDisplay.textContent = hintPenaltySeconds;

    // Show warning message
    const warningMessage = document.getElementById('hintWarningMessage');
    const warningText = document.getElementById('tabSwitchWarning');
    if (warningMessage && warningText) {
        warningText.textContent = 'Tab switch detected! Timer reset.';
        warningMessage.classList.remove('hidden');
    }

    // Reset animation
    const timerRing = document.querySelector('.hint-penalty-timer-ring');
    if (timerRing) {
        timerRing.style.animation = 'none';
        void timerRing.offsetHeight; // Force reflow
        timerRing.style.animation = `hint-countdown ${hintPenaltySeconds}s linear forwards`;
    }

    playSound('penaltyReset');
    console.log('Hint timer reset due to tab switch');
}

function showHint() {
    if (!currentPuzzleHint) return;

    const hintContainer = document.getElementById('hintContainer'); // Ensure parent is visible
    const hintDisplay = document.getElementById('hintDisplay');
    const hintText = document.getElementById('hintText');
    const hintRequestBtn = document.getElementById('hintRequestBtn');

    if (hintContainer) hintContainer.classList.remove('hidden'); // Force visibility

    if (hintDisplay && hintText) {
        hintText.textContent = currentPuzzleHint;
        hintDisplay.classList.remove('hidden');

        // Hide the hint request button
        if (hintRequestBtn) {
            hintRequestBtn.classList.add('hidden');
        }
    }

    hintDisplayed = true;

    // Mark hint as used for this team
    if (currentPuzzle) {
        currentPuzzle.hintUsed = true;
        saveHintState();
    }
}

function closeHintPopup() {
    document.getElementById('hintDisplay').classList.add('hidden');

    // RE-VALIDATE before showing button again
    let isValidHint = false;
    if (currentPuzzle && currentPuzzle.hint) {
        if (typeof currentPuzzle.hint === 'boolean') {
            isValidHint = currentPuzzle.hint === true;
        } else {
            const lower = currentPuzzle.hint.toLowerCase().trim();
            isValidHint = lower !== "none" && lower !== "false" && lower !== "";
        }
    }

    if (isValidHint) {
        const hintRequestBtn = document.getElementById('hintRequestBtn');
        const activeHintBtn = hintRequestBtn || document.querySelector(`#step${currentStep} #hintRequestBtn`);
        if (activeHintBtn) activeHintBtn.classList.remove('hidden');
        else if (hintRequestBtn) hintRequestBtn.classList.remove('hidden');
    }

    hintDisplayed = false;
    // We do NOT reset 'currentPuzzle.hintUsed' here because that tracks SCORING (if they used it at least once).
    // Access is now controlled solely by the button click flow which forces the timer every time.
}

function cleanupHintSystem() {
    if (hintPenaltyTimer) {
        clearInterval(hintPenaltyTimer);
        hintPenaltyTimer = null;
    }

    if (hintRequestTimeout) {
        clearTimeout(hintRequestTimeout);
        hintRequestTimeout = null;
    }

    stopHintTabMonitoring();
    hintPenaltyActive = false;
    hintRequestConfirmed = false;
}

function resetHintForNewTeam() {
    hintDisplayed = false;
    hintPenaltyActive = false;
    hintRequestConfirmed = false;
    hintTabSwitchDuringPenalty = false;

    if (currentPuzzle) {
        currentPuzzle.hintUsed = false;
    }

    // Reset UI elements
    const hintDisplay = document.getElementById('hintDisplay');
    const hintRequestBtn = document.getElementById('hintRequestBtn');
    const hintRequestOverlay = document.getElementById('hintRequestOverlay');
    const hintPenaltyOverlay = document.getElementById('hintPenaltyOverlay');

    if (hintDisplay) hintDisplay.classList.add('hidden');
    if (hintRequestBtn) hintRequestBtn.classList.remove('hidden');
    if (hintRequestOverlay) hintRequestOverlay.classList.add('hidden');
    if (hintPenaltyOverlay) hintPenaltyOverlay.classList.add('hidden');
}

// Ensure global scope access for the close button
window.closeHintPopup = closeHintPopup;
