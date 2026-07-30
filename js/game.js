function getPuzzleQuestion(puzzle) {
    if (!puzzle) return '';
    if (currentLanguage === 'CPP') return puzzle.questionCpp || puzzle.questionPython || '';
    return puzzle.questionPython || puzzle.questionCpp || '';
}

// ==============================
// STEP 1: REGISTRATION
// ==============================
document.getElementById('registrationForm').addEventListener('submit', function (e) {
    e.preventDefault();
    const teamInput = document.getElementById('teamName').value.trim();
    const passwordInput = document.getElementById('teamPassword').value.trim();
    const missionLevel = document.getElementById('missionLevel').value;
    const codeLanguage = document.getElementById('codeLanguage').value;

    if (!teamInput || !passwordInput) {
        showFeedback('registrationFeedback', 'Team name and password are required!', 'error');
        return;
    }

    // Verify team and password
    const foundTeam = TEAMS.find(t => t.team.toLowerCase() === teamInput.toLowerCase());

    if (!foundTeam) {
        showFeedback('registrationFeedback', 'Trainer not found in database!', 'error');
        triggerShake('teamName');
        playSound('error');
        return;
    }

    if (foundTeam.password !== passwordInput) {
        showFeedback('registrationFeedback', 'Incorrect security key!', 'error');
        triggerShake('teamPassword');
        playSound('error');
        return;
    }

    currentTeam = foundTeam.team;
    currentTeamTid = foundTeam.tid || '';
    currentMissionLevel = missionLevel;
    currentLanguage = codeLanguage;
    resetHintForNewTeam();
    gameStartTime = new Date();

    if (!sessionId) {
        sessionId = generateSessionId();
    }

    localStorage.setItem(CONFIG.STORAGE_KEYS.teamInfo, JSON.stringify({
        name: currentTeam,
        tid: currentTeamTid,
        missionLevel,
        language: currentLanguage,
        registeredAt: gameStartTime.toISOString(),
        sessionId: sessionId,
        currentPuzzle: 0
    }));

    submitToGoogleSheets('REGISTRATION', {
        teamName: currentTeam,
        tid: currentTeamTid,
        mission: missionLevel,
        language: currentLanguage
    });

    updateTeamStatus();
    playSound('powerUp');
    document.getElementById('screen')?.classList.add('premium-glow');
    showFeedback('registrationFeedback', `✓ Welcome back, ${currentTeam}`, 'success');

    setTimeout(() => {
        document.getElementById('screen')?.classList.remove('premium-glow');
        showStep(2);
    }, 1200);
});

// ==============================
// STEP 3: UNLOCK VERIFICATION
// ==============================
document.getElementById('unlockForm').addEventListener('submit', function (e) {
    e.preventDefault();
    const code = standardizeString(document.getElementById('unlockCode').value);

    if (!code) {
        showFeedback('unlockFeedback', 'Enter previous answer', 'error');
        return;
    }

    // NEW SYSTEM: Use previousPuzzleId array to link puzzles
    let puzzle = null;

    if (urlLockedPuzzle) {
        // If we have a URL-locked puzzle, validate against its prerequisites
        if (urlLockedPuzzle.previousPuzzleId.includes(0)) {
            // Starting puzzle - check if it has a specific startCode
            if (urlLockedPuzzle.startCode) {
                // Group-specific start code required
                if (standardizeString(urlLockedPuzzle.startCode) === code) {
                    puzzle = urlLockedPuzzle;
                }
            } else {
                // No startCode defined - accept any code (backward compatibility)
                puzzle = urlLockedPuzzle;
            }
        } else {
            // Check if entered code matches ANY of the previous puzzles' answers
            const isValid = urlLockedPuzzle.previousPuzzleId.some(prevId => {
                const prevPuzzle = PUZZLES.find(p => p.id === prevId);
                return prevPuzzle && standardizeString(prevPuzzle.answer) === code;
            });

            if (isValid) {
                puzzle = urlLockedPuzzle;
            }
        }
    } else {
        // No URL lock - search all puzzles
        puzzle = PUZZLES.find(p => {
            if (p.previousPuzzleId.includes(0)) {
                // Starting puzzle - check startCode
                if (p.startCode) {
                    return standardizeString(p.startCode) === code;
                } else {
                    // No startCode - accept any code
                    return true;
                }
            } else {
                // Check if entered code matches ANY of the previous puzzles' answers
                return p.previousPuzzleId.some(prevId => {
                    const prevPuzzle = PUZZLES.find(prev => prev.id === prevId);
                    return prevPuzzle && standardizeString(prevPuzzle.answer) === code;
                });
            }
        });
    }

    if (puzzle) {
        currentPuzzle = puzzle;
        gameStartTime = new Date(); // Reset timer for the specific puzzle 

        const questionEl = document.getElementById('puzzleQuestion');
        if (questionEl) questionEl.textContent = getPuzzleQuestion(puzzle);

        // Safely update clue text (might be in Step 5 or 4)
        const clueEl = document.getElementById('locationClue') || document.getElementById('locationClueText');
        if (clueEl) clueEl.textContent = puzzle.locationClue;

        // Show CSS Pokeball (Mystery State)
        const pokeball = document.getElementById('step4Pokeball');
        if (pokeball) {
            pokeball.classList.remove('hidden');
        }

        // Determine which prerequisite was used
        const unlockedVia = puzzle.previousPuzzleId.includes(0)
            ? 'START'
            : `Puzzle ${puzzle.previousPuzzleId.join(' OR ')}`;

        submitToGoogleSheets('PUZZLE_UNLOCKED', {
            puzzleId: puzzle.id,
            puzzleLink: puzzle.linkid,
            unlockedVia: unlockedVia
        });

        showStep(4);
        playSound('success');
    } else {
        submitToGoogleSheets('UNLOCK_FAILED', {
            wrongCode: code,
            attemptedFor: urlLockedPuzzle ? urlLockedPuzzle.id : 'unknown',
            attemptedLink: urlLockedPuzzle ? urlLockedPuzzle.linkid : 'unknown'
        });
        showFeedback('unlockFeedback', 'Incorrect key', 'error');
        triggerShake('unlockCode');
        playSound('error');
    }
});

// ==============================
// STEP 4: PUZZLE SOLVING - SUBMIT HANDLER
// ==============================
function submitPuzzleAnswer() {
    const answerInput = document.getElementById('puzzleAnswer');
    if (!answerInput) return;

    const answer = answerInput.value.trim().toLowerCase();

    if (!answer) {
        showToast("INPUT REQUIRED", "error");
        return;
    }

    if (!currentPuzzle) {
        showToast("NO PUZZLE LOADED", "error");
        return;
    }

    if (standardizeString(currentPuzzle.answer) === standardizeString(answer)) {
        playSound('victory');
        showToast("SIGNAL DECRYPTED!", "success");

        // Visual flair
        document.getElementById('screen')?.classList.add('premium-glow');
        setTimeout(() => document.getElementById('screen')?.classList.remove('premium-glow'), 2000);

        // Prepare Success Step Data
        const caughtImg = document.getElementById('capturePokemonImg') || document.getElementById('caughtPokemonImg');
        if (caughtImg && currentPuzzle.pokemonId) {
            caughtImg.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${currentPuzzle.pokemonId}.png`;
        }

        const clueText = document.getElementById('locationClue') || document.getElementById('locationClueText');
        const locationCard = document.getElementById('locationCard');
        const nextBtn = document.getElementById('nextSignalBtn');

        if (clueText) {
            clueText.textContent = currentPuzzle.locationClue || "NO SIGNAL SOURCE";
        }

        // Delay move for satisfaction
        const isEnd = !currentPuzzle.locationClue || currentPuzzle.locationClue.toUpperCase() === 'END';
        setTimeout(() => {
            showStep(5);
            playSound('hologram');

            if (isEnd) {
                const locationCard = document.getElementById('locationCard');
                const nextBtn = document.getElementById('nextSignalBtn');
                if (locationCard) locationCard.classList.add('hidden');
                if (nextBtn) nextBtn.classList.add('hidden');

                const completionMessage = document.getElementById('completionMessage');
                if (completionMessage) {
                    completionMessage.classList.remove('hidden');

                    const levelNum = (currentMissionLevel || "L1").split('_')[0].replace('L', '');
                    const levelTitle = document.getElementById('completionLevelTitle');
                    if (levelTitle) levelTitle.textContent = `LEVEL ${levelNum} CHAMPION`;

                    const levelSub = document.getElementById('completionLevelSub');
                    if (levelSub) levelSub.textContent = `YOU HAVE COMPLETED LEVEL ${levelNum}`;

                    const trophyImg = document.getElementById('completionTrophyImg');
                    if (trophyImg) trophyImg.src = 'assets/img/poketropy.png';
                }

                setTimeout(() => flushSessionBuffer(), 100);
                setTimeout(() => triggerFinalCelebration(), 1500);
            } else {
                if (locationCard) locationCard.classList.remove('hidden');
                if (nextBtn) nextBtn.classList.remove('hidden');
            }

            // 🔥 Play Pokemon Cry from PokeAPI assets
            if (currentPuzzle.pokemonId) {
                const cryUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/cries/latest/${currentPuzzle.pokemonId}.ogg`;
                setTimeout(() => playSound(cryUrl, 0.4), 600);
            }
        }, 1200);

        submitToGoogleSheets('SOLVED', {
            puzzleId: currentPuzzle.id,
            team: currentTeam,
            answer: answer
        });

        // Flush buffered events to Google Sheets
        setTimeout(() => flushSessionBuffer(), 500);
    } else {
        playSound('error');
        showToast("DECRYPTION FAILED", "error");

        // Premium Error Effect
        document.getElementById('screen')?.classList.add('glitch-active');
        setTimeout(() => document.getElementById('screen')?.classList.remove('glitch-active'), 400);

        answerInput.value = "";
        triggerShake('puzzleAnswer');

        submitToGoogleSheets('WRONG_ATTEMPT', {
            puzzleId: currentPuzzle.id,
            wrongAnswer: answer
        });
    }
}
// Attach the submit handler
document.getElementById('answerForm').addEventListener('submit', (e) => {
    e.preventDefault(); // Prevent default form submission
    submitPuzzleAnswer();
});

// ==============================
// STEP 5: CONTINUE
// ==============================
function continueToQRScan() {
    // Check if current puzzle is the final one (locationClue is null or "END")
    const isEnd = currentPuzzle && (!currentPuzzle.locationClue || currentPuzzle.locationClue.toUpperCase() === 'END');
    if (isEnd) {
        showToast('🎉 CONGRATULATIONS! You have completed all puzzles!', 'success');
        playSound('victory');

        // Show completion message instead of going to QR scan
        setTimeout(() => {
            showToast('No more puzzles available. Game Complete!', 'success');
        }, 2000);

        return; // Don't proceed to QR scan
    }

    document.getElementById('unlockCode').value = '';
    urlLockedPuzzle = null;
    showStep(2);
}

function backToStep2() {
    showStep(2);
}

// ==============================
// ANTI-CHEAT PROTECTION
// ==============================
function removeBlackout() {
    // Managed by security.js
}

function showAntiCopyToast() {
    // Managed by security.js
}

function togglePasswordVisibility() {
    const pwdInput = document.getElementById('teamPassword');
    const icon = document.getElementById('passwordToggleIcon');
    if (pwdInput && icon) {
        const isPassword = pwdInput.type === 'password';
        pwdInput.type = isPassword ? 'text' : 'password';
        icon.textContent = isPassword ? 'visibility' : 'visibility_off';
    }
}
window.togglePasswordVisibility = togglePasswordVisibility;
