let PUZZLES = [];
let TEAMS = [];
let MEMES = [];

// ==============================
// GAME STATE
// ==============================
let currentPuzzle = null;
let currentTeam = "";
let currentTeamTid = "";
let sessionId = "";
let urlLockedPuzzle = null;
let currentStep = 1;
let currentMissionLevel = "";
let currentLanguage = "PYTHON";
let isPuzzleActive = false;
let tabSwitchCount = 0;

// Team score and solve tracking
let currentTeamScore = 0;
let currentTeamSolvedPuzzles = new Set();

// Tab switching penalty system
let penaltyActive = false;
let penaltyTimer = null;
let penaltySeconds = 15;
let gameStartTime = null;

// 2-second grace period system
let penaltyDelayTimeout = null;
let graceCountdownInterval = null;

// Puzzle Timer System
let puzzleTimerInterval = null;

// QR Scanner State
let qrScannerActive = false;
let videoStream = null;
let flashActive = false;
let qrScanInterval = null;

// Hint System State
let hintPenaltyActive = false;
let hintPenaltySeconds = 0;
let hintPenaltyTimer = null;
let hintRequestConfirmed = false;
let hintRequestTimeout = null;
let hintTabSwitchDuringPenalty = false;
let hintTabSwitchCount = 0;
let hintDisplayed = false;
let currentPuzzleHint = null;

// Grace period variables
let blurTimeout = null;

// ==============================
// SAVE & LOAD GAME STATE
// ==============================
function saveGameState() {
    const gameState = {
        currentTeam,
        currentTeamTid,
        currentStep,
        currentPuzzleId: currentPuzzle?.id,
        tabSwitchCount,
        urlLockedPuzzleId: urlLockedPuzzle?.id,
        sessionId,
        currentLanguage
    };
    localStorage.setItem(CONFIG.STORAGE_KEYS.gameState, JSON.stringify(gameState));
}

function generateSessionId() {
    return 'SESSION_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function getTeamStorageKey() {
    return currentTeamTid ? currentTeamTid : currentTeam;
}

function loadTeamScoreState() {
    currentTeamScore = 0;
    currentTeamSolvedPuzzles = new Set();

    if (!currentTeam) return;
    try {
        const state = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.scoreState) || '{}');
        const teamKey = getTeamStorageKey();
        if (teamKey && state[teamKey]) {
            currentTeamScore = state[teamKey].score || 0;
            const solvedList = Array.isArray(state[teamKey].solved) ? state[teamKey].solved : [];
            currentTeamSolvedPuzzles = new Set(solvedList);
        }
    } catch (e) {
        console.warn('Could not load team score state:', e);
    }
}

function saveTeamScoreState() {
    if (!currentTeam) return;
    try {
        const state = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.scoreState) || '{}');
        const teamKey = getTeamStorageKey();
        state[teamKey] = {
            score: currentTeamScore,
            solved: Array.from(currentTeamSolvedPuzzles)
        };
        localStorage.setItem(CONFIG.STORAGE_KEYS.scoreState, JSON.stringify(state));
    } catch (e) {
        console.warn('Could not save team score state:', e);
    }
}

function resetTeamScoreState() {
    currentTeamScore = 0;
    currentTeamSolvedPuzzles = new Set();
    if (!currentTeam) return;
    try {
        const state = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.scoreState) || '{}');
        const teamKey = getTeamStorageKey();
        if (teamKey && state[teamKey]) {
            delete state[teamKey];
            localStorage.setItem(CONFIG.STORAGE_KEYS.scoreState, JSON.stringify(state));
        }
    } catch (e) {
        console.warn('Could not reset team score state:', e);
    }
}

function hasSolvedPuzzle(puzzleId) {
    return currentTeamSolvedPuzzles.has(puzzleId);
}

function recordPuzzleSolve(puzzleId, pointsEarned) {
    currentTeamSolvedPuzzles.add(puzzleId);
    currentTeamScore += pointsEarned;
    saveTeamScoreState();
}

function standardizeString(str) {
    return (str || '').toString().replace(/\s+/g, '').toUpperCase();
}

// ==============================
// PUZZLE CHAIN GATE
// ==============================
// A puzzle is only allowed to be scanned/unlocked if it is the NEXT one in the
// chain: its previousPuzzleId must match the player's current progress
// (currentPuzzle.id, or 0 when the chain hasn't started = only XG01 is allowed).
function isPuzzleAllowed(puzzle) {
    if (!puzzle) return false;
    if (isTestTeam()) return true;
    const prevIds = (puzzle.previousPuzzleId || []).map(Number);
    if (prevIds.includes(0)) return true;
    if (hasSolvedPuzzle(puzzle.id)) return true;
    const progressId = currentPuzzle ? currentPuzzle.id : 0;
    return prevIds.includes(progressId);
}

function isTestTeam() {
    return typeof currentTeamTid === 'string' && currentTeamTid.toLowerCase() === 'test_id';
}

function puzzleGateMessage(puzzle) {
    const progressId = currentPuzzle ? currentPuzzle.id : 0;
    if (puzzle && puzzle.id === progressId) {
        return `❌ Access Denied - ${puzzle.linkid} already completed`;
    }
    const prevIds = (puzzle.previousPuzzleId || []).map(Number);
    if (prevIds.includes(0)) {
        return '❌ Access Denied - Start from XG01 first';
    }
    const required = PUZZLES.find(p => prevIds.includes(p.id));
    return `❌ Access Denied - Complete ${required ? required.linkid : 'previous puzzle'} first`;
}

async function sha256(text) {
    const data = new TextEncoder().encode(String(text));
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
